/* ==========================================
   MS. WEB-MAN - ARCADE BROWSER GAME
   ========================================== */

const TILE_SIZE = 16;
const COLS = 28;
const ROWS = 31;
const CANVAS_WIDTH = COLS * TILE_SIZE; // 448
const CANVAS_HEIGHT = ROWS * TILE_SIZE; // 496

// Directions
const DIR_NONE = { x: 0, y: 0 };
const DIR_UP = { x: 0, y: -1, angle: 1.5 * Math.PI };
const DIR_DOWN = { x: 0, y: 1, angle: 0.5 * Math.PI };
const DIR_LEFT = { x: -1, y: 0, angle: 1.0 * Math.PI };
const DIR_RIGHT = { x: 1, y: 0, angle: 0.0 * Math.PI };

// Maze definitions (0: Empty, 1: Wall, 2: Dot, 3: Energizer, 4: Ghost House Door, 5: Ghost House Interior)
const MAZE_LAYOUTS = [
    [
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [1,3,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,3,1],
        [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
        [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
        [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,2,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,2,1],
        [1,2,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,2,1],
        [1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1],
        [1,1,1,1,1,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,1,1,1,1,1],
        [0,0,0,0,0,1,2,1,1,1,1,1,0,1,1,0,1,1,1,1,1,2,1,0,0,0,0,0],
        [0,0,0,0,0,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,0,0,0,0,0],
        [0,0,0,0,0,1,2,1,1,0,1,1,1,4,4,1,1,1,0,1,1,2,1,0,0,0,0,0],
        [1,1,1,1,1,1,2,1,1,0,1,5,5,5,5,5,5,1,0,1,1,2,1,1,1,1,1,1],
        [0,0,0,0,0,0,2,0,0,0,1,5,5,5,5,5,5,1,0,0,0,2,0,0,0,0,0,0],
        [1,1,1,1,1,1,2,1,1,0,1,5,5,5,5,5,5,1,0,1,1,2,1,1,1,1,1,1],
        [0,0,0,0,0,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,0,0,0,0,0],
        [0,0,0,0,0,1,2,1,1,0,0,0,0,0,0,0,0,0,0,1,1,2,1,0,0,0,0,0],
        [0,0,0,0,0,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,0,0,0,0,0],
        [1,1,1,1,1,1,2,1,1,0,1,1,1,1,1,1,1,1,0,1,1,2,1,1,1,1,1,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
        [1,2,1,1,1,1,2,1,1,1,1,1,2,1,1,2,1,1,1,1,1,2,1,1,1,1,2,1],
        [1,3,2,2,1,1,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,1,1,2,2,3,1],
        [1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1],
        [1,1,1,2,1,1,2,1,1,2,1,1,1,1,1,1,1,1,2,1,1,2,1,1,2,1,1,1],
        [1,2,2,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,1,1,2,2,2,2,2,2,1],
        [1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1],
        [1,2,1,1,1,1,1,1,1,1,1,1,2,1,1,2,1,1,1,1,1,1,1,1,1,1,2,1],
        [1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ]
];

// Fruit types and values
const FRUITS = [
    { name: 'Cherry', points: 100, color: '#ff0000' },
    { name: 'Strawberry', points: 200, color: '#ff3366' },
    { name: 'Peach', points: 500, color: '#ff9933' },
    { name: 'Pretzel', points: 700, color: '#cc9966' },
    { name: 'Apple', points: 1000, color: '#33cc33' },
    { name: 'Pear', points: 2000, color: '#66ff66' },
    { name: 'Banana', points: 5000, color: '#ffff33' }
];

// Audio System using Web Audio API
class SoundSystem {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.wakaState = false;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playStartGame() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;
        const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'square';
            osc.frequency.setValueAtTime(freq, now + i * 0.08);
            gain.gain.setValueAtTime(0.1, now + i * 0.08);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.07);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + i * 0.08);
            osc.stop(now + i * 0.08 + 0.08);
        });
    }

    playWaka() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        const freq = this.wakaState ? 250 : 180;
        this.wakaState = !this.wakaState;
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.07);
    }

    playEnergizer() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
    }

    playEatGhost() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.linearRampToValueAtTime(600, now + 0.3);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.31);
    }

    playFruit() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.05);
            gain.gain.setValueAtTime(0.12, now + i * 0.05);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.05 + 0.06);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(now + i * 0.05);
            osc.stop(now + i * 0.05 + 0.07);
        });
    }

    playDeath() {
        if (!this.enabled) return;
        this.init();
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.6);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.65);
    }
}

