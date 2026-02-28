// Pixel Diver - p5.js version

let diverImg1, diverImg2;
let swimTitle;
let swimmingSound;
let drowningSound;
let crashSound;
let deathSound;
let currentFrame = 0;
let x, y;
let vx = 0, vy = 0;
let angle = 0;
let scaleX = 1;

const SPEED = 220;
const ACCEL = 420;
const DECEL = 280;
const MAX_TILT = 28;
const DW = 200, DH = 95;

let keys = { up: false, down: false, left: false, right: false };

// Health and Oxygen
let health = 100;
let oxygen = 100;
let oxygenLeaking = false;
const OXYGEN_DRAIN_RATE = 8; // per second when leaking (faster)
const HEALTH_DRAIN_RATE = 10; // per second when no oxygen

// Iceberg
let icebergX, icebergY;
let icebergWidth = 300;
let icebergHeight = 600;
let isDead = false;
let showLeakWarning = false;
let leakWarningTime = 0;

// High pressure
let highPressure = false;
let pressureWarningTime = 0;
const PRESSURE_DAMAGE_RATE = 5; // health per second in deep water

// Bubble system
let bubbles = [];

// Audio ready flag
let audioReady = false;
let gameStarted = false;

// Objectives
let objectives = {
    suffocate: false,
    highPressure: false
};
let deathCause = null;
let showVictory = false;

function preload() {
    diverImg1 = loadImage('water_assets/11280.png');
    diverImg2 = loadImage('water_assets/11281.png');
    swimmingSound = loadSound('water_assets/Slow Breaststroke Swimming  Sound Effect.mp3');
    drowningSound = loadSound('water_assets/drowning.mp3');
    crashSound = loadSound('water_assets/metallic_clash.wav');
    swimTitle = loadImage('water_assets/die-beneath-swim.png');
    deathSound = loadSound('assets/death.wav');
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    x = width / 2 - DW / 2;
    y = height / 2 - DH / 2;

    // Position iceberg on right side from top
    icebergX = width - icebergWidth - 100;
    icebergY = -100; // Start from top

    // Setup swimming sound
    swimmingSound.setVolume(0.3);

    // Setup drowning sound
    drowningSound.setVolume(0.5);

    // Initialize bubbles
    bubbles = [
        { size: 8, offsetX: 2, delay: 0, dur: 4.5, drift: -4, life: 0 },
        { size: 6, offsetX: -4, delay: 1.0, dur: 4.0, drift: 6, life: 0 },
        { size: 10, offsetX: 6, delay: 1.8, dur: 5.0, drift: -8, life: 0 },
        { size: 5, offsetX: -2, delay: 3.0, dur: 3.8, drift: 3, life: 0 },
        { size: 7, offsetX: 4, delay: 2.5, dur: 4.2, drift: -5, life: 0 }
    ];
}

function draw() {
    // Show start screen
    if (!gameStarted) {
        background(168, 216, 234);
        fill(0, 0, 0, 100);
        rect(0, 0, width, height);
        fill(255);
        textAlign(CENTER, CENTER);
        textSize(48);
        text('DIE BENEATH THE SURFACE', width / 2, height / 2 - 100);
        textSize(32);
        text('Die under-water', width / 2, height / 2 - 50);
        textSize(24);
        text('Click to Start', width / 2, height / 2 + 20);
        textSize(16);
        text('Use WASD or Arrow Keys to swim', width / 2, height / 2 + 60);

        // Show objectives
        textSize(18);
        textAlign(LEFT, TOP);
        fill(255, 255, 255, 200);
        text('Mission Objectives:', width / 2 - 120, height / 2 + 110);
        text('[ ] Die from Suffocation', width / 2 - 120, height / 2 + 140);
        text('[ ] Die from High Pressure', width / 2 - 120, height / 2 + 170);
        return;
    }

    // Ocean gradient background
    drawOceanGradient();

    // Caustics effect
    drawCaustics();

    // Update physics
    updatePhysics();

    push();
    // Camera follows diver vertically when going deep
    let cameraY = 0;
    if (y > height / 2) {
        cameraY = -(y - height / 2);
    }
    translate(0, cameraY);

    // Draw shadow
    drawShadow();

    // Draw title image at the top
    if (swimTitle) {
        push();
        imageMode(CENTER);
        image(swimTitle, width / 2, 200, swimTitle.width * 2, swimTitle.height * 2);
        pop();
    }

    // Draw iceberg
    drawIceberg();

    // Draw diver
    drawDiver();

    // Draw bubbles
    drawBubbles();

    pop();

    // Draw UI (not affected by camera)
    drawUI();
}

