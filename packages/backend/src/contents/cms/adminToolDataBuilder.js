#!/usr/bin/env node

/**
 * Admin Tool Data Builder
 * 
 * Unified builder for generating all admin tool data files:
 * 1. Reward lookup tables (REWARD_TYPE items)
 * 2. UI list data (Nation, Town, Village)
 * 3. Localization table (loctab-source CSV to JSON)
 * 
 * Usage:
 *   node adminToolDataBuilder.js [options]
 * 
 * Options:
 *   --all              Build all data (default)
 *   --rewards          Build reward lookup tables only
 *   --ui-lists         Build UI list data only
 *   --localization     Build localization table only
 *   --cms-dir <path>   CMS directory path (default: ../../../cms/server)
 *   --output-dir <path> Output directory path (default: current directory)
 *   --help             Show this help message
 * 
 * Examples:
 *   node adminToolDataBuilder.js
 *   node adminToolDataBuilder.js --rewards
 *   node adminToolDataBuilder.js --cms-dir /path/to/cms/server
 */

const fs = require('fs');
const path = require('path');
const JSON5 = require('json5');

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_CMS_DIR = path.join(__dirname, '../../../cms/server');
const DEFAULT_OUTPUT_DIR = __dirname;
const DEFAULT_LOCTAB_SOURCE = path.join(__dirname, 'loctab-source');

// ============================================================================
// REWARD_TYPE Definitions (from game server rewardDesc.ts)
// ============================================================================

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
  REWARD_SEASON_ITEMS: 38,
  CAPTURED_SHIP: 100,
  SOUND_PACK: 101,
};

const REWARD_TYPE_NAMES = {
  1: 'POINT',
  2: 'ITEM',
  3: 'DEPART_SUPPLY',
  4: 'TRADE_GOODS',
  5: 'MATE_EQUIP',
  6: 'SHIP',
  7: 'MATE',
  8: 'SHIP_BLUEPRINT',
  9: 'SHIP_SLOT_ITEM',
  10: 'QUEST_ITEM',
  11: 'BATTLE_EXP',
  12: 'TRADE_EXP',
  13: 'ADVENTURE_EXP',
  14: 'BATTLE_FAME',
  15: 'TRADE_FAME',
  16: 'ADVENTURE_FAME',
  17: 'SAILOR',
  18: 'MATE_INTIMACY_OR_LOYALTY',
  19: 'ENERGY',
  22: 'TAX_FREE_PERMIT',
  25: 'SHIELD_NON_PURCHASE_COUNT',
  26: 'SHIELD_PURCHASE_COUNT',
  27: 'ARENA_TICKET',
  28: 'WESTERN_SHIP_BUILD_EXP',
  29: 'ORIENTAL_SHIP_BUILD_EXP',
  31: 'CHOICE_BOX',
  32: 'SHIP_CAMOUFLAGE',
  33: 'USER_TITLE',
  34: 'FREE_SWEEP_TICKET',
  35: 'BUY_SWEEP_TICKET',
  36: 'PET',
  37: 'SMUGGLE_GOODS',
  38: 'REWARD_SEASON_ITEMS',
  100: 'CAPTURED_SHIP',
  101: 'SOUND_PACK',
};

const REWARD_TYPE_TO_TABLE = {
  1: 'Point',
  2: 'Item',
  3: 'DepartSupply',
  4: 'TradeGoods',
  5: 'CEquip', // MATE_EQUIP
  6: 'Ship',
  7: 'Mate',
  8: 'ShipBlueprint',
  9: 'ShipSlot', // SHIP_SLOT_ITEM
  10: 'Item', // QUEST_ITEM uses Item table with type filter
  22: 'TaxFreePermit',
  25: 'Shield', // SHIELD_NON_PURCHASE_COUNT
  26: 'Shield', // SHIELD_PURCHASE_COUNT
  32: 'ShipCamouflage',
  33: 'UserTitle',
  36: 'Pet',
  37: 'SmuggleGoods',
  38: 'RewardSeasonItems',
};

const REWARD_TYPE_DESCRIPTIONS = {
  11: 'REWARD_TYPE_DESC_BATTLE_EXP',
  12: 'REWARD_TYPE_DESC_TRADE_EXP',
  13: 'REWARD_TYPE_DESC_ADVENTURE_EXP',
  14: 'REWARD_TYPE_DESC_BATTLE_FAME',
  15: 'REWARD_TYPE_DESC_TRADE_FAME',
  16: 'REWARD_TYPE_DESC_ADVENTURE_FAME',
  17: 'REWARD_TYPE_DESC_SAILOR',
  18: 'REWARD_TYPE_DESC_MATE_INTIMACY_OR_LOYALTY',
  19: 'REWARD_TYPE_DESC_ENERGY',
  27: 'REWARD_TYPE_DESC_ARENA_TICKET',
  28: 'REWARD_TYPE_DESC_WESTERN_SHIP_BUILD_EXP',
  29: 'REWARD_TYPE_DESC_ORIENTAL_SHIP_BUILD_EXP',
  31: 'REWARD_TYPE_DESC_CHOICE_BOX',
  34: 'REWARD_TYPE_DESC_FREE_SWEEP_TICKET',
  35: 'REWARD_TYPE_DESC_BUY_SWEEP_TICKET',
};

const REWARD_TYPE_ID_FIELD_NAMES = {
  1: 'pointId',
  2: 'itemId',
  3: 'departSupplyId',
  4: 'tradeGoodsId',
  5: 'mateEquipId',
  6: 'shipId',
  7: 'mateId',
  8: 'shipBlueprintId',
  9: 'shipSlotItemId',
  10: 'questItemId',
  22: 'taxFreePermitId',
  25: 'shieldId',
  26: 'shieldId',
  32: 'shipCamouflageId',
  33: 'userTitleId',
  36: 'petId',
  37: 'smuggleGoodsId',
  38: 'rewardSeasonItemsId',
};

