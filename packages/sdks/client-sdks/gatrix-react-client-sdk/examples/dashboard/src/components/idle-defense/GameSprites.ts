import * as PIXI from 'pixi.js';

/**
 * Utility to create a PIXI Texture from a 2D pixel array (represented as hex color strings).
 * '.' or null represents transparent.
 */
export function createPixelTexture(
  _app: PIXI.Application,
  pixelMap: (string | null)[][],
  pixelSize: number = 4
): PIXI.Texture {
  const height = pixelMap.length;
  const width = pixelMap[0].length;

  const canvas = document.createElement('canvas');
  canvas.width = width * pixelSize;
  canvas.height = height * pixelSize;
  const ctx = canvas.getContext('2d');

  if (!ctx) return PIXI.Texture.EMPTY;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const color = pixelMap[y][x];
      if (color && color !== '.') {
        ctx.fillStyle = color;
        ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
      }
    }
  }

  return PIXI.Texture.from(canvas);
}

// --- Global Palette ---
export const BK = '#000000'; // Black
export const W = '#ffffff'; // White
const _ = null; // Transparent

// --- Knight Character: Legendary Style (20x24) ---
export const K_EB = '#3b82f6'; // Energy Blue Armor
export const K_ED = '#1d4ed8'; // Energy Dark Blue
export const K_EL = '#93c5fd'; // Energy Light Blue
export const K_M1 = '#f8fafc'; // White Metal (Blade)
export const K_M2 = '#94a3b8'; // Silver Metal
export const K_M3 = '#475569'; // Iron Metal
export const K_R1 = '#f87171'; // Plume Red
export const K_R2 = '#991b1b'; // Plume Dark
export const K_Y1 = '#fbbf24'; // Gold Trim
export const K_Y2 = '#d97706'; // Gold Shadow
export const K_WD = '#78350f'; // Wood Handle

// --- Knight Character: Legendary Style (20x24) ---
export const HERO_IDLE_MAP: (string | null)[][] = [
  [_, _, _, _, _, _, _, _, K_R1, K_R1, K_R1, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, K_R1, K_R1, K_R1, K_R2, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, K_R1, K_R1, K_R1, K_R2, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, K_M2, K_Y1, K_Y1, K_M3, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, K_M2, K_M2, K_M2, K_M2, K_M2, K_M3, _, _, _, _, _, _],
  [_, _, _, _, _, _, K_M2, K_M2, BK, K_M2, BK, K_M2, K_M2, K_M3, _, _, _, _, _, _],
  [_, _, _, _, _, _, K_M3, K_M3, K_M3, K_M3, K_M3, K_M3, K_M3, K_M3, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, K_M3, K_Y1, K_Y1, K_Y1, K_Y1, K_M3, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, _, _, _, _, _, _, _],
  [_, _, _, _, _, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, _, _, _, _, _, _],
  [_, _, _, _, K_EB, K_EB, K_ED, K_ED, K_ED, K_ED, K_ED, K_ED, K_EB, K_EB, _, _, _, _, _, _],
  [_, _, _, K_EB, K_EB, K_ED, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, K_ED, K_EB, K_EB, _, _, _, _, _], // Arms
  [_, _, _, K_EB, K_ED, K_EB, W, W, W, W, W, W, K_EB, K_ED, K_EB, _, _, _, _, _], // Crest
  [_, _, _, K_EB, K_ED, K_EB, W, W, K_R1, K_R1, W, W, K_EB, K_ED, K_EB, _, _, _, _, _], // Shield on belt style
  [_, _, _, K_EB, K_ED, K_EB, W, W, K_R1, K_R1, W, W, K_EB, K_ED, K_EB, _, _, _, _, _],
  [_, _, _, _, K_EB, K_ED, K_ED, K_EB, K_EB, K_EB, K_EB, K_ED, K_ED, K_EB, _, _, _, _, _, _],
  [_, _, _, _, _, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, K_EB, K_ED, K_ED, K_ED, K_ED, K_EB, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, K_EB, K_ED, K_ED, K_ED, K_ED, K_EB, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, K_M3, K_M3, _, _, K_M3, K_M3, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, K_M3, K_M3, _, _, K_M3, K_M3, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, K_M3, K_M3, _, _, K_M3, K_M3, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, BK, BK, _, _, BK, BK, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, BK, BK, _, _, BK, BK, _, _, _, _, _, _, _, _],
];