// Game State Class
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.sound = new SoundSystem();

        this.score = 0;
        this.highScore = parseInt(localStorage.getItem('ms_web_man_highscore') || '10000', 10);
        this.lives = 3;
        this.level = 1;
        this.dotsLeft = 0;
        this.eatenGhostsCount = 0;

        this.state = 'START'; // START, READY, PLAYING, PAUSED, DYING, LEVEL_COMPLETE, GAME_OVER
        this.stateTimer = 0;

        this.maze = [];
        this.player = null;
        this.ghosts = [];
        this.fruit = null;
        this.fruitTimer = 0;
        this.dotsEaten = 0;

        this.frightenedTimer = 0;
        this.frightenedDuration = 7000; // 7 seconds

        this.crtEnabled = true;

        this.initEventListeners();
        this.updateUI();
    }

    initEventListeners() {
        const handleDirectionInput = (dir) => {
            this.sound.init();
            if (this.state === 'START') {
                this.startGame();
            } else if (this.state === 'PLAYING' && this.player) {
                this.player.setNextDirection(dir);
            }
        };

        window.addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Enter'].includes(e.code)) {
                e.preventDefault();
            }

            switch(e.code) {
                case 'ArrowUp':
                case 'KeyW':
                    handleDirectionInput(DIR_UP);
                    break;
                case 'ArrowDown':
                case 'KeyS':
                    handleDirectionInput(DIR_DOWN);
                    break;
                case 'ArrowLeft':
                case 'KeyA':
                    handleDirectionInput(DIR_LEFT);
                    break;
                case 'ArrowRight':
                case 'KeyD':
                    handleDirectionInput(DIR_RIGHT);
                    break;
                case 'Space':
                case 'Enter':
                    if (this.state === 'START') {
                        this.startGame();
                    } else if (this.state === 'GAME_OVER') {
                        this.resetGame();
                    } else if (this.state === 'PLAYING' || this.state === 'PAUSED') {
                        this.togglePause();
                    }
                    break;
            }
        });

        // Touch and mouse Virtual Pad buttons
        const bindPad = (id, dir) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const trigger = (e) => {
                e.preventDefault();
                handleDirectionInput(dir);
            };
            btn.addEventListener('touchstart', trigger, { passive: false });
            btn.addEventListener('mousedown', trigger);
        };

        bindPad('btn-up', DIR_UP);
        bindPad('btn-down', DIR_DOWN);
        bindPad('btn-left', DIR_LEFT);
        bindPad('btn-right', DIR_RIGHT);

        const startBtn = document.getElementById('start-btn');
        if (startBtn) {
            startBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.startGame();
            });
        }

        const restartBtn = document.getElementById('restart-btn');
        if (restartBtn) {
            restartBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.resetGame();
            });
        }

        // Clicking anywhere on start screen starts the game
        const startScreen = document.getElementById('start-screen');
        if (startScreen) {
            startScreen.addEventListener('click', () => {
                if (this.state === 'START') {
                    this.startGame();
                }
            });
        }

        document.getElementById('sound-btn').addEventListener('click', () => {
            this.sound.enabled = !this.sound.enabled;
            document.getElementById('sound-btn').textContent = this.sound.enabled ? '🔊 SOUND: ON' : '🔇 SOUND: OFF';
        });

        document.getElementById('crt-btn').addEventListener('click', () => {
            this.crtEnabled = !this.crtEnabled;
            const crt = document.getElementById('crt-overlay');
            crt.style.display = this.crtEnabled ? 'block' : 'none';
            document.getElementById('crt-btn').textContent = this.crtEnabled ? '📺 CRT: ON' : '📺 CRT: OFF';
        });
    }

    startGame() {
        document.getElementById('start-screen').classList.add('hidden');
        this.sound.playStartGame();
        this.resetGame();
    }

    resetGame() {
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.loadLevel(this.level);
        document.getElementById('game-over-screen').classList.add('hidden');
        document.getElementById('level-complete-screen').classList.add('hidden');
        this.startReadyCountdown();
    }

    loadLevel(lvl) {
        const template = MAZE_LAYOUTS[(lvl - 1) % MAZE_LAYOUTS.length];
        this.maze = template.map(row => [...row]);

        this.dotsLeft = 0;
        this.dotsEaten = 0;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (this.maze[r][c] === 2 || this.maze[r][c] === 3) {
                    this.dotsLeft++;
                }
            }
        }

        this.player = new Player(13.5 * TILE_SIZE, 23 * TILE_SIZE);
        this.ghosts = [
            new Ghost(13.5 * TILE_SIZE, 11 * TILE_SIZE, '#ff0000', 'blinky'),
            new Ghost(13.5 * TILE_SIZE, 14 * TILE_SIZE, '#ffb8ff', 'pinky'),
            new Ghost(11.5 * TILE_SIZE, 14 * TILE_SIZE, '#00ffff', 'inky'),
            new Ghost(15.5 * TILE_SIZE, 14 * TILE_SIZE, '#ffb852', 'sue')
        ];

        this.fruit = null;
        this.fruitTimer = 0;
        this.eatenGhostsCount = 0;
        this.updateUI();
    }

    startReadyCountdown() {
        this.state = 'READY';
        this.stateTimer = 45; // Shortened to ~0.75s for instant snappy play
    }

    togglePause() {
        if (this.state === 'PLAYING') {
            this.state = 'PAUSED';
        } else if (this.state === 'PAUSED') {
            this.state = 'PLAYING';
        }
    }

    updateUI() {
        document.getElementById('score').textContent = String(this.score).padStart(5, '0');
        document.getElementById('high-score').textContent = String(this.highScore).padStart(5, '0');
        document.getElementById('level-display').textContent = this.level;

        const livesContainer = document.getElementById('lives-display');
        livesContainer.innerHTML = '';
        for (let i = 0; i < this.lives - 1; i++) {
            const canvasMini = document.createElement('canvas');
            canvasMini.width = 16;
            canvasMini.height = 16;
            canvasMini.className = 'mini-icon';
            const mCtx = canvasMini.getContext('2d');
            mCtx.fillStyle = '#ffff00';
            mCtx.beginPath();
            mCtx.arc(8, 9, 6, 0.2 * Math.PI, 1.8 * Math.PI);
            mCtx.lineTo(8, 9);
            mCtx.fill();
            mCtx.fillStyle = '#ff007f';
            mCtx.fillRect(7, 1, 2, 4);
            mCtx.fillRect(5, 2, 6, 2);
            livesContainer.appendChild(canvasMini);
        }
    }

    run() {
        let lastTime = performance.now();
        const fps = 60;
        const frameInterval = 1000 / fps;

        const loop = (currentTime) => {
            requestAnimationFrame(loop);
            const elapsed = currentTime - lastTime;
            if (elapsed >= frameInterval) {
                lastTime = currentTime - (elapsed % frameInterval);
                this.update();
                this.render();
            }
        };

        requestAnimationFrame(loop);
    }

    update() {
        if (this.state === 'READY') {
            this.stateTimer--;
            if (this.stateTimer <= 0) {
                this.state = 'PLAYING';
            }
            return;
        }

        if (this.state === 'DYING') {
            this.stateTimer--;
            this.player.deathAnimProgress += 0.04;
            if (this.stateTimer <= 0) {
                this.lives--;
                this.updateUI();
                if (this.lives <= 0) {
                    this.gameOver();
                } else {
                    this.player.reset();
                    this.ghosts.forEach(g => g.reset());
                    this.startReadyCountdown();
                }
            }
            return;
        }

        if (this.state === 'LEVEL_COMPLETE') {
            this.stateTimer--;
            if (this.stateTimer <= 0) {
                this.level++;
                this.loadLevel(this.level);
                this.startReadyCountdown();
            }
            return;
        }

        if (this.state !== 'PLAYING') return;

        if (this.frightenedTimer > 0) {
            this.frightenedTimer -= 1000 / 60;
            if (this.frightenedTimer <= 0) {
                this.ghosts.forEach(g => {
                    if (g.state === 'FRIGHTENED') g.state = 'CHASE';
                });
                this.eatenGhostsCount = 0;
            }
        }

        if (this.fruit) {
            this.fruitTimer--;
            if (this.fruitTimer <= 0) {
                this.fruit = null;
            } else {
                const pTile = this.player.getTileCoord();
                const fTile = { x: Math.floor(this.fruit.x / TILE_SIZE), y: Math.floor(this.fruit.y / TILE_SIZE) };
                if (pTile.x === fTile.x && pTile.y === fTile.y) {
                    this.score += this.fruit.points;
                    this.sound.playFruit();
                    this.fruit = null;
                    this.updateUI();
                }
            }
        }

        this.player.update(this.maze);

        const tile = this.player.getTileCoord();
        if (tile.x >= 0 && tile.x < COLS && tile.y >= 0 && tile.y < ROWS) {
            const cell = this.maze[tile.y][tile.x];
            if (cell === 2) {
                this.maze[tile.y][tile.x] = 0;
                this.score += 10;
                this.dotsLeft--;
                this.dotsEaten++;
                this.sound.playWaka();
                this.checkFruitSpawn();
                this.updateUI();
                if (this.dotsLeft <= 0) {
                    this.levelComplete();
                    return;
                }
            } else if (cell === 3) {
                this.maze[tile.y][tile.x] = 0;
                this.score += 50;
                this.dotsLeft--;
                this.dotsEaten++;
                this.sound.playEnergizer();
                this.triggerFrightenedMode();
                this.updateUI();
                if (this.dotsLeft <= 0) {
                    this.levelComplete();
                    return;
                }
            }
        }

        this.ghosts.forEach(ghost => {
            ghost.update(this.maze, this.player);

            const dist = Math.hypot(ghost.x - this.player.x, ghost.y - this.player.y);
            if (dist < TILE_SIZE * 0.75) {
                if (ghost.state === 'FRIGHTENED') {
                    ghost.state = 'EATEN';
                    this.eatenGhostsCount++;
                    const pts = Math.pow(2, this.eatenGhostsCount) * 100;
                    this.score += pts;
                    this.sound.playEatGhost();
                    this.updateUI();
                } else if (ghost.state === 'CHASE' || ghost.state === 'SCATTER') {
                    this.triggerPlayerDeath();
                }
            }
        });

        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('ms_web_man_highscore', this.highScore);
        }
    }

    checkFruitSpawn() {
        if ((this.dotsEaten === 70 || this.dotsEaten === 170) && !this.fruit) {
            const fruitIndex = Math.min(Math.floor((this.level - 1) / 2), FRUITS.length - 1);
            const fData = FRUITS[fruitIndex];
            this.fruit = {
                x: 13.5 * TILE_SIZE,
                y: 17 * TILE_SIZE,
                ...fData
            };
            this.fruitTimer = 600;
        }
    }

    triggerFrightenedMode() {
        this.frightenedTimer = this.frightenedDuration;
        this.eatenGhostsCount = 0;
        this.ghosts.forEach(g => {
            if (g.state !== 'EATEN') {
                g.state = 'FRIGHTENED';
                g.reverseDirection();
            }
        });
    }

    triggerPlayerDeath() {
        this.state = 'DYING';
        this.stateTimer = 75;
        this.player.deathAnimProgress = 0;
        this.sound.playDeath();
    }

    levelComplete() {
        this.state = 'LEVEL_COMPLETE';
        this.stateTimer = 120;
        document.getElementById('next-level').textContent = this.level + 1;
        document.getElementById('level-complete-screen').classList.remove('hidden');
    }

    gameOver() {
        this.state = 'GAME_OVER';
        document.getElementById('final-score').textContent = this.score;
        document.getElementById('game-over-screen').classList.remove('hidden');
    }

    render() {
        this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const cell = this.maze[r][c];
                const x = c * TILE_SIZE;
                const y = r * TILE_SIZE;

                if (cell === 1) {
                    this.ctx.fillStyle = '#1919a6';
                    this.ctx.strokeStyle = '#2222ff';
                    this.ctx.lineWidth = 1;
                    this.ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
                    this.ctx.strokeRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
                } else if (cell === 2) {
                    this.ctx.fillStyle = '#ffb8ae';
                    this.ctx.beginPath();
                    this.ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 2.5, 0, 2 * Math.PI);
                    this.ctx.fill();
                } else if (cell === 3) {
                    if (Math.floor(Date.now() / 200) % 2 === 0) {
                        this.ctx.fillStyle = '#ffb8ae';
                        this.ctx.beginPath();
                        this.ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, 6, 0, 2 * Math.PI);
                        this.ctx.fill();
                    }
                } else if (cell === 4) {
                    this.ctx.fillStyle = '#ffb8ff';
                    this.ctx.fillRect(x, y + 6, TILE_SIZE, 4);
                }
            }
        }

        if (this.fruit) {
            this.renderFruit();
        }

        this.ghosts.forEach(ghost => ghost.render(this.ctx));
        this.player.render(this.ctx, this.state);

        if (this.state === 'READY') {
            this.ctx.font = '14px "Press Start 2P"';
            this.ctx.fillStyle = '#ffff00';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('READY!', CANVAS_WIDTH / 2, 17 * TILE_SIZE);
        } else if (this.state === 'PAUSED') {
            this.ctx.font = '14px "Press Start 2P"';
            this.ctx.fillStyle = '#00ffff';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('PAUSED', CANVAS_WIDTH / 2, 17 * TILE_SIZE);
        }
    }

    renderFruit() {
        const fx = this.fruit.x;
        const fy = this.fruit.y;
        this.ctx.fillStyle = this.fruit.color;
        this.ctx.beginPath();
        this.ctx.arc(fx + TILE_SIZE/2, fy + TILE_SIZE/2, 6, 0, 2 * Math.PI);
        this.ctx.fill();
        this.ctx.fillStyle = '#00ff00';
        this.ctx.fillRect(fx + 6, fy + 2, 4, 3);
    }
}

