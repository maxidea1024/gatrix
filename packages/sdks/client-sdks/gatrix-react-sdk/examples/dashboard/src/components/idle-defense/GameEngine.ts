// ============================================================
// Idle Defense Roguelike - Game Engine (core logic, no rendering)
// ============================================================

import type {
  Enemy,
  Projectile,
  Particle,
  DamageText,
  HeroStats,
  SkillDef,
  InventoryItem,
  MailItem,
  GameState,
  ShopItem,
} from './GameTypes';
import { ENEMY_CONFIGS } from './GameTypes';
import {
  getDefaultSkills,
  getInitialMails,
  generateWaveClearMail,
  rollDrop,
  generateShopItems,
} from './GameData';

export interface FeatureFlagReader {
  boolVariation(key: string, defaultVal: boolean): boolean;
  numberVariation(key: string, defaultVal: number): number;
}

const CANVAS_W = 800;
const HERO_X = 120;
const SPAWN_X = 850;

export function createInitialState(): GameState {
  return {
    hero: {
      level: 1,
      exp: 0,
      maxExp: 100,
      hp: 100,
      maxHp: 100,
      atk: 10,
      def: 2,
      gold: 0,
      kills: 0,
      wave: 1,
      maxWave: 1,
    },
    enemies: [],
    projectiles: [],
    particles: [],
    damageTexts: [],
    droppedItems: [],
    skills: getDefaultSkills(),
    inventory: [],
    mails: getInitialMails(),
    shopItems: generateShopItems(1),
    totalDamageDealt: 0,
    shakeTimer: 0,
    spawnTimer: 0,
    waveTimer: 0,
    autoAttackTimer: 0,
    heroFrame: 0,
    cloudOffset: 0,
    mountainOffset: 0,
    treeOffset: 0,
    isPaused: false,
    isAttacking: false,
    attackAnimFrame: 0,
    isWaveTransition: false,
    waveCountdown: 0,
    isDead: false,
    bgDistOffset: 0,
    nextEnemyId: 1,
  };
}

function spawnEnemy(gs: GameState, flags: FeatureFlagReader): void {
  const wave = gs.hero.wave;
  const bossMode = flags.boolVariation('idle-boss-mode', false);

  let type: Enemy['type'] = 'normal';
  if (bossMode && gs.enemies.length === 0 && gs.hero.kills % 10 === 9) {
    type = 'boss';
  } else {
    const roll = Math.random();
    if (roll < 0.05 + Math.min(0.1, wave * 0.005)) type = 'boss';
    else if (roll < 0.25) type = 'tank';
    else if (roll < 0.5) type = 'fast';
    // Else stays 'normal'
  }

  const cfg = ENEMY_CONFIGS[type];
  const baseHp = 30 + wave * 20;
  const baseSpeed = 0.4 + wave * 0.02;

  const enemy: Enemy = {
    id: gs.nextEnemyId++,
    x: SPAWN_X + Math.random() * 100,
    y: 300,
    hp: Math.floor(baseHp * cfg.hpMult),
    maxHp: Math.floor(baseHp * cfg.hpMult),
    speed: baseSpeed * cfg.speedMult,
    type,
    color: cfg.color,
    frame: Math.random() * 100,
    dead: false,
    deathFrame: 0,
    size: cfg.size,
    hitTimer: 0,
    knockbackX: 0,
    attackTimer: Math.random() * 100, // Staggered start
    isRanged: type === 'fast' || type === 'boss', // Ranged slimes
  };
  gs.enemies.push(enemy);
}

function spawnParticles(
  gs: GameState,
  x: number,
  y: number,
  color: number,
  count: number,
  sizeMult: number = 1
): void {
  for (let i = 0; i < count; i++) {
    gs.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.8) * 8,
      life: 30 + Math.random() * 30,
      maxLife: 60,
      color,
      size: (2 + Math.random() * 3) * sizeMult,
    });
  }
}

