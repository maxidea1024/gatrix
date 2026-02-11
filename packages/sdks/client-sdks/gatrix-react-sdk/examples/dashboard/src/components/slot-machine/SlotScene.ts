// Slot Machine - Main Phaser Scene (smooth scrolling reels)
import Phaser from 'phaser';
import {
    SlotSymbol, SYMBOL_CONFIGS, BASE_SYMBOLS, THEMES, ThemeKey,
    ASSET_PATH, SYM_DISPLAY, CELL,
} from './SlotTypes';
import { SlotSounds } from './SlotSounds';

const GAME_W = 700;
const GAME_H = 550;
const REEL_CX = GAME_W / 2;
const REEL_CY = 240;
const FRAME_PAD = 24;
const FRAME_W = CELL * 3 + FRAME_PAD * 2;
const FRAME_H = CELL * 3 + FRAME_PAD * 2;
const FRAME_X = REEL_CX - FRAME_W / 2;
const FRAME_Y = REEL_CY - CELL * 1.5 - FRAME_PAD;
const VISIBLE_ROWS = 3;
const BUFFER_ROWS = 2; // Extra rows above/below for smooth scroll
const TOTAL_ROWS = VISIBLE_ROWS + BUFFER_ROWS;

const PAYLINES: [number, number][][] = [
    [[0, 0], [1, 0], [2, 0]],
    [[0, 1], [1, 1], [2, 1]],
    [[0, 2], [1, 2], [2, 2]],
    [[0, 0], [1, 1], [2, 2]],
    [[0, 2], [1, 1], [2, 0]],
];
const PAYLINE_COLORS = [0xff1744, 0x00e676, 0x2979ff, 0xffd600, 0xff00ff];

const WEIGHTS: Record<SlotSymbol, number> = {
    cherry: 22, apple: 18, banana: 14, lemon: 10, wild: 3,
};

export interface SlotBridge {
    config: import('./SlotTypes').SlotConfig;
    playerName: string;
    vipLevel: number;
    credits: number;
    bet: number;
    lastWin: number;
    totalBet: number;
    totalWin: number;
    isSpinning: boolean;
    spinRequested: boolean;
    autoSpinActive: boolean;
    comboCount: number;
    freeSpinsLeft: number;
    onStateChange?: () => void;
}

function cellPos(col: number, row: number) {
    return { x: REEL_CX + (col - 1) * CELL, y: REEL_CY + (row - 1) * CELL };
}

function weightedRandom(wildEnabled: boolean): SlotSymbol {
    const syms = wildEnabled ? SYMBOL_CONFIGS : BASE_SYMBOLS;
    const w = syms.map(s => WEIGHTS[s.key]);
    const total = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < syms.length; i++) {
        r -= w[i];
        if (r <= 0) return syms[i].key;
    }
    return syms[0].key;
}

function generateResult(wildEnabled: boolean): SlotSymbol[][] {
    const result: SlotSymbol[][] = [];
    for (let col = 0; col < 3; col++) {
        result[col] = [];
        for (let row = 0; row < 3; row++) {
            result[col][row] = weightedRandom(wildEnabled);
        }
    }
    return result;
}

interface WinLine {
    lineIdx: number;
    symbol: SlotSymbol;
    payout: number;
    positions: [number, number][];
}

function checkWins(grid: SlotSymbol[][], wildEnabled: boolean, multiplier: number, bet: number, customPayouts: Record<string, number> | null): WinLine[] {
    const wins: WinLine[] = [];
    for (let li = 0; li < PAYLINES.length; li++) {
        const line = PAYLINES[li];
        const syms = line.map(([c, r]) => grid[c][r]);
        const nonWild = syms.filter(s => s !== 'wild');
        let matched = false;
        let matchSym: SlotSymbol | null = null;
        if (!wildEnabled) {
            if (syms[0] === syms[1] && syms[1] === syms[2]) { matched = true; matchSym = syms[0]; }
        } else {
            if (nonWild.length === 0) { matched = true; matchSym = 'lemon'; }
            else if (nonWild.every(s => s === nonWild[0])) { matched = true; matchSym = nonWild[0]; }
        }
        if (matched && matchSym) {
            const cfg = SYMBOL_CONFIGS.find(s => s.key === matchSym)!;
            const basePay = customPayouts?.[matchSym] ?? cfg.payout3;
            const wildBonus = wildEnabled && nonWild.length < 3 ? 1.5 : 1;
            wins.push({ lineIdx: li, symbol: matchSym, payout: Math.floor(basePay * multiplier * bet * wildBonus), positions: line });
        }
    }
    return wins;
}