// Player Class
class Player {
    constructor(x, y) {
        this.startX = x;
        this.startY = y;
        this.reset();
    }

    reset() {
        this.x = this.startX;
        this.y = this.startY;
        this.dir = DIR_LEFT;
        this.nextDir = DIR_LEFT;
        this.speed = 2;
        this.mouthAngle = 0.2;
        this.mouthSpeed = 0.02;
        this.deathAnimProgress = 0;
    }

    setNextDirection(dir) {
        this.nextDir = dir;
        // Immediate cornering / instant turn if reversing or aligned
        if (dir.x === -this.dir.x && dir.y === -this.dir.y) {
            this.dir = dir;
        }
    }

    getTileCoord() {
        return {
            x: Math.floor((this.x + TILE_SIZE / 2) / TILE_SIZE),
            y: Math.floor((this.y + TILE_SIZE / 2) / TILE_SIZE)
        };
    }

    update(maze) {
        if (this.isAligned()) {
            if (this.canMove(maze, this.nextDir)) {
                this.dir = this.nextDir;
            }
        }

        if (this.canMove(maze, this.dir)) {
            this.x += this.dir.x * this.speed;
            this.y += this.dir.y * this.speed;

            this.mouthAngle += this.mouthSpeed;
            if (this.mouthAngle > 0.4 || this.mouthAngle < 0.05) {
                this.mouthSpeed = -this.mouthSpeed;
            }

            if (this.x < -TILE_SIZE / 2) {
                this.x = CANVAS_WIDTH - TILE_SIZE / 2;
            } else if (this.x > CANVAS_WIDTH - TILE_SIZE / 2) {
                this.x = -TILE_SIZE / 2;
            }
        }
    }