function drawOceanGradient() {
    // Extended gradient for much deeper water
    let maxDepth = height * 5;
    let cameraY = y > height / 2 ? -(y - height / 2) : 0;

    for (let i = 0; i < height; i++) {
        let worldY = i - cameraY;
        let inter = worldY / maxDepth;
        inter = constrain(inter, 0, 1);
        let c = lerpColor(color(168, 216, 234), color(10, 20, 50), inter);
        stroke(c);
        line(0, i, width, i);
    }
}

function drawCaustics() {
    push();
    noStroke();
    fill(255, 255, 255, 10);
    let offset = (frameCount * 0.5) % 80;
    for (let i = -80; i < width + 80; i += 80) {
        beginShape();
        vertex(i + offset, 0);
        vertex(i + 40 + offset, 0);
        vertex(i + 60 + offset, height);
        vertex(i + 20 + offset, height);
        endShape(CLOSE);
    }
    pop();
}

function updatePhysics() {
    if (isDead) {
        // Stop all sounds when dead
        if (swimmingSound.isPlaying()) {
            swimmingSound.pause();
        }
        if (drowningSound.isPlaying()) {
            drowningSound.stop();
        }
        return; // Stop physics when dead
    }

    let dt = deltaTime / 1000;
    dt = min(dt, 0.05);

    // Drain oxygen if leaking
    if (oxygenLeaking) {
        oxygen -= OXYGEN_DRAIN_RATE * dt;
        oxygen = max(0, oxygen);

        // Play drowning sound when leaking
        if (!drowningSound.isPlaying()) {
            drowningSound.loop();
        }

        // If oxygen runs out, player dies immediately
        if (oxygen <= 0) {
            isDead = true;
            deathCause = 'suffocate';
            objectives.suffocate = true;
            if (deathSound) deathSound.play();
        }
    } else {
        // Stop drowning sound when not leaking
        if (drowningSound.isPlaying()) {
            drowningSound.stop();
        }
    }

    // Input direction
    let ix = 0, iy = 0;
    if (keys.right) ix += 1;
    if (keys.left) ix -= 1;
    if (keys.down) iy += 1;
    if (keys.up) iy -= 1;

    // Normalize diagonal
    if (ix !== 0 && iy !== 0) {
        ix *= 0.707;
        iy *= 0.707;
    }

    // Accelerate/decelerate
    if (ix !== 0) {
        vx += ix * ACCEL * dt;
    } else {
        let drag = DECEL * dt;
        if (abs(vx) <= drag) vx = 0;
        else vx -= Math.sign(vx) * drag;
    }

    if (iy !== 0) {
        vy += iy * ACCEL * dt;
    } else {
        let drag = DECEL * dt;
        if (abs(vy) <= drag) vy = 0;
        else vy -= Math.sign(vy) * drag;
    }

    // Clamp speed
    vx = constrain(vx, -SPEED, SPEED);
    vy = constrain(vy, -SPEED, SPEED);

    // Control swimming sound based on movement
    let isMoving = abs(vx) > 10 || abs(vy) > 10;
    if (isMoving && gameStarted) {
        if (!swimmingSound.isPlaying()) {
            swimmingSound.loop();
        }
    } else {
        if (swimmingSound.isPlaying()) {
            swimmingSound.pause();
        }
    }

    // Move
    x += vx * dt;
    y += vy * dt;

    // Wrap horizontally
    if (x > width + 10) x = -DW;
    if (x < -DW - 10) x = width;

    // Clamp vertically (much bigger downward map - 5x screen height)
    y = constrain(y, 10, height * 5 - DH - 10);

    // Check for high pressure (deep water - starts at 1.5x screen height)
    if (y > height * 1.5) {
        if (!highPressure) {
            highPressure = true;
            pressureWarningTime = millis();
        }
    } else {
        highPressure = false;
    }

    // Drain health from high pressure (increases with depth)
    if (highPressure) {
        let depthFactor = (y - height * 1.5) / (height * 3.5);
        depthFactor = constrain(depthFactor, 0, 1);
        let damageRate = PRESSURE_DAMAGE_RATE * (1 + depthFactor * 3); // Up to 4x damage at max depth
        health -= damageRate * dt;
        health = max(0, health);
        if (health <= 0) {
            isDead = true;
            deathCause = 'highPressure';
            objectives.highPressure = true;
            if (deathSound) deathSound.play();
        }
    }

    // Check collision with iceberg
    checkIcebergCollision();

    // Flip direction
    if (vx > 10) scaleX = -1;
    else if (vx < -10) scaleX = 1;

    // Tilt angle
    let speedRatio = abs(vy) / SPEED;
    let targetAngle = Math.sign(vy) * speedRatio * MAX_TILT;
    angle += (targetAngle - angle) * 8 * dt;
}

