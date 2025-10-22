#!/usr/bin/env node
// -------------------------------------------------------------------------------------------------
// COPYRIGHT (C)2017 BY MOTIF CO., LTD. ALL RIGHTS RESERVED.
// -------------------------------------------------------------------------------------------------

/**
 * Standalone Reward Lookup Builder
 * 
 * This tool generates a lookup table for reward items by reading CMS JSON5 files directly.
 * It does NOT depend on any game code - it's completely standalone.
 * 
 * Usage:
 *   node rewardLookupBuilder.js [options]
 * 
 * Options:
 *   --output-json <file>   Output JSON file path (default: reward-lookup.json)
 *   --output-html <file>   Output HTML file path (default: reward-lookup.html)
 *   --cms-dir <dir>        CMS directory path (default: ../cms/server)
 */

const fs = require('fs');
const path = require('path');
const JSON5 = require('json5');

// REWARD_TYPE enum definition (copied from game code to be independent)
const REWARD_TYPE = {
  POINT: 1,
  ITEM: 2,
  DEPART_SUPPLY: 3,
  TRADE_GOODS: 4,
  MATE_EQUIP: 5,
  SHIP: 6,
  MATE: 7,
  SHIP_BLUEPRINT: 8,
  SHIP_SLOT_ITEM: 9,
  QUEST_ITEM: 10,
  BATTLE_EXP: 11,
  TRADE_EXP: 12,
  ADVENTURE_EXP: 13,
  BATTLE_FAME: 14,
  TRADE_FAME: 15,
  ADVENTURE_FAME: 16,
  SAILOR: 17,
  MATE_INTIMACY_OR_LOYALTY: 18,
  ENERGY: 19,
  TAX_FREE_PERMIT: 22,
  SHIELD_NON_PURCHASE_COUNT: 25,
  SHIELD_PURCHASE_COUNT: 26,
  ARENA_TICKET: 27,
  WESTERN_SHIP_BUILD_EXP: 28,
  ORIENTAL_SHIP_BUILD_EXP: 29,
  CHOICE_BOX: 31,
  SHIP_CAMOUFLAGE: 32,
  USER_TITLE: 33,
  FREE_SWEEP_TICKET: 34,
  BUY_SWEEP_TICKET: 35,
  PET: 36,
  SMUGGLE_GOODS: 37,
  REWERD_SEASON_ITEMS: 38,
  CAPTURED_SHIP: 100,
  SOUND_PACK: 101,
};

// Reverse mapping for display
const REWARD_TYPE_NAMES = {};
for (const [key, value] of Object.entries(REWARD_TYPE)) {
  REWARD_TYPE_NAMES[value] = key;
}

// Mapping from REWARD_TYPE to CMS table file
const REWARD_TYPE_TO_TABLE = {
  [REWARD_TYPE.POINT]: 'Point',
  [REWARD_TYPE.ITEM]: 'Item',
  [REWARD_TYPE.QUEST_ITEM]: 'Item',
  [REWARD_TYPE.DEPART_SUPPLY]: 'DepartSupply',
  [REWARD_TYPE.TRADE_GOODS]: 'TradeGoods',
  [REWARD_TYPE.MATE_EQUIP]: 'CEquip',
  [REWARD_TYPE.SHIP]: 'Ship',
  [REWARD_TYPE.MATE]: 'Mate',
  [REWARD_TYPE.SHIP_BLUEPRINT]: 'ShipBlueprint',
  [REWARD_TYPE.SHIP_SLOT_ITEM]: 'ShipSlot',
  [REWARD_TYPE.TAX_FREE_PERMIT]: 'TaxFreePermit',
  [REWARD_TYPE.SHIELD_NON_PURCHASE_COUNT]: 'Shield',
  [REWARD_TYPE.SHIELD_PURCHASE_COUNT]: 'Shield',
  [REWARD_TYPE.USER_TITLE]: 'UserTitle',
  [REWARD_TYPE.PET]: 'Pet',
  [REWARD_TYPE.SMUGGLE_GOODS]: 'SmuggleGoods',
  [REWARD_TYPE.REWERD_SEASON_ITEMS]: 'RewardSeasonItems',
  [REWARD_TYPE.SHIP_CAMOUFLAGE]: 'ShipCamouflage',
};

