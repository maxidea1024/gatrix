import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import { useGatrixClient, useGatrixContext } from '@gatrix/react-sdk';

interface IdleRPGGameProps {
  onExit: () => void;
}

// ============================================================
// Drawing helpers — all graphics are procedurally generated
// so the game works without any external image assets.
// ============================================================

/** Draw a small knight-like hero character */
function drawHero(g: PIXI.Graphics, frame: number) {
  g.clear();

  const bob = Math.sin(frame * 0.15) * 2;

  // Body
  g.rect(-12, -30 + bob, 24, 20).fill(0x209cee);
  // Head
  g.circle(0, -38 + bob, 10).fill(0xffcc99);
  // Helmet
  g.rect(-10, -48 + bob, 20, 8).fill(0x666666);
  g.rect(-6, -50 + bob, 12, 4).fill(0x888888);
  // Eyes
  g.circle(-4, -38 + bob, 2).fill(0x000000);
  g.circle(4, -38 + bob, 2).fill(0x000000);
  // Legs
  const legSwing = Math.sin(frame * 0.2) * 3;
  g.rect(-10, -10 + bob, 8, 12).fill(0x3273dc);
  g.rect(2, -10 + bob, 8, 12).fill(0x3273dc);
  // Feet
  g.rect(-12, 2 + bob + legSwing, 10, 4).fill(0x5a3825);
  g.rect(2, 2 + bob - legSwing, 10, 4).fill(0x5a3825);
  // Sword (right hand)
  const swordAngle = Math.sin(frame * 0.1) * 0.2;
  g.rect(14, -30 + bob + swordAngle * 10, 4, 24).fill(0xcccccc);
  g.rect(12, -32 + bob + swordAngle * 10, 8, 4).fill(0xf7d51d);
  // Shield (left hand)
  g.roundRect(-20, -28 + bob, 8, 14, 2)
    .fill(0xe76e55)
    .stroke({ width: 1, color: 0xaa4422 });
}

/** Draw the hero during an attack swing */
function drawHeroAttack(g: PIXI.Graphics, frame: number) {
  g.clear();
  // Body
  g.rect(-12, -30, 24, 20).fill(0x209cee);
  // Head
  g.circle(0, -38, 10).fill(0xffcc99);
  // Helmet
  g.rect(-10, -48, 20, 8).fill(0x666666);
  // Eyes (determined expression)
  g.rect(-6, -39, 4, 2).fill(0x000000);
  g.rect(2, -39, 4, 2).fill(0x000000);
  // Legs
  g.rect(-10, -10, 8, 12).fill(0x3273dc);
  g.rect(2, -10, 8, 12).fill(0x3273dc);
  g.rect(-12, 2, 10, 4).fill(0x5a3825);
  g.rect(2, 2, 10, 4).fill(0x5a3825);
  // Sword — extended forward with slash arc
  const swing = Math.sin(frame * 0.8) * 15;
  g.rect(16, -40 + swing, 5, 30).fill(0xeeeeee);
  g.rect(14, -42 + swing, 9, 5).fill(0xf7d51d);
  // Slash effect arc
  g.arc(20, -25, 25, -0.8, 0.8).stroke({ width: 3, color: 0xffff88, alpha: 0.7 });
  // Shield
  g.roundRect(-20, -28, 8, 14, 2).fill(0xe76e55);
}

