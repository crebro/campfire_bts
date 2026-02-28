let playerStatuses = {
  IDLE: 'IDLE',
  RUNNING: 'RUNNING'
}

class Player {
  constructor(x, y, playerAssets) {
    this.x = x;
    this.y = y;
    this.animationIndex = 0;
    this.playerAssets = playerAssets;
    this.states = [];
    this.playerStatus = playerStatuses.IDLE;
    this.runAnimationItems = this.playerAssets.run.length;
    this.idleAnimationItems = this.playerAssets.idle.length;
    this.leftFlip = false;
    this.health = 100;
    this.oxygen = 100;
    this.velocity = 0;
    this.isDead = false;
    this.deathReason = "";
    this.isSuffocating = false;
  }

  update() {
    if (this.isDead) return;

    // --- Gravity and Vertical Physics ---
    let grounded = !this.isOverVoid(this.x + playerSize / 2, this.y + playerSize);

    if (!grounded) {
      this.velocity += 0.5; // Gravity
      this.y += this.velocity;
    } else {
      // Check for fall damage
      if (this.velocity > 10) {
        let damage = Math.floor((this.velocity - 10) * 2);
        this.health -= damage;
        if (this.health <= 0) {
          this.isDead = true;
          this.deathReason = "Sudden deceleration (Fall Damage)";
          deathChecklist.fall = true;
          if (assets.sounds.death) assets.sounds.death.play();
        }
      }
      this.velocity = 0;
      // Snap to ground if slightly below
      // (This is a simplified check, ideally we find the exact circle edge)
    }

    // --- Oxygen Logic ---
    let surfaceY = height / 2;
    let depth = Math.max(0, (this.y + playerSize - surfaceY) / 100);

    if (this.isSuffocating) {
      this.oxygen -= 0.1; // Faster depletion when suffocating
    } else if (depth > 10) {
      this.oxygen -= 0.005 * (depth - 10);
    } else {
      this.oxygen = Math.min(100, this.oxygen + 0.2);
    }

    if (this.oxygen <= 0) {
      this.isDead = true;
      this.deathReason = this.isSuffocating ? "Suffocated in Sand" : "Insufficient Oxygen";
      deathChecklist.oxygen = true;
      if (assets.sounds.death) assets.sounds.death.play();
    }
  }

  isOverVoid(px, py) {
    // Check if the point (px, py) is inside any dug circle
    for (let circle of digcircles) {
      if (dist(px, py, circle.x, circle.y) < digcirclesRadius) {
        return true;
      }
    }
    // Check if it's in a cave
    for (let cave of caveBlocks) {
      if (dist(px, py, cave.x, cave.y) < digcirclesRadius) {
        return true;
      }
    }
    // Also check if it's above the surface
    if (py < height / 2) return true;

    return false;
  }

  draw() {
    push();
    let XDrawLocation = this.x;
    if (this.leftFlip) {
      translate(width, 0);
      scale(-1, 1);
      XDrawLocation = width - this.x - playerSize;
    }

    if (this.playerStatus == playerStatuses.RUNNING && !this.isDead) {
      image(this.playerAssets.run[this.animationIndex % this.runAnimationItems], XDrawLocation, this.y, 100, 100);
      if (assets.sounds.walking && !assets.sounds.walking.isPlaying()) {
        assets.sounds.walking.loop();
      }
    } else {
      if (assets.sounds.walking && assets.sounds.walking.isPlaying()) {
        assets.sounds.walking.stop();
      }
    }

    if (this.playerStatus == playerStatuses.IDLE) {
      image(this.playerAssets.idle[this.animationIndex % this.idleAnimationItems], XDrawLocation, this.y, 100, 100);
    }
    pop();
  }
}


let player;
let scrollLevel = 0;
let colors = {
  brown: '#755a35',
  sand: '#e9c46a',
  background: 220
}
let digcirclesRadius = 100;
// digcicle format: {x: number, y: number}
let digcircles = [];
let assets = {
  player: {
    run: [],
    idle: []
  },
  sounds: {}
}
let digSpeed = 20;
let animationDivision = 10;
let playerSize = 100;
let minSpacingDigCircle = digcirclesRadius / 2;
let earthTitle;
let caveBlocks = [];
let sandBlocks = [];
let sandSize = 50;

let deathChecklist = {
  fall: false,
  sand: false,
  oxygen: false
};

