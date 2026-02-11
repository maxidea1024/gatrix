// Slot Machine Type Definitions and Constants

export type SlotSymbol = 'cherry' | 'apple' | 'banana' | 'lemon' | 'wild';

export interface SymbolConfig {
    key: SlotSymbol;
    label: string;
    imageFile: string; // Image filename in /assets/slot/
    color: string;
    glowColor: string;
    payout3: number;
    payout2: number;
}

export interface SlotConfig {
    spinSpeed: number;
    winMultiplier: number;
    initialCredits: number;
    theme: 'classic' | 'neon' | 'vegas';
    bonusRoundEnabled: boolean;
    wildSymbolEnabled: boolean;
    autoSpinEnabled: boolean;
    soundEnabled: boolean;
    payoutTable: Record<string, number> | null;
}

export interface FlagChangeLog {
    id: number;
    timestamp: number;
    flagName: string;
    oldValue: string;
    newValue: string;
}

export const SYMBOL_CONFIGS: SymbolConfig[] = [
    { key: 'cherry', label: 'Cherry', imageFile: 'cherry.png', color: '#ff1744', glowColor: '#ff5252', payout3: 10, payout2: 3 },
    { key: 'apple', label: 'Apple', imageFile: 'apple.png', color: '#4caf50', glowColor: '#81c784', payout3: 15, payout2: 5 },
    { key: 'banana', label: 'Banana', imageFile: 'banana.png', color: '#ffd600', glowColor: '#ffff00', payout3: 25, payout2: 8 },
    { key: 'lemon', label: 'Lemon', imageFile: 'lemon.png', color: '#ffc107', glowColor: '#ffe082', payout3: 40, payout2: 12 },
    { key: 'wild', label: 'Wild', imageFile: 'coin.png', color: '#ffd700', glowColor: '#ffeb3b', payout3: 0, payout2: 0 },
];

// Symbols available for reels (without wild by default)
export const BASE_SYMBOLS = SYMBOL_CONFIGS.filter(s => s.key !== 'wild');

export const DEFAULT_SLOT_CONFIG: SlotConfig = {
    spinSpeed: 1,
    winMultiplier: 1,
    initialCredits: 1000,
    theme: 'classic',
    bonusRoundEnabled: false,
    wildSymbolEnabled: false,
    autoSpinEnabled: false,
    soundEnabled: true,
    payoutTable: null,
};

export const THEMES = {
    classic: {
        bg1: '#1a0000',
        bg2: '#4a0000',
        frameColor: 0xd4af37,
        frameBorder: 0x8b6914,
        accentColor: '#ff1744',
        textColor: '#ffd700',
        glowColor: '#ff6b35',
        particleColors: [0xff1744, 0xffd700, 0xff9100],
    },
    neon: {
        bg1: '#0a0020',
        bg2: '#1a0050',
        frameColor: 0x00e5ff,
        frameBorder: 0x0091ea,
        accentColor: '#ff00ff',
        textColor: '#00ffff',
        glowColor: '#e040fb',
        particleColors: [0x00e5ff, 0xff00ff, 0x76ff03],
    },
    vegas: {
        bg1: '#1a0a2e',
        bg2: '#3d1a6e',
        frameColor: 0xffd700,
        frameBorder: 0xb8860b,
        accentColor: '#9c27b0',
        textColor: '#ffd700',
        glowColor: '#ce93d8',
        particleColors: [0xffd700, 0x9c27b0, 0xe91e63],
    },
} as const;

export type ThemeKey = keyof typeof THEMES;

// Layout constants
export const SYM_DISPLAY = 96;
export const CELL = 110;

// Flag names (all prefixed with slot-)
export const FLAG_NAMES = {
    BONUS_ROUND: 'slot-bonus-round',
    WILD_SYMBOL: 'slot-wild-symbol',
    AUTO_SPIN: 'slot-auto-spin',
    SPIN_SPEED: 'slot-spin-speed',
    WIN_MULTIPLIER: 'slot-win-multiplier',
    INITIAL_CREDITS: 'slot-initial-credits',
    THEME: 'slot-theme',
    PAYOUT_TABLE: 'slot-payout-table',
    SOUND: 'slot-sound',
} as const;

export const ASSET_PATH = '/assets/slot';
