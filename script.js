// if you see this, HELLO! please excuse any memory leaks i can't debug on my chromebook

// random integer function
function randint(min, max) {
	max+=1;
	return Math.floor(Math.random()*(max-min)+min);
}

// detect if two rectangles (assuming they have xywh properties)
function overlapRect(rect1, rect2) {
	if (rect1.x > rect2.x+rect2.w || rect2.x > rect1.x+rect1.w) {
		return false;
	}
	if (rect1.y < rect2.y-rect2.h || rect2.y < rect1.y-rect1.h) {
		return false;
	}
	return true;
}

// setup context and tick and intervalID
const canvas = document.getElementById("canv");
const ctx = canvas.getContext("2d");
const tick = 16;
var intervalID = 0; // this is just to clear or start the loop

// font setup
async function loadFont() {
	const fontFile = new FontFace(
		"pixel",
		"url(assets/joystix_monospace.ttf)"
	);
	await fontFile.load();
	document.fonts.add(fontFile);
}

// key events
var controls = {left: false, right: false, up: false, down: false};

document.addEventListener("keydown", Dhandler, false);
document.addEventListener("keydown", resumeGame, false); // resume game event listener
document.addEventListener("keyup", Uhandler, false);
document.addEventListener("keydown", pauseHandler, false); // pausing handler

// if the key is pressed, change it
function Dhandler(e) {
	switch(e.keyCode) {
		case 37:
		case 65:
			controls.left = true;
			break;
		case 38:
		case 32:
		case 87:
			controls.up = true;
			break;
		case 39:
		case 68:
			controls.right = true;
			break;
		case 40:
		case 83:
			controls.down = true;
			break;
	}
}

// if the key is released, change it
function Uhandler(e) {
	switch(e.keyCode) {
		case 37:
		case 65:
			controls.left = false;
			break;
		case 38:
		case 32:
		case 87:
			controls.up = false;
			break;
		case 39:
		case 68:
			controls.right = false;
			break;
		case 40:
		case 83:
			controls.down = false;
			break;
	}
}


class spriteSheet { // uses spritesheets
	constructor(src, numFrames, delay, sw, sh, rows, columns) { // yeah yeah a lot of parameters work with me
		this.currentFrame = 1;
		this.tick = 0;
		this.sw = sw;
		this.sh = sh;
		this.rows = rows;
		this.columns = columns;
		this.delay = delay; // delay is how many ticks until the next one
		this.numFrames = numFrames; // how many frames there are ()
		
		this.img = new Image();
		this.img.src = src;
	}
	
	drawGIF(context, x, y, w, h) {
		if (this.tick < this.delay) {
			this.tick++;
		}
		else if (this.currentFrame < this.numFrames) {
			this.currentFrame++;
			this.tick = 0;
		}
		else {
			this.currentFrame = 1;
			this.tick = 0;
		}
		
		var column = (this.currentFrame-1) % this.columns;
		var row = this.currentFrame - column / this.rows;
		
		context.drawImage(this.img, (column)*this.sw, (row-1)*this.sh, this.sw, this.sh, x, y, w, h);
	}
}


// world values
const ground = 400; // y ground level
const gravity = -30;
var speed = 5;
var start = false;
var gameOver = false;

// pausing
var paused = false;

// scores
var highScore = 0;
var currentScore = 0;

// world textures
var snowIMG = new Image();
snowIMG.src = "assets/world/snow.png";
var groundIMG = new Image();
groundIMG.src = "assets/world/ground.png";
var skyIMG = new Image();
skyIMG.src = "assets/world/sky.png";

// additional values for world stuff
var scrollX = 0;


// player "class"
class player {
	static x = 200; // note; use static if defining a function in a class
	static y = 400; // or if you need to reference a property
	static w = 40;
	static h = 60;
	static standBox = [40, 60]; // the hitbox when the player is in a normal state
	static crouchBox = [60, 40]; // hitbox when crouched
	static onGround = true;
	static velocity = 0;

	// these functions change the width and height depending on the state
	static crouch() {
		this.w = this.crouchBox[0];
		this.h = this.crouchBox[1];
	}

	static stand() {
		this.w = this.standBox[0];
		this.h = this.standBox[1];
	}

	static reset() {
		this.stand();
		this.y = 400;
		this.velocity = 0;
	}