// Localization translations - MUST match actual REWARD_TYPE enum from game server
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
    REWARD_SEASON_ITEMS: '시즌 보상 아이템',
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
    REWARD_SEASON_ITEMS: 'Season Reward Items',
    CAPTURED_SHIP: 'Captured Ship',
    SOUND_PACK: 'Sound Pack',
  },
  cn: {
    POINT: '点数',
    ITEM: '道具',
    DEPART_SUPPLY: '出航补给品',
    TRADE_GOODS: '贸易商品',
    MATE_EQUIP: '航海士装备',
    SHIP: '船只',
    MATE: '航海士',
    SHIP_BLUEPRINT: '船只设计图',
    SHIP_SLOT_ITEM: '船只槽位道具',
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
    SHIELD_NON_PURCHASE_COUNT: '护盾 (非购买)',
    SHIELD_PURCHASE_COUNT: '护盾 (购买)',
    ARENA_TICKET: '竞技场门票',
    WESTERN_SHIP_BUILD_EXP: '西洋造船经验值',
    ORIENTAL_SHIP_BUILD_EXP: '东洋造船经验值',
    CHOICE_BOX: '选择箱',
    SHIP_CAMOUFLAGE: '船只伪装',
    USER_TITLE: '称号',
    FREE_SWEEP_TICKET: '免费扫荡券',
    BUY_SWEEP_TICKET: '付费扫荡券',
    PET: '宠物',
    SMUGGLE_GOODS: '走私品',
    REWARD_SEASON_ITEMS: '赛季奖励道具',
    CAPTURED_SHIP: '捕获船只',
    SOUND_PACK: '音效包',
  },
};

// Description format types (from displayNameUtil.ts)
const DESC_FORMAT_TYPE = {
  COUNT: 1,
  CMS_NAME: 2,
  ENUM_NAME: 3,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Load JSON5 file
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
 * String format function (from mutil.ts)
 */
function stringFormat(formatted, args) {
  if (!formatted || !args) {
    return formatted;
  }
  for (let i = 0; i < args.length; i++) {
    formatted = formatted.replace('{' + i + '}', args[i]);
  }
  return formatted;
}

/**
 * Make character display name from Character CMS
 */
function makeCharacterDisplayName(characterCms) {
  if (!characterCms) {
    return '[Invalid-Character]';
  }

  let firstName = characterCms.firstName || '';
  let middleName = characterCms.middleName || '';
  let familyName = characterCms.familyName || '';

  // Remove @ prefix if exists
  if (firstName.includes('@')) {
    const arr = firstName.split('@');
    firstName = arr[arr.length - 1];
  }
  if (middleName.includes('@')) {
    const arr = middleName.split('@');
    middleName = arr[arr.length - 1];
  }
  if (familyName.includes('@')) {
    const arr = familyName.split('@');
    familyName = arr[arr.length - 1];
  }

  let mateName = firstName;
  if (middleName) {
    mateName += ' ' + middleName;
  }
  if (familyName) {
    mateName += ' ' + familyName;
  }

  return mateName;
}

/**
 * Parse CSV line handling quoted fields properly
 */
function parseCSVLine(line) {
  const fields = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }
  fields.push(currentField);
  return fields;
}

/**
 * Extract items from a CMS table
 */
function extractItemsFromTable(tableData, tableName, rewardType) {
  const items = [];

  if (!tableData || !tableData[tableName]) {
    return items;
  }

  for (const [key, item] of Object.entries(tableData[tableName])) {
    // Skip metadata entries (keys starting with ':')
    if (key.startsWith(':')) {
      continue;
    }

    // Skip invalid entries
    if (!item || !item.id) {
      continue;
    }

    // For Item table, filter by type based on REWARD_TYPE
    if (tableName === 'Item') {
      if (rewardType === REWARD_TYPE.QUEST_ITEM) {
        // QUEST_ITEM: only include type 7 (quest items)
        if (item.type !== 7) {
          continue;
        }
      } else if (rewardType === REWARD_TYPE.ITEM) {
        // ITEM: exclude type 7 (quest items are handled separately)
        if (item.type === 7) {
          continue;
        }
      }
    }

    // Get item name - special handling for Mate and ShipBlueprint
    let itemName = item.name || `${tableName} ${item.id}`;

    // Mate and ShipBlueprint don't have name field, but have descFormat
    // The name will be formatted later in formatItemName()
    if ((tableName === 'Mate' || tableName === 'ShipBlueprint') && !item.name) {
      // Use a placeholder that will be replaced by formatItemName
      itemName = item.name || `${tableName} ${item.id}`;
    }

    items.push({
      id: item.id,
      name: itemName,
      _original: item, // Keep original for formatting
    });
  }

  return items;
}

/**
 * Format item name by replacing placeholders with actual values
 */