// Reel state - scrollOffset drives all positions, symbols array tracks current textures
interface ReelColumn {
    images: Phaser.GameObjects.Image[]; // Fixed order: [0]=buffer top, [1]=row0, [2]=row1, [3]=row2, [4]=buffer bottom
    symbols: SlotSymbol[];              // Matches images order: 5 symbols
    scrollOffset: number;               // Pixels scrolled within current cell (0..CELL)
    speed: number;
    state: 'idle' | 'spinning' | 'stopping' | 'landing';
    stopSymbols: SlotSymbol[];          // Final 3 symbols for visible rows
    stopQueue: SlotSymbol[];            // Queue of symbols to feed during deceleration
}

export class SlotScene extends Phaser.Scene {
    static pendingBridge: SlotBridge | null = null;

    private bridge!: SlotBridge;
    private sounds!: SlotSounds;
    private reels: ReelColumn[] = [];
    private displayGrid: SlotSymbol[][] = [];
    private finalResult: SlotSymbol[][] = [];
    private currentTheme: ThemeKey = 'classic';
    private bgGfx!: Phaser.GameObjects.Graphics;
    private frameGfx!: Phaser.GameObjects.Graphics;
    private winLineGfx!: Phaser.GameObjects.Graphics;
    private creditsTxt!: Phaser.GameObjects.Text;
    private betTxt!: Phaser.GameObjects.Text;
    private winTxt!: Phaser.GameObjects.Text;
    private msgTxt!: Phaser.GameObjects.Text;
    private spinBtn!: Phaser.GameObjects.Container;
    private isProcessing = false;
    private ambientTimer: Phaser.Time.TimerEvent | null = null;

    constructor() { super({ key: 'SlotScene' }); }

    init(data?: { bridge?: SlotBridge }) {
        const bridge = data?.bridge ?? SlotScene.pendingBridge;
        if (bridge) {
            this.bridge = bridge;
            this.currentTheme = (this.bridge.config.theme as ThemeKey) || 'classic';
        }
    }

    preload() {
        for (const sym of SYMBOL_CONFIGS) {
            this.load.image(`sym_${sym.key}`, `${ASSET_PATH}/${sym.imageFile}`);
        }
        this.load.image('coin', `${ASSET_PATH}/coin.png`);
        this.generateParticleTextures();
    }

    create() {
        this.sounds = new SlotSounds();
        this.sounds.init();
        this.sounds.setEnabled(this.bridge.config.soundEnabled);

        this.drawBg();
        this.drawFrame();
        this.createReels();
        this.createUI();
        this.winLineGfx = this.add.graphics().setDepth(10);
        this.startAmbient();

        // Check if auto-spin is already active on scene start
        this.time.delayedCall(500, () => {
            this.triggerAutoSpin();
        });
    }

    update() {
        if (!this.bridge) return;

        // Auto-spin: continuously trigger spins when enabled
        if (this.bridge.autoSpinActive && this.bridge.config.autoSpinEnabled
            && !this.bridge.isSpinning && !this.isProcessing && !this.bridge.spinRequested) {
            this.bridge.spinRequested = true;
        }

        if (this.bridge.spinRequested && !this.bridge.isSpinning && !this.isProcessing) {
            this.bridge.spinRequested = false;
            this.startSpin();
        }

        this.updateReels();

        this.creditsTxt.setText(`CREDITS: ${this.bridge.credits}`);
        this.betTxt.setText(`BET: ${this.bridge.bet}`);
        this.spinBtn.setAlpha(this.bridge.isSpinning || this.isProcessing ? 0.4 : 1);
    }