/** Draw a slime-like enemy */
function drawEnemy(g: PIXI.Graphics, frame: number, isBoss: boolean) {
  g.clear();
  const scale = isBoss ? 1.8 : 1;
  const color = isBoss ? 0xcc2222 : 0x48c774;
  const bob = Math.sin(frame * 0.12) * 3;
  const squish = 1 + Math.sin(frame * 0.12) * 0.05;

  // Body (blob shape)
  g.ellipse(0, -15 * scale + bob, 18 * scale * squish, (18 * scale) / squish).fill(color);
  // Belly highlight
  g.ellipse(0, -10 * scale + bob, 12 * scale * squish, (10 * scale) / squish).fill({
    color: 0xffffff,
    alpha: 0.15,
  });
  // Eyes
  const eyeSpread = 7 * scale;
  g.circle(-eyeSpread, -20 * scale + bob, 4 * scale).fill(0xffffff);
  g.circle(eyeSpread, -20 * scale + bob, 4 * scale).fill(0xffffff);
  g.circle(-eyeSpread + 1, -20 * scale + bob, 2 * scale).fill(0x000000);
  g.circle(eyeSpread + 1, -20 * scale + bob, 2 * scale).fill(0x000000);
  // Mouth
  g.arc(0, -12 * scale + bob, 6 * scale, 0, Math.PI).stroke({ width: 2, color: 0x333333 });

  if (isBoss) {
    // Crown for boss
    g.moveTo(-12, -36 * scale + bob)
      .lineTo(-8, -42 * scale + bob)
      .lineTo(-4, -36 * scale + bob)
      .lineTo(0, -44 * scale + bob)
      .lineTo(4, -36 * scale + bob)
      .lineTo(8, -42 * scale + bob)
      .lineTo(12, -36 * scale + bob)
      .fill(0xf7d51d);
  }
}

/** Draw a damage hit effect (particles) */
function drawHitEffect(g: PIXI.Graphics, frame: number) {
  g.clear();
  const alpha = Math.max(0, 1 - frame * 0.1);
  for (let i = 0; i < 6; i++) {
    const angle = ((Math.PI * 2) / 6) * i + frame * 0.3;
    const dist = frame * 8;
    const x = Math.cos(angle) * dist;
    const y = Math.sin(angle) * dist;
    g.star(x, y, 4, 3, 1.5).fill({ color: 0xffff00, alpha });
  }
}

// ============================================================
// Background drawing helpers
// ============================================================

function drawGround(g: PIXI.Graphics, width: number) {
  g.clear();
  // Grass layer
  g.rect(0, 0, width, 60).fill(0x4a7c3f);
  g.rect(0, 0, width, 8).fill(0x6abf4b);
  // Dirt layer
  g.rect(0, 60, width, 40).fill(0x8b5e3c);
  // Grass tufts
  for (let x = 0; x < width; x += 30) {
    const h = 4 + Math.random() * 6;
    g.moveTo(x, 0)
      .lineTo(x + 3, -h)
      .lineTo(x + 6, 0)
      .fill(0x5aaf3a);
  }
}

function drawMountains(g: PIXI.Graphics, width: number, offset: number) {
  g.clear();
  for (let i = -1; i < width / 120 + 2; i++) {
    const x = i * 120 + (offset % 120);
    g.moveTo(x - 70, 0)
      .lineTo(x, -60 - (i % 3) * 20)
      .lineTo(x + 70, 0)
      .fill(0x3a5f8a)
      .stroke({ color: 0x4a6f9a, width: 1 });
  }
}

function drawClouds(g: PIXI.Graphics, width: number, offset: number) {
  g.clear();
  const positions = [
    { x: 100, y: 40, s: 1.0 },
    { x: 320, y: 25, s: 0.7 },
    { x: 550, y: 50, s: 1.2 },
    { x: 700, y: 30, s: 0.8 },
    { x: 900, y: 45, s: 0.9 },
  ];
  for (const p of positions) {
    const cx = ((p.x + offset) % (width + 200)) - 100;
    g.circle(cx, p.y, 16 * p.s).fill({ color: 0xffffff, alpha: 0.7 });
    g.circle(cx + 12 * p.s, p.y - 4, 12 * p.s).fill({ color: 0xffffff, alpha: 0.6 });
    g.circle(cx - 10 * p.s, p.y + 2, 10 * p.s).fill({ color: 0xffffff, alpha: 0.5 });
  }
}

function drawTrees(g: PIXI.Graphics, width: number, offset: number) {
  g.clear();
  for (let i = -1; i < width / 80 + 2; i++) {
    const x = i * 80 + (offset % 80) + 20;
    const h = 40 + (i % 3) * 15;
    // Trunk
    g.rect(x - 4, -h + 20, 8, h - 10).fill(0x6b4226);
    // Foliage
    g.circle(x, -h + 10, 20).fill(0x2d8a4e);
    g.circle(x - 10, -h + 18, 14).fill(0x3a9a5e);
    g.circle(x + 10, -h + 18, 14).fill(0x3a9a5e);
  }
}