export const HERO_ATTACK_MAP: (string | null)[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, K_R1, K_R1, K_R1, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, K_R1, K_R1, K_R1, K_R2, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, K_R1, K_R1, K_R1, K_R2, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, K_M2, K_Y1, K_Y1, K_M3, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, K_M2, K_M2, K_M2, K_M2, K_M2, K_M3, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, K_M2, K_M2, BK, K_M2, BK, K_M2, K_M2, K_M3, _, _, _],
  [_, _, _, _, _, _, _, _, K_M3, K_M3, K_M3, K_M3, K_M3, K_M3, K_M3, K_M3, K_M3, _, _, _],
  [_, _, _, _, _, _, _, _, K_M1, K_M1, K_M1, K_M1, K_M1, K_M1, K_M1, K_Y1, K_Y1, K_WD, K_WD, _], // Weapon!
  [_, _, _, _, _, _, _, _, K_M1, K_M1, K_M1, K_M1, K_M1, K_M1, K_M1, K_M1, K_M1, K_M1, K_M1, K_M1], // Massive Blade
  [_, _, _, _, _, _, _, _, K_M2, K_M2, K_M2, K_M2, K_M2, K_M2, K_M1, K_M1, K_M1, K_M1, K_M1, K_M1],
  [_, _, _, _, _, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, _, _, _, _, _, _],
  [_, _, _, _, K_EB, K_EB, K_ED, K_ED, K_ED, K_ED, K_ED, K_ED, K_EB, K_EB, _, _, _, _, _, _],
  [_, _, _, K_EB, K_EB, K_ED, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, K_ED, K_EB, K_EB, _, _, _, _, _],
  [_, _, _, K_EB, K_ED, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, K_ED, K_EB, _, _, _, _, _],
  [_, _, _, K_EB, K_ED, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, K_ED, K_EB, _, _, _, _, _],
  [_, _, _, _, K_EB, K_ED, K_ED, K_EB, K_EB, K_EB, K_EB, K_ED, K_ED, K_EB, _, _, _, _, _, _],
  [_, _, _, _, _, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, K_EB, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, K_EB, K_ED, K_ED, K_ED, K_ED, K_EB, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, K_EB, K_ED, K_ED, K_ED, K_ED, K_EB, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, K_M3, K_M3, _, _, K_M3, K_M3, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, K_M3, K_M3, _, _, K_M3, K_M3, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, K_M3, K_M3, _, _, K_M3, K_M3, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, BK, BK, _, _, BK, BK, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, BK, BK, _, _, BK, BK, _, _, _, _, _, _, _, _],
];

// Slime Maps (C = Color, L = Light, D = Dark, E = Eye)
export const G1 = '#48c774'; // Green
export const G2 = '#319e53'; // Dark Green
export const G3 = '#88f0a0'; // Light Green
const E = '#000000'; // Black

