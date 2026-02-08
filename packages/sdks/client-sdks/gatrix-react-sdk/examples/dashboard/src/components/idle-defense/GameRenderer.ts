// ============================================================
// Idle Defense Roguelike - PIXI.js Renderer (Super Mario Style)
// ============================================================

import * as PIXI from 'pixi.js';
import type { GameState } from './GameEngine';

const CANVAS_W = 800;
const CANVAS_H = 400;
const HERO_X = 120;
const P_SIZE = 4; // Pixel size for procedural art

// ---- Pixel Art Helpers ----
function pixelRect(g: PIXI.Graphics, x: number, y: number, w: number, h: number, color: number, alpha = 1) {
    g.rect(x * P_SIZE, y * P_SIZE, w * P_SIZE, h * P_SIZE).fill({ color, alpha });
}

function drawHero(g: PIXI.Graphics, frame: number, isAttacking: boolean, attackFrame: number) {
    g.clear();

    const dashX = isAttacking ? Math.min(15, attackFrame * 2) : 0;
    g.x = HERO_X + dashX;

    const anim = Math.floor(frame * 0.15) % 2;
    const breathe = anim === 0 ? 0 : 1;

    // Body (Blue Tunic)
    pixelRect(g, -3, -8 + breathe, 6, 6, 0x3273dc);
    // Head
    pixelRect(g, -2, -12 + breathe, 5, 4, 0xffcc99);
    // Hair/Helmet
    pixelRect(g, -2, -13 + breathe, 5, 2, 0x666666);
    // Eyes
    pixelRect(g, 1, -11 + breathe, 1, 1, 0x000000);
    pixelRect(g, 3, -11 + breathe, 1, 1, 0x000000);

    // Shield
    pixelRect(g, -5, -7 + breathe, 3, 5, 0xe76e55);
    pixelRect(g, -4, -6 + breathe, 1, 3, 0xffffff, 0.3);

    if (isAttacking) {
        // Sword Swing Pose
        const swing = Math.min(4, attackFrame * 0.5);
        pixelRect(g, 3 + swing, -7, 8, 2, 0xffffff); // Blade
        pixelRect(g, 2 + swing, -8, 1, 4, 0xf7d51d); // Guard
        pixelRect(g, 1 + swing, -7, 2, 1, 0x5a3825); // Handle
    } else {
        // Idle Sword
        pixelRect(g, 3, -10 + breathe, 2, 6, 0xcccccc);
        pixelRect(g, 2, -6 + breathe, 4, 2, 0xf7d51d);
    }

    // Legs
    pixelRect(g, -2, -2, 2, 2, 0x1d4ed8);
    pixelRect(g, 1, -2, 2, 2, 0x1d4ed8);
}


function drawSlime(g: PIXI.Graphics, frame: number, color: number, size: number, type: string, hitTimer: number, attackTimer: number, isRanged: boolean) {
    g.clear();

    const anim = Math.floor(frame * 0.12) % 2;
    const squishY = anim === 0 ? 0 : 1;
    const squishX = anim === 0 ? 0 : -1;

    const drawColor = hitTimer > 0 ? 0xffffff : color;

    // Body
    if (type === 'boss') {
        pixelRect(g, -6, -10 + squishY, 12 + -squishX, 10 - squishY, drawColor);
        pixelRect(g, -3, -13 + squishY, 6, 3, 0xf7d51d); // Crown
    } else if (type === 'tank') {
        pixelRect(g, -5, -8, 10, 8, drawColor);
        pixelRect(g, -4, -4, 8, 2, 0x000000, 0.2); // Shadow detail
    } else {
        pixelRect(g, -4, -6 + squishY, 8 + -squishX, 6 - squishY, drawColor);
    }

    // Eyes
    const eyeColor = type === 'boss' ? 0xffff00 : 0x000000;
    pixelRect(g, 1, -4 + squishY, 1, 1, eyeColor);
    pixelRect(g, 3, -4 + squishY, 1, 1, eyeColor);

    // Ranged Charge Glow (Pixelated)
    if (isRanged && attackTimer > 80) {
        const glowPhase = Math.floor(attackTimer) % 10 > 5;
        if (glowPhase) pixelRect(g, -2, -8, 4, 1, 0xffffff, 0.6);
    }
}


