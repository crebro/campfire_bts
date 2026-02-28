let playerStatuses = {
  IDLE: 'IDLE',
  RUNNING: 'RUNNING'
}

class Player {
  constructor (x, y, playerAssets) {
    this.x = x;
    this.y = y;
    this.animationIndex = 0;
    this.playerAssets = playerAssets;
    this.states = [];
    this.playerStatus = playerStatuses.IDLE;
    this.runAnimationItems = this.playerAssets.run.length;
    this.idleAnimationItems = this.playerAssets.idle.length;
    this.leftFlip = false;
  }

  draw() {
    push();
    let XDrawLocation = this.x;
    if (this.leftFlip) {
      translate(width, 0);
      scale(-1, 1);
      XDrawLocation = width - this.x - playerSize;
    }

    if (this.playerStatus == playerStatuses.RUNNING) {
      image(this.playerAssets.run[this.animationIndex % this.runAnimationItems ], XDrawLocation, this.y, 100, 100);
    }
    if (this.playerStatus == playerStatuses.IDLE) {
      image(this.playerAssets.idle[this.animationIndex % this.idleAnimationItems ], XDrawLocation, this.y, 100, 100);
    }
    pop();
  }
}


let player;
let scrollLevel = 0;
let colors = {
  brown: '#755a35',
  background: 220
}
let digcirclesRadius = 100;
// digcicle format: {x: number, y: number}
let digcircles = [];
let assets = {
  player: {
    run: [],
    idle: []
  }
}
let digSpeed = 20;
let animationDivision = 10;
let playerSize = 100;
let minSpacingDigCircle = digcirclesRadius / 2;
let earthTitle;
let caveBlocks = [];

function preload() {
  for (let i = 0; i < 6; i++) {
    assets.player.run.push(loadImage(`/assets/player/run/run${i + 1}.png`));
    assets.player.run[i].resize(100, 100);
  }

  for (let i = 0; i < 3; i++) {
    assets.player.idle.push(loadImage(`/assets/player/idle/idle${i + 1}.png`));
    assets.player.idle[i].resize(100, 100);
  }

  earthTitle = loadImage('/assets/earth-title.png');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  player = new Player(width / 2, height / 2 - playerSize, assets.player);

  noSmooth();
}

function draw() {
  background(colors.background);


  push();

  translate(0, - ( player.y - height / 2 ) );

  
  image(earthTitle, width / 8 - earthTitle.width / 2, height / 8 - earthTitle.height / 2, earthTitle.width * 2, earthTitle.height * 2);

  fill(colors.brown);
  rect(0, height / 2, width, height * 10);

  push();
  noStroke();
  fill(colors.background);
  for (let i = 0; i < digcircles.length; i++) {
    digcircle = digcircles[i];

    circle(digcircle.x, digcircle.y, digcirclesRadius * 2);
  }

  pop();


  player.draw();

  pop();

  if (keyIsDown(DOWN_ARROW) || keyIsDown(RIGHT_ARROW) || keyIsDown(LEFT_ARROW)) {
    if (keyIsDown(DOWN_ARROW)) {
      player.y += digSpeed;
    }
    if (keyIsDown(RIGHT_ARROW)) {
      player.x += digSpeed;
    }

    if (keyIsDown(LEFT_ARROW)) {
      player.x -= digSpeed;
    }

    // first calculate the distance between the player and the last digcircle
    if (digcircles.length == 0) {
      digcircles.push({x: player.x + playerSize / 2, y: player.y + playerSize - digcirclesRadius});
    } else {
      let lastDigcircle = digcircles[digcircles.length - 1];
      let distance = dist(player.x + playerSize / 2, player.y + playerSize - digcirclesRadius, lastDigcircle.x, lastDigcircle.y);
      if (distance > minSpacingDigCircle) {
        digcircles.push({x: player.x + playerSize / 2, y: player.y + playerSize - digcirclesRadius});
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
}

function keyReleased() {
  if (keyCode == RIGHT_ARROW || keyCode == LEFT_ARROW) {
    player.playerStatus = playerStatuses.IDLE;
  }
  if (keyCode == RIGHT_ARROW || keyCode == LEFT_ARROW || keyCode == RIGHT_ARROW) {
    digcircles.push({x: player.x + playerSize / 2, y: player.y + playerSize - digcirclesRadius});
  }
}

