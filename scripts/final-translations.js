#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = 'packages/frontend/src/locales';

// Final Korean translations
const koTranslations = {
  // Audit logs
  'auditLogs.action': '작업',
  'auditLogs.allActions': '모든 작업',
  'auditLogs.allTypes': '모든 유형',
  'auditLogs.date': '날짜',
  'auditLogs.details': '세부사항',
  'auditLogs.endDate': '종료일',
  'auditLogs.id': 'ID',
  'auditLogs.ipAddress': 'IP 주소',
  'auditLogs.loadFailed': '로드 실패',
  'auditLogs.noLogsDesc': '감사 로그가 없습니다',
  'auditLogs.noLogsFound': '감사 로그를 찾을 수 없습니다',
  'auditLogs.resource': '리소스',
  'auditLogs.resourceType': '리소스 유형',
  'auditLogs.searchUserPlaceholder': '사용자 검색',
  'auditLogs.startDate': '시작일',
  'auditLogs.subtitle': '시스템 활동 및 변경 사항 추적',
  'auditLogs.system': '시스템',
  'auditLogs.title': '감사 로그',
  'auditLogs.user': '사용자',

  // Theme
  'theme': '테마',

  // Additional auth
  'auth.passwordResetEmailSent': '비밀번호 재설정 이메일이 전송되었습니다',
  'auth.passwordResetRequestError': '비밀번호 재설정 요청 오류',
  'auth.passwordResetSuccess': '비밀번호 재설정 성공',
  'auth.passwordResetSuccessDescription': '비밀번호가 성공적으로 재설정되었습니다',
  'auth.passwordTooShort': '비밀번호가 너무 짧습니다',
  'auth.passwordsNotMatch': '비밀번호가 일치하지 않습니다',
  'auth.registerFailed': '회원가입 실패',
  'auth.registerSuccess': '회원가입 성공',
  'auth.registerSuccessDescription': '회원가입이 성공적으로 완료되었습니다',
  'auth.rememberMe': '로그인 상태 유지',
  'auth.resendEmail': '이메일 재전송',
  'auth.resetPasswordDescription': '새 비밀번호를 입력하세요',
  'auth.resetPasswordFailed': '비밀번호 재설정 실패',
  'auth.sendResetEmail': '재설정 이메일 전송',
  'auth.tokenExpired': '토큰이 만료되었습니다',
  'auth.tokenValidationFailed': '토큰 검증 실패',
  'auth.welcomeBack': '다시 오신 것을 환영합니다',

  // Client versions
  'clientVersions.addNew': '새로 추가',
  'clientVersions.bulkActions': '일괄 작업',
  'clientVersions.bulkDelete': '일괄 삭제',
  'clientVersions.bulkDeleteConfirm': '일괄 삭제 확인',
  'clientVersions.bulkDeleteSelected': '선택된 항목 일괄 삭제',
  'clientVersions.bulkDeleteSuccess': '일괄 삭제 성공',
  'clientVersions.bulkExport': '일괄 내보내기',
  'clientVersions.bulkExportSelected': '선택된 항목 일괄 내보내기',
  'clientVersions.bulkExportSuccess': '일괄 내보내기 성공',
  'clientVersions.bulkSelect': '일괄 선택',
  'clientVersions.bulkSelectAll': '모두 선택',
  'clientVersions.bulkSelectNone': '선택 해제',
  'clientVersions.createError': '생성 오류',
  'clientVersions.createSuccess': '생성 성공',
  'clientVersions.deleteConfirm': '삭제 확인',
  'clientVersions.deleteSuccess': '삭제 성공',
  'clientVersions.editVersion': '버전 편집',
  'clientVersions.exportAll': '모두 내보내기',
  'clientVersions.exportSelected': '선택된 항목 내보내기',
  'clientVersions.form.buildNumber': '빌드 번호',
  'clientVersions.form.buildNumberHelp': '빌드 번호를 입력하세요',
  'clientVersions.form.description': '설명',
  'clientVersions.form.descriptionHelp': '버전 설명을 입력하세요',
  'clientVersions.form.isActive': '활성',
  'clientVersions.form.isActiveHelp': '이 버전을 활성화할지 선택하세요',
  'clientVersions.form.releaseDate': '출시일',
  'clientVersions.form.releaseDateHelp': '출시일을 선택하세요',
  'clientVersions.form.version': '버전',
  'clientVersions.form.versionHelp': '버전 번호를 입력하세요',
  'clientVersions.newVersion': '새 버전',
  'clientVersions.noVersionsSelected': '선택된 버전이 없습니다',
  'clientVersions.refreshList': '목록 새로고침',
  'clientVersions.selectAll': '모두 선택',
  'clientVersions.selectNone': '선택 해제',
  'clientVersions.subtitle': '클라이언트 버전 관리 및 배포',
  'clientVersions.title': '클라이언트 버전',
  'clientVersions.updateError': '업데이트 오류',
  'clientVersions.updateSuccess': '업데이트 성공',
  'clientVersions.viewDetails': '세부사항 보기',

  // Game worlds
  'gameWorlds.addNew': '새 게임 월드 추가',
  'gameWorlds.confirmDelete': '게임 월드 삭제 확인',
  'gameWorlds.confirmDeleteMessage': '이 게임 월드를 삭제하시겠습니까?',
  'gameWorlds.createError': '생성 오류',
  'gameWorlds.createSuccess': '생성 성공',
  'gameWorlds.deleteSuccess': '삭제 성공',
  'gameWorlds.editWorld': '게임 월드 편집',
  'gameWorlds.errors.alreadyExists': '이미 존재합니다',
  'gameWorlds.errors.deleteFailed': '삭제 실패',
  'gameWorlds.errors.loadFailed': '로드 실패',
  'gameWorlds.errors.moveDownFailed': '아래로 이동 실패',
  'gameWorlds.errors.moveUpFailed': '위로 이동 실패',
  'gameWorlds.errors.orderUpdateFailed': '순서 업데이트 실패',
  'gameWorlds.errors.saveFailed': '저장 실패',
  'gameWorlds.errors.toggleMaintenanceFailed': '점검 모드 전환 실패',
  'gameWorlds.errors.toggleVisibilityFailed': '표시 상태 전환 실패',
  'gameWorlds.form.description': '설명',
  'gameWorlds.form.descriptionHelp': '게임 월드 설명을 입력하세요',
  'gameWorlds.form.isVisible': '표시',
  'gameWorlds.form.maintenanceHelp': '점검 모드 여부를 선택하세요',
  'gameWorlds.form.name': '이름',
  'gameWorlds.form.nameHelp': '게임 월드 이름을 입력하세요',
  'gameWorlds.form.visibleHelp': '이 월드를 표시할지 선택하세요',
  'gameWorlds.form.worldId': '월드 ID',
  'gameWorlds.form.worldIdHelp': '고유한 월드 ID를 입력하세요',
  'gameWorlds.maintenanceMode': '점검 모드',
  'gameWorlds.moveDown': '아래로 이동',
  'gameWorlds.moveUp': '위로 이동',
  'gameWorlds.movedDown': '아래로 이동됨',
  'gameWorlds.movedUp': '위로 이동됨',
  'gameWorlds.newWorld': '새 게임 월드',
  'gameWorlds.noWorldsDesc': '게임 월드가 없습니다',
  'gameWorlds.orderUpdated': '순서가 업데이트되었습니다',
  'gameWorlds.refreshList': '목록 새로고침',
  'gameWorlds.subtitle': '게임 월드 관리 및 설정',
  'gameWorlds.title': '게임 월드',
  'gameWorlds.toggleMaintenance': '점검 모드 전환',
  'gameWorlds.toggleVisibility': '표시 상태 전환',
  'gameWorlds.updateError': '업데이트 오류',
  'gameWorlds.updateSuccess': '업데이트 성공',
  'gameWorlds.viewDetails': '세부사항 보기',
  'gameWorlds.visible': '표시됨',
  'gameWorlds.worldOrder': '월드 순서'
};