// Descriptions for reward types without tables
// Based on rewardAndPaymentChangeSpec.ts processing logic
const REWARD_TYPE_DESCRIPTIONS = {
  [REWARD_TYPE.BATTLE_EXP]: '전투 경험치 (amount만큼 전투 경험치 증가)',
  [REWARD_TYPE.TRADE_EXP]: '교역 경험치 (amount만큼 교역 경험치 증가)',
  [REWARD_TYPE.ADVENTURE_EXP]: '모험 경험치 (amount만큼 모험 경험치 증가)',
  [REWARD_TYPE.BATTLE_FAME]: '전투 명성 (amount만큼 전투 명성 증가)',
  [REWARD_TYPE.TRADE_FAME]: '교역 명성 (amount만큼 교역 명성 증가)',
  [REWARD_TYPE.ADVENTURE_FAME]: '모험 명성 (amount만큼 모험 명성 증가)',
  [REWARD_TYPE.SAILOR]: '선원 수 (amount만큼 선원 증가)',
  [REWARD_TYPE.MATE_INTIMACY_OR_LOYALTY]: '항해사 친밀도/충성도 (Id: 항해사 ID, amount: 증가량)',
  [REWARD_TYPE.ENERGY]: '행동력 (amount만큼 행동력 증가)',
  [REWARD_TYPE.ARENA_TICKET]: '모의전 입장권 (amount만큼 입장권 증가)',
  [REWARD_TYPE.WESTERN_SHIP_BUILD_EXP]: '서양 조선 경험치 (amount만큼 경험치 증가)',
  [REWARD_TYPE.ORIENTAL_SHIP_BUILD_EXP]: '동양 조선 경험치 (amount만큼 경험치 증가)',
  [REWARD_TYPE.CHOICE_BOX]: '초이스 박스 (특수 처리 필요)',
  [REWARD_TYPE.FREE_SWEEP_TICKET]: '무료 소탕권 (amount만큼 소탕권 증가)',
  [REWARD_TYPE.BUY_SWEEP_TICKET]: '유료 소탕권 (amount만큼 소탕권 증가)',
  [REWARD_TYPE.CAPTURED_SHIP]: '나포 선박 (Id: 선박 ID, 특수 처리)',
  [REWARD_TYPE.SOUND_PACK]: '사운드 팩',
};

// Field names for each reward type (what the "id" field represents)
const REWARD_TYPE_ID_FIELD_NAMES = {
  [REWARD_TYPE.POINT]: 'Point ID',
  [REWARD_TYPE.ITEM]: 'Item ID',
  [REWARD_TYPE.QUEST_ITEM]: 'Item ID',
  [REWARD_TYPE.DEPART_SUPPLY]: 'DepartSupply ID',
  [REWARD_TYPE.TRADE_GOODS]: 'TradeGoods ID',
  [REWARD_TYPE.MATE_EQUIP]: 'CEquip ID',
  [REWARD_TYPE.SHIP]: 'Ship ID',
  [REWARD_TYPE.MATE]: 'Mate ID',
  [REWARD_TYPE.SHIP_BLUEPRINT]: 'ShipBlueprint ID',
  [REWARD_TYPE.SHIP_SLOT_ITEM]: 'ShipSlot ID',
  [REWARD_TYPE.TAX_FREE_PERMIT]: 'TaxFreePermit ID',
  [REWARD_TYPE.SHIELD_NON_PURCHASE_COUNT]: 'Shield ID',
  [REWARD_TYPE.SHIELD_PURCHASE_COUNT]: 'Shield ID',
  [REWARD_TYPE.USER_TITLE]: 'UserTitle ID',
  [REWARD_TYPE.PET]: 'Pet ID',
  [REWARD_TYPE.SMUGGLE_GOODS]: 'SmuggleGoods ID',
  [REWARD_TYPE.REWERD_SEASON_ITEMS]: 'RewardSeasonItems ID',
  [REWARD_TYPE.SHIP_CAMOUFLAGE]: 'ShipCamouflage ID',
  [REWARD_TYPE.MATE_INTIMACY_OR_LOYALTY]: 'Mate ID',
  [REWARD_TYPE.CAPTURED_SHIP]: 'Ship ID',
};