let gameFrameCount = 0;

function preload() {
  for (let i = 0; i < 6; i++) {
    assets.player.run.push(loadImage(`assets/player/run/run${i + 1}.png`));
    assets.player.run[i].resize(100, 100);
  }

  for (let i = 0; i < 3; i++) {
    assets.player.idle.push(loadImage(`assets/player/idle/idle${i + 1}.png`));
    assets.player.idle[i].resize(100, 100);
  }

  earthTitle = loadImage('assets/die-beneath-dig.png');

  assets.sounds.walking = loadSound('assets/sounds/walking-dirt.mp3');
  assets.sounds.sandFall = loadSound('assets/sounds/sand-fall.mp3');
  assets.sounds.death = loadSound('assets/death.wav');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  player = new Player(width / 2, height / 2 - playerSize, assets.player);

  noSmooth();
  generateCaves();
  generateSand();
}

function draw() {
  background(colors.background);


  push();

  translate(0, - (player.y - height / 2));


  image(earthTitle, width / 8 - earthTitle.width / 2, height / 8 - earthTitle.height / 2, earthTitle.width * 3, earthTitle.height * 3);

  fill(colors.brown);
  rect(0, height / 2, width, height * 10);

  // Draw stationary sand (behind voids)
  noStroke();
  for (let s of sandBlocks) {
    if (!s.isFalling) {
      fill(colors.sand);
      rect(s.x, s.y, s.w, s.h);
    }
  }

  push();
  noStroke();
  fill(colors.background);
  for (let i = 0; i < digcircles.length; i++) {
    let digcircle = digcircles[i];
    circle(digcircle.x, digcircle.y, digcirclesRadius * 2);
  }

  for (let i = 0; i < caveBlocks.length; i++) {
    let cave = caveBlocks[i];
    circle(cave.x, cave.y, digcirclesRadius * 2);
  }
  pop();

  // Update and draw falling sand (in front of voids)
  updateSand();
  for (let s of sandBlocks) {
    if (s.isFalling) {
      fill(colors.sand);
      rect(s.x, s.y, s.w, s.h);
    }
  }


  player.update();
  player.draw();

  pop();


  // Hint text
  push();
  fill(255, 255, 255, 217);
  textAlign(CENTER, TOP);
  textSize(12);
  noStroke();
  fill(0, 0, 0, 38);
  rect(width / 2 - 100, 18, 200, 24, 2);
  fill(255, 255, 255, 217);
  text("ARROWS → DIG | YOU CAN'T JUMP", width / 2, 24);
  pop();


  // --- UI Layer ---
  drawUI();

  if (player.isDead) {
    drawGameOver();
    return;
  }

  if (keyIsDown(DOWN_ARROW) || keyIsDown(RIGHT_ARROW) || keyIsDown(LEFT_ARROW)) {
    let oldX = player.x;
    let oldY = player.y;

    if (keyIsDown(DOWN_ARROW)) {
      player.y += digSpeed;
    }
    if (keyIsDown(RIGHT_ARROW)) {
      player.x += digSpeed;
    }

    if (keyIsDown(LEFT_ARROW)) {
      player.x -= digSpeed;
    }

    // --- Digging through Sand ---
    // Check if player's bounding box intersects with any sand block.
    for (let i = sandBlocks.length - 1; i >= 0; i--) {
      let s = sandBlocks[i];
      // Simple AABB intersection check
      if (player.x < s.x + s.w &&
        player.x + playerSize > s.x &&
        player.y < s.y + s.h &&
        player.y + playerSize > s.y) {
        sandBlocks.splice(i, 1);
        // Create a digcircle at the sand block's location to visually clear the area
        digcircles.push({ x: s.x + s.w / 2, y: s.y + s.h / 2 });
      }
    }

    // first calculate the distance between the player and the last digcircle
    if (digcircles.length == 0) {
      digcircles.push({ x: player.x + playerSize / 2, y: player.y + playerSize - digcirclesRadius });
    } else {
      let lastDigcircle = digcircles[digcircles.length - 1];
      let distance = dist(player.x + playerSize / 2, player.y + playerSize - digcirclesRadius, lastDigcircle.x, lastDigcircle.y);
      if (distance > minSpacingDigCircle) {
        digcircles.push({ x: player.x + playerSize / 2, y: player.y + playerSize - digcirclesRadius });
      }
    }

  }

  if (frameCount % animationDivision == 0) {
    player.animationIndex += 1;
  }
}