function formatItemName(item, allCmsTables) {
  // Special handling for Mail - use languageMailTitle[0] (Korean)
  if (item.languageMailTitle && Array.isArray(item.languageMailTitle) && item.languageMailTitle.length > 0) {
    return removeCommentFromName(item.languageMailTitle[0] || `Mail ${item.id}`);
  }

  // Special handling for Quest - use name field
  if (item.name && (item.nodes || item.category !== undefined)) {
    // Quest has 'nodes' array or 'category' field
    return removeCommentFromName(item.name);
  }

  // Special handling for EventMission - use eventTask if available
  if (item.eventTaskId && allCmsTables.EventTask && allCmsTables.EventTask[item.eventTaskId]) {
    const eventTask = allCmsTables.EventTask[item.eventTaskId];
    if (eventTask.overrideDesc) {
      return removeCommentFromName(eventTask.overrideDesc);
    }
    return `EventMission ${item.id}`;
  }

  // Special handling for Mate - get name from Character table
  if (item.characterId && allCmsTables.Character && allCmsTables.Character[item.characterId]) {
    return removeCommentFromName(makeCharacterDisplayName(allCmsTables.Character[item.characterId]));
  }

  // Special handling for ShipBlueprint - get name from Ship table
  if (item.shipId && allCmsTables.Ship && allCmsTables.Ship[item.shipId]) {
    const ship = allCmsTables.Ship[item.shipId];
    const shipName = ship.name ? `${ship.name} 도면` : `Ship ${item.shipId} 도면`;
    return removeCommentFromName(shipName);
  }

  // Special handling for TaxFreePermit - combine nation name, typeName and permitName
  if (item.typeName !== undefined && item.permitName !== undefined) {
    let name = '';

    // Add nation name if nationId exists
    if (item.nationId && allCmsTables.Nation && allCmsTables.Nation[item.nationId]) {
      const nation = allCmsTables.Nation[item.nationId];
      const nationName = removeCommentFromName(nation.name) || `Nation ${item.nationId}`;
      const typeName = removeCommentFromName(item.typeName);
      const permitName = removeCommentFromName(item.permitName);
      name = `[${nationName}] ${typeName} ${permitName}`;
    } else {
      const typeName = removeCommentFromName(item.typeName);
      const permitName = removeCommentFromName(item.permitName);
      name = `${typeName} ${permitName}`;
    }

    return name;
  }

  // Special handling for Point - distinguish paid/free red gems and shards
  if (item.tooltipDesc !== undefined && item.name) {
    // Check if this is a paid item (유료 획득)
    if (item.tooltipDesc.includes('유료 획득')) {
      return removeCommentFromName(`${item.name} (유료)`);
    }
    // Check if this is a red gem or red gem shard (add "무료" for clarity)
    if (item.name === '레드젬' || item.name === '레드젬 파편') {
      return removeCommentFromName(`${item.name} (무료)`);
    }
    // For other points, just return the name
    return removeCommentFromName(item.name);
  }

  // Special handling for RewardSeasonItems - get name from InvestSeason table
  if (item.reward && Array.isArray(item.reward) && item.reward.length > 0) {
    // RewardSeasonItems has reward array with SeasonId
    const firstReward = item.reward[0];
    let seasonName = `Season ${firstReward.SeasonId}`;

    if (firstReward.SeasonId && allCmsTables.InvestSeason && allCmsTables.InvestSeason[firstReward.SeasonId]) {
      const season = allCmsTables.InvestSeason[firstReward.SeasonId];
      // InvestSeason has name field with placeholder like "투자 시즌 {0}"
      if (season.name && season.nameFormatTexts && season.nameFormatTexts.length > 0) {
        seasonName = stringFormat(season.name, season.nameFormatTexts);
      } else if (season.name) {
        seasonName = season.name;
      }
    }

    // Get reward item names to distinguish between different RewardSeasonItems
    const rewardNames = [];
    for (const reward of item.reward) {
      if (reward.Type && reward.Id) {
        const tableName = REWARD_TYPE_TO_TABLE[reward.Type];
        if (tableName && allCmsTables[tableName] && allCmsTables[tableName][reward.Id]) {
          const rewardItem = allCmsTables[tableName][reward.Id];
          const itemName = rewardItem.name || `ID ${reward.Id}`;
          const qty = reward.MinQuantity === reward.MaxQuantity
            ? `${reward.MinQuantity}개`
            : `${reward.MinQuantity}-${reward.MaxQuantity}개`;
          rewardNames.push(`${itemName} ${qty}`);
        }
      }
    }

    // Return season name with first reward item for distinction
    if (rewardNames.length > 0) {
      return removeCommentFromName(`${seasonName} (${rewardNames[0]})`);
    }

    return removeCommentFromName(seasonName);
  }

  // If no formatting info, return original name
  if (!item.descFormat || !item.descFormatType) {
    return removeCommentFromName(item.name);
  }

  // Helper function to get formatted text for a descFormat type
  const getDescFormatText = (formatType, target) => {
    switch (formatType) {
      case DESC_FORMAT_TYPE.COUNT:
        return target.toString();

      case DESC_FORMAT_TYPE.CMS_NAME:
        // Look up name from CMS tables
        if (allCmsTables.Ship && allCmsTables.Ship[target]) {
          return allCmsTables.Ship[target].name;
        }
        if (allCmsTables.Mate && allCmsTables.Mate[target]) {
          const mate = allCmsTables.Mate[target];
          if (mate.characterId && allCmsTables.Character && allCmsTables.Character[mate.characterId]) {
            return makeCharacterDisplayName(allCmsTables.Character[mate.characterId]);
          }
          return `Mate ${target}`;
        }
        if (allCmsTables.Character && allCmsTables.Character[target]) {
          return makeCharacterDisplayName(allCmsTables.Character[target]);
        }
        if (allCmsTables.ShipBlueprint && allCmsTables.ShipBlueprint[target]) {
          return allCmsTables.ShipBlueprint[target].name;
        }
        if (allCmsTables.Item && allCmsTables.Item[target]) {
          return allCmsTables.Item[target].name;
        }
        if (allCmsTables.InvestSeason && allCmsTables.InvestSeason[target]) {
          return allCmsTables.InvestSeason[target].name;
        }
        return `[Unknown-${target}]`;

      case DESC_FORMAT_TYPE.ENUM_NAME:
        return `[Enum-${target}]`;

      default:
        return `[Unknown-Format-${formatType}]`;
    }
  };

  // Build array of formatted texts
  const formattedTexts = item.descFormat.map((fmt, index) => {
    const target = item.descFormatType[index]?.target;
    if (typeof target !== 'number') {
      return '[Invalid-Target]';
    }
    return getDescFormatText(fmt.Type, target);
  });

  // Replace placeholders in item name
  return removeCommentFromName(stringFormat(item.name, formattedTexts));
}

/**
 * Remove comment part from item name (everything after @)
 * @param {string} name - Item name
 * @returns {string} - Cleaned name
 */
function removeCommentFromName(name) {
  if (!name || typeof name !== 'string') {
    return name;
  }

  // Remove @ and everything after it
  const atIndex = name.indexOf('@');
  if (atIndex !== -1) {
    return name.substring(0, atIndex).trim();
  }

  return name;
}

// ============================================================================
// Builder Functions
// ============================================================================

/**
 * Build reward lookup table
 * @param {string} cmsDir - CMS directory path
 * @param {Object} loctab - Localization table (Korean → Chinese)
 */