    isAligned() {
        return Math.abs(this.x % TILE_SIZE) < 0.1 && Math.abs(this.y % TILE_SIZE) < 0.1;
    }

    canMove(maze, dir) {
        if (dir === DIR_NONE) return false;
        const nextX = this.x + dir.x * this.speed;
        const nextY = this.y + dir.y * this.speed;

        if (nextX < 0 || nextX >= CANVAS_WIDTH - TILE_SIZE) return true;

        const tileX = Math.floor((nextX + TILE_SIZE / 2) / TILE_SIZE);
        const tileY = Math.floor((nextY + TILE_SIZE / 2) / TILE_SIZE);

        if (tileY < 0 || tileY >= ROWS || tileX < 0 || tileX >= COLS) return false;
        const cell = maze[tileY][tileX];
        return cell !== 1 && cell !== 4;
    }

    render(ctx, gameState) {
        ctx.save();
        ctx.translate(this.x + TILE_SIZE / 2, this.y + TILE_SIZE / 2);

        if (gameState === 'DYING') {
            ctx.fillStyle = '#ffff00';
            ctx.beginPath();
            const radius = TILE_SIZE / 2 * (1 - this.deathAnimProgress);
            ctx.arc(0, 0, Math.max(0, radius), 0, (2 - this.deathAnimProgress * 2) * Math.PI);
            ctx.lineTo(0, 0);
            ctx.fill();
            ctx.restore();
            return;
        }

        let rotation = 0;
        if (this.dir === DIR_UP) rotation = 1.5 * Math.PI;
        else if (this.dir === DIR_DOWN) rotation = 0.5 * Math.PI;
        else if (this.dir === DIR_LEFT) rotation = 1.0 * Math.PI;
        else if (this.dir === DIR_RIGHT) rotation = 0.0 * Math.PI;

        ctx.rotate(rotation);

        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(0, 0, TILE_SIZE / 2 - 1, this.mouthAngle * Math.PI, (2 - this.mouthAngle) * Math.PI);
        ctx.lineTo(0, 0);
        ctx.fill();

        // Bow
        ctx.fillStyle = '#ff007f';
        ctx.fillRect(-2, -10, 4, 4);
        ctx.beginPath();
        ctx.moveTo(-2, -8);
        ctx.lineTo(-8, -13);
        ctx.lineTo(-8, -3);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(2, -8);
        ctx.lineTo(8, -13);
        ctx.lineTo(8, -3);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(1, -5, 1.5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.restore();
    }
}

// Ghost Class
class Ghost {
    constructor(x, y, color, type) {
        this.startX = x;
        this.startY = y;
        this.color = color;
        this.type = type;
        this.reset();
    }