function drawShadow() {
    let depth = y / height;
    let shadowX = x + DW / 2;
    let shadowY = min(height - 18, y + DH + 8 + depth * 25);
    let shadowOpacity = max(0, 0.38 - depth * 0.28);

    push();
    noStroke();
    fill(70, 140, 175, shadowOpacity * 255);
    ellipse(shadowX, shadowY, 100, 10);
    pop();
}

function drawDiver() {
    // Animate swimming when moving
    let isMoving = abs(vx) > 10 || abs(vy) > 10;
    if (isMoving) {
        // Switch frame every 0.2 seconds when moving
        if (frameCount % 12 === 0) {
            currentFrame = 1 - currentFrame;
        }
    }

    let currentImg = currentFrame === 0 ? diverImg1 : diverImg2;

    push();
    translate(x + DW / 2, y + DH / 2);
    scale(scaleX, 1);
    rotate(radians(scaleX * angle));
    imageMode(CENTER);
    image(currentImg, 0, 0, DW, DH);
    pop();
}

function drawBubbles() {
    let time = millis() / 1000;

    for (let b of bubbles) {
        let t = (time - b.delay) % b.dur;
        if (t < 0) continue;

        let progress = t / b.dur;
        let bubbleX = x + 20 + b.offsetX + lerp(0, b.drift, progress);
        let bubbleY = y + 20 - progress * 90;
        let bubbleSize = lerp(b.size * 0.5, b.size * 1.1, progress);
        let opacity = progress < 0.1 ? map(progress, 0, 0.1, 0, 0.85) :
            progress > 0.85 ? map(progress, 0.85, 1, 0.5, 0) : 0.85;

        push();
        noFill();
        stroke(255, 255, 255, opacity * 165);
        strokeWeight(1.5);
        ellipse(bubbleX, bubbleY, bubbleSize);

        // Inner highlight
        noStroke();
        fill(255, 255, 255, opacity * 230);
        ellipse(bubbleX - bubbleSize * 0.15, bubbleY - bubbleSize * 0.15, bubbleSize * 0.3);
        pop();
    }
}

