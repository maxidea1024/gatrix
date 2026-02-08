// ============================================================
// Idle Defense Roguelike - Type Definitions
// ============================================================

export interface Position {
  x: number;
  y: number;
}

export interface Enemy {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  type: 'normal' | 'fast' | 'tank' | 'boss';
  color: number;
  frame: number;
  dead: boolean;
  deathFrame: number;
  size: number;
  hitTimer: number; // For flash effect
  knockbackX: number; // For hit recoil
  attackTimer: number; // For ranged enemies
  isRanged?: boolean;
}

export interface Projectile {
  x: number;
  y: number;
  targetId: number | 'hero';
  source: 'hero' | 'enemy';
  damage: number;
  speed: number;
  isSkill: boolean;
  color: number;
  phase: number;
  amplitude: number;
  history: { x: number; y: number }[];
}

export interface DroppedItem {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  icon: string;
  rarity: string;
  life: number;
  collected: boolean;
  item: InventoryItem;
  history: { x: number; y: number }[];
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
}

export interface DamageText {
  x: number;
  y: number;
  vy: number;
  text: string;
  life: number;
  color: number;
  isSkill: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  icon: string;
  type: 'weapon' | 'armor' | 'potion' | 'scroll' | 'material';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  quantity: number;
  description: string;
  stat?: { atk?: number; def?: number; hp?: number; speed?: number };
  equipped?: boolean;
  sellPrice: number;
}

export interface ShopItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  price: number;
  type: 'weapon' | 'armor' | 'potion' | 'scroll';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  stat?: { atk?: number; def?: number; hp?: number; speed?: number };
}

export interface MailItem {
  id: string;
  sender: string;
  subject: string;
  body: string;
  rewards?: { gold?: number; items?: InventoryItem[] };
  read: boolean;
  claimed: boolean;
  timestamp: number;
}

export interface SkillDef {
  id: string;
  name: string;
  icon: string;
  cooldown: number;
  currentCd: number;
  damage: number;
  description: string;
  type: 'single' | 'aoe' | 'buff';
}

export interface HeroStats {
  level: number;
  exp: number;
  maxExp: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  gold: number;
  kills: number;
  wave: number;
  maxWave: number;
}

export interface GameState {
  hero: HeroStats;
  enemies: Enemy[];
  projectiles: Projectile[];
  particles: Particle[];
  damageTexts: DamageText[];
  droppedItems: DroppedItem[];
  skills: SkillDef[];
  inventory: InventoryItem[];
  mails: MailItem[];
  shopItems: ShopItem[];
  totalDamageDealt: number;
  shakeTimer: number;
  spawnTimer: number;
  waveTimer: number;
  autoAttackTimer: number;
  heroFrame: number;
  cloudOffset: number;
  mountainOffset: number;
  treeOffset: number;
  isPaused: boolean;
  isAttacking: boolean;
  attackAnimFrame: number;
  isWaveTransition: boolean;
  waveCountdown: number;
  isDead: boolean;
}

export type UIPanel = 'none' | 'inventory' | 'shop' | 'mail';

export const RARITY_COLORS: Record<string, string> = {
  common: '#aaaaaa',
  uncommon: '#4ade80',
  rare: '#60a5fa',
  epic: '#c084fc',
  legendary: '#fbbf24',
};

export const ENEMY_CONFIGS = {
  normal: { color: 0x48c774, size: 1, speedMult: 1, hpMult: 1 },
  fast: { color: 0x3ec8e8, size: 0.8, speedMult: 2, hpMult: 0.6 },
  tank: { color: 0xe6853e, size: 1.4, speedMult: 0.5, hpMult: 3 },
  boss: { color: 0xcc2222, size: 2.0, speedMult: 0.3, hpMult: 10 },
} as const;
