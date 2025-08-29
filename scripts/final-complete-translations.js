#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = 'packages/frontend/src/locales';

// Complete Korean translations for ALL remaining English keys
const koTranslations = {
  // Game worlds - all missing translations
  "gameWorlds.actions": "작업",
  "gameWorlds.active": "활성",
  "gameWorlds.activeWorlds": "활성 월드",
  "gameWorlds.addGameWorld": "게임 월드 추가",
  "gameWorlds.cancel": "취소",
  "gameWorlds.confirm": "확인",
  "gameWorlds.created": "생성됨",
  "gameWorlds.deleteGameWorld": "게임 월드 삭제",
  "gameWorlds.description": "설명",
  "gameWorlds.editGameWorld": "게임 월드 편집",
  "gameWorlds.endMaintenance": "점검 종료",
  "gameWorlds.hidden": "숨김",
  "gameWorlds.hiddenWorlds": "숨겨진 월드",
  "gameWorlds.hideGameWorld": "게임 월드 숨기기",
  "gameWorlds.loading": "로딩 중",
  "gameWorlds.maintenance": "점검",
  "gameWorlds.maintenanceToggled": "점검 모드 전환됨",
  "gameWorlds.maintenanceWorlds": "점검 중인 월드",
  "gameWorlds.name": "이름",
  "gameWorlds.noWorldsFound": "게임 월드를 찾을 수 없습니다",
  "gameWorlds.save": "저장",
  "gameWorlds.searchPlaceholder": "게임 월드 검색",
  "gameWorlds.showGameWorld": "게임 월드 표시",
  "gameWorlds.startMaintenance": "점검 시작",
  "gameWorlds.tags": "태그",
  "gameWorlds.totalWorlds": "총 월드 수",
  "gameWorlds.underMaintenance": "점검 중",
  "gameWorlds.visibilityToggled": "표시 상태 전환됨",
  "gameWorlds.visibleToUsers": "사용자에게 표시",
  "gameWorlds.worldCreated": "월드가 생성되었습니다",
  "gameWorlds.worldDeleted": "월드가 삭제되었습니다",
  "gameWorlds.worldId": "월드 ID",
  "gameWorlds.worldUpdated": "월드가 업데이트되었습니다",

  // Navigation
  "navigation.administration": "관리",
  "navigation.auditLogs": "감사 로그",
  "navigation.dashboard": "대시보드",
  "navigation.logout": "로그아웃",
  "navigation.profile": "프로필",
  "navigation.settings": "설정",
  "navigation.systemStats": "시스템 통계",
  "navigation.userManagement": "사용자 관리",

  // Not found
  "notFound.backToDashboard": "대시보드로 돌아가기",
  "notFound.backToHome": "홈으로 돌아가기",
  "notFound.causeIncorrectUrl": "잘못된 URL",
  "notFound.causePageMoved": "페이지 이동",
  "notFound.causePageRemoved": "페이지 삭제",
  "notFound.causePermissionDenied": "권한 거부",
  "notFound.causeServerError": "서버 오류",
  "notFound.causeTemporaryUnavailable": "일시적 사용 불가",
  "notFound.description": "요청하신 페이지를 찾을 수 없습니다",
  "notFound.possibleCauses": "가능한 원인",
  "notFound.suggestions": "제안사항",
  "notFound.title": "페이지를 찾을 수 없습니다",

  // Pending approval
  "pendingApproval.checkBackLater": "나중에 다시 확인해주세요",
  "pendingApproval.contactAdmin": "관리자에게 문의하세요",
  "pendingApproval.description": "계정 승인을 기다리고 있습니다",

  // Profile
  "profile.accountInfo": "계정 정보",
  "profile.accountSettings": "계정 설정",
  "profile.changePassword": "비밀번호 변경",
  "profile.confirmPassword": "비밀번호 확인",
  "profile.currentPassword": "현재 비밀번호",
  "profile.emailVerified": "이메일 인증됨",
  "profile.lastLogin": "마지막 로그인",
  "profile.newPassword": "새 비밀번호",
  "profile.personalInfo": "개인 정보",
  "profile.securitySettings": "보안 설정",
  "profile.title": "프로필",
  "profile.updateProfile": "프로필 업데이트",

  // Settings
  "settings.appearance": "외관",
  "settings.general": "일반",
  "settings.general.title": "일반 설정",
  "settings.integrations": "통합",
  "settings.integrations.title": "통합 설정",
  "settings.network": "네트워크",
  "settings.network.title": "네트워크 설정",
  "settings.notifications": "알림",
  "settings.privacy": "개인정보",
  "settings.security": "보안",
  "settings.title": "설정",

  // Sign up prompt
  "signUpPrompt.description": "계정이 필요합니다",

  // Status
  "status.active": "활성",
  "status.inactive": "비활성",
  "status.pending": "대기 중",

  // Tags
  "tags.addTag": "태그 추가",
  "tags.createTag": "태그 생성",
  "tags.deleteTag": "태그 삭제",
  "tags.editTag": "태그 편집",
  "tags.noTags": "태그 없음",
  "tags.removeTag": "태그 제거",
  "tags.tagCreated": "태그가 생성되었습니다",
  "tags.tagDeleted": "태그가 삭제되었습니다",
  "tags.tagUpdated": "태그가 업데이트되었습니다",

  // Whitelist
  "whitelist.addEntry": "항목 추가",
  "whitelist.bulkAdd": "일괄 추가",
  "whitelist.bulkDelete": "일괄 삭제",
  "whitelist.columns.actions": "작업",
  "whitelist.columns.createdAt": "생성일",
  "whitelist.columns.description": "설명",
  "whitelist.columns.name": "이름",
  "whitelist.columns.updatedAt": "수정일",
  "whitelist.createEntry": "항목 생성",
  "whitelist.deleteEntry": "항목 삭제",
  "whitelist.dialog.bulkAddTitle": "일괄 추가",
  "whitelist.dialog.createTitle": "새 항목 생성",
  "whitelist.dialog.editTitle": "항목 편집",
  "whitelist.editEntry": "항목 편집",
  "whitelist.entryCreated": "항목이 생성되었습니다",
  "whitelist.entryDeleted": "항목이 삭제되었습니다",
  "whitelist.entryUpdated": "항목이 업데이트되었습니다",
  "whitelist.form.description": "설명",
  "whitelist.form.descriptionHelp": "항목에 대한 설명을 입력하세요",
  "whitelist.form.ipAddress": "IP 주소",
  "whitelist.form.ipAddressHelp": "IP 주소를 입력하세요",
  "whitelist.form.name": "이름",
  "whitelist.form.nameHelp": "항목 이름을 입력하세요",
  "whitelist.loadFailed": "화이트리스트 로드 실패",
  "whitelist.noEntries": "화이트리스트 항목이 없습니다",
  "whitelist.searchPlaceholder": "이름 또는 IP 주소로 검색",
  "whitelist.title": "화이트리스트",

  // Dashboard additional
  "dashboard.allCaughtUp": "모든 작업 완료",
  "dashboard.emailVerified": "이메일 인증됨",
  "dashboard.lastLogin": "마지막 로그인",
  "dashboard.never": "없음",
  "dashboard.operational": "정상 운영",
  "dashboard.profileManagement": "프로필 관리",
  "dashboard.profileManagementDesc": "개인 정보 및 계정 설정을 관리하세요",
  "dashboard.requiresAttention": "주의 필요",
  "dashboard.role": "역할",
  "dashboard.status": "상태",
  "dashboard.systemStatus": "시스템 상태",
  "dashboard.totalUsers": "총 사용자 수",
  "dashboard.unknown": "알 수 없음",

  // Navigation additional
  "navigation.users": "사용자",

  // Not found additional
  "notFound.causeBrokenLink": "깨진 링크",
  "notFound.causeMovedOrDeleted": "이동되거나 삭제된 페이지",
  "notFound.causeNoPermission": "권한 없음",
  "notFound.footer": "도움이 필요하시면 지원팀에 문의하세요",
  "notFound.subtitle": "404 오류",

  // Profile additional
  "profile.avatarUploadFailed": "아바타 업로드 실패",
  "profile.avatarUploaded": "아바타가 업로드되었습니다",
  "profile.fileTooLarge": "파일이 너무 큽니다",
  "profile.invalidFileType": "유효하지 않은 파일 형식",
  "profile.name": "이름",
  "profile.nameRequired": "이름이 필요합니다",
  "profile.profileUpdated": "프로필이 업데이트되었습니다",
  "profile.updateFailed": "업데이트 실패",

  // Settings additional
  "settings.subtitle": "시스템 설정 및 환경설정",

  // Sidebar
  "sidebar.adminPanel": "관리자 패널",
  "sidebar.auditLogs": "감사 로그",
  "sidebar.clientVersions": "클라이언트 버전",
  "sidebar.collapse": "접기",
  "sidebar.dashboard": "대시보드",
  "sidebar.expand": "펼치기",
  "sidebar.gameWorlds": "게임 월드",
  "sidebar.maintenance": "점검 관리",
  "sidebar.maintenanceTemplates": "점검 템플릿",
  "sidebar.scheduler": "스케줄러",
  "sidebar.settings": "설정",
  "sidebar.systemStats": "시스템 통계",
  "sidebar.userManagement": "사용자 관리",
  "sidebar.users": "사용자",
  "sidebar.whitelist": "화이트리스트",

  // Additional missing keys
  "theme.auto": "자동",
  "theme.dark": "어두운 테마",
  "theme.light": "밝은 테마"
};

// Complete Chinese translations for remaining English keys
const zhTranslations = {
  // Whitelist
  "whitelist.dialog.bulkPlaceholder": "张三  192.168.1.100   VIP用户\n李四               普通用户\n管理员       10.0.0.1        管理员"
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
  console.log('🌐 Applying final complete translations...\n');
  
  applyTranslations('ko', koTranslations);
  applyTranslations('zh', zhTranslations);
  
  console.log('\n✅ Final complete translation update finished!');
}

if (require.main === module) {
  main();
}

module.exports = { applyTranslations, koTranslations, zhTranslations };