function drawDeadSlime(g: PIXI.Graphics, deathFrame: number, color: number, size: number) {
    g.clear();
    const progress = Math.min(1, deathFrame / 15);
    const alpha = 1 - progress;
    g.ellipse(0, -2 * size, 25 * size * (1 + progress), 5 * size * alpha).fill({ color, alpha });
}

// ---- Mario Style Backgrounds ----

const BG_WIDTH = 1200; // Wider segment for variety

function drawDistantMountains(g: PIXI.Graphics, offset: number) {
    g.clear();
    const xBase = -(offset % BG_WIDTH);

    const drawSegment = (startX: number) => {
        // Peaks at fixed relative positions
        const peaks = [
            { x: 100, h: 100 }, { x: 400, h: 150 }, { x: 700, h: 120 }, { x: 1000, h: 140 }
        ];
        for (const p of peaks) {
            g.moveTo(startX + p.x - 200, 0).lineTo(startX + p.x, -p.h).lineTo(startX + p.x + 200, 0)
                .fill({ color: 0x4a7aed, alpha: 0.15 });
        }
    };

    drawSegment(xBase);
    drawSegment(xBase + BG_WIDTH);
}

function drawMarioClouds(g: PIXI.Graphics, offset: number) {
    g.clear();
    const xBase = -(offset % BG_WIDTH);

    const drawSegment = (startX: number) => {
        const cloudData = [
            { x: 100, y: 50, v: 0 }, { x: 350, y: 80, v: 1 }, { x: 600, y: 40, v: 2 },
            { x: 850, y: 90, v: 3 }, { x: 1100, y: 60, v: 0 }, { x: 220, y: 120, v: 2 }
        ];
        for (const c of cloudData) {
            const x = startX + c.x;
            const py = c.y;
            if (c.v === 0) {
                g.circle(x, py, 25).fill(0xffffff);
                g.circle(x - 20, py + 5, 18).fill(0xffffff);
                g.circle(x + 20, py + 5, 18).fill(0xffffff);
            } else if (c.v === 1) {
                g.roundRect(x - 30, py, 60, 20, 10).fill(0xffffff);
                g.circle(x - 10, py - 5, 12).fill(0xffffff);
                g.circle(x + 10, py - 5, 15).fill(0xffffff);
            } else if (c.v === 2) {
                g.circle(x, py, 15).fill(0xffffff);
                g.circle(x - 10, py + 2, 10).fill(0xffffff);
            } else {
                g.circle(x, py, 20).fill(0xffffff);
                g.circle(x - 15, py + 8, 14).fill(0xffffff);
                g.circle(x + 15, py + 8, 14).fill(0xffffff);
                g.circle(x, py + 12, 14).fill(0xffffff);
            }
        }
    };

    drawSegment(xBase);
    drawSegment(xBase + BG_WIDTH);
}

function drawMarioHills(g: PIXI.Graphics, offset: number) {
    g.clear();
    const xBase = -(offset % BG_WIDTH);

    const drawSegment = (startX: number) => {
        const hills = [
            { x: 200, h: 90, c: 0x3fb14d }, { x: 550, h: 60, c: 0x2e8b3b },
            { x: 900, h: 100, c: 0x3fb14d }, { x: 1100, h: 70, c: 0x2e8b3b }
        ];
        for (const h of hills) {
            const x = startX + h.x;
            g.moveTo(x - 150, 0).bezierCurveTo(x - 80, -h.h, x + 80, -h.h, x + 150, 0)
                .fill(h.c).stroke({ width: 2, color: 0x1d5e24 });
            g.circle(x - 10, -h.h + 40, 6).fill({ color: 0xffffff, alpha: 0.1 });
            g.circle(x + 20, -h.h + 60, 4).fill({ color: 0xffffff, alpha: 0.1 });
        }
    };

    drawSegment(xBase);
    drawSegment(xBase + BG_WIDTH);
}