function buildRewardLookupTable(cmsDir, loctab = {}) {
  const lookupTable = {};

  console.log('📦 Building reward lookup table...');
  console.log(`   CMS directory: ${cmsDir}\n`);

  // First, load all CMS tables that might be referenced for item name formatting
  console.log('   Loading reference CMS tables for item name formatting...');
  const allCmsTables = {};
  const referenceTables = ['Ship', 'Mate', 'Character', 'ShipBlueprint', 'Item', 'InvestSeason', 'Nation'];

  for (const tableName of referenceTables) {
    const filePath = path.join(cmsDir, `${tableName}.json`);
    let actualFilePath = filePath;
    if (!fs.existsSync(filePath)) {
      actualFilePath = path.join(cmsDir, `${tableName}.json5`);
    }

    if (fs.existsSync(actualFilePath)) {
      const tableData = loadJson5File(actualFilePath);
      if (tableData) {
        allCmsTables[tableName] = {};

        if (tableName === 'Character' || tableName === 'InvestSeason' || tableName === 'Nation') {
          const table = tableData[tableName];
          for (const [key, entry] of Object.entries(table)) {
            if (entry && entry.id && !key.startsWith(':')) {
              allCmsTables[tableName][entry.id] = entry;
            }
          }
        } else {
          const entries = extractItemsFromTable(tableData, tableName, null);
          for (const entry of entries) {
            allCmsTables[tableName][entry.id] = entry._original || entry;
          }
        }
      }
    }
  }

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
      requiresAmount: true,
      items: [],
      itemCount: 0,
    };

    if (tableName) {
      const filePath = path.join(cmsDir, `${tableName}.json`);
      let actualFilePath = filePath;
      if (!fs.existsSync(filePath)) {
        actualFilePath = path.join(cmsDir, `${tableName}.json5`);
      }

      if (fs.existsSync(actualFilePath)) {
        const tableData = loadJson5File(actualFilePath);
        if (tableData) {
          let items = extractItemsFromTable(tableData, tableName, rewardTypeNum);

          // Format item names with translations
          items = items.map(item => {
            const formattedName = formatItemName(item._original, allCmsTables);

            // Add translations
            const itemData = {
              id: item.id,
              name: formattedName,  // Korean name (default)
              nameKr: formattedName,  // Korean name
            };

            // Special handling for Point items with paid/free distinction
            if (item._original.tooltipDesc && item._original.name) {
              const isPaid = item._original.tooltipDesc.includes('유료 획득');
              const isRedGem = item._original.name === '레드젬' || item._original.name === '레드젬 파편';

              if (isPaid || isRedGem) {
                const baseName = item._original.name;
                const baseCn = loctab[baseName] || baseName;
                const suffix = isPaid ? '유료' : '무료';
                const suffixCn = loctab[suffix] || suffix;

                itemData.nameCn = `${baseCn} (${suffixCn})`;
                itemData.nameEn = formattedName;
                return itemData;
              }
            }

            // Add Chinese translation from loctab
            if (loctab && loctab[formattedName]) {
              itemData.nameCn = loctab[formattedName];
            }

            // English name is same as Korean for now (no English translation table)
            itemData.nameEn = formattedName;

            return itemData;
          });

          // Sort by ID
          items.sort((a, b) => a.id - b.id);

          info.items = items;
          info.itemCount = items.length;
        }
      }
    }

    lookupTable[rewardTypeNum] = info;
  }

  console.log('   ✅ Reward lookup table built successfully!\n');
  return lookupTable;
}

/**
 * Generate REWARD_TYPE list for dropdown
 */
function generateRewardTypeList(lookupTable) {
  const rewardTypes = [];

  for (const [, info] of Object.entries(lookupTable)) {
    rewardTypes.push({
      value: info.rewardType,
      name: info.rewardTypeName,
      nameKey: `REWARD_TYPE_${info.rewardTypeName}`,
      hasTable: info.hasTable,
      tableFile: info.tableFile,
      itemCount: info.itemCount,
      descriptionKey: info.description,
    });
  }

  // Sort by value
  rewardTypes.sort((a, b) => a.value - b.value);

  return rewardTypes;
}

/**
 * Generate localization files
 */
function generateLocalizations(lookupTable) {
  const localizations = {
    kr: {},
    us: {},
    cn: {},
  };

  // Add REWARD_TYPE name translations
  for (const [, info] of Object.entries(lookupTable)) {
    const typeKey = `REWARD_TYPE_${info.rewardTypeName}`;

    localizations.kr[typeKey] = REWARD_TYPE_TRANSLATIONS.kr[info.rewardTypeName] || info.rewardTypeName;
    localizations.us[typeKey] = REWARD_TYPE_TRANSLATIONS.us[info.rewardTypeName] || info.rewardTypeName;
    localizations.cn[typeKey] = REWARD_TYPE_TRANSLATIONS.cn[info.rewardTypeName] || info.rewardTypeName;

    // Add description if exists
    if (info.description) {
      localizations.kr[info.description] = `${localizations.kr[typeKey]} (수치만큼 증가)`;
      localizations.us[info.description] = `${localizations.us[typeKey]} (increases by amount)`;
      localizations.cn[info.description] = `${localizations.cn[typeKey]} (增加指定数值)`;
    }
  }

  return localizations;
}

/**
 * Generate UI list data for various CMS tables
 * Includes: Nation, Town, Village, Ship, Mate, Character, Item, Quest, Discovery, etc.
 */