function keyPressed() {
  if (keyCode == RIGHT_ARROW || keyCode == LEFT_ARROW) {
    player.playerStatus = playerStatuses.RUNNING;
  }

  if (keyCode == LEFT_ARROW) {
    player.leftFlip = true;
  }

  if (keyCode == RIGHT_ARROW) {
    player.leftFlip = false;
  }

  let allDead = deathChecklist.fall && deathChecklist.sand && deathChecklist.oxygen;
  if (player.isDead && (key == 'r' || key == 'R') && !allDead) {
    restartGame();
  }
}

function keyReleased() {
  if (keyCode == RIGHT_ARROW || keyCode == LEFT_ARROW) {
    player.playerStatus = playerStatuses.IDLE;
  }
  if (keyCode == RIGHT_ARROW || keyCode == LEFT_ARROW || keyCode == RIGHT_ARROW) {
    digcircles.push({ x: player.x + playerSize / 2, y: player.y + playerSize - digcirclesRadius });
  }
}

function drawUI() {
  push();
  // Health Bar
  noStroke();
  fill(0, 100);
  rect(20, 80, 200, 20); // Shifted down from 20
  fill(255, 50, 50);
  rect(20, 80, map(player.health, 0, 100, 0, 200), 20);
  fill(255);
  textSize(14);
  text("HEALTH", 25, 95);

  // Oxygen Bar
  fill(0, 100);
  rect(20, 110, 200, 20); // Shifted down from 50
  fill(50, 150, 255);
  rect(20, 110, map(player.oxygen, 0, 100, 0, 200), 20);
  fill(255);
  text("OXYGEN", 25, 125);

  // Depth
  let depth = Math.floor(Math.max(0, (player.y + playerSize - height / 2) / 10));
  textSize(20);
  text(`Depth: ${depth}m`, 20, 160); // Shifted down from 100

  // --- Death Checklist UI ---
  let checklistX = width - 250;
  let checklistY = 30;
  fill(0, 100);
  rect(checklistX - 10, checklistY - 10, 240, 110, 5);
  fill(255);
  textSize(16);
  textAlign(LEFT, TOP);
  text("OBJECTIVE: DIE ALL WAYS", checklistX, checklistY);

  textSize(14);
  drawCheckItem("1. Fall Damage", deathChecklist.fall, checklistX, checklistY + 25);
  drawCheckItem("2. Crushed by Sand", deathChecklist.sand, checklistX, checklistY + 45);
  drawCheckItem("3. Suffocation/O2", deathChecklist.oxygen, checklistX, checklistY + 65);

  // --- Home Button ---
  let homeBtnX = 20;
  let homeBtnY = 20;
  let homeBtnW = 100;
  let homeBtnH = 40;

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
}

function drawCheckItem(label, checked, x, y) {
  text(checked ? "[X] " + label : "[  ] " + label, x, y);
}

function drawGameOver() {
  push();
  fill(0, 150);
  rect(0, 0, width, height);
  fill(255);
  textAlign(CENTER, CENTER);

  let allDead = deathChecklist.fall && deathChecklist.sand && deathChecklist.oxygen;

  if (allDead) {
    textSize(60);
    fill(255, 215, 0); // Gold
    text("YOU ARE FINALLY DEAD!", width / 2, height / 2 - 80);
    textSize(30);
    fill(255);
    text("You experienced all underground deaths.", width / 2, height / 2);

    textSize(15);
    fill(255);
    text("Click to return to home", width / 2, height / 2 + 50);
    pop();
  } else {
    textSize(50);
    text("DEAD!", width / 2, height / 2 - 100);
    textSize(20);
    text(player.deathReason, width / 2, height / 2 - 20);

    // Death Checklist on Game Over
    let startY = height / 2 + 20;
    textSize(16);

    // Fall Damage
    fill(deathChecklist.fall ? "rgb(50, 255, 50)" : "rgb(255, 255, 255)");
    text(deathChecklist.fall ? "[X] Fall Damage" : "[ ] Fall Damage", width / 2, startY);

    // Crushed by Sand
    fill(deathChecklist.sand ? "rgb(50, 255, 50)" : "rgb(255, 255, 255)");
    text(deathChecklist.sand ? "[X] Crushed by Sand" : "[ ] Crushed by Sand", width / 2, startY + 25);

    // Oxygen
    fill(deathChecklist.oxygen ? "rgb(50, 255, 50)" : "rgb(255, 255, 255)");
    text(deathChecklist.oxygen ? "[X] Insufficient Oxygen" : "[ ] Insufficient Oxygen", width / 2, startY + 50);

    textSize(15);
    fill(255);
    text("Press 'R' to Restart", width / 2, height / 2 + 100);
    pop();
  }
}

