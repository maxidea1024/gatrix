// Slot Machine Type Definitions and Constants

export type SlotSymbol = 'cherry' | 'lemon' | 'orange' | 'bell' | 'star' | 'seven' | 'diamond' | 'wild';

export interface SymbolConfig {
    key: SlotSymbol;
    label: string;
    emoji: string;
    color: string;
    glowColor: string;
    payout3: number; // 3 matching = this multiplier
    payout2: number; // 2 matching = this multiplier
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
    { key: 'cherry', label: 'Cherry', emoji: '🍒', color: '#ff1744', glowColor: '#ff5252', payout3: 10, payout2: 3 },
    { key: 'lemon', label: 'Lemon', emoji: '🍋', color: '#ffd600', glowColor: '#ffff00', payout3: 15, payout2: 5 },
    { key: 'orange', label: 'Orange', emoji: '🍊', color: '#ff9100', glowColor: '#ffab40', payout3: 20, payout2: 5 },
    { key: 'bell', label: 'Bell', emoji: '🔔', color: '#ffab00', glowColor: '#ffd740', payout3: 30, payout2: 8 },
    { key: 'star', label: 'Star', emoji: '⭐', color: '#ffc107', glowColor: '#ffe082', payout3: 50, payout2: 10 },
    { key: 'seven', label: 'Seven', emoji: '7️⃣', color: '#d50000', glowColor: '#ff5252', payout3: 100, payout2: 20 },
    { key: 'diamond', label: 'Diamond', emoji: '💎', color: '#2979ff', glowColor: '#82b1ff', payout3: 200, payout2: 40 },
    { key: 'wild', label: 'Wild', emoji: '🃏', color: '#aa00ff', glowColor: '#ea80fc', payout3: 0, payout2: 0 },
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

// Reel layout constants
export const REEL_COLS = 3;
export const REEL_ROWS = 3;
export const SYMBOL_SIZE = 100;
export const SYMBOL_GAP = 8;
export const REEL_CELL = SYMBOL_SIZE + SYMBOL_GAP;

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
