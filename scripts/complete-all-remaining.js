#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = 'packages/frontend/src/locales';

// Complete ALL remaining Korean translations
const koTranslations = {
  // Sidebar
  "sidebar.logout": "로그아웃",
  "sidebar.navigation": "네비게이션",
  "sidebar.profile": "프로필",
  "sidebar.settingsPanel": "설정 패널",

  // Users
  "users.addUser": "사용자 추가",
  "users.createError": "생성 오류",
  "users.deleteError": "삭제 오류",
  "users.email": "이메일",
  "users.joinDate": "가입일",
  "users.lastLogin": "마지막 로그인",
  "users.name": "이름",
  "users.password": "비밀번호",
  "users.status": "상태",
  "users.user": "사용자",
  "users.userDeleted": "사용자가 삭제되었습니다",

  // Whitelist - all remaining
  "whitelist.anyIp": "모든 IP",
  "whitelist.bulkImport": "일괄 가져오기",
  "whitelist.columns.allowPeriod": "허용 기간",
  "whitelist.columns.createdBy": "생성자",
  "whitelist.columns.id": "ID",
  "whitelist.columns.memo": "메모",
  "whitelist.columns.nickname": "닉네임",
  "whitelist.dialog.addTitle": "항목 추가",
  "whitelist.dialog.bulkHint1": "각 줄에 하나씩 입력하세요",
  "whitelist.dialog.bulkHint2": "형식: 닉네임 [IP주소] [메모]",
  "whitelist.dialog.bulkTitle": "일괄 추가",
  "whitelist.dialog.deleteTitle": "항목 삭제",
  "whitelist.dialog.import": "가져오기",
  "whitelist.errors.bulkCreateFailed": "일괄 생성 실패",
  "whitelist.errors.deleteFailed": "삭제 실패",
  "whitelist.errors.loadFailed": "로드 실패",
  "whitelist.errors.noValidEntries": "유효한 항목이 없습니다",
  "whitelist.errors.saveFailed": "저장 실패",
  "whitelist.form.anyIpPlaceholder": "모든 IP 허용",
  "whitelist.form.endDateOpt": "종료일 (선택사항)",
  "whitelist.form.memoOpt": "메모 (선택사항)",
  "whitelist.form.memoPlaceholder": "메모를 입력하세요",
  "whitelist.form.nickname": "닉네임",
  "whitelist.form.startDateOpt": "시작일 (선택사항)",
  "whitelist.permanent": "영구",
  "whitelist.subtitle": "IP 주소 화이트리스트 관리",
  "whitelist.toast.created": "생성됨",
  "whitelist.toast.deleted": "삭제됨",
  "whitelist.toast.updated": "업데이트됨",

  // Missing settings keys
  "settings.integrations.genericWebhook": "일반 웹훅",
  "settings.integrations.genericWebhookHelp": "일반 웹훅 URL을 입력하세요",
  "settings.integrations.slackWebhook": "Slack 웹훅",
  "settings.integrations.slackWebhookHelp": "Slack 웹훅 URL을 입력하세요",
  "settings.network.admindUrl": "Admind URL",
  "settings.network.admindUrlHelp": "Admind 연결 주소를 입력하세요",

  // Theme
  "theme": "테마"
};

// Complete remaining Chinese translations
const zhTranslations = {
  // Fix remaining Chinese issues
  "clientVersions.exportSuccess": "CSV文件导出成功",
  "settings.integrations.slackWebhook": "Slack Webhook URL",
  "settings.network.admindUrl": "Admind 连接地址",
  "slackWebhookUrl": "Slack Webhook URL"
};

function applyTranslations(lang, translations) {
  const filePath = path.join(LOCALES_DIR, `${lang}.json`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  
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
  
  let updated = 0;
  for (const [key, value] of Object.entries(translations)) {
    setNestedValue(data, key, value);
    updated++;
  }
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
  console.log(`Updated ${updated} translations in ${lang}.json`);
}

function main() {
  console.log('🌐 Completing ALL remaining translations...\n');
  
  applyTranslations('ko', koTranslations);
  applyTranslations('zh', zhTranslations);
  
  console.log('\n✅ ALL translations completed!');
}

if (require.main === module) {
  main();
}

module.exports = { applyTranslations, koTranslations, zhTranslations };