    reset() {
        this.x = this.startX;
        this.y = this.startY;
        this.dir = DIR_UP;
        this.speed = 1.75;
        this.state = 'CHASE';
    }

    getTileCoord() {
        return {
            x: Math.floor((this.x + TILE_SIZE / 2) / TILE_SIZE),
            y: Math.floor((this.y + TILE_SIZE / 2) / TILE_SIZE)
        };
    }

    reverseDirection() {
        this.dir = { x: -this.dir.x, y: -this.dir.y };
    }

    update(maze, player) {
        if (Math.abs(this.x % TILE_SIZE) < 0.1 && Math.abs(this.y % TILE_SIZE) < 0.1) {
            const validDirs = [DIR_UP, DIR_DOWN, DIR_LEFT, DIR_RIGHT].filter(d => {
                if (d.x === -this.dir.x && d.y === -this.dir.y) return false;
                return this.canMove(maze, d);
            });

            if (validDirs.length === 0) {
                validDirs.push({ x: -this.dir.x, y: -this.dir.y });
            }

            if (this.state === 'FRIGHTENED') {
                this.dir = validDirs[Math.floor(Math.random() * validDirs.length)];
            } else if (this.state === 'EATEN') {
                const targetX = 13.5 * TILE_SIZE;
                const targetY = 14 * TILE_SIZE;
                let bestDir = validDirs[0];
                let minDst = Infinity;
                validDirs.forEach(d => {
                    const nextX = this.x + d.x * TILE_SIZE;
                    const nextY = this.y + d.y * TILE_SIZE;
                    const dst = Math.hypot(nextX - targetX, nextY - targetY);
                    if (dst < minDst) {
                        minDst = dst;
                        bestDir = d;
                    }
                });
                this.dir = bestDir;
                if (Math.hypot(this.x - targetX, this.y - targetY) < 4) {
                    this.state = 'CHASE';
                }
            } else {
                let targetX = player.x;
                let targetY = player.y;

                if (this.type === 'pinky') {
                    targetX += player.dir.x * TILE_SIZE * 4;
                    targetY += player.dir.y * TILE_SIZE * 4;
                } else if (this.type === 'inky') {
                    targetX += (player.x - this.x) * 0.5;
                    targetY += (player.y - this.y) * 0.5;
                } else if (this.type === 'sue') {
                    const dist = Math.hypot(this.x - player.x, this.y - player.y);
                    if (dist < TILE_SIZE * 5) {
                        targetX = 0;
                        targetY = CANVAS_HEIGHT;
                    }
                }

                let bestDir = validDirs[0];
                let minDst = Infinity;
                validDirs.forEach(d => {
                    const nextX = this.x + d.x * TILE_SIZE;
                    const nextY = this.y + d.y * TILE_SIZE;
                    const dst = Math.hypot(nextX - targetX, nextY - targetY);
                    if (dst < minDst) {
                        minDst = dst;
                        bestDir = d;
                    }
                });
                this.dir = bestDir;
            }
        }

        const currentSpeed = (this.state === 'FRIGHTENED') ? 1.0 : (this.state === 'EATEN' ? 3.0 : this.speed);
        this.x += this.dir.x * currentSpeed;
        this.y += this.dir.y * currentSpeed;

        if (this.x < -TILE_SIZE / 2) this.x = CANVAS_WIDTH - TILE_SIZE / 2;
        else if (this.x > CANVAS_WIDTH - TILE_SIZE / 2) this.x = -TILE_SIZE / 2;
    }

