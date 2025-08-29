#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = 'packages/frontend/src/locales';

// Comprehensive Korean translations for all missing keys
const koTranslations = {
  // Single character keys
  "T": "T",
  "_": " ",
  "a": "a",

  // Client versions - missing translations
  "clientVersions.bulkStatusTitle": "상태 일괄 변경",
  "clientVersions.changeStatus": "상태 변경",
  "clientVersions.copySuccess": "복사 성공",
  "clientVersions.copyVersion": "버전 복사",
  "clientVersions.customPayload": "사용자 정의 페이로드",
  "clientVersions.deleteConfirmTitle": "삭제 확인",
  "clientVersions.exportSuccess": "내보내기 성공",
  "clientVersions.externalClickLink": "외부 클릭 링크",
  "clientVersions.form.additionalSettings": "추가 설정",
  "clientVersions.form.basicInfo": "기본 정보",
  "clientVersions.form.copyTitle": "복사 제목",
  "clientVersions.form.customPayloadHelp": "사용자 정의 페이로드를 입력하세요",
  "clientVersions.form.editTitle": "편집 제목",
  "clientVersions.form.externalClickLinkHelp": "외부 클릭 링크를 입력하세요",
  "clientVersions.form.gameServerAddressForWhiteListHelp": "화이트리스트용 게임 서버 주소를 입력하세요",
  "clientVersions.form.gameServerAddressHelp": "게임 서버 주소를 입력하세요",
  "clientVersions.form.gameServerRequired": "게임 서버가 필요합니다",
  "clientVersions.form.guestModeAllowedHelp": "게스트 모드 허용 여부를 선택하세요",
  "clientVersions.form.memoHelp": "메모를 입력하세요",
  "clientVersions.form.patchAddressForWhiteListHelp": "화이트리스트용 패치 주소를 입력하세요",
  "clientVersions.form.patchAddressHelp": "패치 주소를 입력하세요",
  "clientVersions.form.patchAddressRequired": "패치 주소가 필요합니다",
  "clientVersions.form.platformHelp": "플랫폼을 선택하세요",
  "clientVersions.form.platformRequired": "플랫폼이 필요합니다",
  "clientVersions.form.serverAddresses": "서버 주소",
  "clientVersions.form.statusHelp": "상태를 선택하세요",
  "clientVersions.form.title": "제목",
  "clientVersions.form.versionInvalid": "유효하지 않은 버전",
  "clientVersions.form.versionRequired": "버전이 필요합니다",
  "clientVersions.gameServer": "게임 서버",
  "clientVersions.gameServerAddress": "게임 서버 주소",
  "clientVersions.gameServerAddressForWhiteList": "화이트리스트용 게임 서버 주소",
  "clientVersions.guestMode": "게스트 모드",
  "clientVersions.guestModeAllowed": "게스트 모드 허용",
  "clientVersions.memo": "메모",
  "clientVersions.patchAddress": "패치 주소",
  "clientVersions.patchAddressForWhiteList": "화이트리스트용 패치 주소",
  "clientVersions.platform": "플랫폼",
  "clientVersions.searchHelperText": "검색 도움말",
  "clientVersions.searchPlaceholder": "검색어를 입력하세요",
  "clientVersions.selectedItems": "선택된 항목",
  "clientVersions.statusLabel": "상태 라벨",
  "clientVersions.version": "버전",

  // Common - missing translations
  "common.actions": "작업",
  "common.add": "추가",
  "common.all": "전체",
  "common.allRoles": "모든 역할",
  "common.allStatuses": "모든 상태",
  "common.back": "뒤로",
  "common.cancel": "취소",
  "common.clearFilters": "필터 지우기",
  "common.clearSelection": "선택 지우기",
  "common.close": "닫기",
  "common.collapse": "접기",
  "common.confirm": "확인",
  "common.copy": "복사",
  "common.create": "생성",
  "common.createdAt": "생성일",
  "common.createdBy": "생성자",
  "common.delete": "삭제",
  "common.edit": "편집",
  "common.enabled": "활성화",
  "common.end": "종료",
  "common.error": "오류",
  "common.expand": "펼치기",
  "common.export": "내보내기",
  "common.filter": "필터",
  "common.filters": "필터",
  "common.history": "이력",
  "common.id": "아이디",
  "common.import": "가져오기",
  "common.lastModified": "마지막 수정",
  "common.loading": "로딩 중",
  "common.month": "월",
  "common.name": "이름",
  "common.next": "다음",
  "common.noData": "데이터 없음",
  "common.ok": "확인",
  "common.page": "페이지",
  "common.previous": "이전",
  "common.refresh": "새로고침",
  "common.repeat": "반복",
  "common.resource": "리소스",
  "common.save": "저장",
  "common.search": "검색",
  "common.select": "선택",
  "common.selectAll": "모두 선택",
  "common.sort": "정렬",
  "common.start": "시작",
  "common.status": "상태",
  "common.submit": "제출",
  "common.tags": "태그",
  "common.time": "시간",
  "common.timestamp": "타임스탬프",
  "common.timezone": "시간대",
  "common.today": "오늘",
  "common.total": "총",
  "common.type": "유형",
  "common.update": "업데이트",
  "common.updatedAt": "수정일",
  "common.updatedBy": "수정자",
  "common.view": "보기",
  "common.week": "주",
  "common.year": "년",

  // Dashboard
  "dashboard.administrators": "관리자",
  "dashboard.adminWelcome": "관리자 대시보드에 오신 것을 환영합니다",
  "dashboard.loadStatsError": "통계 로드 오류",
  "dashboard.pendingApproval": "승인 대기",
  "dashboard.quickActions": "빠른 작업",
  "dashboard.recentActivity": "최근 활동",
  "dashboard.recentActivityPlaceholder": "최근 활동이 없습니다",
  "dashboard.systemOverview": "시스템 개요",
  "dashboard.userWelcome": "사용자 대시보드에 오신 것을 환영합니다",
  "dashboard.welcomeBack": "다시 오신 것을 환영합니다, {{name}}님!",

  // Errors
  "errors.deleteError": "삭제 오류",
  "errors.generic": "오류가 발생했습니다",
  "errors.loadError": "로드 오류",
  "errors.networkError": "네트워크 오류",
  "errors.saveError": "저장 오류",
  "errors.unauthorized": "인증되지 않음",
  "errors.forbidden": "접근 금지",
  "errors.notFound": "찾을 수 없음",
  "errors.serverError": "서버 오류",
  "errors.validationError": "유효성 검사 오류",
  "errors.sessionExpired": "세션이 만료되었습니다",
  "errors.tryAgain": "다시 시도하세요",
  "errors.contactSupport": "지원팀에 문의하세요",

  // Game worlds
  "gameWorlds.alreadyBottom": "이미 맨 아래입니다",
  "gameWorlds.alreadyTop": "이미 맨 위입니다",
  "gameWorlds.errors.alreadyExists": "이미 존재합니다",
  "gameWorlds.errors.deleteFailed": "삭제 실패",
  "gameWorlds.errors.loadFailed": "로드 실패",
  "gameWorlds.errors.moveDownFailed": "아래로 이동 실패",
  "gameWorlds.errors.moveUpFailed": "위로 이동 실패",
  "gameWorlds.errors.orderUpdateFailed": "순서 업데이트 실패",
  "gameWorlds.errors.saveFailed": "저장 실패",
  "gameWorlds.errors.toggleMaintenanceFailed": "점검 모드 전환 실패",
  "gameWorlds.errors.toggleVisibilityFailed": "표시 상태 전환 실패",
  "gameWorlds.form.descriptionHelp": "게임 월드 설명을 입력하세요",
  "gameWorlds.form.maintenanceHelp": "점검 모드 여부를 선택하세요",
  "gameWorlds.form.nameHelp": "게임 월드 이름을 입력하세요",
  "gameWorlds.form.visibleHelp": "이 월드를 표시할지 선택하세요",
  "gameWorlds.form.worldIdHelp": "고유한 월드 ID를 입력하세요",
  "gameWorlds.movedDown": "아래로 이동됨",
  "gameWorlds.movedUp": "위로 이동됨",
  "gameWorlds.noWorldsDesc": "게임 월드가 없습니다",
  "gameWorlds.orderUpdated": "순서가 업데이트되었습니다",
  "gameWorlds.worldName": "월드 이름",

  // Language
  "language.changeLanguage": "언어 변경",

  // Navigation
  "nav.administration": "관리",
  "nav.administrationDesc": "사용자를 관리하고, 감사 로그를 확인하며, 시스템 설정을 구성하세요.",

  // Not found
  "notFound.causeUrlTypo": "URL 입력 오류",

  // Pending approval
  "pendingApproval.additionalInfo": "추가 정보",
  "pendingApproval.backToLogin": "로그인으로 돌아가기",
  "pendingApproval.message": "메시지",
  "pendingApproval.title": "승인 대기",

  // Platform
  "platform": "플랫폼",

  // Profile
  "profile.editProfile": "프로필 편집",
  "profile.memberSince": "가입일",

  // Roles
  "roles.admin": "관리자",
  "roles.user": "사용자",

  // Settings
  "settings.integrations.slackWebhook": "Slack 웹훅 URL",
  "settings.network.admindUrl": "Admind 연결 주소",

  // Sign up prompt
  "signUpPrompt.backToLogin": "로그인으로 돌아가기",
  "signUpPrompt.createAccount": "계정 생성",
  "signUpPrompt.message": "메시지",
  "signUpPrompt.title": "회원가입 안내",

  // Slack webhook
  "slackWebhookUrl": "Slack 웹훅 URL",

  // Theme
  "theme": "테마",

  // Users
  "users.role": "역할",
  "users.roles.admin": "관리자",
  "users.roles.user": "사용자",
  "users.statuses.active": "활성",
  "users.statuses.pending": "대기",
  "users.statuses.suspended": "정지",
  "users.promoteToAdmin": "관리자로 승격",
  "users.demoteToUser": "사용자로 강등",

  // Additional missing keys
  "createdAt": "생성일",
  "div": "구분",
  "genericWebhookUrl": "일반 웹훅 URL",

  // Final missing translations
  "common.goBack": "뒤로 가기",
  "common.goToDashboard": "대시보드로 이동",
  "common.goToLogin": "로그인으로 이동",
  "common.info": "정보",
  "common.loggedInAs": "로그인 사용자",
  "common.no": "아니오",
  "common.reset": "재설정",
  "common.rowsPerPage": "페이지당 행 수",
  "common.saving": "저장 중",
  "common.success": "성공",
  "common.warning": "경고",
  "common.yes": "예",

  // Dashboard additional
  "dashboard.accountCreated": "계정 생성됨",
  "dashboard.activeSessions": "활성 세션",
  "dashboard.activeUsers": "활성 사용자",
  "dashboard.administration": "관리",
  "dashboard.administrationDesc": "관리 설명",

  // Status
  "status.deleted": "삭제됨",
  "status.suspended": "정지됨",

  // Tags
  "tags.description": "설명",
  "tags.duplicateName": "중복된 이름",
  "tags.name": "이름",
  "tags.title": "제목",

  // Token
  "token": "토큰",

  // Users additional
  "users.userCreated": "사용자 생성됨",

  // Whitelist
  "whitelist.columns.ipAddress": "IP 주소",
  "whitelist.dialog.bulkPlaceholder": "홍길동  192.168.1.100   VIP 사용자\n김영희               일반 사용자\n관리자       10.0.0.1        관리자",
  "whitelist.form.ipAddressOpt": "IP 주소 (선택사항)"
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
  console.log('🌐 Completing Korean translations...\n');
  
  applyTranslations('ko', koTranslations);
  
  console.log('\n✅ Korean translation completion finished!');
}

if (require.main === module) {
  main();
}

module.exports = { applyTranslations, koTranslations };