	static loadSprites() {
		this.runSPRITE = new spriteSheet("assets/player/running30x20.png", 2, 10, 20, 30, 1, 2);
		this.duckSPRITE = new spriteSheet("assets/player/duck20x30.png", 2, 10, 30, 20, 1, 2);
		this.flySPRITE = new spriteSheet("assets/player/flying30x20.png", 2, 10, 20, 30, 1, 2);
		this.deadSPRITE = new Image(); this.deadSPRITE.src = "assets/player/dead.png";
	}

}

player.loadSprites();


// constructor for obstacles
class obstacle {
	sinceLastCreated = 0; // a timer basically, start at 1
	nextCreate = 200; // start value
	typeOb = {
		0: [canvas.width, ground, 50, 60, "assets/obstacles/obs1x1.png"],
		1: [canvas.width, ground, 80, 33, "assets/obstacles/obs7x3.png"],
		2: [canvas.width, ground-50, 60, 30, "assets/obstacles/obs2x1.png"],
		3: [canvas.width, ground, 60, 30, "assets/obstacles/obs2x1.png"]
	};
	
	constructor(t) {
		this.t = t;
		this.x = this.typeOb[t][0];
		this.y = this.typeOb[t][1];
		this.w = this.typeOb[t][2];
		this.h = this.typeOb[t][3];
		this.img = new Image();
		this.img.src = this.typeOb[t][4];
	}
}

var obList = []; // empty list where i will add obstacles



// the function to draw stuff on the canvas
ctx.imageSmoothingEnabled = false; // just disables smoothing

// draw the snow
var snowX = 0;
var snowY = 0;

function drawSnow() {
	ctx.drawImage(snowIMG, -snowX, snowY, canvas.width, canvas.height);
	ctx.drawImage(snowIMG, canvas.width-snowX, snowY, canvas.width, canvas.height);
	ctx.drawImage(snowIMG, -snowX, snowY-canvas.height, canvas.width, canvas.height);
	ctx.drawImage(snowIMG, canvas.width-snowX, snowY-canvas.height, canvas.width, canvas.height);
	
	snowX+=speed;
	snowY+=0.4;
	
	if (snowX > canvas.width) {
		snowX = 0;
	}
	if (snowY > canvas.height) {
		snowY = 0;
	}
	
}

var tutTimer = 0;

function draw() {
	
	// clear canvas
	ctx.clearRect(0, 0, canvas.width, canvas.height);
	
	// draw sky
	ctx.drawImage(skyIMG, 0, 0, canvas.width, canvas.height);
	
	// draw snow
	drawSnow();
	
	// draw ground
	ctx.drawImage(groundIMG, -scrollX, ground,canvas.width,canvas.height);
	ctx.drawImage(groundIMG, -scrollX+canvas.width, ground,canvas.width,canvas.height);
	
	scrollX+=speed;
	if (scrollX > canvas.width) {
		scrollX = 0;
	}
	
	// // draw obstacles
	for (let i = 0; i < obList.length; i++) {
		ctx.drawImage(obList[i].img, obList[i].x, obList[i].y-obList[i].h, obList[i].w, obList[i].h);
	}
	
	// draw placeholder player
	if (gameOver) {
		ctx.drawImage(player.deadSPRITE, player.x, player.y-player.h, player.w, player.h);
	}
	else if (!player.onGround) {
		player.flySPRITE.drawGIF(ctx, player.x, player.y-player.h, player.w, player.h);
	}
	else if (controls.down) {
		player.duckSPRITE.drawGIF(ctx, player.x, player.y-player.h, player.w, player.h);
	}
	else {
		player.runSPRITE.drawGIF(ctx, player.x, player.y-player.h, player.w, player.h);
	}

	if (tutTimer < 300 && !gameOver) {
		ctx.textAlign = "center";
		ctx.font = "bold 20px pixel";
		ctx.fillText('Use ARROW KEYS to move and SPACEBAR to jump!', canvas.width/2, 100);
		tutTimer++;
	}
	else if(gameOver) {
		tutTimer = 300;
	}
	
	ctx.textAlign = "right";
	ctx.font = "bold 20px pixel";
	ctx.fillText(String(currentScore), canvas.width-10, 30);
}