    // ==================== Symbol Helper ====================

    private setSymTexture(img: Phaser.GameObjects.Image, sym: SlotSymbol) {
        img.setTexture(`sym_${sym}`);
        const s = SYM_DISPLAY / Math.max(img.width, img.height);
        img.setScale(s);
    }

    private generateParticleTextures() {
        const c = document.createElement('canvas');
        c.width = 16; c.height = 16;
        const ctx = c.getContext('2d')!;
        const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.5, '#ffffaa');
        g.addColorStop(1, 'rgba(255,255,200,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 16, 16);
        this.textures.addCanvas('particle_dot', c);

        const c2 = document.createElement('canvas');
        c2.width = 8; c2.height = 8;
        const ctx2 = c2.getContext('2d')!;
        const g2 = ctx2.createRadialGradient(4, 4, 0, 4, 4, 4);
        g2.addColorStop(0, '#ffd700');
        g2.addColorStop(1, 'rgba(255,215,0,0)');
        ctx2.fillStyle = g2;
        ctx2.fillRect(0, 0, 8, 8);
        this.textures.addCanvas('spark', c2);
    }

    // ==================== Scene Setup ====================

    private drawBg() {
        const t = THEMES[this.currentTheme];
        this.bgGfx = this.add.graphics();
        const steps = 30;
        for (let i = 0; i < steps; i++) {
            const c1 = Phaser.Display.Color.HexStringToColor(t.bg1);
            const c2 = Phaser.Display.Color.HexStringToColor(t.bg2);
            const ratio = i / (steps - 1);
            const mixed = Phaser.Display.Color.Interpolate.ColorWithColor(c1, c2, 100, Math.floor(ratio * 100));
            this.bgGfx.fillStyle(Phaser.Display.Color.GetColor(mixed.r, mixed.g, mixed.b));
            const sliceH = Math.ceil(GAME_H / steps) + 1;
            this.bgGfx.fillRect(0, Math.floor((GAME_H / steps) * i), GAME_W, sliceH);
        }
    }

