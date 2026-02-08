/**
 * Find missing keys in en.json and zh.json compared to ko.json
 * and add them with translated values
 */

const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../packages/frontend/src/locales');

const koJson = JSON.parse(fs.readFileSync(path.join(localesDir, 'ko.json'), 'utf8'));
const enJson = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
const zhJson = JSON.parse(fs.readFileSync(path.join(localesDir, 'zh.json'), 'utf8'));

// Translations for missing keys
const translations = {
  en: {
    'changeRequest.rejectionInfo': 'Rejection Info',
    'changeRequest.rejectedBy': 'Rejected By',
    'changeRequest.rejectedAt': 'Rejected At',
    'changeRequest.rejectionReason': 'Rejection Reason',
    'changeRequest.reopenDialog.title': 'Reopen Change Request',
    'changeRequest.reopenDialog.description': 'Reopen this request to modify and resubmit?',
    'changeRequests.createdForReview': 'Change request created. Will be applied after approval.',
    'changeRequests.pendingReviewBanner':
      '{{count}} change request(s) pending review. Click to review.',
  },
  zh: {
    'changeRequest.rejectionInfo': '拒绝信息',
    'changeRequest.rejectedBy': '拒绝人',
    'changeRequest.rejectedAt': '拒绝时间',
    'changeRequest.rejectionReason': '拒绝原因',
    'changeRequest.reopenDialog.title': '重新打开变更请求',
    'changeRequest.reopenDialog.description': '重新打开以修改并重新提交？',
    'changeRequests.createdForReview': '变更请求已创建，批准后将应用。',
    'changeRequests.pendingReviewBanner': '有 {{count}} 个变更请求待审核。点击查看。',
  },
};

function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((o, k) => (o || {})[k], obj);
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

const koKeys = getAllKeys(koJson);
const enKeys = getAllKeys(enJson);
const zhKeys = getAllKeys(zhJson);

const missingInEn = koKeys.filter((k) => !enKeys.includes(k));
const missingInZh = koKeys.filter((k) => !zhKeys.includes(k));

console.log('Missing in en.json:', missingInEn.length, 'keys');
console.log('Missing in zh.json:', missingInZh.length, 'keys');

// Add missing keys to en.json
for (const key of missingInEn) {
  const koValue = getNestedValue(koJson, key);
  const enValue = translations.en[key] || koValue; // Use translation or fallback to Korean
  setNestedValue(enJson, key, enValue);
  console.log(`[EN] Added: ${key}`);
}

// Add missing keys to zh.json
for (const key of missingInZh) {
  const koValue = getNestedValue(koJson, key);
  const zhValue = translations.zh[key] || koValue; // Use translation or fallback to Korean
  setNestedValue(zhJson, key, zhValue);
  console.log(`[ZH] Added: ${key}`);
}

// Save updated files
fs.writeFileSync(path.join(localesDir, 'en.json'), JSON.stringify(enJson, null, 2), 'utf8');
fs.writeFileSync(path.join(localesDir, 'zh.json'), JSON.stringify(zhJson, null, 2), 'utf8');

console.log('\nDone! Updated en.json and zh.json');
