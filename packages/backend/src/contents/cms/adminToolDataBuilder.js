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
// REWARD_TYPE Definitions
// ============================================================================

const REWARD_TYPE = {
  POINT: 1,
  ITEM: 2,
  SHIP: 3,
  MATE: 4,
  SHIP_PARTS: 5,
  SHIP_OPTION: 6,
  SHIP_FIGURE: 7,
  SHIP_ORNAMENT: 8,
  SHIP_SPECIAL_OPTION: 9,
  QUEST_ITEM: 10,
  BATTLE_EXP: 11,
  ADVENTURE_EXP: 12,
  TRADE_EXP: 13,
  BATTLE_FAME: 14,
  ADVENTURE_FAME: 15,
  TRADE_FAME: 16,
  SHIP_SAILOR: 17,
  SHIP_CAPACITY: 18,
  SHIP_DURABILITY: 19,
  SHIP_ATTACK: 20,
  SHIP_DEFENSE: 21,
  SHIP_SPEED: 22,
  SHIP_TURN: 23,
  SHIP_WAVE: 24,
  SHIP_MATERIAL: 25,
  SHIP_ALCHEMY: 26,
  SHIP_BIOLOGY: 27,
  SHIP_ASTRONOMY: 28,
  SHIP_FINANCE: 29,
  SHIP_INDUSTRY: 30,
  SHIP_WINE: 31,
  SHIP_ART: 32,
  USER_TITLE: 33,
  SHIP_BLUEPRINT: 34,
  REWARD_SEASON_ITEMS: 35,
};

const REWARD_TYPE_NAMES = {
  1: 'POINT',
  2: 'ITEM',
  3: 'SHIP',
  4: 'MATE',
  5: 'SHIP_PARTS',
  6: 'SHIP_OPTION',
  7: 'SHIP_FIGURE',
  8: 'SHIP_ORNAMENT',
  9: 'SHIP_SPECIAL_OPTION',
  10: 'QUEST_ITEM',
  11: 'BATTLE_EXP',
  12: 'ADVENTURE_EXP',
  13: 'TRADE_EXP',
  14: 'BATTLE_FAME',
  15: 'ADVENTURE_FAME',
  16: 'TRADE_FAME',
  17: 'SHIP_SAILOR',
  18: 'SHIP_CAPACITY',
  19: 'SHIP_DURABILITY',
  20: 'SHIP_ATTACK',
  21: 'SHIP_DEFENSE',
  22: 'SHIP_SPEED',
  23: 'SHIP_TURN',
  24: 'SHIP_WAVE',
  25: 'SHIP_MATERIAL',
  26: 'SHIP_ALCHEMY',
  27: 'SHIP_BIOLOGY',
  28: 'SHIP_ASTRONOMY',
  29: 'SHIP_FINANCE',
  30: 'SHIP_INDUSTRY',
  31: 'SHIP_WINE',
  32: 'SHIP_ART',
  33: 'USER_TITLE',
  34: 'SHIP_BLUEPRINT',
  35: 'REWARD_SEASON_ITEMS',
};

const REWARD_TYPE_TO_TABLE = {
  1: 'Point',
  2: 'Item',
  3: 'Ship',
  4: 'Mate',
  5: 'ShipParts',
  6: 'ShipOption',
  7: 'ShipFigure',
  8: 'ShipOrnament',
  9: 'ShipSpecialOption',
  10: 'Item', // QUEST_ITEM uses Item table with type filter
  33: 'UserTitle',
  34: 'ShipBlueprint',
  35: 'RewardSeasonItems',
};

