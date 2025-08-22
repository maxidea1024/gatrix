#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 번역 파일 경로
const LOCALES_DIR = 'packages/frontend/src/locales';
const FRONTEND_SRC = 'packages/frontend/src';

// 지원하는 언어
const LANGUAGES = ['en', 'ko', 'zh'];

/**
 * 코드에서 사용되는 모든 번역 키 추출
 */
function extractUsedKeys() {
  const usedKeys = new Set();
  
  // TypeScript/TSX 파일에서 t() 호출 찾기
  const files = glob.sync(`${FRONTEND_SRC}/**/*.{ts,tsx}`, {
    ignore: ['**/*.d.ts', '**/node_modules/**']
  });
  
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    
    // t('key') 패턴 찾기
    const matches = content.match(/t\(['"`]([^'"`]+)['"`]\)/g);
    if (matches) {
      matches.forEach(match => {
        const key = match.match(/t\(['"`]([^'"`]+)['"`]\)/)[1];
        usedKeys.add(key);
      });
    }
  });
  
  return Array.from(usedKeys).sort();
}

/**
 * 번역 파일에서 정의된 키들 추출
 */
function extractDefinedKeys(lang) {
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  
  if (!fs.existsSync(filePath)) {
    console.error(`Translation file not found: ${filePath}`);
    return [];
  }
  
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const keys = [];
  
  function extractKeys(obj, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'object' && value !== null) {
        extractKeys(value, fullKey);
      } else {
        keys.push(fullKey);
      }
    }
  }
  
  extractKeys(content);
  return keys.sort();
}

/**
 * 메인 검증 함수
 */
function checkTranslations() {
  console.log('🔍 번역 키 검증을 시작합니다...\n');
  
  // 사용되는 키들 추출
  const usedKeys = extractUsedKeys();
  console.log(`📝 코드에서 사용되는 번역 키: ${usedKeys.length}개`);
  
  // 각 언어별 정의된 키들 추출
  const definedKeys = {};
  LANGUAGES.forEach(lang => {
    definedKeys[lang] = extractDefinedKeys(lang);
    console.log(`🌐 ${lang}.json에 정의된 키: ${definedKeys[lang].length}개`);
  });
  
  console.log('\n' + '='.repeat(50));
  
  // 누락된 키 찾기
  let hasErrors = false;
  
  LANGUAGES.forEach(lang => {
    const missing = usedKeys.filter(key => !definedKeys[lang].includes(key));
    
    if (missing.length > 0) {
      hasErrors = true;
      console.log(`\n❌ ${lang}.json에서 누락된 키들:`);
      missing.forEach(key => console.log(`   - ${key}`));
    } else {
      console.log(`\n✅ ${lang}.json: 모든 키가 정의되어 있습니다.`);
    }
  });
  
  // 사용되지 않는 키 찾기
  LANGUAGES.forEach(lang => {
    const unused = definedKeys[lang].filter(key => !usedKeys.includes(key));
    
    if (unused.length > 0) {
      console.log(`\n⚠️  ${lang}.json에서 사용되지 않는 키들:`);
      unused.forEach(key => console.log(`   - ${key}`));
    }
  });
  
  // 언어간 일관성 확인
  console.log('\n' + '='.repeat(50));
  console.log('\n🔄 언어간 일관성 확인:');
  
  const baseKeys = definedKeys[LANGUAGES[0]];
  LANGUAGES.slice(1).forEach(lang => {
    const currentKeys = definedKeys[lang];
    const missingInCurrent = baseKeys.filter(key => !currentKeys.includes(key));
    const extraInCurrent = currentKeys.filter(key => !baseKeys.includes(key));
    
    if (missingInCurrent.length > 0) {
      hasErrors = true;
      console.log(`\n❌ ${lang}.json에서 ${LANGUAGES[0]}.json 대비 누락된 키들:`);
      missingInCurrent.forEach(key => console.log(`   - ${key}`));
    }
    
    if (extraInCurrent.length > 0) {
      console.log(`\n⚠️  ${lang}.json에서 ${LANGUAGES[0]}.json 대비 추가된 키들:`);
      extraInCurrent.forEach(key => console.log(`   - ${key}`));
    }
    
    if (missingInCurrent.length === 0 && extraInCurrent.length === 0) {
      console.log(`\n✅ ${lang}.json: ${LANGUAGES[0]}.json과 일관성이 유지됩니다.`);
    }
  });
  
  console.log('\n' + '='.repeat(50));
  
  if (hasErrors) {
    console.log('\n❌ 번역 키 검증에서 오류가 발견되었습니다.');
    process.exit(1);
  } else {
    console.log('\n✅ 모든 번역 키가 올바르게 정의되어 있습니다!');
  }
}

// 스크립트 실행
if (require.main === module) {
  checkTranslations();
}

module.exports = { checkTranslations, extractUsedKeys, extractDefinedKeys };
