#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = 'packages/frontend/src/locales';

// Test specific audit actions that are commonly used
const testActions = [
  'user_login',
  'user_register', 
  'user_update',
  'user_delete',
  'whitelist_create',
  'game_world_update',
  'client_version_create'
];

const testResources = [
  'user',
  'whitelist',
  'client_version',
  'game_world'
];

function testTranslations() {
  const langs = ['en', 'ko', 'zh'];
  
  console.log('🧪 Testing audit log translations...\n');
  
  langs.forEach(lang => {
    console.log(`=== ${lang.toUpperCase()} ===`);
    
    try {
      const filePath = path.join(LOCALES_DIR, `${lang}.json`);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      console.log('📋 Actions:');
      testActions.forEach(action => {
        const translation = data.auditLogs?.actions?.[action];
        if (translation) {
          console.log(`  ✅ ${action}: "${translation}"`);
        } else {
          console.log(`  ❌ ${action}: MISSING`);
        }
      });
      
      console.log('\n📦 Resources:');
      testResources.forEach(resource => {
        const translation = data.auditLogs?.resources?.[resource];
        if (translation) {
          console.log(`  ✅ ${resource}: "${translation}"`);
        } else {
          console.log(`  ❌ ${resource}: MISSING`);
        }
      });
      
      console.log('');
      
    } catch (error) {
      console.log(`❌ Error reading ${lang}.json:`, error.message);
    }
  });
  
  console.log('✅ Audit log translation test completed!');
}

if (require.main === module) {
  testTranslations();
}

module.exports = { testTranslations };
