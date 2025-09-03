#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = 'packages/frontend/src/locales';

// Missing user action translations
const translations = {
  ko: {
    // User promotion/demotion
    'common.promoteUser': '사용자 승격',
    'common.demoteUser': '사용자 강등',
    'common.promoteUserConfirm': '{{name}} 사용자를 관리자로 승격하시겠습니까?',
    'common.demoteUserConfirm': '{{name}} 사용자를 일반 사용자로 강등하시겠습니까?',
    'common.userPromoted': '사용자가 관리자로 승격되었습니다',
    'common.userDemoted': '사용자가 일반 사용자로 강등되었습니다',
    'common.userPromoteFailed': '사용자 승격에 실패했습니다',
    'common.userDemoteFailed': '사용자 강등에 실패했습니다',
    'common.promoteToAdmin': '관리자로 승격',
    'common.demoteFromAdmin': '관리자에서 강등',
    
    // Additional common actions
    'common.suspend': '정지',
    'common.activate': '활성화',
    'common.suspended': '정지됨'
  },
  en: {
    // User promotion/demotion
    'common.promoteUser': 'Promote User',
    'common.demoteUser': 'Demote User',
    'common.promoteUserConfirm': 'Are you sure you want to promote {{name}} to admin?',
    'common.demoteUserConfirm': 'Are you sure you want to demote {{name}} from admin?',
    'common.userPromoted': 'User has been promoted to admin',
    'common.userDemoted': 'User has been demoted from admin',
    'common.userPromoteFailed': 'Failed to promote user',
    'common.userDemoteFailed': 'Failed to demote user',
    'common.promoteToAdmin': 'Promote to Admin',
    'common.demoteFromAdmin': 'Demote from Admin',
    
    // Additional common actions
    'common.suspend': 'Suspend',
    'common.activate': 'Activate',
    'common.suspended': 'Suspended'
  },
  zh: {
    // User promotion/demotion
    'common.promoteUser': '提升用户',
    'common.demoteUser': '降级用户',
    'common.promoteUserConfirm': '确定要将 {{name}} 提升为管理员吗？',
    'common.demoteUserConfirm': '确定要将 {{name}} 从管理员降级吗？',
    'common.userPromoted': '用户已提升为管理员',
    'common.userDemoted': '用户已从管理员降级',
    'common.userPromoteFailed': '提升用户失败',
    'common.userDemoteFailed': '降级用户失败',
    'common.promoteToAdmin': '提升为管理员',
    'common.demoteFromAdmin': '从管理员降级',
    
    // Additional common actions
    'common.suspend': '暂停',
    'common.activate': '激活',
    'common.suspended': '已暂停'
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

function applyTranslations(lang, langTranslations) {
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`File ${filePath} does not exist, skipping...`);
    return;
  }
  
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
  let updated = 0;
  for (const [key, value] of Object.entries(langTranslations)) {
    setNestedValue(data, key, value);
    updated++;
  }
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`✅ Updated ${updated} translations in ${lang}.json`);
}

// Apply translations for all languages
console.log('🌐 Adding user action translations...\n');

for (const [lang, langTranslations] of Object.entries(translations)) {
  applyTranslations(lang, langTranslations);
}

console.log('\n🎉 All user action translations have been added!');
