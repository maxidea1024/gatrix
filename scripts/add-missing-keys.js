#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = 'packages/frontend/src/locales';

// Missing keys to add
const missingKeys = {
  en: {
    'admin.gameWorlds.title': 'Game Worlds',
    'admin.scheduler.settings': 'Scheduler Settings', 
    'admin.whitelist.title': 'Whitelist Management'
  },
  ko: {
    'admin.gameWorlds.title': '게임 월드',
    'admin.scheduler.settings': '스케줄러 설정',
    'admin.whitelist.title': '화이트리스트 관리'
  },
  zh: {
    'admin.gameWorlds.title': '游戏世界',
    'admin.scheduler.settings': '调度器设置',
    'admin.whitelist.title': '白名单管理'
  }
};

function setNestedValue(obj, keyPath, value) {
  const keys = keyPath.split('.');
  let current = obj;
  
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key];
  }
  
  current[keys[keys.length - 1]] = value;
}

function addMissingKeys() {
  Object.entries(missingKeys).forEach(([lang, keys]) => {
    console.log(`\n🔧 Adding missing keys to ${lang}.json...`);
    
    const filePath = path.join(LOCALES_DIR, `${lang}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    let added = 0;
    Object.entries(keys).forEach(([key, value]) => {
      setNestedValue(data, key, value);
      console.log(`  ✅ Added: ${key} = "${value}"`);
      added++;
    });
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    console.log(`  📝 Updated ${added} keys in ${lang}.json`);
  });
}

if (require.main === module) {
  addMissingKeys();
  console.log('\n✅ All missing keys have been added!');
}

module.exports = { addMissingKeys };