const REWARD_TYPE_DESCRIPTIONS = {
  11: 'REWARD_TYPE_DESC_BATTLE_EXP',
  12: 'REWARD_TYPE_DESC_ADVENTURE_EXP',
  13: 'REWARD_TYPE_DESC_TRADE_EXP',
  14: 'REWARD_TYPE_DESC_BATTLE_FAME',
  15: 'REWARD_TYPE_DESC_ADVENTURE_FAME',
  16: 'REWARD_TYPE_DESC_TRADE_FAME',
  17: 'REWARD_TYPE_DESC_SHIP_SAILOR',
  18: 'REWARD_TYPE_DESC_SHIP_CAPACITY',
  19: 'REWARD_TYPE_DESC_SHIP_DURABILITY',
  20: 'REWARD_TYPE_DESC_SHIP_ATTACK',
  21: 'REWARD_TYPE_DESC_SHIP_DEFENSE',
  22: 'REWARD_TYPE_DESC_SHIP_SPEED',
  23: 'REWARD_TYPE_DESC_SHIP_TURN',
  24: 'REWARD_TYPE_DESC_SHIP_WAVE',
  25: 'REWARD_TYPE_DESC_SHIP_MATERIAL',
  26: 'REWARD_TYPE_DESC_SHIP_ALCHEMY',
  27: 'REWARD_TYPE_DESC_SHIP_BIOLOGY',
  28: 'REWARD_TYPE_DESC_SHIP_ASTRONOMY',
  29: 'REWARD_TYPE_DESC_SHIP_FINANCE',
  30: 'REWARD_TYPE_DESC_SHIP_INDUSTRY',
  31: 'REWARD_TYPE_DESC_SHIP_WINE',
  32: 'REWARD_TYPE_DESC_SHIP_ART',
};

const REWARD_TYPE_ID_FIELD_NAMES = {
  1: 'pointId',
  2: 'itemId',
  3: 'shipId',
  4: 'mateId',
  5: 'shipPartsId',
  6: 'shipOptionId',
  7: 'shipFigureId',
  8: 'shipOrnamentId',
  9: 'shipSpecialOptionId',
  10: 'questItemId',
  33: 'userTitleId',
  34: 'shipBlueprintId',
  35: 'rewardSeasonItemsId',
};