function drawUI() {
    push();

    // Depth indicator (top left)
    let depth = floor((y / height) * 100);
    textAlign(LEFT, TOP);
    textSize(14);
    fill(255, 255, 255, 217);
    text('DEPTH', 20, 80);

    push();
    stroke(2);
    textSize(24);
    fill(150, 200, 255);
    if (highPressure) {
        fill(255, 150, 0); // Orange when in high pressure
    }
    text(depth + 'm', 20, 100);
    pop();

    // Health bar (top left, below depth)
    textAlign(LEFT, TOP);
    textSize(12);
    fill(255, 255, 255, 217);
    text('HEALTH', 20, 140);

    noFill();
    stroke(255, 255, 255, 100);
    strokeWeight(2);
    rect(20, 160, 200, 20, 3);

    noStroke();
    fill(220, 50, 50);
    rect(20, 160, 200 * (health / 100), 20, 3);

    // Oxygen bar (top left, below health)
    textAlign(LEFT, TOP);
    textSize(12);
    fill(255, 255, 255, 217);
    text('OXYGEN', 20, 200);

    noFill();
    stroke(255, 255, 255, 100);
    strokeWeight(2);
    rect(20, 220, 200, 20, 3);

    noStroke();
    fill(30, 60, 120); // Dark blue
    rect(20, 220, 200 * (oxygen / 100), 20, 3);

    // Objectives checklist (top right, below oxygen)
    push();
    // Background box for objectives
    noStroke();
    fill(0, 0, 0, 100);
    rect(width - 240, 75, 220, 90, 5);

    textAlign(LEFT, TOP);
    textSize(16);
    fill(255, 255, 255, 255);
    text('OBJECTIVES', width - 225, 85);

    textSize(14);
    if (objectives.suffocate) {
        fill(50, 255, 50);
        text('[X] Suffocate', width - 225, 115);
    } else {
        fill(255, 255, 255, 200);
        text('[ ] Suffocate', width - 225, 115);
    }

    if (objectives.highPressure) {
        fill(50, 255, 50);
        text('[X] High Pressure', width - 225, 145);
    } else {
        fill(255, 255, 255, 200);
        text('[ ] High Pressure', width - 225, 145);
    }
    pop();

    // --- Home Button ---
    let homeBtnX = 20;
    let homeBtnY = 20;
    let homeBtnW = 100;
    let homeBtnH = 40;

    push();
    fill(0, 150);
    stroke(255, 100);
    strokeWeight(2);
    rect(homeBtnX, homeBtnY, homeBtnW, homeBtnH, 5);

    noStroke();
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(16);
    text("HOME", homeBtnX + homeBtnW / 2, homeBtnY + homeBtnH / 2);

    // Hint text background
    fill(0, 100);
    rect(homeBtnX + homeBtnW + 10, homeBtnY + 5, 230, 30, 5);

    // Hint text
    textSize(12);
    textAlign(LEFT, CENTER);
    fill(255, 200);
    text("'hints' available on home screen", homeBtnX + homeBtnW + 20, homeBtnY + homeBtnH / 2);
    pop();

    // Warning text if leaking
    if (showLeakWarning && millis() - leakWarningTime < 3000) {
        textAlign(CENTER, CENTER);
        let alpha = 255;
        if (millis() - leakWarningTime > 2500) {
            alpha = map(millis() - leakWarningTime, 2500, 3000, 255, 0);
        }

        // Pulsing effect
        let pulseSize = 72 + sin(millis() * 0.01) * 8;

        // Shadow
        fill(0, 0, 0, alpha * 0.5);
        textSize(pulseSize + 4);
        text('OXYGEN LEAK!', width / 2 + 4, height / 2 + 4);

        // Main text
        fill(255, 50, 50, alpha);
        textSize(pulseSize);
        text('OXYGEN LEAK!', width / 2, height / 2);
    } else if (oxygenLeaking && oxygen > 0) {
        textAlign(CENTER, TOP);
        fill(255, 50, 50);
        textSize(16);
        text('⚠ OXYGEN LEAK ⚠', width / 2, 70);
    }

    // High pressure warning
    if (highPressure && health > 0) {
        textAlign(CENTER, TOP);
        fill(255, 150, 0);
        textSize(16);
        let pulseAlpha = 200 + sin(millis() * 0.01) * 55;
        fill(255, 150, 0, pulseAlpha);

        // Show depth
        let depth = floor((y / height) * 100);
        text(`⚠ HIGH PRESSURE ⚠ DEPTH: ${depth}m`, width / 2, 95);

        // Show large warning on first entry
        if (millis() - pressureWarningTime < 3000) {
            textAlign(CENTER, CENTER);
            let alpha = 255;
            if (millis() - pressureWarningTime > 2500) {
                alpha = map(millis() - pressureWarningTime, 2500, 3000, 255, 0);
            }

            let pulseSize = 64 + sin(millis() * 0.01) * 6;

            // Shadow
            fill(0, 0, 0, alpha * 0.5);
            textSize(pulseSize + 4);
            text('HIGH PRESSURE!', width / 2 + 4, height / 2 + 64);

            // Main text
            fill(255, 150, 0, alpha);
            textSize(pulseSize);
            text('HIGH PRESSURE!', width / 2, height / 2 + 60);
        }
    }

    // Death message
    if (isDead) {
        textAlign(CENTER, CENTER);
        fill(0, 0, 0, 150);
        rect(0, 0, width, height);

        // Check if both objectives completed
        if (objectives.suffocate && objectives.highPressure) {
            showVictory = true;
        }

        if (showVictory) {
            // Victory screen
            fill(50, 255, 50);
            textSize(64);
            text('YOU ARE FINALLY DEAD!', width / 2, height / 2 - 80);

            fill(255, 255, 255);
            textSize(24);
            text('You have experienced all underwater deaths!', width / 2, height / 2 - 20);

            textSize(20);
            text('✓ Suffocated', width / 2, height / 2 + 30);
            text('✓ Crushed by Pressure', width / 2, height / 2 + 60);

            textSize(18);
            fill(255, 255, 255, 200);
            text('Click to return to home', width / 2, height / 2 + 110);
        } else {
            // Death screen with objective
            fill(255, 50, 50);
            textSize(48);
            if (deathCause === 'suffocate') {
                text('SUFFOCATED!', width / 2, height / 2 - 60);
            } else if (deathCause === 'highPressure') {
                text('CRUSHED BY PRESSURE!', width / 2, height / 2 - 60);
            }

            fill(255, 255, 255);
            textSize(20);
            text('Press R to try another death', width / 2, height / 2 + 20);

            // Show objectives checklist
            textSize(18);
            textAlign(LEFT, TOP);
            fill(255, 255, 255, 200);
            text('Objectives:', width / 2 - 150, height / 2 + 80);

            if (objectives.suffocate) {
                fill(50, 255, 50);
                text('☑ Die from Suffocation', width / 2 - 150, height / 2 + 110);
            } else {
                fill(255, 255, 255, 150);
                text('☐ Die from Suffocation', width / 2 - 150, height / 2 + 110);
            }

            if (objectives.highPressure) {
                fill(50, 255, 50);
                text('☑ Die from High Pressure', width / 2 - 150, height / 2 + 140);
            } else {
                fill(255, 255, 255, 150);
                text('☐ Die from High Pressure', width / 2 - 150, height / 2 + 140);
            }
        }

        pop();
        return;
    }

    // Hint text
    fill(255, 255, 255, 217);
    textAlign(CENTER, TOP);
    textSize(12);
    noStroke();
    fill(0, 0, 0, 38);
    rect(width / 2 - 100, 18, 200, 24, 2);
    fill(255, 255, 255, 217);
    text('← WASD · ARROWS → SWIM', width / 2, 24);

    // Speed bar
    let totalSpeed = sqrt(vx * vx + vy * vy) / SPEED;
    let speedPercent = min(1, totalSpeed);

    textAlign(LEFT, CENTER);
    textSize(11);
    fill(255, 255, 255, 178);
    text('SPD', width / 2 - 60, height - 22);

    noFill();
    stroke(255, 255, 255, 51);
    strokeWeight(1);
    rect(width / 2 - 30, height - 27, 80, 5, 3);

    noStroke();
    fill(255, 255, 255, 191);
    rect(width / 2 - 30, height - 27, 80 * speedPercent, 5, 3);

    // Key indicators
    drawKeyIndicator(width / 2 - 16, height - 83, '▲', keys.up);
    drawKeyIndicator(width / 2 - 48, height - 51, '◀', keys.left);
    drawKeyIndicator(width / 2 - 16, height - 51, '▼', keys.down);
    drawKeyIndicator(width / 2 + 16, height - 51, '▶', keys.right);

    pop();
}