    private drawFrame() {
        const t = THEMES[this.currentTheme];
        this.frameGfx = this.add.graphics();
        this.frameGfx.lineStyle(6, t.frameColor, 0.3);
        this.frameGfx.strokeRoundedRect(FRAME_X - 4, FRAME_Y - 4, FRAME_W + 8, FRAME_H + 8, 16);
        this.frameGfx.lineStyle(3, t.frameColor, 1);
        this.frameGfx.strokeRoundedRect(FRAME_X, FRAME_Y, FRAME_W, FRAME_H, 12);
        this.frameGfx.fillStyle(0x0a0a1a, 0.9);
        this.frameGfx.fillRoundedRect(FRAME_X + 4, FRAME_Y + 4, FRAME_W - 8, FRAME_H - 8, 10);
        this.frameGfx.lineStyle(1, t.frameColor, 0.15);
        for (let c = 1; c < 3; c++) {
            const x = FRAME_X + FRAME_PAD + c * CELL;
            this.frameGfx.lineBetween(x, FRAME_Y + 8, x, FRAME_Y + FRAME_H - 8);
        }
        for (let r = 1; r < 3; r++) {
            const y = FRAME_Y + FRAME_PAD + r * CELL;
            this.frameGfx.lineBetween(FRAME_X + 8, y, FRAME_X + FRAME_W - 8, y);
        }
        for (let r = 0; r < 3; r++) {
            const y = cellPos(0, r).y;
            this.frameGfx.fillStyle(PAYLINE_COLORS[r], 0.6);
            this.frameGfx.fillTriangle(FRAME_X - 8, y - 6, FRAME_X - 8, y + 6, FRAME_X + 2, y);
            this.frameGfx.fillTriangle(FRAME_X + FRAME_W + 8, y - 6, FRAME_X + FRAME_W + 8, y + 6, FRAME_X + FRAME_W - 2, y);
        }
        this.add.text(REEL_CX, FRAME_Y - 28, '✦ GATRIX SLOT SAGA ✦', {
            fontSize: '22px', fontFamily: 'Georgia, serif',
            color: t.textColor, fontStyle: 'bold', stroke: '#000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(5);
    }

    // ==================== Reel System ====================

    private createReels() {
        const maskGfx = this.make.graphics({ x: 0, y: 0 });
        maskGfx.fillStyle(0xffffff);
        maskGfx.fillRect(FRAME_X + 4, FRAME_Y + 4, FRAME_W - 8, FRAME_H - 8);
        const mask = maskGfx.createGeometryMask();

        this.reels = [];
        this.displayGrid = [];

        for (let col = 0; col < 3; col++) {
            const images: Phaser.GameObjects.Image[] = [];
            const symbols: SlotSymbol[] = [];
            this.displayGrid[col] = [];

            // 5 images: index 0=buffer top, 1-3=visible, 4=buffer bottom
            for (let i = 0; i < TOTAL_ROWS; i++) {
                const sym = weightedRandom(false);
                symbols.push(sym);
                const x = REEL_CX + (col - 1) * CELL;
                const { y } = cellPos(col, i - 1); // i=0 -> row -1 (above)
                const img = this.add.image(x, y, `sym_${sym}`).setDepth(2);
                this.setSymTexture(img, sym);
                img.setMask(mask);
                images.push(img);

                if (i >= 1 && i <= 3) {
                    this.displayGrid[col][i - 1] = sym;
                }
            }

            this.reels.push({
                images,
                symbols,
                scrollOffset: 0,
                speed: 0,
                state: 'idle',
                stopSymbols: [],
                stopQueue: [],
            });
        }
    }

    // Position all images in a column based on scrollOffset
    private positionReelImages(col: number) {
        const reel = this.reels[col];
        for (let i = 0; i < TOTAL_ROWS; i++) {
            const { y: baseY } = cellPos(col, i - 1);
            reel.images[i].y = baseY + reel.scrollOffset;
        }
    }

    // When scrollOffset crosses CELL, rotate symbols: bottom exits, new enters top
    private rotateSymbols(col: number) {
        const reel = this.reels[col];
        reel.symbols.pop(); // Remove bottom
        // If stopping and queue has symbols, use queued symbol; otherwise random
        let newSym: SlotSymbol;
        if (reel.state === 'stopping' && reel.stopQueue.length > 0) {
            newSym = reel.stopQueue.shift()!;
        } else {
            newSym = weightedRandom(this.bridge.config.wildSymbolEnabled);
        }
        reel.symbols.unshift(newSym); // Add to top
        // Reassign all textures
        for (let i = 0; i < TOTAL_ROWS; i++) {
            this.setSymTexture(reel.images[i], reel.symbols[i]);
        }
    }

    private updateReels() {
        for (let col = 0; col < 3; col++) {
            const reel = this.reels[col];
            if (reel.state === 'idle' || reel.state === 'landing') continue;

            // Decelerate if stopping
            if (reel.state === 'stopping') {
                if (reel.stopQueue.length > 0) {
                    // Keep fast speed while feeding queue — decisive feel
                    reel.speed = Math.max(12, reel.speed * 0.97);
                } else {
                    // Queue exhausted — snap immediately
                    reel.state = 'landing';
                    reel.speed = 0;
                    reel.scrollOffset = 0;

                    // Snap to grid with tiny settle bounce
                    for (let i = 0; i < TOTAL_ROWS; i++) {
                        const { y: gridY } = cellPos(col, i - 1);
                        reel.images[i].y = gridY + 6;
                        this.tweens.add({
                            targets: reel.images[i],
                            y: gridY,
                            duration: 100,
                            ease: 'Cubic.out',
                        });
                    }

                    for (let row = 0; row < 3; row++) {
                        this.displayGrid[col][row] = reel.symbols[row + 1];
                    }

                    this.sounds.reelStop();

                    this.time.delayedCall(120, () => {
                        reel.state = 'idle';
                        if (this.reels.every(r => r.state === 'idle')) {
                            this.onAllStopped();
                        }
                    });
                    continue;
                }
            }

            // Advance scroll
            reel.scrollOffset += reel.speed;

            // Check cell boundary crossing
            while (reel.scrollOffset >= CELL) {
                reel.scrollOffset -= CELL;
                this.rotateSymbols(col);
            }

            // Position images
            this.positionReelImages(col);
        }
    }

    // ==================== Spin Control ====================

    startSpin() {
        if (this.bridge.credits < this.bridge.bet) return;
        this.bridge.isSpinning = true;
        this.bridge.credits -= this.bridge.bet;
        this.bridge.totalBet += this.bridge.bet;
        this.bridge.lastWin = 0;
        this.winTxt.setText('');
        this.winLineGfx.clear();
        this.bridge.onStateChange?.();
        this.sounds.spinStart();

        this.finalResult = generateResult(this.bridge.config.wildSymbolEnabled);
        const speedFactor = this.bridge.config.spinSpeed || 1;
        const maxSpeed = 18 * speedFactor;

        for (let col = 0; col < 3; col++) {
            const reel = this.reels[col];
            reel.state = 'spinning';
            reel.scrollOffset = 0;
            reel.speed = maxSpeed;
            reel.stopSymbols = this.finalResult[col];
            reel.stopQueue = [];

            const stopDelay = 600 + col * 400;
            this.time.delayedCall(stopDelay / speedFactor, () => {
                reel.state = 'stopping';
                reel.speed = Math.max(10, reel.speed * 0.7);
                // Build queue: feed order so final state is [bufTop, stop0, stop1, stop2, bufBot]
                // Each symbol enters at top (unshift). After 5 rotations:
                // Feed 1→becomes idx4, Feed 2→idx3, Feed 3→idx2, Feed 4→idx1, Feed 5→idx0
                reel.stopQueue = [
                    weightedRandom(false),    // will end up at index 4 (buffer bottom)
                    reel.stopSymbols[2],       // will end up at index 3 (row 2)
                    reel.stopSymbols[1],       // will end up at index 2 (row 1)
                    reel.stopSymbols[0],       // will end up at index 1 (row 0)
                    weightedRandom(false),    // will end up at index 0 (buffer top)
                ];
            });
        }
    }

    private onAllStopped() {
        this.bridge.isSpinning = false;
        this.isProcessing = true;

        const wins = checkWins(
            this.finalResult, this.bridge.config.wildSymbolEnabled,
            this.bridge.config.winMultiplier || 1, this.bridge.bet,
            this.bridge.config.payoutTable,
        );

        if (wins.length > 0) {
            const totalWin = wins.reduce((sum, w) => sum + w.payout, 0);
            this.bridge.lastWin = totalWin;
            this.bridge.credits += totalWin;
            this.bridge.totalWin += totalWin;
            this.bridge.comboCount++;
            this.winTxt.setText(`WIN: ${totalWin}`);
            this.showWinLines(wins);
            this.highlightWins(wins);
            this.burstCoins(wins);

            if (totalWin >= this.bridge.bet * 30) {
                this.showMessage('JACKPOT!', '#00e5ff');
                this.sounds.jackpot();
                this.cameras.main.shake(500, 0.012);
            } else if (totalWin >= this.bridge.bet * 10) {
                this.showMessage('BIG WIN!', '#ffd700');
                this.sounds.bigWin();
                this.cameras.main.shake(250, 0.006);
            } else {
                this.sounds.win();
            }

            if (this.bridge.config.bonusRoundEnabled && this.bridge.comboCount >= 3 && this.bridge.freeSpinsLeft === 0) {
                this.time.delayedCall(1000, () => {
                    this.bridge.freeSpinsLeft = 5;
                    this.showMessage('FREE SPINS!', '#ff00ff');
                    this.sounds.bonusStart();
                    this.bridge.onStateChange?.();
                });
            }

            this.time.delayedCall(1600, () => {
                this.isProcessing = false;
                this.winLineGfx.clear();
                this.bridge.onStateChange?.();
                this.checkAutoOrFree();
            });
        } else {
            this.bridge.comboCount = 0;
            this.isProcessing = false;
            this.bridge.onStateChange?.();
            this.checkAutoOrFree();
        }
    }

    private checkAutoOrFree() {
        if (this.bridge.freeSpinsLeft > 0) {
            this.bridge.freeSpinsLeft--;
            this.sounds.freeSpin();
            this.time.delayedCall(500, () => {
                this.bridge.spinRequested = true;
                this.bridge.onStateChange?.();
            });
        } else if (this.bridge.autoSpinActive && this.bridge.config.autoSpinEnabled) {
            this.time.delayedCall(800, () => { this.bridge.spinRequested = true; });
        }
    }

    // Called externally when auto-spin flag changes
    triggerAutoSpin() {
        if (this.bridge.autoSpinActive && this.bridge.config.autoSpinEnabled
            && !this.bridge.isSpinning && !this.isProcessing) {
            this.bridge.spinRequested = true;
        }
    }

    // ==================== UI ====================

    private createUI() {
        const t = THEMES[this.currentTheme];
        const PIXEL_FONT = '"Press Start 2P", "Courier New", monospace';
        const infoY = FRAME_Y + FRAME_H + 22;

        // Row 1: CREDITS left, WIN right
        this.creditsTxt = this.add.text(FRAME_X + 6, infoY, `CREDITS: ${this.bridge.credits}`, {
            fontSize: '11px', fontFamily: PIXEL_FONT, color: '#ffd700', stroke: '#000', strokeThickness: 2,
        }).setDepth(5);

        this.winTxt = this.add.text(FRAME_X + FRAME_W - 6, infoY, '', {
            fontSize: '11px', fontFamily: PIXEL_FONT, color: '#00e676', stroke: '#000', strokeThickness: 2,
        }).setOrigin(1, 0).setDepth(5);

        // Row 2: BET center with arrows
        const betY = infoY + 22;
        this.betTxt = this.add.text(REEL_CX, betY, `BET: ${this.bridge.bet}`, {
            fontSize: '10px', fontFamily: PIXEL_FONT, color: '#fff', stroke: '#000', strokeThickness: 2,
        }).setOrigin(0.5, 0).setDepth(5);

        this.add.text(REEL_CX - 60, betY + 1, '◀', {
            fontSize: '10px', fontFamily: PIXEL_FONT, color: '#ccc',
        }).setOrigin(0.5, 0).setDepth(5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                if (!this.bridge.isSpinning) {
                    this.bridge.bet = Math.max(1, this.bridge.bet - 5);
                    this.sounds.buttonClick(); this.bridge.onStateChange?.();
                }
            });

        this.add.text(REEL_CX + 60, betY + 1, '▶', {
            fontSize: '10px', fontFamily: PIXEL_FONT, color: '#ccc',
        }).setOrigin(0.5, 0).setDepth(5).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                if (!this.bridge.isSpinning) {
                    this.bridge.bet = Math.min(100, this.bridge.bet + 5);
                    this.sounds.buttonClick(); this.bridge.onStateChange?.();
                }
            });

