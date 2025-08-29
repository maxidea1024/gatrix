#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = 'packages/frontend/src/locales';

function findEnglishValues(obj, prefix = '') {
  const issues = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string' && /^[A-Za-z]/.test(v) && v.length > 1 && !/^(OK|API|URL|ID|UUID)$/.test(v)) {
      issues.push({ key, value: v });
    } else if (typeof v === 'object' && v) {
      issues.push(...findEnglishValues(v, key));
    }
  }
  return issues;
}

function main() {
  const ko = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'ko.json'), 'utf8'));
  const zh = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'zh.json'), 'utf8'));
  
  const koIssues = findEnglishValues(ko);
  const zhIssues = findEnglishValues(zh);
  
  console.log(`Remaining Korean issues: ${koIssues.length}`);
  console.log(`Remaining Chinese issues: ${zhIssues.length}`);
  
  if (koIssues.length > 0) {
    console.log('\nTop 20 Korean issues:');
    koIssues.slice(0, 20).forEach(i => {
      console.log(`  "${i.key}": "${i.value}"`);
    });
  }
  
  if (zhIssues.length > 0) {
    console.log('\nTop 20 Chinese issues:');
    zhIssues.slice(0, 20).forEach(i => {
      console.log(`  "${i.key}": "${i.value}"`);
    });
  }
}

if (require.main === module) {
  main();
}
