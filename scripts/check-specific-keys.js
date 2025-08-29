#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = 'packages/frontend/src/locales';

const keysToCheck = [
  'admin.dashboard.title',
  'admin.users.title', 
  'clientVersions.title',
  'admin.gameWorlds.title',
  'admin.maintenance.title',
  'admin.maintenanceTemplates.title',
  'admin.scheduler.title',
  'admin.scheduler.settings',
  'admin.whitelist.title',
  'navigation.auditLogs'
];

function getValue(obj, keyPath) {
  const parts = keyPath.split('.');
  let value = obj;
  for (const part of parts) {
    value = value?.[part];
  }
  return value;
}

function checkKeys() {
  const langs = ['en', 'ko', 'zh'];
  
  langs.forEach(lang => {
    console.log(`\n=== ${lang.toUpperCase()} ===`);
    
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
    } catch (error) {
      console.log(`❌ Error reading ${lang}.json:`, error.message);
    }
  });
}

if (require.main === module) {
  checkKeys();
}

module.exports = { checkKeys };