        // SPIN button - more spacing below
        const btnY = betY + 38;
        const btnGfx = this.add.graphics();
        btnGfx.fillStyle(t.frameColor, 1);
        btnGfx.fillRoundedRect(REEL_CX - 75, btnY - 24, 150, 48, 24);
        btnGfx.lineStyle(2, 0xffffff, 0.4);
        btnGfx.strokeRoundedRect(REEL_CX - 75, btnY - 24, 150, 48, 24);
        btnGfx.setDepth(5);
        const btnTxt = this.add.text(REEL_CX, btnY, '▶  SPIN', {
            fontSize: '22px', fontFamily: 'Impact, sans-serif', color: '#1a1a2e',
        }).setOrigin(0.5).setDepth(5);
        // Interactive zone with correct position and size
        const btnZone = this.add.zone(REEL_CX, btnY, 150, 48).setDepth(6)
            .setInteractive({ useHandCursor: true });
        btnZone.on('pointerdown', () => {
            if (!this.bridge.isSpinning && !this.isProcessing) {
                this.sounds.buttonClick();
                this.bridge.spinRequested = true;
            }
        });
        btnZone.on('pointerover', () => {
            if (!this.bridge.isSpinning) { btnTxt.setColor('#ffffff'); }
        });
        btnZone.on('pointerout', () => { btnTxt.setColor('#1a1a2e'); });
        // Store reference for alpha control
        this.spinBtn = this.add.container(0, 0, [btnGfx, btnTxt]).setDepth(5);

