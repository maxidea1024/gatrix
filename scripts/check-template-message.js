#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = 'packages/frontend/src/locales';

function checkTemplateMessage() {
  const langs = ['en', 'ko', 'zh'];
  
  console.log('🔍 Checking onlyDefaultMessage translations...\n');
  
  langs.forEach(lang => {
    try {
      const filePath = path.join(LOCALES_DIR, `${lang}.json`);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      const message = data.admin?.maintenanceTemplates?.onlyDefaultMessage;
      console.log(`${lang.toUpperCase()}: "${message}"`);
      
    } catch (error) {
      console.log(`❌ Error reading ${lang}.json:`, error.message);
    }
  });
  
  console.log('\n✅ Check completed!');
}

if (require.main === module) {
  checkTemplateMessage();
}

module.exports = { checkTemplateMessage };