/**
 * Load a JSON5 file
 */
function loadJson5File(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON5.parse(content);
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Extract items from a CMS table
 */
function extractItemsFromTable(tableData, tableName) {
  const items = [];
  
  if (!tableData || !tableData[tableName]) {
    return items;
  }
  
  const table = tableData[tableName];
  
  for (const [key, item] of Object.entries(table)) {
    if (!item || !item.id || key.startsWith(':')) {
      continue;
    }
    
    const name = item.name || `${tableName} ${item.id}`;
    
    items.push({
      id: item.id,
      name: name,
    });
  }
  
  // Sort by id
  items.sort((a, b) => a.id - b.id);
  
  return items;
}

/**
 * Build the complete reward lookup table
 */
function buildRewardLookupTable(cmsDir) {
  const lookupTable = {};

  console.log('Building reward lookup table...');
  console.log(`CMS directory: ${cmsDir}\n`);

  // Process each REWARD_TYPE
  for (const [rewardType, rewardTypeName] of Object.entries(REWARD_TYPE_NAMES)) {
    const rewardTypeNum = parseInt(rewardType);
    const tableName = REWARD_TYPE_TO_TABLE[rewardTypeNum];

    const info = {
      rewardType: rewardTypeNum,
      rewardTypeName: rewardTypeName,
      tableFile: tableName ? `${tableName}.json` : null,
      hasTable: !!tableName,
      description: REWARD_TYPE_DESCRIPTIONS[rewardTypeNum] || null,
      idFieldName: REWARD_TYPE_ID_FIELD_NAMES[rewardTypeNum] || 'ID',
      requiresAmount: true, // All reward types require amount/quantity
      items: [],
      itemCount: 0,
    };

    if (tableName) {
      const filePath = path.join(cmsDir, `${tableName}.json`);

      // Try .json first, then .json5
      let actualFilePath = filePath;
      if (!fs.existsSync(filePath)) {
        actualFilePath = path.join(cmsDir, `${tableName}.json5`);
      }

      if (fs.existsSync(actualFilePath)) {
        console.log(`Loading ${path.basename(actualFilePath)}...`);
        const tableData = loadJson5File(actualFilePath);

        if (tableData) {
          info.items = extractItemsFromTable(tableData, tableName);
          info.itemCount = info.items.length;
          console.log(`  Found ${info.itemCount} items`);
        }
      } else {
        console.warn(`  Warning: ${tableName}.json or ${tableName}.json5 not found`);
      }
    }

    lookupTable[rewardTypeNum] = info;
  }

  console.log('\nLookup table built successfully!');
  return lookupTable;
}

/**
 * Generate REWARD_TYPE list for admin tool
 */
function generateRewardTypeList(lookupTable) {
  const rewardTypes = [];

  for (const [rewardType, info] of Object.entries(lookupTable)) {
    rewardTypes.push({
      value: parseInt(rewardType),
      name: info.rewardTypeName,
      nameKey: `REWARD_TYPE_${info.rewardTypeName}`, // Localization key
      hasTable: info.hasTable,
      tableFile: info.tableFile,
      itemCount: info.itemCount,
      descriptionKey: info.hasTable ? null : `REWARD_TYPE_DESC_${info.rewardTypeName}`, // Localization key for description
    });
  }

  // Sort by value
  rewardTypes.sort((a, b) => a.value - b.value);

  return rewardTypes;
}

/**
 * Localization translations for REWARD_TYPE names
 */
const REWARD_TYPE_TRANSLATIONS = {
  kr: {
    POINT: '포인트',
    ITEM: '아이템',
    DEPART_SUPPLY: '출항 보급품',
    TRADE_GOODS: '교역품',
    MATE_EQUIP: '항해사 장비',
    SHIP: '선박',
    MATE: '항해사',
    SHIP_BLUEPRINT: '선박 설계도',
    SHIP_SLOT_ITEM: '선박 슬롯 아이템',
    QUEST_ITEM: '퀘스트 아이템',
    BATTLE_EXP: '전투 경험치',
    TRADE_EXP: '교역 경험치',
    ADVENTURE_EXP: '모험 경험치',
    BATTLE_FAME: '전투 명성',
    TRADE_FAME: '교역 명성',
    ADVENTURE_FAME: '모험 명성',
    SAILOR: '선원',
    MATE_INTIMACY_OR_LOYALTY: '항해사 친밀도/충성도',
    ENERGY: '행동력',
    TAX_FREE_PERMIT: '면세 허가증',
    SHIELD_NON_PURCHASE_COUNT: '보호막 (비구매)',
    SHIELD_PURCHASE_COUNT: '보호막 (구매)',
    ARENA_TICKET: '모의전 입장권',
    WESTERN_SHIP_BUILD_EXP: '서양 조선 경험치',
    ORIENTAL_SHIP_BUILD_EXP: '동양 조선 경험치',
    CHOICE_BOX: '초이스 박스',
    SHIP_CAMOUFLAGE: '선박 위장',
    USER_TITLE: '칭호',
    FREE_SWEEP_TICKET: '무료 소탕권',
    BUY_SWEEP_TICKET: '유료 소탕권',
    PET: '펫',
    SMUGGLE_GOODS: '밀수품',
    REWERD_SEASON_ITEMS: '시즌 보상 아이템',
    CAPTURED_SHIP: '나포 선박',
    SOUND_PACK: '사운드 팩',
  },
  us: {
    POINT: 'Point',
    ITEM: 'Item',
    DEPART_SUPPLY: 'Departure Supply',
    TRADE_GOODS: 'Trade Goods',
    MATE_EQUIP: 'Mate Equipment',
    SHIP: 'Ship',
    MATE: 'Mate',
    SHIP_BLUEPRINT: 'Ship Blueprint',
    SHIP_SLOT_ITEM: 'Ship Slot Item',
    QUEST_ITEM: 'Quest Item',
    BATTLE_EXP: 'Battle EXP',
    TRADE_EXP: 'Trade EXP',
    ADVENTURE_EXP: 'Adventure EXP',
    BATTLE_FAME: 'Battle Fame',
    TRADE_FAME: 'Trade Fame',
    ADVENTURE_FAME: 'Adventure Fame',
    SAILOR: 'Sailor',
    MATE_INTIMACY_OR_LOYALTY: 'Mate Intimacy/Loyalty',
    ENERGY: 'Energy',
    TAX_FREE_PERMIT: 'Tax Free Permit',
    SHIELD_NON_PURCHASE_COUNT: 'Shield (Non-Purchase)',
    SHIELD_PURCHASE_COUNT: 'Shield (Purchase)',
    ARENA_TICKET: 'Arena Ticket',
    WESTERN_SHIP_BUILD_EXP: 'Western Shipbuilding EXP',
    ORIENTAL_SHIP_BUILD_EXP: 'Oriental Shipbuilding EXP',
    CHOICE_BOX: 'Choice Box',
    SHIP_CAMOUFLAGE: 'Ship Camouflage',
    USER_TITLE: 'Title',
    FREE_SWEEP_TICKET: 'Free Sweep Ticket',
    BUY_SWEEP_TICKET: 'Paid Sweep Ticket',
    PET: 'Pet',
    SMUGGLE_GOODS: 'Smuggle Goods',
    REWERD_SEASON_ITEMS: 'Season Reward Items',
    CAPTURED_SHIP: 'Captured Ship',
    SOUND_PACK: 'Sound Pack',
  },
  cn: {
    POINT: '点数',
    ITEM: '道具',
    DEPART_SUPPLY: '出航补给品',
    TRADE_GOODS: '贸易品',
    MATE_EQUIP: '航海士装备',
    SHIP: '船舶',
    MATE: '航海士',
    SHIP_BLUEPRINT: '船舶设计图',
    SHIP_SLOT_ITEM: '船舶槽道具',
    QUEST_ITEM: '任务道具',
    BATTLE_EXP: '战斗经验值',
    TRADE_EXP: '贸易经验值',
    ADVENTURE_EXP: '冒险经验值',
    BATTLE_FAME: '战斗声望',
    TRADE_FAME: '贸易声望',
    ADVENTURE_FAME: '冒险声望',
    SAILOR: '船员',
    MATE_INTIMACY_OR_LOYALTY: '航海士亲密度/忠诚度',
    ENERGY: '行动力',
    TAX_FREE_PERMIT: '免税许可证',
    SHIELD_NON_PURCHASE_COUNT: '保护罩(非购买)',
    SHIELD_PURCHASE_COUNT: '保护罩(购买)',
    ARENA_TICKET: '模拟战入场券',
    WESTERN_SHIP_BUILD_EXP: '西洋造船经验值',
    ORIENTAL_SHIP_BUILD_EXP: '东洋造船经验值',
    CHOICE_BOX: '选择箱',
    SHIP_CAMOUFLAGE: '船舶伪装',
    USER_TITLE: '称号',
    FREE_SWEEP_TICKET: '免费扫荡券',
    BUY_SWEEP_TICKET: '付费扫荡券',
    PET: '宠物',
    SMUGGLE_GOODS: '走私品',
    REWERD_SEASON_ITEMS: '赛季奖励道具',
    CAPTURED_SHIP: '俘获船舶',
    SOUND_PACK: '音效包',
  },
};

/**
 * Localization translations for descriptions
 */
const DESCRIPTION_TRANSLATIONS = {
  kr: {
    BATTLE_EXP: '전투 경험치 (수치만큼 전투 경험치 증가)',
    TRADE_EXP: '교역 경험치 (수치만큼 교역 경험치 증가)',
    ADVENTURE_EXP: '모험 경험치 (수치만큼 모험 경험치 증가)',
    BATTLE_FAME: '전투 명성 (수치만큼 전투 명성 증가)',
    TRADE_FAME: '교역 명성 (수치만큼 교역 명성 증가)',
    ADVENTURE_FAME: '모험 명성 (수치만큼 모험 명성 증가)',
    SAILOR: '선원 수 (수치만큼 선원 증가)',
    MATE_INTIMACY_OR_LOYALTY: '항해사 친밀도/충성도 (ID: 항해사 ID, 수치: 증가량)',
    ENERGY: '행동력 (수치만큼 행동력 증가)',
    ARENA_TICKET: '모의전 입장권 (수치만큼 입장권 증가)',
    WESTERN_SHIP_BUILD_EXP: '서양 조선 경험치 (수치만큼 경험치 증가)',
    ORIENTAL_SHIP_BUILD_EXP: '동양 조선 경험치 (수치만큼 경험치 증가)',
    CHOICE_BOX: '초이스 박스 (특수 처리 필요)',
    FREE_SWEEP_TICKET: '무료 소탕권 (수치만큼 소탕권 증가)',
    BUY_SWEEP_TICKET: '유료 소탕권 (수치만큼 소탕권 증가)',
    CAPTURED_SHIP: '나포 선박 (ID: 선박 ID, 특수 처리)',
    SOUND_PACK: '사운드 팩',
  },
  us: {
    BATTLE_EXP: 'Battle experience points (increases by amount)',
    TRADE_EXP: 'Trade experience points (increases by amount)',
    ADVENTURE_EXP: 'Adventure experience points (increases by amount)',
    BATTLE_FAME: 'Battle fame (increases by amount)',
    TRADE_FAME: 'Trade fame (increases by amount)',
    ADVENTURE_FAME: 'Adventure fame (increases by amount)',
    SAILOR: 'Sailor count (increases by amount)',
    MATE_INTIMACY_OR_LOYALTY: 'Mate intimacy/loyalty (ID: Mate ID, amount: increase value)',
    ENERGY: 'Energy (increases by amount)',
    ARENA_TICKET: 'Arena ticket (increases by amount)',
    WESTERN_SHIP_BUILD_EXP: 'Western shipbuilding experience (increases by amount)',
    ORIENTAL_SHIP_BUILD_EXP: 'Oriental shipbuilding experience (increases by amount)',
    CHOICE_BOX: 'Choice box (requires special handling)',
    FREE_SWEEP_TICKET: 'Free sweep ticket (increases by amount)',
    BUY_SWEEP_TICKET: 'Paid sweep ticket (increases by amount)',
    CAPTURED_SHIP: 'Captured ship (ID: Ship ID, special handling)',
    SOUND_PACK: 'Sound pack',
  },
  cn: {
    BATTLE_EXP: '战斗经验值 (增加指定数值的战斗经验值)',
    TRADE_EXP: '贸易经验值 (增加指定数值的贸易经验值)',
    ADVENTURE_EXP: '冒险经验值 (增加指定数值的冒险经验值)',
    BATTLE_FAME: '战斗声望 (增加指定数值的战斗声望)',
    TRADE_FAME: '贸易声望 (增加指定数值的贸易声望)',
    ADVENTURE_FAME: '冒险声望 (增加指定数值的冒险声望)',
    SAILOR: '船员数 (增加指定数值的船员)',
    MATE_INTIMACY_OR_LOYALTY: '航海士亲密度/忠诚度 (ID: 航海士ID, 数值: 增加量)',
    ENERGY: '行动力 (增加指定数值的行动力)',
    ARENA_TICKET: '模拟战入场券 (增加指定数值的入场券)',
    WESTERN_SHIP_BUILD_EXP: '西洋造船经验值 (增加指定数值的经验值)',
    ORIENTAL_SHIP_BUILD_EXP: '东洋造船经验值 (增加指定数值的经验值)',
    CHOICE_BOX: '选择箱 (需要特殊处理)',
    FREE_SWEEP_TICKET: '免费扫荡券 (增加指定数值的扫荡券)',
    BUY_SWEEP_TICKET: '付费扫荡券 (增加指定数值的扫荡券)',
    CAPTURED_SHIP: '俘获船舶 (ID: 船舶ID, 特殊处理)',
    SOUND_PACK: '音效包',
  },
};

/**
 * Generate localization files for kr, us, cn
 */
function generateLocalizations(lookupTable) {
  const localizations = {
    kr: {},
    us: {},
    cn: {},
  };

  // Add REWARD_TYPE name translations
  for (const [rewardType, info] of Object.entries(lookupTable)) {
    const typeKey = `REWARD_TYPE_${info.rewardTypeName}`;

    localizations.kr[typeKey] = REWARD_TYPE_TRANSLATIONS.kr[info.rewardTypeName] || info.rewardTypeName;
    localizations.us[typeKey] = REWARD_TYPE_TRANSLATIONS.us[info.rewardTypeName] || info.rewardTypeName;
    localizations.cn[typeKey] = REWARD_TYPE_TRANSLATIONS.cn[info.rewardTypeName] || info.rewardTypeName;

    // Add description translations for non-table types
    if (!info.hasTable) {
      const descKey = `REWARD_TYPE_DESC_${info.rewardTypeName}`;

      localizations.kr[descKey] = DESCRIPTION_TRANSLATIONS.kr[info.rewardTypeName] || '';
      localizations.us[descKey] = DESCRIPTION_TRANSLATIONS.us[info.rewardTypeName] || '';
      localizations.cn[descKey] = DESCRIPTION_TRANSLATIONS.cn[info.rewardTypeName] || '';
    }
  }

  return localizations;
}

// HTML generation removed - not needed for admin tool

// Main execution
function main() {
  const args = process.argv.slice(2);
  
  // Parse arguments
  let outputJson = path.join(__dirname, 'reward-lookup.json');
  let cmsDir = path.join(__dirname, '..', '..', '..', 'cms', 'server');
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output-json' && i + 1 < args.length) {
      outputJson = args[++i];
    } else if (args[i] === '--output-html' && i + 1 < args.length) {
      outputHtml = args[++i];
    } else if (args[i] === '--cms-dir' && i + 1 < args.length) {
      cmsDir = args[++i];
    }
  }
  
  // Build lookup table
  const lookupTable = buildRewardLookupTable(cmsDir);

  // Save full JSON
  console.log(`\nSaving full lookup table to: ${outputJson}`);
  fs.writeFileSync(outputJson, JSON.stringify(lookupTable, null, 2), 'utf8');
  console.log('Full lookup table saved successfully!');

  // Generate and save REWARD_TYPE list (for admin tool dropdown)
  const rewardTypeList = generateRewardTypeList(lookupTable);
  const rewardTypeListFile = path.join(path.dirname(outputJson), 'reward-type-list.json');
  console.log(`\nSaving REWARD_TYPE list to: ${rewardTypeListFile}`);
  fs.writeFileSync(rewardTypeListFile, JSON.stringify(rewardTypeList, null, 2), 'utf8');
  console.log('REWARD_TYPE list saved successfully!');

  // Generate and save localization files (kr, us, cn)
  const localizations = generateLocalizations(lookupTable);

  const locKrFile = path.join(path.dirname(outputJson), 'reward-localization-kr.json');
  console.log(`\nSaving Korean localization to: ${locKrFile}`);
  fs.writeFileSync(locKrFile, JSON.stringify(localizations.kr, null, 2), 'utf8');
  console.log('Korean localization saved successfully!');

  const locUsFile = path.join(path.dirname(outputJson), 'reward-localization-us.json');
  console.log(`\nSaving English localization to: ${locUsFile}`);
  fs.writeFileSync(locUsFile, JSON.stringify(localizations.us, null, 2), 'utf8');
  console.log('English localization saved successfully!');

  const locCnFile = path.join(path.dirname(outputJson), 'reward-localization-cn.json');
  console.log(`\nSaving Chinese localization to: ${locCnFile}`);
  fs.writeFileSync(locCnFile, JSON.stringify(localizations.cn, null, 2), 'utf8');
  console.log('Chinese localization saved successfully!');

  console.log('\n✅ All done!');
  console.log(`\nGenerated files:`);
  console.log(`  - ${outputJson} (full lookup table)`);
  console.log(`  - ${rewardTypeListFile} (REWARD_TYPE list for dropdown)`);
  console.log(`  - ${locKrFile} (Korean localization)`);
  console.log(`  - ${locUsFile} (English localization)`);
  console.log(`  - ${locCnFile} (Chinese localization)`);
  console.log(`\nYou can now use these JSON files in your admin tool`);
}

if (require.main === module) {
  main();
}

module.exports = {
  REWARD_TYPE,
  REWARD_TYPE_NAMES,
  buildRewardLookupTable,
};