        // Big message text
        this.msgTxt = this.add.text(REEL_CX, REEL_CY, '', {
            fontSize: '52px', fontFamily: 'Impact, sans-serif', color: '#ffd700',
            stroke: '#000', strokeThickness: 6,
        }).setOrigin(0.5).setDepth(20).setAlpha(0);
    }

    // ==================== Effects ====================

    private showWinLines(wins: WinLine[]) {
        this.winLineGfx.clear();
        for (const w of wins) {
            const color = PAYLINE_COLORS[w.lineIdx % PAYLINE_COLORS.length];
            const pts = w.positions.map(([c, r]) => cellPos(c, r));
            // Glow layer
            this.winLineGfx.lineStyle(8, color, 0.3);
            this.winLineGfx.beginPath();
            this.winLineGfx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) this.winLineGfx.lineTo(pts[i].x, pts[i].y);
            this.winLineGfx.strokePath();
            // Main line
            this.winLineGfx.lineStyle(4, color, 0.9);
            this.winLineGfx.beginPath();
            this.winLineGfx.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) this.winLineGfx.lineTo(pts[i].x, pts[i].y);
            this.winLineGfx.strokePath();
        }
    }

    // Find the image closest to a grid position (since array order is not fixed)
    private getImageAtGrid(col: number, row: number): Phaser.GameObjects.Image {
        const { y: targetY } = cellPos(col, row);
        let closest = this.reels[col].images[0];
        let minDist = Math.abs(closest.y - targetY);
        for (const img of this.reels[col].images) {
            const d = Math.abs(img.y - targetY);
            if (d < minDist) { minDist = d; closest = img; }
        }
        return closest;
    }

    private highlightWins(wins: WinLine[]) {
        const done = new Set<string>();
        for (const w of wins) {
            for (const [c, r] of w.positions) {
                if (done.has(`${c}-${r}`)) continue;
                done.add(`${c}-${r}`);
                const img = this.getImageAtGrid(c, r);
                const baseScale = SYM_DISPLAY / Math.max(img.width, img.height);
                this.tweens.add({
                    targets: img,
                    scaleX: baseScale * 1.2, scaleY: baseScale * 1.2,
                    duration: 200, yoyo: true, repeat: 2, ease: 'Sine.inOut',
                });
            }
        }
    }

    private burstCoins(wins: WinLine[]) {
        const creditPos = { x: FRAME_X + 60, y: FRAME_Y + FRAME_H + 24 }; // target: credits text

        for (const w of wins) {
            for (const [c, r] of w.positions) {
                const { x, y } = cellPos(c, r);

                // Sparkle burst at winning position
                const sparkEmitter = this.add.particles(x, y, 'spark', {
                    speed: { min: 80, max: 200 },
                    lifespan: 600,
                    scale: { start: 1.5, end: 0 },
                    alpha: { start: 1, end: 0 },
                    angle: { min: 0, max: 360 },
                    emitting: false,
                }).setDepth(15);
                sparkEmitter.explode(12);
                this.time.delayedCall(800, () => sparkEmitter.destroy());

                // Coin burst at winning position
                const coinEmitter = this.add.particles(x, y, 'coin', {
                    speed: { min: 40, max: 150 },
                    lifespan: 700,
                    scale: { start: 0.15, end: 0.05 },
                    alpha: { start: 1, end: 0.3 },
                    angle: { min: 0, max: 360 },
                    rotate: { min: 0, max: 360 },
                    emitting: false,
                }).setDepth(15);
                coinEmitter.explode(8);
                this.time.delayedCall(900, () => coinEmitter.destroy());

                // Flying coins toward credits text
                const numCoins = 3 + Math.floor(w.payout / (this.bridge.bet * 5));
                for (let i = 0; i < Math.min(numCoins, 8); i++) {
                    const coin = this.add.image(x, y, 'coin').setDepth(16);
                    const s = 0.12;
                    coin.setScale(s);
                    coin.setAlpha(0);

                    // Staggered launch with arc motion
                    this.time.delayedCall(i * 80, () => {
                        coin.setAlpha(1);
                        // Random offset from source
                        const ox = Phaser.Math.Between(-20, 20);
                        const oy = Phaser.Math.Between(-20, 20);
                        coin.setPosition(x + ox, y + oy);

                        // Arc via mid-point
                        const midX = (x + ox + creditPos.x) / 2 + Phaser.Math.Between(-40, 40);
                        const midY = Math.min(y + oy, creditPos.y) - Phaser.Math.Between(30, 80);

                        // First half: fly up and out
                        this.tweens.add({
                            targets: coin,
                            x: midX, y: midY,
                            scaleX: s * 1.3, scaleY: s * 1.3,
                            duration: 250, ease: 'Sine.out',
                            onComplete: () => {
                                // Second half: fly into credits
                                this.tweens.add({
                                    targets: coin,
                                    x: creditPos.x, y: creditPos.y,
                                    scaleX: s * 0.5, scaleY: s * 0.5,
                                    alpha: 0.6,
                                    duration: 300, ease: 'Sine.in',
                                    onComplete: () => {
                                        // Flash at landing
                                        const flash = this.add.circle(creditPos.x, creditPos.y, 8, 0xffd700, 0.8).setDepth(16);
                                        this.tweens.add({
                                            targets: flash,
                                            scaleX: 2, scaleY: 2, alpha: 0,
                                            duration: 200,
                                            onComplete: () => flash.destroy(),
                                        });
                                        coin.destroy();
                                    },
                                });
                            },
                        });
                    });
                }
            }
        }
    }

    private showMessage(text: string, color: string) {
        this.msgTxt.setText(text).setColor(color).setAlpha(0).setScale(0.3);
        this.tweens.add({
            targets: this.msgTxt, alpha: 1, scaleX: 1.2, scaleY: 1.2,
            duration: 350, ease: 'Back.out',
            onComplete: () => {
                this.tweens.add({
                    targets: this.msgTxt, alpha: 0, scaleX: 1.5, scaleY: 1.5,
                    delay: 900, duration: 400,
                });
            },
        });
    }

    private startAmbient() {
        const t = THEMES[this.currentTheme];
        this.ambientTimer = this.time.addEvent({
            delay: 1200, loop: true,
            callback: () => {
                const x = Phaser.Math.Between(0, GAME_W);
                const emitter = this.add.particles(x, GAME_H + 10, 'particle_dot', {
                    speedY: { min: -50, max: -25 }, speedX: { min: -15, max: 15 },
                    lifespan: 4000, scale: { start: 0.6, end: 0 },
                    alpha: { start: 0.25, end: 0 },
                    tint: t.particleColors[Phaser.Math.Between(0, t.particleColors.length - 1)],
                    emitting: false,
                }).setDepth(1);
                emitter.explode(1);
                this.time.delayedCall(5000, () => emitter.destroy());
            },
        });
    }

    // ==================== Public API ====================

    updateSoundEnabled(enabled: boolean) { this.sounds.setEnabled(enabled); }

    updateTheme(theme: ThemeKey) {
        if (theme === this.currentTheme) return;
        this.currentTheme = theme;
        this.sounds.themeSwitch();
        this.bgGfx.destroy();
        this.frameGfx.destroy();
        if (this.ambientTimer) this.ambientTimer.destroy();
        this.drawBg();
        this.drawFrame();
        this.startAmbient();
        this.cameras.main.flash(300);
    }

    shutdown() {
        this.sounds.destroy();
        if (this.ambientTimer) this.ambientTimer.destroy();
    }
}
