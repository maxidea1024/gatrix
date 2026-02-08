// ============================================================
// Idle Defense Roguelike - Game Data (Shop, Mail, Items, Skills)
// ============================================================

import type { ShopItem, MailItem, InventoryItem, SkillDef } from './GameTypes';

let _itemIdCounter = 0;
function nextItemId(): string {
    return `item_${++_itemIdCounter}_${Date.now()}`;
}

// ---- Shop Items Pool ----
const WEAPON_POOL: Omit<ShopItem, 'id'>[] = [
    { name: 'Rusty Sword', icon: '🗡️', description: 'A basic sword.', price: 50, type: 'weapon', rarity: 'common', stat: { atk: 3 } },
    { name: 'Iron Blade', icon: '⚔️', description: 'Sturdy iron blade.', price: 150, type: 'weapon', rarity: 'uncommon', stat: { atk: 8 } },
    { name: 'Flame Edge', icon: '🔥', description: 'Burns on contact.', price: 500, type: 'weapon', rarity: 'rare', stat: { atk: 18 } },
    { name: 'Shadow Fang', icon: '🌑', description: 'Forged in darkness.', price: 1500, type: 'weapon', rarity: 'epic', stat: { atk: 35 } },
    { name: 'Excalibur', icon: '✨', description: 'Legendary holy sword.', price: 5000, type: 'weapon', rarity: 'legendary', stat: { atk: 60 } },
];

const ARMOR_POOL: Omit<ShopItem, 'id'>[] = [
    { name: 'Leather Vest', icon: '🧥', description: 'Basic protection.', price: 40, type: 'armor', rarity: 'common', stat: { def: 2 } },
    { name: 'Chain Mail', icon: '🛡️', description: 'Linked metal rings.', price: 120, type: 'armor', rarity: 'uncommon', stat: { def: 6, hp: 20 } },
    { name: 'Mithril Plate', icon: '💎', description: 'Light but strong.', price: 400, type: 'armor', rarity: 'rare', stat: { def: 14, hp: 50 } },
    { name: 'Dragon Scale', icon: '🐉', description: 'Dragon hide armor.', price: 1200, type: 'armor', rarity: 'epic', stat: { def: 28, hp: 100 } },
];

const CONSUMABLE_POOL: Omit<ShopItem, 'id'>[] = [
    { name: 'HP Potion', icon: '❤️', description: 'Restore 50 HP.', price: 20, type: 'potion', rarity: 'common', stat: { hp: 50 } },
    { name: 'Mega Potion', icon: '💖', description: 'Restore 200 HP.', price: 80, type: 'potion', rarity: 'uncommon', stat: { hp: 200 } },
    { name: 'ATK Scroll', icon: '📜', description: '+10 ATK for 30s.', price: 100, type: 'scroll', rarity: 'uncommon', stat: { atk: 10 } },
    { name: 'DEF Scroll', icon: '📋', description: '+10 DEF for 30s.', price: 100, type: 'scroll', rarity: 'uncommon', stat: { def: 10 } },
];

export function generateShopItems(wave: number): ShopItem[] {
    const items: ShopItem[] = [];
    const maxRarityIndex = Math.min(4, Math.floor(wave / 3));

    // Pick weapons available at current wave
    for (const w of WEAPON_POOL) {
        const ri = ['common', 'uncommon', 'rare', 'epic', 'legendary'].indexOf(w.rarity);
        if (ri <= maxRarityIndex) {
            items.push({ ...w, id: nextItemId(), price: Math.floor(w.price * (1 + wave * 0.1)) });
        }
    }
    // Pick armors
    for (const a of ARMOR_POOL) {
        const ri = ['common', 'uncommon', 'rare', 'epic', 'legendary'].indexOf(a.rarity);
        if (ri <= maxRarityIndex) {
            items.push({ ...a, id: nextItemId(), price: Math.floor(a.price * (1 + wave * 0.1)) });
        }
    }
    // Always show consumables
    for (const c of CONSUMABLE_POOL) {
        items.push({ ...c, id: nextItemId() });
    }
    return items;
}