// ============================================================
// Main Component
// ============================================================

const IdleRPGGame: React.FC<IdleRPGGameProps> = ({ onExit }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const client = useGatrixClient();
  const { syncFlags } = useGatrixContext();

  // React state for HUD
  const [level, setLevel] = useState(1);
  const [gold, setGold] = useState(0);
  const [exp, setExp] = useState(0);
  const [kills, setKills] = useState(0);
  const [stage, setStage] = useState(1);
  const [subStage, setSubStage] = useState(1);
  const [log, setLog] = useState<string[]>([]);
  const [gameState, setGameState] = useState<'playing' | 'loading' | 'stageClear'>('playing');

  // Internal game state (not triggering re-renders)
  const stateRef = useRef({
    level: 1,
    gold: 0,
    exp: 0,
    kills: 0,
    stage: 1,
    subStage: 1,
    enemyHp: 100,
    enemyMaxHp: 100,
    attackTimer: 0,
    heroFrame: 0,
    enemyFrame: 0,
    hitFrame: -1,
    isAttacking: false,
    attackAnimFrame: 0,
    cloudOffset: 0,
    mountainOffset: 0,
    treeOffset: 0,
    gameState: 'playing' as string,
    enemyX: 700,
    heroX: 180,
  });

  const addLog = useCallback((msg: string) => {
    setLog((prev) => [msg, ...prev].slice(0, 6));
  }, []);

  useEffect(() => {
    let destroyed = false;

    const initGame = async () => {
      const app = new PIXI.Application();
      await app.init({
        width: 800,
        height: 400,
        backgroundColor: 0x87ceeb,
        antialias: true,
      });

      if (destroyed || !canvasRef.current) {
        app.destroy(true);
        return;
      }
      canvasRef.current.appendChild(app.canvas);

      // ---- Layers ----
      const skyGradient = new PIXI.Graphics();
      skyGradient.rect(0, 0, 800, 300).fill(0x87ceeb);
      skyGradient.rect(0, 250, 800, 50).fill(0xa8d8ea);
      app.stage.addChild(skyGradient);

      const cloudGfx = new PIXI.Graphics();
      app.stage.addChild(cloudGfx);

      const mountainGfx = new PIXI.Graphics();
      mountainGfx.y = 280;
      app.stage.addChild(mountainGfx);

      const treeGfx = new PIXI.Graphics();
      treeGfx.y = 300;
      app.stage.addChild(treeGfx);

      const groundGfx = new PIXI.Graphics();
      drawGround(groundGfx, 800);
      groundGfx.y = 300;
      app.stage.addChild(groundGfx);

      // World layer (hero, enemy, effects)
      const worldLayer = new PIXI.Container();
      app.stage.addChild(worldLayer);

      // Hero
      const heroGfx = new PIXI.Graphics();
      heroGfx.x = 180;
      heroGfx.y = 300;
      worldLayer.addChild(heroGfx);

      // Enemy
      const enemyGfx = new PIXI.Graphics();
      enemyGfx.x = 700;
      enemyGfx.y = 300;
      worldLayer.addChild(enemyGfx);

      // Hit effect
      const hitGfx = new PIXI.Graphics();
      hitGfx.visible = false;
      worldLayer.addChild(hitGfx);

      // Enemy HP bar (drawn in canvas)
      const hpBarBg = new PIXI.Graphics();
      const hpBarFill = new PIXI.Graphics();
      const hpText = new PIXI.Text({
        text: '',
        style: { fontSize: 10, fill: 0xffffff, fontFamily: '"Press Start 2P", monospace' },
      });
      app.stage.addChild(hpBarBg, hpBarFill, hpText);

      // Damage text container
      const dmgTexts: { text: PIXI.Text; vy: number; life: number }[] = [];

      // ---- Helper functions ----
      const s = stateRef.current;

      const spawnEnemy = () => {
        const bossMode = client.features.boolVariation('idle-boss-mode', false);
        const hpBase = s.stage * 80 + 50;
        s.enemyMaxHp = bossMode ? hpBase * 5 : hpBase;
        s.enemyHp = s.enemyMaxHp;
        s.enemyX = 800; // Off-screen right
        s.enemyFrame = 0;
      };

      const showDamage = (x: number, y: number, amount: number, isSkill: boolean) => {
        const txt = new PIXI.Text({
          text: isSkill ? `★${amount}★` : `${amount}`,
          style: {
            fontSize: isSkill ? 22 : 14,
            fill: isSkill ? 0xffdd00 : 0xffffff,
            fontFamily: '"Press Start 2P", monospace',
            stroke: { color: 0x000000, width: 3 },
          },
        });
        txt.anchor.set(0.5);
        txt.x = x + (Math.random() - 0.5) * 40;
        txt.y = y - 40;
        worldLayer.addChild(txt);
        dmgTexts.push({ text: txt, vy: -2 - Math.random(), life: 60 });
      };

      const dealDamage = (amount: number, isSkill = false) => {
        s.enemyHp -= amount;
        showDamage(s.enemyX, 260, amount, isSkill);
        s.hitFrame = 0;
        hitGfx.visible = true;
        hitGfx.x = s.enemyX;
        hitGfx.y = 270;

        if (s.enemyHp <= 0) {
          s.enemyHp = 0;
          defeatEnemy();
        }
      };

      const defeatEnemy = () => {
        const expMult = client.features.numberVariation('idle-exp-booster', 1);
        const gainExp = Math.floor((15 + s.stage * 5) * expMult);
        const gainGold = s.stage * 8 + Math.floor(Math.random() * 10);
        const bossMode = client.features.boolVariation('idle-boss-mode', false);

        s.exp += gainExp;
        s.gold += gainGold;
        s.kills += 1;

        // Level up check
        const expNeeded = s.level * 100;
        if (s.exp >= expNeeded) {
          s.exp -= expNeeded;
          s.level += 1;
          addLog(`⬆ LEVEL UP! Now Lv.${s.level}`);
          setLevel(s.level);
        }

        // Stage progression: every 5 kills
        if (s.kills % 5 === 0) {
          s.subStage += 1;
          if (s.subStage > 3) {
            s.subStage = 1;
            s.stage += 1;
            addLog(`🏰 STAGE ${s.stage} REACHED!`);
          }
          setSubStage(s.subStage);
          setStage(s.stage);
        }

        const enemyName = bossMode ? 'BOSS' : 'Slime';
        addLog(`⚔ ${enemyName} defeated! +${gainExp}XP +${gainGold}G`);
        setExp(s.exp);
        setGold(s.gold);
        setKills(s.kills);

        // Spawn next enemy
        spawnEnemy();
      };

      // Make dealDamage available from outside
      (stateRef as any).dealDamage = dealDamage;

      // Initial spawn
      spawnEnemy();

      // ---- Game Loop ----
      app.ticker.add((ticker) => {
        if (destroyed) return;
        const delta = ticker.deltaTime;
        const gameSpeed = client.features.numberVariation('idle-game-speed', 1);
        const moveSpeed = client.features.numberVariation('idle-move-speed', 1);
        const isAutoSkill = client.features.boolVariation('idle-auto-skill', false);
        const bossMode = client.features.boolVariation('idle-boss-mode', false);

        if (s.gameState !== 'playing') return;

        // Increment animation frames
        s.heroFrame += delta * gameSpeed;
        s.enemyFrame += delta * gameSpeed;

        // Background parallax
        s.cloudOffset += 0.3 * delta * moveSpeed * gameSpeed;
        s.mountainOffset += 0.1 * delta * moveSpeed * gameSpeed;
        s.treeOffset += 0.5 * delta * moveSpeed * gameSpeed;

        drawClouds(cloudGfx, 800, s.cloudOffset);
        drawMountains(mountainGfx, 800, s.mountainOffset);
        drawTrees(treeGfx, 800, s.treeOffset);

        // Enemy slide in
        const targetEnemyX = 550;
        if (s.enemyX > targetEnemyX) {
          s.enemyX -= 3 * delta * gameSpeed;
          if (s.enemyX < targetEnemyX) s.enemyX = targetEnemyX;
        }
        enemyGfx.x = s.enemyX;

        // Draw characters
        if (s.isAttacking) {
          drawHeroAttack(heroGfx, s.attackAnimFrame);
          s.attackAnimFrame += delta * gameSpeed;
          if (s.attackAnimFrame > 12) {
            s.isAttacking = false;
          }
        } else {
          drawHero(heroGfx, s.heroFrame);
        }

        drawEnemy(enemyGfx, s.enemyFrame, bossMode);

        // Hit effect
        if (s.hitFrame >= 0) {
          drawHitEffect(hitGfx, s.hitFrame);
          s.hitFrame += delta;
          if (s.hitFrame > 8) {
            s.hitFrame = -1;
            hitGfx.visible = false;
          }
        }

        // Attack timer — auto attack
        s.attackTimer += delta * gameSpeed * 0.02;
        if (s.attackTimer >= 1 && s.enemyX <= targetEnemyX) {
          s.attackTimer = 0;
          s.isAttacking = true;
          s.attackAnimFrame = 0;

          const baseDamage = 8 + s.level * 3;
          const variance = Math.floor(Math.random() * 5);
          const crit = Math.random() > 0.85;
          const dmg = crit ? (baseDamage + variance) * 2 : baseDamage + variance;
          dealDamage(dmg, crit);

          // Auto-skill
          if (isAutoSkill && Math.random() > 0.75) {
            setTimeout(() => {
              if (!destroyed) {
                const skillDmg = s.level * 8 + 30;
                dealDamage(skillDmg, true);
                addLog('✨ AUTO SKILL: POWER BASH!');
              }
            }, 200);
          }
        }

        // Update damage texts
        for (let i = dmgTexts.length - 1; i >= 0; i--) {
          const d = dmgTexts[i];
          d.text.y += d.vy * delta;
          d.life -= delta;
          d.text.alpha = Math.max(0, d.life / 30);
          if (d.life <= 0) {
            worldLayer.removeChild(d.text);
            d.text.destroy();
            dmgTexts.splice(i, 1);
          }
        }

        // Enemy HP bar
        const hpPercent = Math.max(0, s.enemyHp / s.enemyMaxHp);
        hpBarBg
          .clear()
          .rect(s.enemyX - 30, 220, 60, 8)
          .fill(0x333333)
          .stroke({ width: 1, color: 0x666666 });
        hpBarFill
          .clear()
          .rect(s.enemyX - 29, 221, 58 * hpPercent, 6)
          .fill(hpPercent > 0.3 ? 0xff4444 : 0xff0000);
        hpText.text = `${Math.max(0, Math.ceil(s.enemyHp))}/${s.enemyMaxHp}`;
        hpText.x = s.enemyX - 28;
        hpText.y = 208;
      });

      // Cleanup
      return () => {
        destroyed = true;
        app.destroy(true, { children: true });
      };
    };

    const cleanup = initGame();

    return () => {
      destroyed = true;
      cleanup?.then((fn) => fn?.());
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Manual skill
  const useSkill = useCallback(() => {
    const s = stateRef.current;
    if (s.gameState !== 'playing') return;
    const fn = (stateRef as any).dealDamage;
    if (fn) {
      const skillDmg = s.level * 10 + 50;
      fn(skillDmg, true);
      addLog('🗡️ POWER BASH!');
    }
  }, [addLog]);

  // Sync flags transition
  const startSyncTransition = useCallback(async () => {
    stateRef.current.gameState = 'loading';
    setGameState('loading');
    await syncFlags(true);
    setTimeout(() => {
      stateRef.current.gameState = 'playing';
      setGameState('playing');
      addLog('🔄 Config synced from server!');
    }, 1500);
  }, [syncFlags, addLog]);

  const expPercent =
    stateRef.current.level > 0 ? Math.min(100, (exp / (stateRef.current.level * 100)) * 100) : 0;

  return (
    <div
      style={{
        background: '#111',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
      }}
    >
      {/* Header */}
      <div
        className="nes-container is-dark with-title"
        style={{
          width: '808px',
          display: 'flex',
          justifyContent: 'space-between',
          padding: '8px 16px',
          alignItems: 'center',
        }}
      >
        <p className="title">GATRIX ADVENTURE</p>
        <div style={{ display: 'flex', gap: '24px', fontSize: '10px' }}>
          <span>
            STAGE {stage}-{subStage}
          </span>
          <span style={{ color: '#f7d51d' }}>💰 {gold.toLocaleString()}</span>
          <span style={{ color: '#92cc41' }}>Lv.{level}</span>
          <span style={{ color: '#aaa' }}>KO:{kills}</span>
        </div>
      </div>

      {/* Game Canvas */}
      <div
        style={{
          position: 'relative',
          border: '4px solid #444',
          width: '808px',
          height: '408px',
          overflow: 'hidden',
          borderRadius: '4px',
        }}
      >
        <div ref={canvasRef} />

        {/* Stage Clear overlay */}
        {gameState === 'stageClear' && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 5,
            }}
          >
            <h1 className="nes-text is-warning" style={{ fontSize: '36px' }}>
              STAGE CLEAR!
            </h1>
          </div>
        )}

        {/* Loading overlay */}
        {gameState === 'loading' && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              background: 'rgba(0,0,0,0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
          >
            <div className="nes-container is-dark with-title" style={{ width: '350px' }}>
              <p className="title">SYNCING FLAGS</p>
              <div style={{ textAlign: 'center' }}>
                <i className="nes-icon is-large star"></i>
                <p style={{ fontSize: '11px', marginTop: '12px' }}>Fetching feature config...</p>
                <progress className="nes-progress is-success" max={100}></progress>
              </div>
            </div>
          </div>
        )}

        {/* EXP bar */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: '6px',
            background: '#333',
          }}
        >
          <div
            style={{
              height: '100%',
              background: '#92cc41',
              width: `${expPercent}%`,
              transition: 'width 0.3s',
            }}
          />
        </div>

        {/* Sync button overlay */}
        {client.features.canSyncFlags() && (
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 20,
            }}
          >
            <button
              className="nes-btn is-warning"
              onClick={startSyncTransition}
              style={{ fontSize: '10px', animation: 'pulse 1s infinite' }}
            >
              ⚡ NEW CONFIG — SYNC NOW
            </button>
          </div>
        )}
      </div>

      {/* Bottom panel */}
      <div style={{ display: 'flex', gap: '8px', width: '808px' }}>
        {/* Log */}
        <div
          className="nes-container is-dark with-title"
          style={{
            flex: 1,
            height: '110px',
            overflow: 'hidden',
          }}
        >
          <p className="title">BATTLE LOG</p>
          <div style={{ fontSize: '9px', textAlign: 'left', lineHeight: '1.6' }}>
            {log.map((m, i) => (
              <div key={i} style={{ opacity: 1 - i * 0.15 }}>
                {m}
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div
          className="nes-container is-dark with-title"
          style={{ width: '250px', height: '110px' }}
        >
          <p className="title">ACTIONS</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button className="nes-btn is-primary" onClick={useSkill} style={{ fontSize: '10px' }}>
              🗡️ POWER BASH
            </button>
            <button className="nes-btn is-error" onClick={onExit} style={{ fontSize: '10px' }}>
              EXIT GAME
            </button>
          </div>
        </div>
      </div>

      {/* Flag status bar */}
      <div
        style={{
          fontSize: '9px',
          color: '#666',
          textAlign: 'center',
          width: '808px',
          display: 'flex',
          justifyContent: 'center',
          gap: '16px',
        }}
      >
        <span>
          MODE: {client.features.boolVariation('idle-boss-mode', false) ? '🔴 BOSS' : '🟢 NORMAL'}
        </span>
        <span>SPEED: x{client.features.numberVariation('idle-game-speed', 1)}</span>
        <span>EXP: x{client.features.numberVariation('idle-exp-booster', 1)}</span>
        <span>AUTO: {client.features.boolVariation('idle-auto-skill', false) ? 'ON' : 'OFF'}</span>
      </div>
    </div>
  );
};

export default IdleRPGGame;