export const SLIME_MAP: (string | null)[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, G3, G3, G3, G3, _, _, _, _, _, _, _],
  [_, _, _, _, G3, G1, G1, G1, G1, G3, _, _, _, _, _, _],
  [_, _, _, G3, G1, G1, G1, G1, G1, G1, G3, _, _, _, _, _],
  [_, _, G3, G1, G1, G1, G1, G1, G1, G1, G1, G3, _, _, _, _],
  [_, _, G3, G1, E, G1, G1, G1, E, G1, G1, G3, _, _, _, _],
  [_, _, G1, G1, E, G1, G1, G1, E, G1, G1, G1, _, _, _, _],
  [_, _, G1, G1, G1, G1, G1, G1, G1, G1, G1, G1, _, _, _, _],
  [_, _, G1, G1, G1, G1, G1, G1, G1, G1, G1, G1, _, _, _, _],
  [_, _, G2, G1, G1, G1, G1, G1, G1, G1, G1, G2, _, _, _, _],
  [_, _, G2, G2, G1, G1, G1, G1, G1, G1, G2, G2, _, _, _, _],
  [_, _, _, G2, G2, G2, G2, G2, G2, G2, G2, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// Item Maps (P = Potion, S = Sword, G = Gold)
const PL = '#ec4899'; // Pink Light
const PD = '#be185d'; // Pink Dark
const GL = '#ffffff'; // Glass Light

export const POTION_MAP: (string | null)[][] = [
  [_, _, _, _, _, BK, BK, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, BK, BK, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, BK, BK, BK, BK, _, _, _, _, _, _, _, _],
  [_, _, _, BK, PL, PL, GL, PL, BK, _, _, _, _, _, _, _],
  [_, _, BK, PL, PL, PL, GL, PL, PL, BK, _, _, _, _, _, _],
  [_, _, BK, PL, PL, PL, PL, PL, PL, BK, _, _, _, _, _, _],
  [_, _, BK, PL, PL, PD, PD, PL, PL, BK, _, _, _, _, _, _],
  [_, _, BK, PD, PD, PD, PD, PD, PD, BK, _, _, _, _, _, _],
  [_, _, _, BK, BK, BK, BK, BK, BK, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// Fast Slime (Blue)
const B1 = '#3ec8e8';
const B2 = '#2a9bb5';
const B3 = '#a5f3ff';

export const FAST_SLIME_MAP: (string | null)[][] = SLIME_MAP.map((row) =>
  row.map((c) => (c === G1 ? B1 : c === G2 ? B2 : c === G3 ? B3 : c))
);

// Boss Slime (Red + Crown)
const SR1 = '#cc2222';
const SR2 = '#881111';
const SR3 = '#ff6666';
const SY1 = '#f7d51d'; // Gold

export const BOSS_SLIME_MAP: (string | null)[][] = SLIME_MAP.map((row, y) =>
  row.map((c, x) => {
    // Add crown
    if (y < 3 && x >= 5 && x <= 10) {
      if (y === 0 && (x === 5 || x === 7 || x === 10)) return SY1;
      if (y === 1 && x >= 5 && x <= 10) return SY1;
      if (y === 2 && x >= 6 && x <= 9) return SY1;
    }
    return c === G1 ? SR1 : c === G2 ? SR2 : c === G3 ? SR3 : c;
  })
);

// Tank Slime (Grey/Steel)
const T1 = '#94a3b8'; // Slate 400
const T2 = '#475569'; // Slate 600
const T3 = '#f1f5f9'; // Slate 100

export const TANK_SLIME_MAP: (string | null)[][] = SLIME_MAP.map((row) =>
  row.map((c) => (c === G1 ? T1 : c === G2 ? T2 : c === G3 ? T3 : c))
);

// Sword Map
const SM1 = '#eeeeee'; // Metal
const SM2 = '#9ca3af'; // Metal Dark
const SWD = '#5a3825'; // Wood

export const SWORD_MAP: (string | null)[][] = [
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, _, SM1],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, _, SM1, SM2],
  [_, _, _, _, _, _, _, _, _, _, _, _, _, SM1, SM2, _],
  [_, _, _, _, _, _, _, _, _, _, _, _, SM1, SM2, _, _],
  [_, _, _, _, _, _, _, _, _, _, _, SM1, SM2, _, _, _],
  [_, _, _, _, _, _, _, _, _, _, SM1, SM2, _, _, _, _],
  [_, _, _, _, _, _, _, _, _, SM1, SM2, _, _, _, _, _],
  [_, _, _, _, _, _, _, _, SM1, SM2, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, SM1, SM2, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, SM1, SM2, _, _, _, _, _, _, _, _],
  [_, _, _, _, _, SM1, SM2, _, _, _, _, _, _, _, _, _],
  [_, _, _, _, SY1, SY1, _, _, _, _, _, _, _, _, _, _],
  [_, _, _, SY1, SY1, _, _, _, _, _, _, _, _, _, _, _],
  [_, _, SWD, SWD, _, _, _, _, _, _, _, _, _, _, _, _],
  [_, SWD, SWD, _, _, _, _, _, _, _, _, _, _, _, _, _],
];

// Shield Map
const SR = '#e76e55'; // Orange-Red

export const SHIELD_MAP: (string | null)[][] = [
  [_, _, _, BK, BK, BK, BK, _, _, _],
  [_, _, BK, SR, SR, SR, SR, BK, _, _],
  [_, BK, SR, SR, W, W, SR, SR, BK, _],
  [BK, SR, SR, W, SR, SR, W, SR, SR, BK],
  [BK, SR, SR, W, SR, SR, W, SR, SR, BK],
  [BK, SR, SR, SR, W, W, SR, SR, SR, BK],
  [BK, SR, SR, SR, SR, SR, SR, SR, SR, BK],
  [_, BK, SR, SR, SR, SR, SR, SR, BK, _],
  [_, _, BK, SR, SR, SR, SR, BK, _, _],
  [_, _, _, BK, BK, BK, BK, _, _, _],
];

// Projectile Maps
export const ARROW_MAP: (string | null)[][] = [
  [_, _, _, _, _, _, _, BK, BK, _, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, BK, W, BK, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, BK, W, BK, _, _, _, _, _, _],
  [_, _, _, _, _, _, _, BK, W, BK, _, _, _, _, _, _],
  [_, _, _, _, _, _, BK, BK, W, BK, BK, _, _, _, _, _],
  [_, _, _, _, _, BK, K_M2, K_M2, K_M1, K_M2, K_M2, BK, _, _, _, _],
  [_, _, _, _, BK, K_M3, K_M3, K_M3, K_M3, K_M3, K_M3, K_M3, BK, _, _, _],
  [_, _, _, _, BK, K_M2, K_M2, K_M1, K_M2, K_M2, BK, _, _, _, _, _],
  [_, _, _, _, _, BK, BK, W, BK, BK, _, _, _, _, _, _],
];

export const ORB_MAP: (string | null)[][] = [
  [_, _, _, BK, BK, BK, _, _],
  [_, BK, '#9261ff', '#9261ff', '#9261ff', BK, _],
  [BK, '#9261ff', W, W, '#9261ff', '#9261ff', BK],
  [BK, '#9261ff', W, '#9261ff', '#9261ff', '#9261ff', BK],
  [BK, '#9261ff', '#9261ff', '#9261ff', '#9261ff', BK, _],
  [_, BK, BK, BK, BK, _, _, _],
];