function addDamageText(
  gs: GameState,
  x: number,
  y: number,
  amount: number,
  isSkill: boolean
): void {
  gs.damageTexts.push({
    x: x + (Math.random() - 0.5) * 30,
    y: y - 30,
    vy: -1.5 - Math.random(),
    text: isSkill ? `★${amount}★` : `${amount}`,
    life: 50,
    color: isSkill ? 0xffdd00 : 0xffffff,
    isSkill,
  });
}

function dealDamageToEnemy(gs: GameState, enemy: Enemy, rawDamage: number, isSkill: boolean): void {
  const dmg = Math.max(1, rawDamage);
  enemy.hp -= dmg;
  enemy.hitTimer = 4; // Shorter flash for snappier feel
  enemy.knockbackX = 15; // Recoil back 15 pixels
  gs.totalDamageDealt += dmg;
  addDamageText(gs, enemy.x, enemy.y - 20 * enemy.size, dmg, isSkill);
  spawnParticles(
    gs,
    enemy.x,
    enemy.y - 15 * enemy.size,
    isSkill ? 0xffdd00 : 0xffffff,
    isSkill ? 12 : 6
  );

  if (enemy.hp <= 0) {
    enemy.hp = 0;
    enemy.dead = true;
    enemy.deathFrame = 0;
    // Death particles - RED for blood effect - Big and many!
    spawnParticles(gs, enemy.x, enemy.y - 15 * enemy.size, 0xff0000, 80, 1.5);
  }
}

function processEnemyDeath(
  gs: GameState,
  enemy: Enemy,
  flags: FeatureFlagReader,
  addLog: (m: string) => void
): void {
  const expMult = flags.numberVariation('idle-exp-booster', 1);
  const baseExp = 10 + gs.hero.wave * 5;
  const baseGold = 5 + gs.hero.wave * 3;
  const gainExp = Math.floor(baseExp * expMult * (enemy.type === 'boss' ? 5 : 1));
  const gainGold = Math.floor(baseGold * (enemy.type === 'boss' ? 5 : 1));

  gs.hero.exp += gainExp;
  gs.hero.gold += gainGold;
  gs.hero.kills += 1;

  // Level up
  while (gs.hero.exp >= gs.hero.maxExp) {
    gs.hero.exp -= gs.hero.maxExp;
    gs.hero.level += 1;
    gs.hero.maxExp = gs.hero.level * 100;
    gs.hero.maxHp += 15;
    gs.hero.hp = gs.hero.maxHp;
    gs.hero.atk += 3;
    gs.hero.def += 1;
    addLog(`⬆ LEVEL UP! You reached Lv.${gs.hero.level}. Congrats!`);
  }

  // Spawn Dropped Item Animation (Homing missile style)
  const dropItemData = rollDrop(gs.hero.wave);
  if (dropItemData) {
    gs.droppedItems.push({
      id: Math.random().toString(36).substr(2, 9),
      x: enemy.x,
      y: enemy.y,
      // Pop out velocity
      vx: -2 + Math.random() * 4,
      vy: -8 - Math.random() * 4,
      icon: dropItemData.icon,
      rarity: dropItemData.rarity,
      targetX: HERO_X,
      targetY: 280,
      life: 120, // Longer life for better path
      collected: false,
      item: dropItemData,
      history: [],
    });
  }

  const typeName = enemy.type === 'boss' ? 'Boss Slime' : 'Slime';
  addLog(`⚔ ${typeName} Defeated! (+${gainExp}XP, +${gainGold}G)`);
}

export function useSkill(
  gs: GameState,
  skillId: string,
  _flags: FeatureFlagReader,
  addLog: (m: string) => void
): void {
  const skill = gs.skills.find((s) => s.id === skillId);
  if (!skill || skill.currentCd > 0 || gs.isPaused) return;

  skill.currentCd = skill.cooldown;

  if (skill.type === 'buff') {
    // Heal
    const healAmount = Math.floor(gs.hero.maxHp * 0.3);
    gs.hero.hp = Math.min(gs.hero.maxHp, gs.hero.hp + healAmount);
    addLog(`🛡️ HOLY LIGHT! Recovered ${healAmount} HP.`);
    return;
  }

  const damage = skill.damage + gs.hero.atk * 2 + gs.hero.level * 5;
  if (skill.type === 'aoe') {
    // Hit all enemies on screen
    for (const e of gs.enemies) {
      if (!e.dead && e.x < CANVAS_W) {
        dealDamageToEnemy(gs, e, damage, true);
      }
    }
    addLog(`🔥 ${skill.name}! Powerful AOE Attack!`);
  } else {
    // Hit closest enemy
    const alive = gs.enemies.filter((e) => !e.dead).sort((a, b) => a.x - b.x);
    if (alive.length > 0) {
      dealDamageToEnemy(gs, alive[0], damage * 2, true);
      addLog(`🗡️ ${skill.name}! Critical Strike!`);
    }
  }
}