function generateCaves() {
  // Generate random caves at depths
  for (let d = width / 2 + 50; d < 10000; d += 100) {
    let count = floor(random(3, 8));
    let centerX = random(width);
    for (let i = 0; i < count; i++) {
      caveBlocks.push({
        x: centerX + random(-200, 200),
        y: d + random(-100, 100)
      });
    }
  }
}

function generateSand() {
  for (let d = width / 2 + 100; d < 10000; d += 250) {
    let patchCount = floor(random(2, 5));
    for (let p = 0; p < patchCount; p++) {
      let startX = random(width - 200);
      let rows = floor(random(2, 4));
      let cols = floor(random(4, 8));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          sandBlocks.push({
            x: startX + c * sandSize,
            y: d + r * sandSize,
            w: sandSize,
            h: sandSize,
            isFalling: false,
            velocity: 0
          });
        }
      }
    }
  }
}

function updateSand() {
  if (player.isDead) return;

  player.isSuffocating = false; // Reset every frame

  for (let s of sandBlocks) {
    if (!s.isFalling) {
      // Check if any point under the sand block is in void
      // We check center-bottom
      if (player.isOverVoid(s.x + s.w / 2, s.y + s.h + 5)) {
        s.isFalling = true;
        // Only play sound if game has been running for a bit (settling period)
        if (gameFrameCount > 120 && assets.sounds.sandFall && !assets.sounds.sandFall.isPlaying()) {
          assets.sounds.sandFall.play();
        }
      }
    } else {
      let prevY = s.y;
      s.velocity += 0.4;
      s.y += s.velocity;

      // Damage player on impact (only if sand was moving fast enough)
      if (s.velocity > 5) {
        if (s.x < player.x + playerSize &&
          s.x + s.w > player.x &&
          s.y < player.y + playerSize &&
          s.y + s.h > player.y &&
          prevY + s.h <= player.y + 10) { // Impact from top
          player.health -= 5;
          if (player.health <= 0) {
            player.isDead = true;
            player.deathReason = "Crushed by Falling Sand";
            deathChecklist.sand = true;
            if (assets.sounds.death) assets.sounds.death.play();
          }
        }
      }

      // Stop falling if hits solid earth (not void)
      if (!player.isOverVoid(s.x + s.w / 2, s.y + s.h)) {
        s.isFalling = false;
        s.velocity = 0;
      }
    }

    // Commented out code for suffocation (oxygen reduction) by sand

    // // Check for suffocation (player's head area - top 40% - is substantially inside sand)
    // if (player.x + playerSize * 0.3 < s.x + s.w &&
    //   player.x + playerSize * 0.7 > s.x &&
    //   player.y < s.y + s.h &&
    //   player.y + playerSize * 0.4 > s.y) {
    //   player.isSuffocating = true;
    // }
  }

  if (player.isSuffocating) {
    // Show visual indicator or handled via oxygen meter
  }

  gameFrameCount++;
}

function restartGame() {
  player.x = width / 2;
  player.y = height / 2 - playerSize;
  player.health = 100;
  player.oxygen = 100;
  player.velocity = 0;
  player.isDead = false;
  player.deathReason = "";
  gameFrameCount = 0;
  digcircles = [];
  sandBlocks = [];
  generateSand();
}

// Redefine setup to ensure caves and sand are generated
let originalSetup = setup;
setup = function () {
  createCanvas(windowWidth, windowHeight);
  player = new Player(width / 2, height / 2 - playerSize, assets.player);
  noSmooth();
  generateCaves();
  generateSand();
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

  let allDead = deathChecklist.fall && deathChecklist.sand && deathChecklist.oxygen;
  if (allDead) {
    // Return to home page when victory screen is shown
    window.location.href = 'index.html';
  }
}