function generateUIListData(cmsDir, loctab = {}) {
  console.log('🗺️  Building UI list data...');

  const uiListData = {
    nations: [],
    towns: [],
    villages: [],
    ships: [],
    mates: [],
    characters: [],
    items: [],
    questItems: [],
    quests: [],
    discoveries: [],
    jobs: [],
    tradeGoods: [],
    recipes: [],
    shipBlueprints: [],
    cEquips: [],
    points: [],
    userTitles: [],
    achievements: [],
    collections: [],
    battleSkills: [],
    worldSkills: [],
    battleBuffs: [],
    worldBuffs: [],
    eventMissions: [],
    mails: [],
  };

  // Helper function to load a CMS table
  const loadTable = (tableName) => {
    const filePath = path.join(cmsDir, `${tableName}.json`);
    let actualFilePath = filePath;
    if (!fs.existsSync(filePath)) {
      actualFilePath = path.join(cmsDir, `${tableName}.json5`);
    }

    if (fs.existsSync(actualFilePath)) {
      return loadJson5File(actualFilePath);
    }
    return null;
  };

  // Helper function to extract basic list from a table with localization
  const extractList = (tableName, listKey, additionalFields = [], loctab = {}) => {
    const table = loadTable(tableName);
    if (!table || !table[tableName]) {
      return [];
    }

    const list = [];
    for (const [key, item] of Object.entries(table[tableName])) {
      if (!item || !item.id || key.startsWith(':')) {
        continue;
      }

      let nameKr = item.name || item.Name || `${tableName} ${item.id}`;

      // Remove @ and everything after it (comment marker)
      const atIndex = nameKr.indexOf('@');
      if (atIndex !== -1) {
        nameKr = nameKr.substring(0, atIndex).trim();
      }

      const entry = {
        id: item.id,
        name: nameKr,
        nameKr: nameKr,
        nameCn: loctab[nameKr] || nameKr,
        nameEn: nameKr, // English translation not available, use Korean
      };

      // Add additional fields if specified
      for (const field of additionalFields) {
        if (item[field] !== undefined) {
          entry[field] = item[field];
        }
      }

      list.push(entry);
    }

    list.sort((a, b) => a.id - b.id);
    return list;
  };

  // 1. Nation (국가)
  uiListData.nations = extractList('Nation', 'nations', [], loctab);
  console.log(`   ✅ Loaded ${uiListData.nations.length} nations`);

  // 2. Town (마을/항구)
  uiListData.towns = extractList('Town', 'towns', ['nationId', 'type'], loctab);
  console.log(`   ✅ Loaded ${uiListData.towns.length} towns`);

  // 3. Village (촌락)
  uiListData.villages = extractList('Village', 'villages', [], loctab);
  console.log(`   ✅ Loaded ${uiListData.villages.length} villages`);

  // 4. Ship (선박) - name 필드 사용
  uiListData.ships = extractList('Ship', 'ships', ['shipClass', 'grade', 'type'], loctab);
  console.log(`   ✅ Loaded ${uiListData.ships.length} ships`);

  // 5. Mate (항해사) - Character 테이블에서 이름 가져오기
  const mateTable = loadTable('Mate');
  const characterTable = loadTable('Character');
  if (mateTable && mateTable.Mate && characterTable && characterTable.Character) {
    for (const [key, mate] of Object.entries(mateTable.Mate)) {
      if (!mate || !mate.id || key.startsWith(':')) {
        continue;
      }

      // Get character name from Character table
      const character = characterTable.Character[mate.characterId];
      let nameKr = `Mate ${mate.id}`;

      if (character) {
        // Use firstName + lastName if available
        if (character.firstName && character.lastName) {
          nameKr = `${character.firstName} ${character.lastName}`;
        } else if (character.firstName) {
          nameKr = character.firstName;
        } else if (character.name) {
          nameKr = character.name;
        }
      }

      // Remove @ and everything after it (comment marker)
      const atIndex = nameKr.indexOf('@');
      if (atIndex !== -1) {
        nameKr = nameKr.substring(0, atIndex).trim();
      }

      uiListData.mates.push({
        id: mate.id,
        name: nameKr,
        nameKr: nameKr,
        nameCn: loctab[nameKr] || nameKr,
        nameEn: nameKr,
        characterId: mate.characterId,
        grade: mate.mateGrade,
        job: mate.jobId,
      });
    }
    uiListData.mates.sort((a, b) => a.id - b.id);
    console.log(`   ✅ Loaded ${uiListData.mates.length} mates`);
  }

  // 6. Character (캐릭터) - firstName + lastName 조합
  if (characterTable && characterTable.Character) {
    for (const [key, character] of Object.entries(characterTable.Character)) {
      if (!character || !character.id || key.startsWith(':')) {
        continue;
      }

      let nameKr = `Character ${character.id}`;
      if (character.firstName && character.lastName) {
        nameKr = `${character.firstName} ${character.lastName}`;
      } else if (character.firstName) {
        nameKr = character.firstName;
      } else if (character.name) {
        nameKr = character.name;
      }

      // Remove @ and everything after it (comment marker)
      const atIndex = nameKr.indexOf('@');
      if (atIndex !== -1) {
        nameKr = nameKr.substring(0, atIndex).trim();
      }

      uiListData.characters.push({
        id: character.id,
        name: nameKr,
        nameKr: nameKr,
        nameCn: loctab[nameKr] || nameKr,
        nameEn: nameKr,
        firstName: character.firstName,
        lastName: character.lastName,
      });
    }
    uiListData.characters.sort((a, b) => a.id - b.id);
    console.log(`   ✅ Loaded ${uiListData.characters.length} characters`);
  }

  // 7. Item (아이템) - 일반 아이템만 (type != 7)
  const itemTable = loadTable('Item');
  if (itemTable && itemTable.Item) {
    for (const [key, item] of Object.entries(itemTable.Item)) {
      if (!item || !item.id || key.startsWith(':') || item.type === 7) {
        continue;
      }
      const nameKr = item.name || `Item ${item.id}`;
      uiListData.items.push({
        id: item.id,
        name: nameKr,
        nameKr: nameKr,
        nameCn: loctab[nameKr] || nameKr,
        nameEn: nameKr,
        type: item.type,
        grade: item.grade,
      });
    }
    uiListData.items.sort((a, b) => a.id - b.id);
    console.log(`   ✅ Loaded ${uiListData.items.length} items`);
  }

  // 8. Quest Item (퀘스트 아이템) - type == 7
  if (itemTable && itemTable.Item) {
    for (const [key, item] of Object.entries(itemTable.Item)) {
      if (!item || !item.id || key.startsWith(':') || item.type !== 7) {
        continue;
      }
      const nameKr = item.name || `Quest Item ${item.id}`;
      uiListData.questItems.push({
        id: item.id,
        name: nameKr,
        nameKr: nameKr,
        nameCn: loctab[nameKr] || nameKr,
        nameEn: nameKr,
      });
    }
    uiListData.questItems.sort((a, b) => a.id - b.id);
    console.log(`   ✅ Loaded ${uiListData.questItems.length} quest items`);
  }

  // 9. Quest (퀘스트) - formatTexts로 플레이스홀더 치환
  const questTable = loadTable('Quest');
  if (questTable && questTable.Quest) {
    for (const [key, quest] of Object.entries(questTable.Quest)) {
      if (!quest || !quest.id || key.startsWith(':')) {
        continue;
      }

      let nameKr = quest.name || `Quest ${quest.id}`;

      // Replace placeholders if formatTexts exists
      if (quest.formatTexts && Array.isArray(quest.formatTexts)) {
        const formattedTexts = quest.formatTexts.map((fmt) => {
          // Type 0 = Direct value from Val field
          if (fmt.Type === 0 && fmt.Val) {
            return fmt.Val;
          }
          return '[Unknown]';
        });

        // Replace {0}, {1}, {2}, etc. with formatted texts
        nameKr = stringFormat(nameKr, formattedTexts);
      }

      uiListData.quests.push({
        id: quest.id,
        name: nameKr,
        nameKr: nameKr,
        nameCn: loctab[nameKr] || nameKr,
        nameEn: nameKr,
        type: quest.type,
        level: quest.level,
      });
    }
    uiListData.quests.sort((a, b) => a.id - b.id);
    console.log(`   ✅ Loaded ${uiListData.quests.length} quests`);
  }

  // 10. Discovery (발견물)
  uiListData.discoveries = extractList('Discovery', 'discoveries', ['type', 'grade'], loctab);
  console.log(`   ✅ Loaded ${uiListData.discoveries.length} discoveries`);

  // 11. Job (직업)
  uiListData.jobs = extractList('Job', 'jobs', ['type'], loctab);
  console.log(`   ✅ Loaded ${uiListData.jobs.length} jobs`);

  // 12. TradeGoods (교역품)
  uiListData.tradeGoods = extractList('TradeGoods', 'tradeGoods', ['category', 'grade'], loctab);
  console.log(`   ✅ Loaded ${uiListData.tradeGoods.length} trade goods`);

  // 13. Recipe (레시피)
  uiListData.recipes = extractList('Recipe', 'recipes', ['type'], loctab);
  console.log(`   ✅ Loaded ${uiListData.recipes.length} recipes`);

  // 14. ShipBlueprint (선박 도면) - Ship 테이블에서 이름 가져오기
  const shipBlueprintTable = loadTable('ShipBlueprint');
  const shipTable = loadTable('Ship');
  if (shipBlueprintTable && shipBlueprintTable.ShipBlueprint && shipTable && shipTable.Ship) {
    for (const [key, blueprint] of Object.entries(shipBlueprintTable.ShipBlueprint)) {
      if (!blueprint || !blueprint.id || key.startsWith(':')) {
        continue;
      }

      // Get ship name from Ship table
      const ship = shipTable.Ship[blueprint.shipId];
      let nameKr = `ShipBlueprint ${blueprint.id}`;

      if (ship && ship.name) {
        nameKr = `${ship.name} 도면`;
      }

      uiListData.shipBlueprints.push({
        id: blueprint.id,
        name: nameKr,
        nameKr: nameKr,
        nameCn: loctab[nameKr] || nameKr,
        nameEn: nameKr,
        shipId: blueprint.shipId,
        grade: blueprint.grade,
      });
    }
    uiListData.shipBlueprints.sort((a, b) => a.id - b.id);
    console.log(`   ✅ Loaded ${uiListData.shipBlueprints.length} ship blueprints`);
  }

  // 15. CEquip (캐릭터 장비)
  uiListData.cEquips = extractList('CEquip', 'cEquips', ['type', 'grade', 'job'], loctab);
  console.log(`   ✅ Loaded ${uiListData.cEquips.length} character equipments`);

  // 16. Point (포인트) - Special handling for paid/free red gems
  const pointTable = loadTable('Point');
  if (pointTable && pointTable.Point) {
    const pointList = [];
    for (const [key, item] of Object.entries(pointTable.Point)) {
      if (!item || !item.id || key.startsWith(':')) {
        continue;
      }

      let nameKr = item.name || `Point ${item.id}`;
      let nameCn = loctab[item.name] || nameKr;
      let nameEn = nameKr;

      // Debug: Check if this is a red gem
      const isRedGem = item.name === '레드젬' || item.name === '레드젬 파편';
      const hasPaidDesc = item.tooltipDesc && item.tooltipDesc.includes('유료 획득');

      // Apply same logic as formatItemName for paid/free distinction
      if (item.tooltipDesc && item.name) {
        if (hasPaidDesc) {
          // Paid item - compose localized name
          nameKr = `${item.name} (유료)`;
          const baseCn = loctab[item.name] || item.name;
          const paidCn = loctab['유료'] || '유료';
          nameCn = `${baseCn} (${paidCn})`;
          nameEn = nameKr;
        } else if (isRedGem) {
          // Free red gem - compose localized name
          nameKr = `${item.name} (무료)`;
          const baseCn = loctab[item.name] || item.name;
          const freeCn = loctab['무료'] || '무료';
          nameCn = `${baseCn} (${freeCn})`;
          nameEn = nameKr;
        }
        // else: use original name for other points
      }

      const entry = {
        id: item.id,
        name: nameKr,
        nameKr: nameKr,
        nameCn: nameCn,
        nameEn: nameEn,
      };

      pointList.push(entry);
    }
    pointList.sort((a, b) => a.id - b.id);
    uiListData.points = pointList;
  } else {
    console.log('   ⚠️  Point table not found or empty');
    uiListData.points = [];
  }
  console.log(`   ✅ Loaded ${uiListData.points.length} points`);

  // 17. UserTitle (칭호)
  uiListData.userTitles = extractList('UserTitle', 'userTitles', ['type'], loctab);
  console.log(`   ✅ Loaded ${uiListData.userTitles.length} user titles`);

  // 18. Achievement (업적)
  uiListData.achievements = extractList('Achievement', 'achievements', ['type', 'grade'], loctab);
  console.log(`   ✅ Loaded ${uiListData.achievements.length} achievements`);

  // 19. Collection (수집)
  uiListData.collections = extractList('Collection', 'collections', ['type'], loctab);
  console.log(`   ✅ Loaded ${uiListData.collections.length} collections`);

  // 20. BattleSkill (전투 스킬)
  uiListData.battleSkills = extractList('BattleSkill', 'battleSkills', ['type', 'grade'], loctab);
  console.log(`   ✅ Loaded ${uiListData.battleSkills.length} battle skills`);

  // 21. WorldSkill (월드 스킬)
  uiListData.worldSkills = extractList('WorldSkill', 'worldSkills', ['type'], loctab);
  console.log(`   ✅ Loaded ${uiListData.worldSkills.length} world skills`);

  // 22. BattleBuff (전투 버프)
  uiListData.battleBuffs = extractList('BattleBuff', 'battleBuffs', ['type'], loctab);
  console.log(`   ✅ Loaded ${uiListData.battleBuffs.length} battle buffs`);

  // 23. WorldBuff (월드 버프)
  uiListData.worldBuffs = extractList('WorldBuff', 'worldBuffs', ['type'], loctab);
  console.log(`   ✅ Loaded ${uiListData.worldBuffs.length} world buffs`);

  // 24. EventMission (이벤트 미션) - EventTask에서 설명 가져오기
  const eventMissionTable = loadTable('EventMission');
  const eventTaskTable = loadTable('EventTask');
  if (eventMissionTable && eventMissionTable.EventMission) {
    for (const [key, mission] of Object.entries(eventMissionTable.EventMission)) {
      if (!mission || !mission.id || key.startsWith(':')) {
        continue;
      }

      let nameKr = `EventMission ${mission.id}`;

      // Get description from EventTask if available
      if (mission.eventTaskId && eventTaskTable && eventTaskTable.EventTask) {
        const eventTask = eventTaskTable.EventTask[mission.eventTaskId];
        if (eventTask && eventTask.overrideDesc) {
          nameKr = eventTask.overrideDesc;

          // Replace placeholders if descFormat exists
          if (eventTask.descFormat && Array.isArray(eventTask.descFormat)) {
            const formattedTexts = eventTask.descFormat.map((fmt) => {
              // Type 1 = COUNT, use eventTaskCount
              if (fmt.Type === 1) {
                return eventTask.eventTaskCount ? eventTask.eventTaskCount.toString() : '0';
              }
              // Type 2 = CMS_NAME, Type 3 = ENUM_NAME - not implemented for EventTask
              return '[Unknown]';
            });

            // Replace {0}, {1}, {2}, etc. with formatted texts
            nameKr = stringFormat(nameKr, formattedTexts);
          }

          // Remove @ and everything after it (comment marker)
          const atIndex = nameKr.indexOf('@');
          if (atIndex !== -1) {
            nameKr = nameKr.substring(0, atIndex).trim();
          }
        }
      }

      uiListData.eventMissions.push({
        id: mission.id,
        name: nameKr,
        nameKr: nameKr,
        nameCn: loctab[nameKr] || nameKr,
        nameEn: nameKr,
        type: mission.type,
        eventTaskId: mission.eventTaskId,
      });
    }
    uiListData.eventMissions.sort((a, b) => a.id - b.id);
    console.log(`   ✅ Loaded ${uiListData.eventMissions.length} event missions`);
  }

  // 25. Mail (메일) - languageMailTitle[0] 사용 + descFormat 플레이스홀더 치환
  const mailTable = loadTable('Mail');
  const townTable = loadTable('Town');
  if (mailTable && mailTable.Mail) {
    for (const [key, mail] of Object.entries(mailTable.Mail)) {
      if (!mail || !mail.id || key.startsWith(':')) {
        continue;
      }

      let nameKr = `Mail ${mail.id}`;

      // Use languageMailTitle[0] (Korean) if available
      if (mail.languageMailTitle && Array.isArray(mail.languageMailTitle) && mail.languageMailTitle.length > 0) {
        nameKr = mail.languageMailTitle[0] || nameKr;

        // Replace placeholders if descFormat exists
        if (mail.descFormat && Array.isArray(mail.descFormat)) {
          const formattedTexts = mail.descFormat.map((fmt) => {
            // Type 2 = CMS_NAME (e.g., Town, Item, etc.)
            if (fmt.Type === 2) {
              if (fmt.TypeName === 'Town') {
                // For Town, use generic placeholder since we don't have specific town ID
                return '[도시명]';
              }
              // Add more TypeName handling as needed
              return '[CMS]';
            }
            // Type 1 = COUNT
            if (fmt.Type === 1) {
              return '[수량]';
            }
            return '[Unknown]';
          });

          // Replace {0}, {1}, {2}, etc. with formatted texts
          nameKr = stringFormat(nameKr, formattedTexts);
        }
      }

      uiListData.mails.push({
        id: mail.id,
        name: nameKr,
        nameKr: nameKr,
        nameCn: loctab[nameKr] || nameKr,
        nameEn: nameKr,
        type: mail.mailType,
      });
    }
    uiListData.mails.sort((a, b) => a.id - b.id);
    console.log(`   ✅ Loaded ${uiListData.mails.length} mails`);
  }

  console.log('   ✅ UI list data built successfully!\n');
  return uiListData;
}