// game loop
function loop() {
	
	// controls hitbox
	if (controls.down && player.onGround) {
		player.crouch();
	}
	else {
		player.stand();
	}
	
	// move the player
	if (controls.right && player.x + player.w < canvas.width) {
		player.x+=3;
	}
	if (controls.left && player.x > 0) {
		player.x-=5;
	}
	
	// changes y level based on velocity
	player.y-=player.velocity;
	
	if (!player.onGround && player.y >= ground) {
		player.onGround = true;
		player.velocity = 0;
		player.y = ground;
	}
	
	// makes player jump
	if (controls.up && player.onGround) {
		player.velocity = 10;
		player.onGround = false;
		player.stand();
	}
	
	// decreases the players velocity
	if (!player.onGround) {
		player.velocity+=gravity*(tick/1000);
		
		// once the player reaches max height, they can decrease their velocity faster with down key
		if (controls.down) {
		player.velocity+=-5*(tick/1000);
		}
	}
	
	// bug begins here
	
	// obstacles generation
	if (obstacle.sinceLastCreated < obstacle.nextCreate) {
		obstacle.sinceLastCreated += 1;
	}
	else {
		obstacle.sinceLastCreated = 0;
		obstacle.nextCreate = randint(80 + 2*speed, 100 + 2*speed);
		
		// add obstacle
		const obsID = randint(0,20);
		if (obsID >= 0 && obsID < 8) {
		obList.push(new obstacle(0));
		}
		else if (obsID >= 8 && obsID < 17) {
		obList.push(new obstacle(1));
		}
		else if (obsID >= 17 && obsID < 20) {
		obList.push(new obstacle(2));
		}
		else {
		obList.push(new obstacle(3));
		}
	}

	// obstacle stuff, terminate game if collision on the way
	if (obList.length > 0) {
		for (let i = 0; i < obList.length; i++) {
		
		if (obList[i].t == 2 || obList[i].t == 3) {
			obList[i].x -= speed*1.333;
		}
		else {
			obList[i].x -= speed;
		}
	
		if (overlapRect(obList[i], player)) {
			gameOver = true; // game over handler
		}
		}
		if ((obList[0].x) + (obList[0].w) < 0) {
		obList.shift();
		}
	}

	// game over sequence
	if (gameOver) {
		draw(); // just to show the current state
		ctx.textAlign = "center";
		ctx.font = "bold 40px pixel";
		ctx.fillText("YOU DIED!", canvas.width/2, 80);
		
		ctx.font = "20px pixel";
		ctx.fillText("Press SPACE to Restart", canvas.width/2, 100);
		ctx.fillText("Score: " + String(currentScore), canvas.width/2, 150);
		clearInterval(intervalID); // stops the interval
		
		if (currentScore > highScore) {
		ctx.font = "30px";
		ctx.fillText("New High Score!", canvas.width/2, 180);
		highScore = currentScore;
		}
		
		currentScore = 0;

		return;
		
	}

	currentScore+=1;
	
	if (currentScore % 100 == 0) {
		speed+=.1;
	}
	
	// drawing stuff, placed before game over so players can see where they died
	draw();
}

var startID;

// resume game after player presses space
function resumeGame(e) {
	if (gameOver && e.keyCode == 32) {
		player.reset();
		obstacle.nextCreate = 200; // default value, hardcoded because im lazy
		obList = [];
		intervalID = setInterval(loop, tick);
		gameOver = false;
		speed = 5;
		player.x = 200;

	}
	if (!start && e.keyCode == 32) {
		clearInterval(startID);
		intervalID = setInterval(loop, tick);
		start = true;
	}
}

// start menu
function startMenu() {
	ctx.drawImage(skyIMG, 0, 0, canvas.width, canvas.height);
	drawSnow();
	scrollX+=1;
	if (scrollX > canvas.width) {
		scrollX = 0;
	}
	ctx.drawImage(groundIMG, -scrollX, ground, canvas.width, canvas.height);
	ctx.drawImage(groundIMG, canvas.width-scrollX, ground, canvas.width, canvas.height);
	ctx.font = "40px pixel";
	ctx.textAlign = "center";
	ctx.fillText("Welcome!", canvas.width/2, 100);
	ctx.fillText("Press SPACE to play!", canvas.width/2, 200);
}

function pauseHandler(e) {
	if (!paused && e.keyCode == 27 && !gameOver && start) {
		clearInterval(intervalID);
		
		ctx.fillStyle = "rgba(255,255,255,.3)";
		ctx.fillRect(0,0,canvas.width,canvas.height);
		ctx.fillStyle = "rgba(0,0,0,1)";
		
		ctx.textAlign = "center";
		ctx.font = "bold 40px pixel";
		ctx.fillText("PAUSED", canvas.width/2, canvas.height/2);
		paused = true;
	}
	else if (paused && e.keyCode == 27 && !gameOver) {
		paused = false;
		intervalID = setInterval(loop, tick);
	}
}

loadFont().then(() => {startID = setInterval(startMenu, tick);});