    canMove(maze, dir) {
        if (dir === DIR_NONE) return false;
        const nextX = this.x + dir.x * TILE_SIZE;
        const nextY = this.y + dir.y * TILE_SIZE;

        if (nextX < 0 || nextX >= CANVAS_WIDTH - TILE_SIZE) return true;

        const tileX = Math.floor((nextX + TILE_SIZE / 2) / TILE_SIZE);
        const tileY = Math.floor((nextY + TILE_SIZE / 2) / TILE_SIZE);

        if (tileY < 0 || tileY >= ROWS || tileX < 0 || tileX >= COLS) return false;
        const cell = maze[tileY][tileX];
        return cell !== 1;
    }

    render(ctx) {
        ctx.save();
        ctx.translate(this.x + TILE_SIZE / 2, this.y + TILE_SIZE / 2);

        let ghostColor = this.color;
        if (this.state === 'FRIGHTENED') {
            ghostColor = '#2121ff';
        } else if (this.state === 'EATEN') {
            this.renderEyes(ctx);
            ctx.restore();
            return;
        }

        ctx.fillStyle = ghostColor;
        ctx.beginPath();
        ctx.arc(0, -2, TILE_SIZE / 2 - 1, Math.PI, 0, false);
        ctx.lineTo(TILE_SIZE / 2 - 1, TILE_SIZE / 2);
        ctx.lineTo(TILE_SIZE / 2 - 3, TILE_SIZE / 2 - 2);
        ctx.lineTo(TILE_SIZE / 4, TILE_SIZE / 2);
        ctx.lineTo(0, TILE_SIZE / 2 - 2);
        ctx.lineTo(-TILE_SIZE / 4, TILE_SIZE / 2);
        ctx.lineTo(-(TILE_SIZE / 2 - 3), TILE_SIZE / 2 - 2);
        ctx.lineTo(-(TILE_SIZE / 2 - 1), TILE_SIZE / 2);
        ctx.closePath();
        ctx.fill();

        this.renderEyes(ctx);

        ctx.restore();
    }

    renderEyes(ctx) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-3, -3, 2.5, 0, 2 * Math.PI);
        ctx.arc(3, -3, 2.5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = '#0000ff';
        let px = 0, py = 0;
        if (this.dir === DIR_UP) py = -1;
        else if (this.dir === DIR_DOWN) py = 1;
        else if (this.dir === DIR_LEFT) px = -1;
        else if (this.dir === DIR_RIGHT) px = 1;

        ctx.beginPath();
        ctx.arc(-3 + px, -3 + py, 1.2, 0, 2 * Math.PI);
        ctx.arc(3 + px, -3 + py, 1.2, 0, 2 * Math.PI);
        ctx.fill();
    }
}

// Start Game on Load
window.addEventListener('DOMContentLoaded', () => {
    window.gameInstance = new Game();
    window.gameInstance.run();
});
