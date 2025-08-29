#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = 'packages/frontend/src/locales';

function verifyAuditActions() {
  const langs = ['en', 'ko', 'zh'];
  
  langs.forEach(lang => {
    console.log(`\n=== ${lang.toUpperCase()} ===`);
    
    try {
      const filePath = path.join(LOCALES_DIR, `${lang}.json`);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      console.log('auditLogs.actions exists:', !!data.auditLogs?.actions);
      console.log('Actions count:', Object.keys(data.auditLogs?.actions || {}).length);
      console.log('Resources count:', Object.keys(data.auditLogs?.resources || {}).length);
      
      console.log('\nSample actions:');
      Object.entries(data.auditLogs?.actions || {}).slice(0, 5).forEach(([k, v]) => {
        console.log(`  ${k}: ${v}`);
      });
      
      console.log('\nResources:');
      Object.entries(data.auditLogs?.resources || {}).forEach(([k, v]) => {
        console.log(`  ${k}: ${v}`);
      });
      
    } catch (error) {
      console.log(`❌ Error reading ${lang}.json:`, error.message);
    }
  });
}

if (require.main === module) {
  verifyAuditActions();
}

module.exports = { verifyAuditActions };
