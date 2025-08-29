#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = 'packages/frontend/src/locales';

const keysToCheck = [
  'admin.messageTemplates.title',
  'admin.messageTemplates.onlyDefaultMessage'
];

function getValue(obj, keyPath) {
  const parts = keyPath.split('.');
  let value = obj;
  for (const part of parts) {
    value = value?.[part];
  }
  return value;
}

function verifyMessageTemplates() {
  const langs = ['en', 'ko', 'zh'];
  
  console.log('🧪 Verifying message template translations...\n');
  
  langs.forEach(lang => {
    console.log(`=== ${lang.toUpperCase()} ===`);
    
    try {
      const filePath = path.join(LOCALES_DIR, `${lang}.json`);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      keysToCheck.forEach(key => {
        const value = getValue(data, key);
        if (value) {
          console.log(`✅ ${key}: "${value}"`);
        } else {
          console.log(`❌ ${key}: MISSING`);
        }
      });
      
      console.log('');
      
    } catch (error) {
      console.log(`❌ Error reading ${lang}.json:`, error.message);
    }
  });
  
  console.log('✅ Message template verification completed!');
}

if (require.main === module) {
  verifyMessageTemplates();
}

module.exports = { verifyMessageTemplates };
