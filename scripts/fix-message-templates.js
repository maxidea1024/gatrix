#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = 'packages/frontend/src/locales';

// Correct translations for message templates (not maintenance-specific)
const messageTemplateTranslations = {
  en: {
    'admin.messageTemplates.title': 'Message Templates',
    'admin.messageTemplates.onlyDefaultMessage': 'Default message only'
  },
  ko: {
    'admin.messageTemplates.title': '메시지 템플릿 관리',
    'admin.messageTemplates.onlyDefaultMessage': '기본 메시지 사용'
  },
  zh: {
    'admin.messageTemplates.title': '消息模板管理',
    'admin.messageTemplates.onlyDefaultMessage': '使用默认消息'
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

function fixMessageTemplates() {
  Object.entries(messageTemplateTranslations).forEach(([lang, translations]) => {
    console.log(`\n🔧 Fixing message template translations in ${lang}.json...`);
    
    const filePath = path.join(LOCALES_DIR, `${lang}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    let added = 0;
    Object.entries(translations).forEach(([key, value]) => {
      setNestedValue(data, key, value);
      console.log(`  ✅ Set: ${key} = "${value}"`);
      added++;
    });
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    console.log(`  📝 Updated ${added} keys in ${lang}.json`);
  });
}

if (require.main === module) {
  fixMessageTemplates();
  console.log('\n✅ Message template translations have been fixed!');
}

module.exports = { fixMessageTemplates };