function drawMarioGround(g: PIXI.Graphics, offset: number) {
    g.clear();
    const xBase = -(offset % BG_WIDTH);

    const drawSegment = (startX: number) => {
        const spacing = 120;
        // Soil base
        g.rect(startX, 15, BG_WIDTH, 85).fill(0x946037);

        for (let x = 0; x < BG_WIDTH; x += spacing) {
            const tx = startX + x;
            g.rect(tx, 0, spacing + 1, 15).fill(0x71c937); // Grass Top
            g.rect(tx, 5, spacing, 2).fill(0x9ae65f); // Grass Detail

            // Varied Soil Details (Stones/Dirt)
            g.rect(tx + 10, 30, 15, 8).fill(0xab7d55);
            g.rect(tx + 60, 45, 20, 12).fill(0xab7d55);
            g.rect(tx + 90, 25, 10, 10).fill(0xab7d55);
            g.rect(tx + 30, 65, 25, 10).fill(0xab7d55);
            g.circle(tx + 50, 75, 4).fill(0xab7d55);
            if (x % 240 === 0) {
                g.rect(tx + 5, 55, 12, 12).fill(0x8a5a3a); // Darker patch
            }
        }
    };

    drawSegment(xBase);
    drawSegment(xBase + BG_WIDTH);
}

export interface RendererObjects {
    app: PIXI.Application;
    heroGfx: PIXI.Graphics;
    worldLayer: PIXI.Container;
    distMountains: PIXI.Graphics;
    clouds: PIXI.Graphics;
    hills: PIXI.Graphics;
    ground: PIXI.Graphics;
    particleGfx: PIXI.Graphics;
    heroHpBg: PIXI.Graphics;
    heroHpFill: PIXI.Graphics;
    enemyPool: PIXI.Graphics[];
    enemyHpBars: PIXI.Graphics[];
    dropPool: PIXI.Container[];
    projectilePool: PIXI.Graphics[];
    dmgTextPool: PIXI.Text[];
    waveText: PIXI.Text;
}

export async function createRenderer(container: HTMLDivElement): Promise<RendererObjects> {
    const app = new PIXI.Application();
    await app.init({
        width: CANVAS_W,
        height: CANVAS_H,
        backgroundColor: 0x5c94fc, // Classic Mario Blue
        antialias: false, // Turned off for sharp retro edges
    });
    // PIXI v8 doesn't have a direct roundPixels option in init anymore, 
    // but it renders sharper when antialias is off.
    container.appendChild(app.canvas);

    const distMountains = new PIXI.Graphics();
    distMountains.y = 300;
    app.stage.addChild(distMountains);

    const clouds = new PIXI.Graphics();
    app.stage.addChild(clouds);

    const hills = new PIXI.Graphics();
    hills.y = 300;
    app.stage.addChild(hills);

    const ground = new PIXI.Graphics();
    ground.y = 300;
    app.stage.addChild(ground);

    const worldLayer = new PIXI.Container();
    app.stage.addChild(worldLayer);

    const heroGfx = new PIXI.Graphics();
    heroGfx.x = HERO_X;
    heroGfx.y = 300;
    worldLayer.addChild(heroGfx);

    const heroHpBg = new PIXI.Graphics();
    const heroHpFill = new PIXI.Graphics();
    app.stage.addChild(heroHpBg, heroHpFill);

    const particleGfx = new PIXI.Graphics();
    worldLayer.addChild(particleGfx);

    const waveText = new PIXI.Text({
        text: '',
        style: {
            fontSize: 32, fill: 0xffffff, fontFamily: '"Press Start 2P", monospace',
            stroke: { color: 0x000000, width: 6 },
        },
    });
    waveText.anchor.set(0.5);
    waveText.x = CANVAS_W / 2;
    waveText.y = CANVAS_H / 2 - 40;
    app.stage.addChild(waveText);

    return {
        app, heroGfx, worldLayer, distMountains, clouds, hills, ground,
        particleGfx, heroHpBg, heroHpFill,
        enemyPool: [], enemyHpBars: [], dropPool: [],
        projectilePool: [],
        dmgTextPool: [], waveText,
    };
}

