// ============================================================
// Idle Defense Roguelike - PIXI.js Renderer (Super Mario Style)
// ============================================================

import * as PIXI from 'pixi.js';
import type { GameState } from './GameEngine';
import {
    createPixelTexture,
    HERO_IDLE_MAP,
    HERO_ATTACK_MAP,
    SLIME_MAP,
    FAST_SLIME_MAP,
    BOSS_SLIME_MAP,
    TANK_SLIME_MAP,
    POTION_MAP,
    SWORD_MAP,
    SHIELD_MAP,
    ARROW_MAP,
    ORB_MAP,
} from './GameSprites';

const CANVAS_W = 800;
const CANVAS_H = 400;
const HERO_X = 120;

// ---- Mario Style Backgrounds ----

const BG_WIDTH = 1200; // Wider segment for variety

function drawDistantMountains(g: PIXI.Graphics, offset: number) {
    g.clear();
    const xBase = -(offset % BG_WIDTH);

    const drawSegment = (startX: number) => {
        // Peaks at fixed relative positions
        const peaks = [
            { x: 100, h: 100 },
            { x: 400, h: 150 },
            { x: 700, h: 120 },
            { x: 1000, h: 140 },
        ];
        for (const p of peaks) {
            g.moveTo(startX + p.x - 200, 0)
                .lineTo(startX + p.x, -p.h)
                .lineTo(startX + p.x + 200, 0)
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
            { x: 100, y: 50, v: 0 },
            { x: 350, y: 80, v: 1 },
            { x: 600, y: 40, v: 2 },
            { x: 850, y: 90, v: 3 },
            { x: 1100, y: 60, v: 0 },
            { x: 220, y: 120, v: 2 },
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
            { x: 200, h: 90, c: 0x3fb14d },
            { x: 550, h: 60, c: 0x2e8b3b },
            { x: 900, h: 100, c: 0x3fb14d },
            { x: 1100, h: 70, c: 0x2e8b3b },
        ];
        for (const h of hills) {
            const x = startX + h.x;
            g.moveTo(x - 150, 0)
                .bezierCurveTo(x - 80, -h.h, x + 80, -h.h, x + 150, 0)
                .fill(h.c)
                .stroke({ width: 2, color: 0x1d5e24 });
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
    worldLayer: PIXI.Container;
    distMountains: PIXI.Graphics;
    clouds: PIXI.Graphics;
    hills: PIXI.Graphics;
    ground: PIXI.Graphics;
    particleGfx: PIXI.Graphics;
    heroHpBg: PIXI.Graphics;
    heroHpFill: PIXI.Graphics;
    enemyPool: PIXI.Sprite[];
    enemyHpBars: PIXI.Graphics[];
    enemyShadows: PIXI.Graphics[];
    dropPool: PIXI.Container[];
    projectilePool: PIXI.Sprite[];
    dmgTextPool: PIXI.Text[];
    waveText: PIXI.Text;
    textures: {
        hero: PIXI.Texture;
        heroAttack: PIXI.Texture;
        slimeNormal: PIXI.Texture;
        slimeFast: PIXI.Texture;
        slimeTank: PIXI.Texture;
        slimeBoss: PIXI.Texture;
        itemPotion: PIXI.Texture;
        itemSword: PIXI.Texture;
        itemShield: PIXI.Texture;
        itemMaterial: PIXI.Texture;
        arrow: PIXI.Texture;
        orb: PIXI.Texture;
    };
    heroSprite: PIXI.Sprite;
    heroShadow: PIXI.Graphics;
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

    const heroHpBg = new PIXI.Graphics();
    const heroHpFill = new PIXI.Graphics();
    app.stage.addChild(heroHpBg, heroHpFill);

    const particleGfx = new PIXI.Graphics();
    worldLayer.addChild(particleGfx);

    const waveText = new PIXI.Text({
        text: '',
        style: {
            fontSize: 32,
            fill: 0xffffff,
            fontFamily: '"Press Start 2P", monospace',
            stroke: { color: 0x000000, width: 6 },
        },
    });
    waveText.anchor.set(0.5);
    waveText.x = CANVAS_W / 2;
    waveText.y = CANVAS_H / 2 - 40;
    app.stage.addChild(waveText);

    // Generate Textures
    const textures = {
        hero: createPixelTexture(app, HERO_IDLE_MAP, 3),
        heroAttack: createPixelTexture(app, HERO_ATTACK_MAP, 3),
        slimeNormal: createPixelTexture(app, SLIME_MAP, 3),
        slimeFast: createPixelTexture(app, FAST_SLIME_MAP, 3),
        slimeTank: createPixelTexture(app, TANK_SLIME_MAP, 4),
        slimeBoss: createPixelTexture(app, BOSS_SLIME_MAP, 5),
        itemPotion: createPixelTexture(app, POTION_MAP, 2.5),
        itemSword: createPixelTexture(app, SWORD_MAP, 2.5),
        itemShield: createPixelTexture(app, SHIELD_MAP, 2.5),
        itemMaterial: createPixelTexture(app, SLIME_MAP, 1.5), // Tiny slime gel
        arrow: createPixelTexture(app, ARROW_MAP, 2),
        orb: createPixelTexture(app, ORB_MAP, 3),
    };

    const heroShadow = new PIXI.Graphics();
    heroShadow.ellipse(0, 0, 18, 6).fill({ color: 0x000000, alpha: 0.3 });
    worldLayer.addChildAt(heroShadow, 0); // Background of worldLayer

    const heroSprite = new PIXI.Sprite(textures.hero);
    heroSprite.anchor.set(0.5, 1);
    heroSprite.x = HERO_X;
    heroSprite.y = 305;
    worldLayer.addChild(heroSprite);

    return {
        app,
        worldLayer,
        distMountains,
        clouds,
        hills,
        ground,
        particleGfx,
        heroHpBg,
        heroHpFill,
        enemyPool: [],
        enemyHpBars: [],
        enemyShadows: [],
        dropPool: [],
        projectilePool: [],
        dmgTextPool: [],
        waveText,
        textures,
        heroSprite,
        heroShadow,
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
    const dashX = gs.isAttacking ? Math.min(10, gs.attackAnimFrame * 2) : 0;
    r.heroSprite.x = HERO_X + dashX;
    r.heroSprite.y = 305 + Math.sin(gs.heroFrame * 0.15) * 2;
    r.heroSprite.texture = gs.isAttacking ? r.textures.heroAttack : r.textures.hero;
    r.heroSprite.tint = gs.shakeTimer > 0 ? 0xff8888 : 0xffffff;

    r.heroShadow.x = r.heroSprite.x;
    r.heroShadow.y = 305;
    r.heroShadow.scale.set(1 + Math.sin(gs.heroFrame * 0.15) * 0.1);

    if (gs.isAttacking) {
        r.heroSprite.scale.x = 1.05;
    } else {
        r.heroSprite.scale.x = 1;
    }

    // Hero HP bar
    const hpPct = gs.hero.hp / gs.hero.maxHp;
    r.heroHpBg
        .clear()
        .rect(HERO_X - 25, 312, 50, 8)
        .fill(0x000000);
    r.heroHpFill
        .clear()
        .rect(HERO_X - 24, 313, 48 * hpPct, 6)
        .fill(0xff0000);

    // Enemies (Pooling)
    while (r.enemyPool.length < gs.enemies.length) {
        const sprite = new PIXI.Sprite(r.textures.slimeNormal);
        sprite.anchor.set(0.5, 1);
        r.worldLayer.addChild(sprite);
        r.enemyPool.push(sprite);

        const hpBar = new PIXI.Graphics();
        r.worldLayer.addChild(hpBar);
        r.enemyHpBars.push(hpBar);

        const shadow = new PIXI.Graphics();
        shadow.ellipse(0, 0, 16, 6).fill({ color: 0x000000, alpha: 0.3 });
        r.worldLayer.addChildAt(shadow, 0); // Behind everything
        r.enemyShadows.push(shadow);
    }

    for (let i = 0; i < r.enemyPool.length; i++) {
        const sprite = r.enemyPool[i];
        const hp = r.enemyHpBars[i];
        const shadow = r.enemyShadows[i];
        if (i < gs.enemies.length) {
            const e = gs.enemies[i];
            sprite.visible = true;
            hp.visible = !e.dead;
            shadow.visible = !e.dead;
            sprite.x = e.x + e.knockbackX;
            sprite.y = 305 + Math.sin(e.frame * 0.12) * 3;

            shadow.x = sprite.x;
            shadow.y = 305;
            shadow.scale.set(e.size);
            if (e.type === 'boss') sprite.texture = r.textures.slimeBoss;
            else if (e.type === 'tank') sprite.texture = r.textures.slimeTank;
            else if (e.type === 'fast') sprite.texture = r.textures.slimeFast;
            else sprite.texture = r.textures.slimeNormal;

            if (e.dead) {
                sprite.alpha = Math.max(0, 1 - e.deathFrame / 15);
                sprite.scale.set(1.5, 0.2); // Squish on death
                sprite.tint = 0xff0000;
                sprite.y += 5; // Sink into ground
            } else {
                sprite.alpha = 1;
                const hit = e.hitTimer > 0;
                sprite.tint = hit ? 0xff0000 : 0xffffff;
                if (hit) sprite.scale.set(1.15);
                else sprite.scale.set(1);

                const barW = 34 * e.size;
                const pct = e.hp / e.maxHp;
                hp.clear()
                    .rect(e.x + e.knockbackX - barW / 2, e.y - 45 * e.size, barW, 5)
                    .fill(0x000000);
                hp.rect(e.x + e.knockbackX - barW / 2 + 1, e.y - 45 * e.size + 1, (barW - 2) * pct, 3).fill(
                    0xff0000
                );
            }
        } else {
            sprite.visible = false;
            hp.visible = false;
        }
    }

    // Dropped Items
    while (r.dropPool.length < gs.droppedItems.length) {
        const container = new PIXI.Container();
        const sprite = new PIXI.Sprite(r.textures.itemPotion);
        sprite.anchor.set(0.5);
        container.addChild(sprite);
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

            const sprite = dg.children[0] as PIXI.Sprite;
            if (d.item.type === 'potion') sprite.texture = r.textures.itemPotion;
            else if (d.item.type === 'weapon') sprite.texture = r.textures.itemSword;
            else if (d.item.type === 'armor') sprite.texture = r.textures.itemShield;
            else sprite.texture = r.textures.itemMaterial;

            // Draw Trail (using item's history)
            // ... trail logic remains but could be updated for better look ...

            dg.scale.set(1 + Math.sin(gs.heroFrame * 0.2) * 0.1);
        } else {
            dg.visible = false;
        }
    }

    // Projectiles
    while (r.projectilePool.length < gs.projectiles.length) {
        const sprite = new PIXI.Sprite();
        sprite.anchor.set(0.5);
        r.worldLayer.addChild(sprite);
        r.projectilePool.push(sprite);
    }
    for (let i = 0; i < r.projectilePool.length; i++) {
        const sprite = r.projectilePool[i];
        if (i < gs.projectiles.length) {
            const p = gs.projectiles[i];
            sprite.visible = true;
            sprite.x = p.x;
            sprite.y = p.y;
            sprite.scale.set(p.isSkill ? 2 : 1);

            if (p.source === 'hero') {
                sprite.texture = r.textures.arrow;
                sprite.tint = p.color;
                sprite.rotation = -Math.PI / 2; // Point right (Arrow map is vertical)
            } else {
                sprite.texture = r.textures.orb;
                sprite.tint = 0xffffff; // Use orb's internal colors
                sprite.rotation = 0;
            }
        } else {
            sprite.visible = false;
        }
    }

    // Particles
    r.particleGfx.clear();
    for (const p of gs.particles) {
        const alpha = Math.max(0, p.life / p.maxLife);
        r.particleGfx
            .rect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
            .fill({ color: p.color, alpha });
    }

    // Damage Texts
    while (r.dmgTextPool.length < gs.damageTexts.length) {
        const txt = new PIXI.Text({
            style: {
                fontSize: 16,
                fill: 0xffffff,
                fontFamily: '"Press Start 2P"',
                stroke: { color: 0x000000, width: 4 },
            },
        });
        txt.anchor.set(0.5);
        r.worldLayer.addChild(txt);
        r.dmgTextPool.push(txt);
    }
    for (let i = 0; i < r.dmgTextPool.length; i++) {
        const txt = r.dmgTextPool[i];
        if (i < gs.damageTexts.length) {
            const dt = gs.damageTexts[i];
            txt.visible = true;
            txt.text = dt.text;
            txt.x = dt.x;
            txt.y = dt.y;
            txt.alpha = dt.life / 50;
            txt.style.fill = dt.color;
        } else {
            txt.visible = false;
        }
    }

    if (gs.isWaveTransition) {
        r.waveText.visible = true;
        r.waveText.text = `WAVE ${gs.hero.wave + 1}`;
        r.waveText.style.fill = 0xffffff;
        r.waveText.alpha = 0.5 + Math.sin(gs.waveCountdown * 0.1) * 0.5;
    } else if (gs.isDead) {
        r.waveText.visible = true;
        r.waveText.text = 'DEFEATED';
        r.waveText.style.fill = 0xff4444;
        r.waveText.alpha = 1;
    } else {
        r.waveText.visible = false;
    }
}

export function destroyRenderer(r: RendererObjects): void {
    r.app.destroy(true, { children: true });
}