export function shopItemToInventory(shop: ShopItem): InventoryItem {
    return {
        id: nextItemId(),
        name: shop.name,
        icon: shop.icon,
        type: shop.type,
        rarity: shop.rarity,
        quantity: 1,
        description: shop.description,
        stat: shop.stat,
        equipped: false,
        sellPrice: Math.floor(shop.price * 0.4),
    };
}

// ---- Drop Table ----
export function rollDrop(wave: number): InventoryItem | null {
    const chance = Math.random();
    if (chance > 0.3) return null; // 30% drop rate

    const rarityRoll = Math.random();
    let rarity: InventoryItem['rarity'] = 'common';
    if (rarityRoll < 0.02 + wave * 0.002) rarity = 'legendary';
    else if (rarityRoll < 0.08 + wave * 0.005) rarity = 'epic';
    else if (rarityRoll < 0.2 + wave * 0.01) rarity = 'rare';
    else if (rarityRoll < 0.5) rarity = 'uncommon';

    const materials: { name: string; icon: string }[] = [
        { name: 'Slime Gel', icon: '🟢' },
        { name: 'Monster Core', icon: '💠' },
        { name: 'Dark Shard', icon: '🔮' },
        { name: 'Beast Fang', icon: '🦷' },
        { name: 'Magic Stone', icon: '💎' },
    ];
    const mat = materials[Math.floor(Math.random() * materials.length)];
    return {
        id: nextItemId(),
        name: mat.name,
        icon: mat.icon,
        type: 'material',
        rarity,
        quantity: 1,
        description: `Dropped from wave ${wave} enemy.`,
        sellPrice: Math.floor(5 * (1 + wave * 0.5) * (['common', 'uncommon', 'rare', 'epic', 'legendary'].indexOf(rarity) + 1)),
    };
}

// ---- Initial Mails ----
export function getInitialMails(): MailItem[] {
    return [
        {
            id: 'mail_welcome',
            sender: '⚔️ Commander',
            subject: 'Welcome, Defender!',
            body: 'Hold the line against the slime horde! Use feature flags to adjust difficulty.',
            rewards: { gold: 100 },
            read: false,
            claimed: false,
            timestamp: Date.now(),
        },
        {
            id: 'mail_starter',
            sender: '🏪 Merchant',
            subject: 'Starter Pack',
            body: 'Here is a small gift to get you started.',
            rewards: {
                gold: 50,
                items: [{
                    id: nextItemId(), name: 'HP Potion', icon: '❤️', type: 'potion',
                    rarity: 'common', quantity: 3, description: 'Restore 50 HP.',
                    sellPrice: 8,
                }],
            },
            read: false,
            claimed: false,
            timestamp: Date.now() - 60000,
        },
    ];
}

export function generateWaveClearMail(wave: number): MailItem {
    const goldReward = wave * 20 + 50;
    return {
        id: `mail_wave_${wave}_${Date.now()}`,
        sender: '🏰 HQ',
        subject: `Wave ${wave} Clear Reward`,
        body: `Congratulations on surviving wave ${wave}! Here is your reward.`,
        rewards: { gold: goldReward },
        read: false,
        claimed: false,
        timestamp: Date.now(),
    };
}

// ---- Skills ----
export function getDefaultSkills(): SkillDef[] {
    return [
        { id: 'power_bash', name: 'Power Bash', icon: '🗡️', cooldown: 300, currentCd: 0, damage: 50, description: 'Heavy single-target hit.', type: 'single' },
        { id: 'flame_burst', name: 'Flame Burst', icon: '🔥', cooldown: 600, currentCd: 0, damage: 30, description: 'AOE fire damage.', type: 'aoe' },
        { id: 'fortify', name: 'Fortify', icon: '🛡️', cooldown: 900, currentCd: 0, damage: 0, description: 'Heal 30% HP.', type: 'buff' },
    ];
}
