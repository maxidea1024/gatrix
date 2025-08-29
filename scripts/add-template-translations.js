#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = 'packages/frontend/src/locales';

// Missing translations for message templates
const templateTranslations = {
  en: {
    'common.languages': 'Languages',
    'common.creator': 'Creator',
    'admin.maintenanceTemplates.onlyDefaultMessage': 'Only default message'
  },
  ko: {
    'common.languages': '언어',
    'common.creator': '생성자',
    'admin.maintenanceTemplates.onlyDefaultMessage': '기본 메시지만'
  },
  zh: {
    'common.languages': '语言',
    'common.creator': '创建者',
    'admin.maintenanceTemplates.onlyDefaultMessage': '仅默认消息'
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

function addTemplateTranslations() {
  Object.entries(templateTranslations).forEach(([lang, translations]) => {
    console.log(`\n🔧 Adding template translations to ${lang}.json...`);
    
    const filePath = path.join(LOCALES_DIR, `${lang}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    let added = 0;
    Object.entries(translations).forEach(([key, value]) => {
      setNestedValue(data, key, value);
      console.log(`  ✅ Added: ${key} = "${value}"`);
      added++;
    });
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    console.log(`  📝 Updated ${added} keys in ${lang}.json`);
  });
}

if (require.main === module) {
  addTemplateTranslations();
  console.log('\n✅ All template translations have been added!');
}

module.exports = { addTemplateTranslations };