export function renderFrame(r: RendererObjects, gs: GameState): void {
    // Screen Shake
    if (gs.shakeTimer > 0) {
        const intensity = gs.shakeTimer * 0.5;
        r.worldLayer.x = (Math.random() - 0.5) * intensity;
        r.worldLayer.y = (Math.random() - 0.5) * intensity;
    } else {
        r.worldLayer.x = 0;
        r.worldLayer.y = 0;
    }

    // Backgrounds with seamless looping
    drawDistantMountains(r.distMountains, gs.bgDistOffset);
    drawMarioClouds(r.clouds, gs.cloudOffset);
    drawMarioHills(r.hills, gs.mountainOffset);
    drawMarioGround(r.ground, gs.treeOffset);

    // Hero
    drawHero(r.heroGfx, gs.heroFrame, gs.isAttacking, gs.attackAnimFrame);

    // Hero HP bar
    const hpPct = gs.hero.hp / gs.hero.maxHp;
    r.heroHpBg.clear().rect(HERO_X - 25, 312, 50, 8).fill(0x000000);
    r.heroHpFill.clear().rect(HERO_X - 24, 313, 48 * hpPct, 6).fill(0xff0000);

    // Items... (Pooling)
    while (r.enemyPool.length < gs.enemies.length) {
        const eg = new PIXI.Graphics();
        r.worldLayer.addChild(eg);
        r.enemyPool.push(eg);
        const hpBar = new PIXI.Graphics();
        r.worldLayer.addChild(hpBar);
        r.enemyHpBars.push(hpBar);
    }

    for (let i = 0; i < r.enemyPool.length; i++) {
        const eg = r.enemyPool[i];
        const hp = r.enemyHpBars[i];
        if (i < gs.enemies.length) {
            const e = gs.enemies[i];
            eg.visible = true; hp.visible = !e.dead;
            eg.x = e.x + e.knockbackX; eg.y = e.y;
            if (e.dead) {
                drawDeadSlime(eg, e.deathFrame, e.color, e.size);
            } else {
                drawSlime(eg, e.frame, e.color, e.size, e.type, e.hitTimer, e.attackTimer, e.isRanged || false);
                const barW = 34 * e.size;
                const pct = e.hp / e.maxHp;
                hp.clear().rect(e.x + e.knockbackX - barW / 2, e.y - 45 * e.size, barW, 5).fill(0x000000);
                hp.rect(e.x + e.knockbackX - barW / 2 + 1, e.y - 45 * e.size + 1, (barW - 2) * pct, 3).fill(0xff0000);
            }
        } else {
            eg.visible = false; hp.visible = false;
        }
    }

    // Dropped Items
    while (r.dropPool.length < gs.droppedItems.length) {
        const container = new PIXI.Container();
        const bg = new PIXI.Graphics().circle(0, 0, 12).fill({ color: 0xffffff, alpha: 0.8 }).stroke({ width: 2, color: 0x000000 });
        const txt = new PIXI.Text({ text: '', style: { fontSize: 14 } });
        txt.anchor.set(0.5);
        container.addChild(bg, txt);
        r.worldLayer.addChild(container);
        r.dropPool.push(container);
    }
    for (let i = 0; i < r.dropPool.length; i++) {
        const dg = r.dropPool[i];
        if (i < gs.droppedItems.length) {
            const d = gs.droppedItems[i];
            dg.visible = true;
            dg.x = d.x;
            dg.y = d.y;
            (dg.children[1] as PIXI.Text).text = d.icon;

            // Draw Trail (using item's history)
            const bg = dg.children[0] as PIXI.Graphics;
            bg.clear();
            if (d.history.length > 1) {
                for (let j = 0; j < d.history.length; j++) {
                    const pos = d.history[j];
                    const relX = pos.x - d.x;
                    const relY = pos.y - d.y;
                    const alpha = (j / d.history.length) * 0.4;
                    bg.circle(relX, relY, 8 * (j / d.history.length)).fill({ color: 0xffffff, alpha });
                }
            }
            bg.circle(0, 0, 12).fill({ color: 0xffffff, alpha: 0.8 }).stroke({ width: 2, color: 0x000000 });

            // Floating effect
            dg.scale.set(1 + Math.sin(gs.heroFrame * 0.2) * 0.1);
        } else {
            dg.visible = false;
        }
    }

    // Projectiles
    while (r.projectilePool.length < gs.projectiles.length) {
        const pg = new PIXI.Graphics();
        r.worldLayer.addChild(pg);
        r.projectilePool.push(pg);
    }
    for (let i = 0; i < r.projectilePool.length; i++) {
        const pg = r.projectilePool[i];
        if (i < gs.projectiles.length) {
            const p = gs.projectiles[i];
            pg.visible = true; pg.clear();

            // Draw Trail
            if (p.history.length > 1) {
                for (let j = 0; j < p.history.length; j++) {
                    const pos = p.history[j];
                    const alpha = (j / p.history.length) * 0.4;
                    const s = (p.isSkill ? 1.5 : 1) * (j / p.history.length);
                    pixelRect(pg, (pos.x / P_SIZE) - s, (pos.y / P_SIZE) - s, s * 2, s * 2, p.color, alpha);
                }
            }

            // Head (Projectile Sprite)
            if (p.source === 'hero') {
                pixelRect(pg, (p.x / P_SIZE) - 1.5, (p.y / P_SIZE) - 1, 3, 2, p.isSkill ? 0xffdd00 : 0xffffff);
                pixelRect(pg, (p.x / P_SIZE) + 1.5, (p.y / P_SIZE) - 0.5, 1, 1, 0x60a5fa, 0.5); // Tip
            } else {
                pixelRect(pg, (p.x / P_SIZE) - 1, (p.y / P_SIZE) - 1, 2, 2, p.color);
                pixelRect(pg, (p.x / P_SIZE) - 0.5, (p.y / P_SIZE) - 0.5, 1, 1, 0x000000, 0.4);
            }
        } else {
            pg.visible = false;
        }
    }

    // Particles
    r.particleGfx.clear();
    for (const p of gs.particles) {
        const alpha = Math.max(0, p.life / p.maxLife);
        r.particleGfx.rect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size).fill({ color: p.color, alpha });
    }

    // Damage Texts
    while (r.dmgTextPool.length < gs.damageTexts.length) {
        const txt = new PIXI.Text({ style: { fontSize: 16, fill: 0xffffff, fontFamily: '"Press Start 2P"', stroke: { color: 0x000000, width: 4 } } });
        txt.anchor.set(0.5);
        r.worldLayer.addChild(txt);
        r.dmgTextPool.push(txt);
    }
    for (let i = 0; i < r.dmgTextPool.length; i++) {
        const txt = r.dmgTextPool[i];
        if (i < gs.damageTexts.length) {
            const dt = gs.damageTexts[i];
            txt.visible = true; txt.text = dt.text; txt.x = dt.x; txt.y = dt.y; txt.alpha = dt.life / 50;
            txt.style.fill = dt.color;
        } else {
            txt.visible = false;
        }
    }

    if (gs.isWaveTransition) {
        r.waveText.visible = true;
        r.waveText.text = `WAVE ${gs.hero.wave + 1}`;
        r.waveText.alpha = 0.5 + Math.sin(gs.waveCountdown * 0.1) * 0.5;
    } else {
        r.waveText.visible = false;
    }
}

export function destroyRenderer(r: RendererObjects): void {
    r.app.destroy(true, { children: true });
}