// Final Chinese translations
const zhTranslations = {
  // Audit logs
  'auditLogs.action': '操作',
  'auditLogs.allActions': '所有操作',
  'auditLogs.allTypes': '所有类型',
  'auditLogs.date': '日期',
  'auditLogs.details': '详情',
  'auditLogs.endDate': '结束日期',
  'auditLogs.id': 'ID',
  'auditLogs.ipAddress': 'IP地址',
  'auditLogs.loadFailed': '加载失败',
  'auditLogs.noLogsDesc': '没有审计日志',
  'auditLogs.noLogsFound': '未找到审计日志',
  'auditLogs.resource': '资源',
  'auditLogs.resourceType': '资源类型',
  'auditLogs.searchUserPlaceholder': '搜索用户',
  'auditLogs.startDate': '开始日期',
  'auditLogs.subtitle': '跟踪系统活动和变更',
  'auditLogs.system': '系统',
  'auditLogs.title': '审计日志',
  'auditLogs.user': '用户',

  // Theme
  'theme': '主题',

  // Game worlds
  'gameWorlds.errors.alreadyExists': '已存在',
  'gameWorlds.errors.deleteFailed': '删除失败',
  'gameWorlds.errors.loadFailed': '加载失败',
  'gameWorlds.errors.moveDownFailed': '下移失败',
  'gameWorlds.errors.moveUpFailed': '上移失败',
  'gameWorlds.errors.orderUpdateFailed': '顺序更新失败',
  'gameWorlds.errors.saveFailed': '保存失败',
  'gameWorlds.errors.toggleMaintenanceFailed': '切换维护模式失败',
  'gameWorlds.errors.toggleVisibilityFailed': '切换可见性失败',
  'gameWorlds.form.descriptionHelp': '请输入游戏世界描述',
  'gameWorlds.form.maintenanceHelp': '选择是否为维护模式',
  'gameWorlds.form.nameHelp': '请输入游戏世界名称',
  'gameWorlds.form.visibleHelp': '选择是否显示此世界',
  'gameWorlds.form.worldIdHelp': '请输入唯一的世界ID',
  'gameWorlds.movedDown': '已下移',
  'gameWorlds.movedUp': '已上移',
  'gameWorlds.noWorldsDesc': '没有游戏世界',
  'gameWorlds.orderUpdated': '顺序已更新'
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
  console.log('🌐 Applying final translations...\n');
  
  applyTranslations('ko', koTranslations);
  applyTranslations('zh', zhTranslations);
  
  console.log('\n✅ Final translation update completed!');
}

if (require.main === module) {
  main();
}

module.exports = { applyTranslations, koTranslations, zhTranslations };