export function tick(
  gs: GameState,
  delta: number,
  flags: FeatureFlagReader,
  addLog: (m: string) => void
): void {
  if (gs.isPaused) return;

  const gameSpeed = Math.max(0.1, flags.numberVariation('idle-game-speed', 1));
  const isAutoSkill = flags.boolVariation('idle-auto-skill', false);
  const d = delta * gameSpeed;

  gs.heroFrame += d;

  // Shake decrement
  if (gs.shakeTimer > 0) gs.shakeTimer -= d;

  // Slight ambient scroll for life (defense = slow move)
  // Multi-layer parallax
  gs.bgDistOffset += 0.02 * d;
  gs.cloudOffset += 0.2 * d;
  gs.mountainOffset += 0.05 * d;
  gs.treeOffset += 0.12 * d; // Ground/Near scroll speed for platform feel

  // Move skill cooldowns (Always run)
  for (const sk of gs.skills) {
    if (sk.currentCd > 0) {
      sk.currentCd -= d;
      if (sk.currentCd < 0) sk.currentCd = 0;
    }
  }

  // Visuals & Ambient (Always run)
  updateVisuals(gs, d, addLog);

  // Transitions
  if (gs.isWaveTransition) {
    gs.waveCountdown -= d;
    if (gs.waveCountdown <= 0) {
      gs.isWaveTransition = false;
      gs.hero.wave += 1;
      if (gs.hero.wave > gs.hero.maxWave) gs.hero.maxWave = gs.hero.wave;
      gs.shopItems = generateShopItems(gs.hero.wave);
      addLog(`🏰 WAVE ${gs.hero.wave} STARTED! Prepare for defense.`);
    }
    return;
  }

  if (gs.isDead) {
    return;
  }

  // Spawn / Waves logic continues...

  // Spawn enemies
  const spawnInterval = Math.max(30, 120 - gs.hero.wave * 5);
  gs.spawnTimer += d;
  if (gs.spawnTimer >= spawnInterval) {
    gs.spawnTimer = 0;
    const maxEnemies = 6 + Math.floor(gs.hero.wave / 2);
    if (gs.enemies.filter((e) => !e.dead).length < maxEnemies) {
      spawnEnemy(gs, flags);
    }
  }

  // Move enemies (toward hero / defense line)
  for (const e of gs.enemies) {
    if (e.dead) continue;
    e.frame += d;
    if (e.hitTimer > 0) e.hitTimer -= d;
    if (e.knockbackX > 0) e.knockbackX -= d * 0.5;

    // Effective position = x + knockback
    if (e.x + e.knockbackX > HERO_X + 60) {
      e.x -= e.speed * d;

      // Ranged attack logic
      if (e.isRanged && !e.dead && e.x < 800) {
        e.attackTimer += d;
        if (e.attackTimer > 120) {
          e.attackTimer = 0;
          gs.projectiles.push({
            x: e.x,
            y: e.y - 20,
            targetId: 'hero',
            source: 'enemy',
            damage: Math.floor(5 + gs.hero.wave * 1.5),
            speed: 5,
            isSkill: false,
            color: 0x9261ff, // Villainous purple
            phase: Math.random() * Math.PI,
            amplitude: 5,
            history: [],
          });
        }
      }
    } else {
      // Enemy attacks hero
      const dmg = Math.max(1, Math.floor(3 + gs.hero.wave - gs.hero.def * 0.3));
      gs.hero.hp -= dmg;
      gs.shakeTimer = 10;
      addDamageText(gs, HERO_X, 260, dmg, false);
      spawnParticles(gs, HERO_X, 270, 0xff4444, 3);
      if (gs.hero.hp <= 0) {
        gs.hero.hp = 0;
        if (!gs.isDead) {
          gs.isDead = true;
          // Clear immediate threats
          gs.enemies = [];
          gs.projectiles = [];
          addLog('💀 DEFEATED. Recovering energy to retry...');
          setTimeout(() => {
            gs.hero.hp = gs.hero.maxHp;
            gs.isDead = false;
            addLog('🔄 RECOVERED! Stop the slimes again!');
          }, 2000);
        }
        return;
      }
    }
  }

  // Auto attack
  gs.autoAttackTimer += d;
  const atkSpeed = 50;
  if (gs.autoAttackTimer >= atkSpeed) {
    gs.autoAttackTimer = 0;
    const alive = gs.enemies.filter((e) => !e.dead && e.x < CANVAS_W).sort((a, b) => a.x - b.x);
    if (alive.length > 0) {
      gs.isAttacking = true;
      gs.attackAnimFrame = 0;
      const target = alive[0];
      const baseDmg = gs.hero.atk + gs.hero.level * 2;
      const variance = Math.floor(Math.random() * 5);
      const crit = Math.random() > 0.85;
      const dmg = crit ? (baseDmg + variance) * 2 : baseDmg + variance;

      // Fire projectile
      gs.projectiles.push({
        x: HERO_X + 20,
        y: 270,
        targetId: target.id,
        source: 'hero',
        damage: dmg,
        speed: 8,
        isSkill: crit,
        color: crit ? 0xffdd00 : 0xdddddd,
        phase: Math.random() * Math.PI * 2,
        amplitude: crit ? 20 : 8, // Less extreme wave
        history: [],
      });
    }
  }

  // Attack animation
  if (gs.isAttacking) {
    gs.attackAnimFrame += d;
    if (gs.attackAnimFrame > 12) gs.isAttacking = false;
  }

  // Move projectiles
  for (let i = gs.projectiles.length - 1; i >= 0; i--) {
    const p = gs.projectiles[i];

    // Off-screen cleanup
    if (p.x < -100 || p.x > CANVAS_W + 100) {
      gs.projectiles.splice(i, 1);
      continue;
    }

    let tx = 0,
      ty = 0;
    let collisionThreshold = 10;
    let isTargetValid = false;

    if (p.targetId === 'hero') {
      tx = HERO_X;
      ty = 280;
      isTargetValid = gs.hero.hp > 0;
    } else {
      const target = gs.enemies.find((e) => e.id === p.targetId);
      if (target && !target.dead) {
        tx = target.x;
        ty = target.y - 15 * target.size;
        isTargetValid = true;
      }
    }

    if (!isTargetValid) {
      gs.projectiles.splice(i, 1);
      continue;
    }

    const dx = tx - p.x;
    const dy = ty - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < collisionThreshold) {
      if (p.source === 'hero') {
        const target = gs.enemies.find((e) => e.id === p.targetId);
        if (target) dealDamageToEnemy(gs, target, p.damage, p.isSkill);
      } else {
        // Damage Hero
        gs.hero.hp -= p.damage;
        gs.shakeTimer = 8;
        addDamageText(gs, HERO_X, 260, p.damage, false);
        spawnParticles(gs, HERO_X, 280, 0xff0000, 5);

        if (gs.hero.hp <= 0 && !gs.isDead) {
          gs.hero.hp = 0;
          gs.isDead = true;
          gs.enemies = [];
          gs.projectiles = [];
          addLog('💀 DEFEATED by projectile. Recovering...');
          setTimeout(() => {
            gs.hero.hp = gs.hero.maxHp;
            gs.isDead = false;
            addLog('🔄 RECOVERED! Back to the fight!');
          }, 2000);
        }
      }
      gs.projectiles.splice(i, 1);
    } else {
      p.phase += 0.15 * d; // Slightly slower wave
      p.x += (dx / dist) * p.speed * d;

      // Wavy Y movement
      const linearStepY = (dy / dist) * p.speed * d;
      p.y += linearStepY + Math.cos(p.phase) * (p.amplitude * 0.05) * d;
      p.y += Math.cos(p.phase) * 1 * d; // Subtle wave

      // Update trail
      p.history.push({ x: p.x, y: p.y });
      if (p.history.length > 5) p.history.shift();
    }
  }

  // Process dead enemies
  for (let i = gs.enemies.length - 1; i >= 0; i--) {
    const e = gs.enemies[i];
    if (e.dead) {
      e.deathFrame += d;
      if (e.deathFrame === d) {
        // First frame of death
        processEnemyDeath(gs, e, flags, addLog);
      }
      if (e.deathFrame > 20) {
        gs.enemies.splice(i, 1);
      }
    }
  }

  // Wave clear check
  const waveKillTarget = 10 + gs.hero.wave * 3;
  if (
    gs.hero.kills >= waveKillTarget * gs.hero.wave &&
    gs.enemies.filter((e) => !e.dead).length === 0 &&
    gs.hero.kills > 0 &&
    gs.hero.kills % waveKillTarget === 0
  ) {
    gs.isWaveTransition = true;
    gs.waveCountdown = 120;
    gs.mails.unshift(generateWaveClearMail(gs.hero.wave));
    addLog(`🎉 WAVE ${gs.hero.wave} CLEAR! HQ sends you a reward.`);
  }

  // Auto-skill
  if (isAutoSkill) {
    for (const sk of gs.skills) {
      if (sk.currentCd <= 0 && gs.enemies.some((e) => !e.dead)) {
        useSkill(gs, sk.id, flags, addLog);
        break;
      }
    }
  }

  updateVisuals(gs, d, addLog); // No-op now as it moved up, can remove
}