// Localization translations
const REWARD_TYPE_TRANSLATIONS = {
  kr: {
    POINT: '포인트',
    ITEM: '아이템',
    SHIP: '선박',
    MATE: '항해사',
    SHIP_PARTS: '선박 부품',
    SHIP_OPTION: '선박 옵션',
    SHIP_FIGURE: '선수상',
    SHIP_ORNAMENT: '선박 장식',
    SHIP_SPECIAL_OPTION: '선박 특수 옵션',
    QUEST_ITEM: '퀘스트 아이템',
    BATTLE_EXP: '전투 경험치',
    ADVENTURE_EXP: '모험 경험치',
    TRADE_EXP: '교역 경험치',
    BATTLE_FAME: '전투 명성',
    ADVENTURE_FAME: '모험 명성',
    TRADE_FAME: '교역 명성',
    SHIP_SAILOR: '선원 수',
    SHIP_CAPACITY: '적재량',
    SHIP_DURABILITY: '내구도',
    SHIP_ATTACK: '공격력',
    SHIP_DEFENSE: '방어력',
    SHIP_SPEED: '속도',
    SHIP_TURN: '선회',
    SHIP_WAVE: '대파',
    SHIP_MATERIAL: '공예',
    SHIP_ALCHEMY: '연금술',
    SHIP_BIOLOGY: '생물학',
    SHIP_ASTRONOMY: '천문학',
    SHIP_FINANCE: '재정학',
    SHIP_INDUSTRY: '공업',
    SHIP_WINE: '주조',
    SHIP_ART: '미술',
    USER_TITLE: '칭호',
    SHIP_BLUEPRINT: '선박 설계도',
    REWARD_SEASON_ITEMS: '시즌 보상 아이템',
  },
  us: {
    POINT: 'Point',
    ITEM: 'Item',
    SHIP: 'Ship',
    MATE: 'Mate',
    SHIP_PARTS: 'Ship Parts',
    SHIP_OPTION: 'Ship Option',
    SHIP_FIGURE: 'Ship Figure',
    SHIP_ORNAMENT: 'Ship Ornament',
    SHIP_SPECIAL_OPTION: 'Ship Special Option',
    QUEST_ITEM: 'Quest Item',
    BATTLE_EXP: 'Battle EXP',
    ADVENTURE_EXP: 'Adventure EXP',
    TRADE_EXP: 'Trade EXP',
    BATTLE_FAME: 'Battle Fame',
    ADVENTURE_FAME: 'Adventure Fame',
    TRADE_FAME: 'Trade Fame',
    SHIP_SAILOR: 'Sailor',
    SHIP_CAPACITY: 'Capacity',
    SHIP_DURABILITY: 'Durability',
    SHIP_ATTACK: 'Attack',
    SHIP_DEFENSE: 'Defense',
    SHIP_SPEED: 'Speed',
    SHIP_TURN: 'Turn',
    SHIP_WAVE: 'Wave',
    SHIP_MATERIAL: 'Material',
    SHIP_ALCHEMY: 'Alchemy',
    SHIP_BIOLOGY: 'Biology',
    SHIP_ASTRONOMY: 'Astronomy',
    SHIP_FINANCE: 'Finance',
    SHIP_INDUSTRY: 'Industry',
    SHIP_WINE: 'Wine',
    SHIP_ART: 'Art',
    USER_TITLE: 'Title',
    SHIP_BLUEPRINT: 'Ship Blueprint',
    REWARD_SEASON_ITEMS: 'Season Reward Items',
  },
  cn: {
    POINT: '点数',
    ITEM: '道具',
    SHIP: '船只',
    MATE: '航海士',
    SHIP_PARTS: '船只部件',
    SHIP_OPTION: '船只选项',
    SHIP_FIGURE: '船首像',
    SHIP_ORNAMENT: '船只装饰',
    SHIP_SPECIAL_OPTION: '船只特殊选项',
    QUEST_ITEM: '任务道具',
    BATTLE_EXP: '战斗经验值',
    ADVENTURE_EXP: '冒险经验值',
    TRADE_EXP: '贸易经验值',
    BATTLE_FAME: '战斗声望',
    ADVENTURE_FAME: '冒险声望',
    TRADE_FAME: '贸易声望',
    SHIP_SAILOR: '船员数',
    SHIP_CAPACITY: '装载量',
    SHIP_DURABILITY: '耐久度',
    SHIP_ATTACK: '攻击力',
    SHIP_DEFENSE: '防御力',
    SHIP_SPEED: '速度',
    SHIP_TURN: '转向',
    SHIP_WAVE: '抗浪',
    SHIP_MATERIAL: '工艺',
    SHIP_ALCHEMY: '炼金术',
    SHIP_BIOLOGY: '生物学',
    SHIP_ASTRONOMY: '天文学',
    SHIP_FINANCE: '财政学',
    SHIP_INDUSTRY: '工业',
    SHIP_WINE: '酿酒',
    SHIP_ART: '美术',
    USER_TITLE: '称号',
    SHIP_BLUEPRINT: '船只设计图',
    REWARD_SEASON_ITEMS: '赛季奖励道具',
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

    items.push({
      id: item.id,
      name: item.name || `${tableName} ${item.id}`,
      _original: item, // Keep original for formatting
    });
  }

  return items;
}

/**
 * Format item name by replacing placeholders with actual values
 */
function formatItemName(item, allCmsTables) {
  // If no formatting info, return original name
  if (!item.descFormat || !item.descFormatType) {
    return item.name;
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
    return getDescFormatText(fmt, target);
  });

  // Replace placeholders in item name
  return stringFormat(item.name, formattedTexts);
}

// ============================================================================
// Builder Functions
// ============================================================================

/**
 * Build reward lookup table
 */