/**
 * Convert loctab-source CSV to loctab JSON
 */
function convertLocalizationTable(inputPath, outputPath) {
  console.log('🌐 Converting localization table...');
  console.log(`   Input: ${inputPath}`);
  console.log(`   Output: ${outputPath}\n`);

  if (!fs.existsSync(inputPath)) {
    console.log('   ⚠️  loctab-source file not found, skipping...\n');
    return null;
  }

  const content = fs.readFileSync(inputPath, 'utf8');
  const lines = content.split('\n');

  const loctab = {};
  const keyLowerCaseMap = new Map();
  let lineCount = 0;
  let processedCount = 0;
  let skippedCount = 0;
  let exactDuplicateCount = 0;
  let caseDuplicateCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    lineCount++;

    // Skip header line (first line)
    if (i === 0) {
      continue;
    }

    // Skip empty lines
    if (!line) {
      skippedCount++;
      continue;
    }

    // Parse CSV line
    const fields = parseCSVLine(line);

    // We need at least 4 fields (field[1] = key, field[3] = chinese)
    if (fields.length < 4) {
      skippedCount++;
      continue;
    }

    const key = fields[1];
    const chinese = fields[3];

    // Skip if key is empty
    if (!key) {
      skippedCount++;
      continue;
    }

    // Check for exact duplicate
    if (loctab.hasOwnProperty(key)) {
      exactDuplicateCount++;
      continue;
    }

    // Check for case-insensitive duplicate
    const keyLower = key.toLowerCase();
    if (keyLowerCaseMap.has(keyLower)) {
      caseDuplicateCount++;
      continue;
    }

    // Add to loctab
    loctab[key] = chinese || key;
    keyLowerCaseMap.set(keyLower, key);
    processedCount++;
  }

  // Save to file
  fs.writeFileSync(outputPath, JSON.stringify(loctab, null, 2), 'utf8');

  console.log(`   ✅ Localization table converted successfully!`);
  console.log(`   📊 Statistics:`);
  console.log(`      Total lines: ${lineCount}`);
  console.log(`      Processed: ${processedCount}`);
  console.log(`      Skipped: ${skippedCount}`);
  console.log(`      Exact duplicates: ${exactDuplicateCount}`);
  console.log(`      Case-insensitive duplicates: ${caseDuplicateCount}\n`);

  return loctab;
}