function updateVisuals(gs: GameState, d: number, addLog?: (m: string) => void): void {
  // Update particles
  for (let i = gs.particles.length - 1; i >= 0; i--) {
    const p = gs.particles[i];
    p.x += p.vx * d * 0.5;
    p.y += p.vy * d * 0.5;
    p.vy += 0.15 * d;
    p.life -= d;
    if (p.life <= 0) gs.particles.splice(i, 1);
  }

  // Update Damage Texts
  for (let i = gs.damageTexts.length - 1; i >= 0; i--) {
    const dt = gs.damageTexts[i];
    dt.y += dt.vy * d;
    dt.life -= d;
    if (dt.life <= 0) gs.damageTexts.splice(i, 1);
  }

  // Update Dropped Items (Homing missile behavior)
  for (let i = gs.droppedItems.length - 1; i >= 0; i--) {
    const item = gs.droppedItems[i];
    item.life -= d;

    if (item.life < 100) {
      // Homing Phase: Apply steering force towards hero
      const dx = item.targetX - item.x;
      const dy = item.targetY - item.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 15) {
        // Collected!
        if (!item.collected) {
          item.collected = true;
          const existing = gs.inventory.find(
            (it) => it.name === item.item.name && it.rarity === item.item.rarity
          );
          if (existing) {
            existing.quantity += 1;
          } else {
            gs.inventory.push(item.item);
          }
          if (addLog) addLog(`📦 Item Acquired: ${item.icon} ${item.item.name}`);
          gs.droppedItems.splice(i, 1);
        }
      } else {
        // Accelerate towards target
        const speed = 15;
        const ax = (dx / dist) * speed;
        const ay = (dy / dist) * speed;

        // Lerp velocity for smooth curve
        item.vx += (ax - item.vx) * 0.1 * d;
        item.vy += (ay - item.vy) * 0.1 * d;
      }
    } else {
      // Initial Pop Phase: Physics (gravity)
      item.vy += 0.5 * d;
    }

    // Apply velocity
    item.x += item.vx * d;
    item.y += item.vy * d;

    // Trail update
    item.history.push({ x: item.x, y: item.y });
    if (item.history.length > 8) item.history.shift();

    if (item.life <= 0) gs.droppedItems.splice(i, 1);
  }
}