function drawKeyIndicator(x, y, label, pressed) {
    push();
    if (pressed) {
        fill(255, 255, 255, 115);
        scale(0.9);
        x /= 0.9;
        y /= 0.9;
    } else {
        fill(255, 255, 255, 46);
    }
    stroke(255, 255, 255, 89);
    strokeWeight(1);
    rect(x - 14, y - 14, 28, 28, 4);

    noStroke();
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(11);
    text(label, x, y);
    pop();
}

function keyPressed() {
    updateKeys(true);

    // Press R to restart after death
    if ((key === 'r' || key === 'R') && isDead && !showVictory) {
        resetGame();
    }
}

function resetGame() {
    // Reset position
    x = width / 2 - DW / 2;
    y = height / 2 - DH / 2;
    vx = 0;
    vy = 0;
    angle = 0;

    // Reset health and oxygen
    health = 100;
    oxygen = 100;
    oxygenLeaking = false;

    // Reset state
    isDead = false;
    deathCause = null;
    highPressure = false;
    showLeakWarning = false;

    // Stop sounds
    if (swimmingSound.isPlaying()) {
        swimmingSound.pause();
    }
    if (drowningSound.isPlaying()) {
        drowningSound.stop();
    }
}

function keyReleased() {
    updateKeys(false);
}