// ============================================================================
// Main Function
// ============================================================================

function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  let buildRewards = false;
  let buildUILists = false;
  let buildLocalization = false;
  let cmsDir = DEFAULT_CMS_DIR;
  let outputDir = DEFAULT_OUTPUT_DIR;

  // Parse options
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      console.log(`
Admin Tool Data Builder

Usage:
  node adminToolDataBuilder.js [options]

Options:
  --all              Build all data (default)
  --rewards          Build reward lookup tables only
  --ui-lists         Build UI list data only
  --localization     Build localization table only
  --cms-dir <path>   CMS directory path (default: ../../../cms/server)
  --output-dir <path> Output directory path (default: current directory)
  --help, -h         Show this help message

Examples:
  node adminToolDataBuilder.js
  node adminToolDataBuilder.js --rewards
  node adminToolDataBuilder.js --cms-dir /path/to/cms/server
      `);
      process.exit(0);
    } else if (arg === '--all') {
      buildRewards = true;
      buildUILists = true;
      buildLocalization = true;
    } else if (arg === '--rewards') {
      buildRewards = true;
    } else if (arg === '--ui-lists') {
      buildUILists = true;
    } else if (arg === '--localization') {
      buildLocalization = true;
    } else if (arg === '--cms-dir') {
      cmsDir = args[++i];
    } else if (arg === '--output-dir') {
      outputDir = args[++i];
    }
  }

  // If no specific option is set, build all
  if (!buildRewards && !buildUILists && !buildLocalization) {
    buildRewards = true;
    buildUILists = true;
    buildLocalization = true;
  }

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║         Admin Tool Data Builder                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  const generatedFiles = [];

  // Build localization table FIRST (needed for reward lookup)
  let loctab = {};
  if (buildLocalization || buildRewards) {
    const loctabSource = path.join(outputDir, 'loctab-source');
    const loctabOutput = path.join(outputDir, 'loctab');

    loctab = convertLocalizationTable(loctabSource, loctabOutput);
    if (loctab && buildLocalization) {
      generatedFiles.push({ name: 'loctab.json', description: 'Localization table (Korean → Chinese)' });
    }
  }

  // Build reward lookup tables (with loctab for translations)
  if (buildRewards) {
    const lookupTable = buildRewardLookupTable(cmsDir, loctab);

    // Save full lookup table
    const lookupFile = path.join(outputDir, 'reward-lookup.json');
    fs.writeFileSync(lookupFile, JSON.stringify(lookupTable, null, 2), 'utf8');
    generatedFiles.push({ name: 'reward-lookup.json', description: 'Full reward lookup table' });

    // Generate and save REWARD_TYPE list
    const rewardTypeList = generateRewardTypeList(lookupTable);
    const typeListFile = path.join(outputDir, 'reward-type-list.json');
    fs.writeFileSync(typeListFile, JSON.stringify(rewardTypeList, null, 2), 'utf8');
    generatedFiles.push({ name: 'reward-type-list.json', description: 'REWARD_TYPE dropdown list' });

    // Generate and save localizations
    const localizations = generateLocalizations(lookupTable);

    const locKrFile = path.join(outputDir, 'reward-localization-kr.json');
    fs.writeFileSync(locKrFile, JSON.stringify(localizations.kr, null, 2), 'utf8');
    generatedFiles.push({ name: 'reward-localization-kr.json', description: 'Korean localization' });

    const locUsFile = path.join(outputDir, 'reward-localization-us.json');
    fs.writeFileSync(locUsFile, JSON.stringify(localizations.us, null, 2), 'utf8');
    generatedFiles.push({ name: 'reward-localization-us.json', description: 'English localization' });

    const locCnFile = path.join(outputDir, 'reward-localization-cn.json');
    fs.writeFileSync(locCnFile, JSON.stringify(localizations.cn, null, 2), 'utf8');
    generatedFiles.push({ name: 'reward-localization-cn.json', description: 'Chinese localization' });
  }

  // Build UI list data (with loctab for translations)
  if (buildUILists) {
    const uiListData = generateUIListData(cmsDir, loctab);

    const uiListFile = path.join(outputDir, 'ui-list-data.json');
    fs.writeFileSync(uiListFile, JSON.stringify(uiListData, null, 2), 'utf8');
    generatedFiles.push({ name: 'ui-list-data.json', description: 'UI list data (Nation/Town/Village)' });
  }

  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);

  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  ✅ All tasks completed successfully!                         ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('📁 Generated files:\n');
  generatedFiles.forEach(file => {
    console.log(`   ✓ ${file.name}`);
    console.log(`     ${file.description}\n`);
  });

  console.log(`⏱️  Total time: ${duration}s\n`);
  console.log('💡 You can now use these files in your admin tool!\n');
}

// Run main function
if (require.main === module) {
  main();
}

module.exports = {
  buildRewardLookupTable,
  generateRewardTypeList,
  generateLocalizations,
  generateUIListData,
  convertLocalizationTable,
};