function buildRewardLookupTable(cmsDir) {
  const lookupTable = {};

  console.log('📦 Building reward lookup table...');
  console.log(`   CMS directory: ${cmsDir}\n`);

  // First, load all CMS tables that might be referenced for item name formatting
  console.log('   Loading reference CMS tables for item name formatting...');
  const allCmsTables = {};
  const referenceTables = ['Ship', 'Mate', 'Character', 'ShipBlueprint', 'Item', 'InvestSeason'];

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

        if (tableName === 'Character' || tableName === 'InvestSeason') {
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

          // Format item names
          items = items.map(item => {
            const formattedName = formatItemName(item._original, allCmsTables);
            return {
              id: item.id,
              name: formattedName,
            };
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
function generateUIListData(cmsDir) {
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

  // Helper function to extract basic list from a table
  const extractList = (tableName, listKey, additionalFields = []) => {
    const table = loadTable(tableName);
    if (!table || !table[tableName]) {
      return [];
    }

    const list = [];
    for (const [key, item] of Object.entries(table[tableName])) {
      if (!item || !item.id || key.startsWith(':')) {
        continue;
      }

      const entry = {
        id: item.id,
        name: item.name || item.Name || `${tableName} ${item.id}`,
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
  uiListData.nations = extractList('Nation', 'nations');
  console.log(`   ✅ Loaded ${uiListData.nations.length} nations`);

  // 2. Town (마을/항구)
  uiListData.towns = extractList('Town', 'towns', ['nationId', 'type']);
  console.log(`   ✅ Loaded ${uiListData.towns.length} towns`);

  // 3. Village (촌락)
  uiListData.villages = extractList('Village', 'villages');
  console.log(`   ✅ Loaded ${uiListData.villages.length} villages`);

  // 4. Ship (선박)
  uiListData.ships = extractList('Ship', 'ships', ['shipClass', 'grade', 'type']);
  console.log(`   ✅ Loaded ${uiListData.ships.length} ships`);

  // 5. Mate (항해사)
  uiListData.mates = extractList('Mate', 'mates', ['characterId', 'grade', 'job']);
  console.log(`   ✅ Loaded ${uiListData.mates.length} mates`);

  // 6. Character (캐릭터)
  uiListData.characters = extractList('Character', 'characters', ['firstName', 'lastName']);
  console.log(`   ✅ Loaded ${uiListData.characters.length} characters`);

  // 7. Item (아이템) - 일반 아이템만 (type != 7)
  const itemTable = loadTable('Item');
  if (itemTable && itemTable.Item) {
    for (const [key, item] of Object.entries(itemTable.Item)) {
      if (!item || !item.id || key.startsWith(':') || item.type === 7) {
        continue;
      }
      uiListData.items.push({
        id: item.id,
        name: item.name || `Item ${item.id}`,
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
      uiListData.questItems.push({
        id: item.id,
        name: item.name || `Quest Item ${item.id}`,
      });
    }
    uiListData.questItems.sort((a, b) => a.id - b.id);
    console.log(`   ✅ Loaded ${uiListData.questItems.length} quest items`);
  }

  // 9. Quest (퀘스트)
  uiListData.quests = extractList('Quest', 'quests', ['type', 'level']);
  console.log(`   ✅ Loaded ${uiListData.quests.length} quests`);

  // 10. Discovery (발견물)
  uiListData.discoveries = extractList('Discovery', 'discoveries', ['type', 'grade']);
  console.log(`   ✅ Loaded ${uiListData.discoveries.length} discoveries`);

  // 11. Job (직업)
  uiListData.jobs = extractList('Job', 'jobs', ['type']);
  console.log(`   ✅ Loaded ${uiListData.jobs.length} jobs`);

  // 12. TradeGoods (교역품)
  uiListData.tradeGoods = extractList('TradeGoods', 'tradeGoods', ['category', 'grade']);
  console.log(`   ✅ Loaded ${uiListData.tradeGoods.length} trade goods`);

  // 13. Recipe (레시피)
  uiListData.recipes = extractList('Recipe', 'recipes', ['type']);
  console.log(`   ✅ Loaded ${uiListData.recipes.length} recipes`);

  // 14. ShipBlueprint (선박 도면)
  uiListData.shipBlueprints = extractList('ShipBlueprint', 'shipBlueprints', ['shipId', 'grade']);
  console.log(`   ✅ Loaded ${uiListData.shipBlueprints.length} ship blueprints`);

  // 15. CEquip (캐릭터 장비)
  uiListData.cEquips = extractList('CEquip', 'cEquips', ['type', 'grade', 'job']);
  console.log(`   ✅ Loaded ${uiListData.cEquips.length} character equipments`);

  // 16. Point (포인트)
  uiListData.points = extractList('Point', 'points');
  console.log(`   ✅ Loaded ${uiListData.points.length} points`);

  // 17. UserTitle (칭호)
  uiListData.userTitles = extractList('UserTitle', 'userTitles', ['type']);
  console.log(`   ✅ Loaded ${uiListData.userTitles.length} user titles`);

  // 18. Achievement (업적)
  uiListData.achievements = extractList('Achievement', 'achievements', ['type', 'grade']);
  console.log(`   ✅ Loaded ${uiListData.achievements.length} achievements`);

  // 19. Collection (수집)
  uiListData.collections = extractList('Collection', 'collections', ['type']);
  console.log(`   ✅ Loaded ${uiListData.collections.length} collections`);

  // 20. BattleSkill (전투 스킬)
  uiListData.battleSkills = extractList('BattleSkill', 'battleSkills', ['type', 'grade']);
  console.log(`   ✅ Loaded ${uiListData.battleSkills.length} battle skills`);

  // 21. WorldSkill (월드 스킬)
  uiListData.worldSkills = extractList('WorldSkill', 'worldSkills', ['type']);
  console.log(`   ✅ Loaded ${uiListData.worldSkills.length} world skills`);

  // 22. BattleBuff (전투 버프)
  uiListData.battleBuffs = extractList('BattleBuff', 'battleBuffs', ['type']);
  console.log(`   ✅ Loaded ${uiListData.battleBuffs.length} battle buffs`);

  // 23. WorldBuff (월드 버프)
  uiListData.worldBuffs = extractList('WorldBuff', 'worldBuffs', ['type']);
  console.log(`   ✅ Loaded ${uiListData.worldBuffs.length} world buffs`);

  // 24. EventMission (이벤트 미션)
  uiListData.eventMissions = extractList('EventMission', 'eventMissions', ['type']);
  console.log(`   ✅ Loaded ${uiListData.eventMissions.length} event missions`);

  // 25. Mail (메일)
  uiListData.mails = extractList('Mail', 'mails', ['type']);
  console.log(`   ✅ Loaded ${uiListData.mails.length} mails`);

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

  // Build reward lookup tables
  if (buildRewards) {
    const lookupTable = buildRewardLookupTable(cmsDir);

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

  // Build UI list data
  if (buildUILists) {
    const uiListData = generateUIListData(cmsDir);

    const uiListFile = path.join(outputDir, 'ui-list-data.json');
    fs.writeFileSync(uiListFile, JSON.stringify(uiListData, null, 2), 'utf8');
    generatedFiles.push({ name: 'ui-list-data.json', description: 'UI list data (Nation/Town/Village)' });
  }

  // Build localization table
  if (buildLocalization) {
    const loctabSource = path.join(outputDir, 'loctab-source');
    const loctabOutput = path.join(outputDir, 'loctab');

    const loctab = convertLocalizationTable(loctabSource, loctabOutput);
    if (loctab) {
      generatedFiles.push({ name: 'loctab', description: 'Localization table (Korean → Chinese)' });
    }
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