function updateKeys(pressed) {
    if (keyCode === UP_ARROW || key === 'w' || key === 'W') {
        keys.up = pressed;
    }
    if (keyCode === DOWN_ARROW || key === 's' || key === 'S') {
        keys.down = pressed;
    }
    if (keyCode === LEFT_ARROW || key === 'a' || key === 'A') {
        keys.left = pressed;
    }
    if (keyCode === RIGHT_ARROW || key === 'd' || key === 'D') {
        keys.right = pressed;
    }
}

function mousePressed() {
    // Check Home Button
    let homeBtnX = 20;
    let homeBtnY = 20;
    let homeBtnW = 100;
    let homeBtnH = 40;

    if (mouseX > homeBtnX && mouseX < homeBtnX + homeBtnW &&
        mouseY > homeBtnY && mouseY < homeBtnY + homeBtnH) {
        window.location.href = 'index.html';
        return;
    }

    if (!gameStarted) {
        gameStarted = true;
        // Start audio context
        userStartAudio();
    } else if (showVictory) {
        // Return to home page when victory screen is shown
        window.location.href = 'index.html';
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    icebergX = width - icebergWidth - 100;
    icebergY = -100;
}

function checkIcebergCollision() {
    // Get iceberg polygon points
    let icebergPoints = getIcebergPoints();

    // Check if diver rectangle intersects with iceberg polygon
    let diverLeft = x;
    let diverRight = x + DW;
    let diverTop = y;
    let diverBottom = y + DH;

    // Check if any corner of diver is inside iceberg polygon
    let corners = [
        { x: diverLeft, y: diverTop },
        { x: diverRight, y: diverTop },
        { x: diverLeft, y: diverBottom },
        { x: diverRight, y: diverBottom },
        { x: x + DW / 2, y: y + DH / 2 } // center point
    ];

    let collision = false;
    for (let corner of corners) {
        if (pointInPolygon(corner.x, corner.y, icebergPoints)) {
            collision = true;
            break;
        }
    }

    if (collision) {
        // Push diver away from iceberg center
        let iceCenterX = icebergX + icebergWidth / 2;
        let iceCenterY = icebergY + icebergHeight / 2;
        let diverCenterX = x + DW / 2;
        let diverCenterY = y + DH / 2;

        let dx = diverCenterX - iceCenterX;
        let dy = diverCenterY - iceCenterY;
        let dist = sqrt(dx * dx + dy * dy);

        if (dist > 0) {
            // Normalize and push away
            dx /= dist;
            dy /= dist;

            // Push diver out
            x += dx * 5;
            y += dy * 5;

            // Stop velocity towards iceberg
            if (dx < 0 && vx < 0) vx = 0;
            if (dx > 0 && vx > 0) vx = 0;
            if (dy < 0 && vy < 0) vy = 0;
            if (dy > 0 && vy > 0) vy = 0;
        }

        if (!oxygenLeaking) {
            oxygenLeaking = true;
            showLeakWarning = true;
            leakWarningTime = millis();
            if (crashSound) {
                crashSound.play();
            }
        }
    }
}

function getIcebergPoints() {
    // Return the inverted polygon points of the iceberg (wide at top)
    return [
        { x: icebergX + icebergWidth * 0.5, y: icebergY + icebergHeight },
        { x: icebergX + icebergWidth * 0.7, y: icebergY + icebergHeight * 0.85 },
        { x: icebergX + icebergWidth * 0.85, y: icebergY + icebergHeight * 0.75 },
        { x: icebergX + icebergWidth, y: icebergY + icebergHeight * 0.6 },
        { x: icebergX + icebergWidth * 0.95, y: icebergY + icebergHeight * 0.4 },
        { x: icebergX + icebergWidth * 0.9, y: icebergY + icebergHeight * 0.2 },
        { x: icebergX + icebergWidth * 0.85, y: icebergY },
        { x: icebergX + icebergWidth * 0.15, y: icebergY },
        { x: icebergX + icebergWidth * 0.1, y: icebergY + icebergHeight * 0.2 },
        { x: icebergX + icebergWidth * 0.05, y: icebergY + icebergHeight * 0.4 },
        { x: icebergX, y: icebergY + icebergHeight * 0.65 },
        { x: icebergX + icebergWidth * 0.15, y: icebergY + icebergHeight * 0.8 },
        { x: icebergX + icebergWidth * 0.3, y: icebergY + icebergHeight * 0.9 }
    ];
}

function pointInPolygon(px, py, polygon) {
    // Ray casting algorithm to check if point is inside polygon
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        let xi = polygon[i].x, yi = polygon[i].y;
        let xj = polygon[j].x, yj = polygon[j].y;

        let intersect = ((yi > py) != (yj > py))
            && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function drawIceberg() {
    push();

    // Iceberg body (light blue/white)
    noStroke();
    fill(200, 230, 255);

    // Inverted iceberg shape
    beginShape();
    let pts = getIcebergPoints();
    for (let p of pts) vertex(p.x, p.y);
    endShape(CLOSE);

    // Highlights (bright white areas) - flipped
    fill(255, 255, 255, 180);
    beginShape();
    vertex(icebergX + icebergWidth * 0.5, icebergY + icebergHeight);
    vertex(icebergX + icebergWidth * 0.65, icebergY + icebergHeight * 0.85);
    vertex(icebergX + icebergWidth * 0.55, icebergY + icebergHeight * 0.75);
    vertex(icebergX + icebergWidth * 0.45, icebergY + icebergHeight * 0.8);
    endShape(CLOSE);

    beginShape();
    vertex(icebergX + icebergWidth * 0.2, icebergY + icebergHeight * 0.7);
    vertex(icebergX + icebergWidth * 0.3, icebergY + icebergHeight * 0.65);
    vertex(icebergX + icebergWidth * 0.25, icebergY + icebergHeight * 0.5);
    vertex(icebergX + icebergWidth * 0.15, icebergY + icebergHeight * 0.55);
    endShape(CLOSE);

    // Shadows (darker blue areas) - flipped
    fill(150, 180, 200, 120);
    beginShape();
    vertex(icebergX + icebergWidth * 0.85, icebergY + icebergHeight * 0.75);
    vertex(icebergX + icebergWidth, icebergY + icebergHeight * 0.6);
    vertex(icebergX + icebergWidth * 0.95, icebergY + icebergHeight * 0.4);
    vertex(icebergX + icebergWidth * 0.8, icebergY + icebergHeight * 0.5);
    endShape(CLOSE);

    beginShape();
    vertex(icebergX + icebergWidth * 0.1, icebergY + icebergHeight * 0.2);
    vertex(icebergX + icebergWidth * 0.15, icebergY);
    vertex(icebergX + icebergWidth * 0.3, icebergY + icebergHeight * 0.05);
    vertex(icebergX + icebergWidth * 0.25, icebergY + icebergHeight * 0.25);
    endShape(CLOSE);

    // Cracks and details
    stroke(180, 210, 230);
    strokeWeight(2);
    noFill();
    line(icebergX + icebergWidth * 0.4, icebergY + icebergHeight * 0.3,
        icebergX + icebergWidth * 0.45, icebergY + icebergHeight * 0.5);
    line(icebergX + icebergWidth * 0.6, icebergY + icebergHeight * 0.4,
        icebergX + icebergWidth * 0.65, icebergY + icebergHeight * 0.65);

    pop();
}
