#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = 'packages/frontend/src/locales';

// Comprehensive Korean translations
const koTranslations = {
  // Admin scheduler
  'admin.scheduler.title': '스케줄 관리',

  // Admin users
  'admin.users.addUser': '사용자 추가',
  'admin.users.approve': '승인',
  'admin.users.deleteConfirmation': '삭제 확인',
  'admin.users.deleteConfirmationInput': '삭제 확인 입력',
  'admin.users.deleteUser': '사용자 삭제',
  'admin.users.editUser': '사용자 편집',
  'admin.users.emailDoesNotMatch': '이메일이 일치하지 않습니다',
  'admin.users.fetchError': '가져오기 오류',
  'admin.users.statusUpdated': '상태가 업데이트되었습니다',
  'admin.users.subtitle': '사용자 관리 및 권한 설정',
  'admin.users.suspend': '정지',
  'admin.users.title': '사용자 관리',
  'admin.users.userUpdated': '사용자가 업데이트되었습니다',

  // Auth
  'auth.accountPending': '계정 승인 대기 중',
  'auth.accountSuspended': '계정이 정지되었습니다',
  'auth.alreadyHaveAccount': '이미 계정이 있으신가요?',
  'auth.backToLogin': '로그인으로 돌아가기',
  'auth.checkEmailForReset': '비밀번호 재설정 이메일을 확인하세요',
  'auth.completeRegistration': '회원가입 완료',
  'auth.confirmPassword': '비밀번호 확인',
  'auth.createAccount': '계정 생성',
  'auth.dontHaveAccount': '계정이 없으신가요?',
  'auth.email': '이메일',
  'auth.emailRequired': '이메일이 필요합니다',
  'auth.forgotPassword': '비밀번호를 잊으셨나요?',
  'auth.login': '로그인',
  'auth.loginFailed': '로그인 실패',
  'auth.logout': '로그아웃',
  'auth.name': '이름',
  'auth.nameRequired': '이름이 필요합니다',
  'auth.password': '비밀번호',
  'auth.passwordRequired': '비밀번호가 필요합니다',
  'auth.passwordsDoNotMatch': '비밀번호가 일치하지 않습니다',
  'auth.register': '회원가입',
  'auth.registrationFailed': '회원가입 실패',
  'auth.resetPassword': '비밀번호 재설정',
  'auth.signIn': '로그인',
  'auth.signUp': '회원가입',

  // Common
  'common.action': '작업',
  'common.addTag': '태그 추가',
  'common.calendar': '달력',
  'common.confirmDelete': '삭제 확인',
  'common.copied': '복사됨',
  'common.cron': '크론',
  'common.day': '일',
  'common.description': '설명',
  'common.end': '종료',
  'common.history': '이력',
  'common.id': '아이디',
  'common.loading': '로딩 중',
  'common.month': '월',
  'common.name': '이름',
  'common.next': '다음',
  'common.previous': '이전',
  'common.repeat': '반복',
  'common.search': '검색',
  'common.start': '시작',
  'common.status': '상태',
  'common.time': '시간',
  'common.today': '오늘',
  'common.total': '총',
  'common.type': '유형',
  'common.week': '주',
  'common.year': '년',

  // Dashboard
  'dashboard.adminWelcome': '관리자 대시보드에 오신 것을 환영합니다',
  'dashboard.userWelcome': '사용자 대시보드에 오신 것을 환영합니다',
  'dashboard.welcomeBack': '다시 오신 것을 환영합니다, {{name}}님!',

  // Errors
  'error.generic': '오류가 발생했습니다',
  'error.networkError': '네트워크 오류',
  'error.serverError': '서버 오류',
  'error.unauthorized': '인증되지 않음',
  'error.forbidden': '접근 금지',
  'error.notFound': '찾을 수 없음',

  // Navigation
  'nav.administration': '관리',
  'nav.administrationDesc': '사용자를 관리하고, 감사 로그를 확인하며, 시스템 설정을 구성하세요.',

  // Profile
  'profile.accountInfo': '계정 정보',
  'profile.changePassword': '비밀번호 변경',
  'profile.currentPassword': '현재 비밀번호',
  'profile.newPassword': '새 비밀번호',
  'profile.personalInfo': '개인 정보',
  'profile.updateProfile': '프로필 업데이트',

  // Settings
  'settings.appearance': '외관',
  'settings.notifications': '알림',
  'settings.privacy': '개인정보',
  'settings.security': '보안',

  // Client versions
  'clientVersions.exportError': '내보내기 오류',
  'clientVersions.exportSelectedError': '선택된 항목 내보내기 오류',
  'clientVersions.form.duplicateVersion': '중복된 버전',
  'clientVersions.loadFailed': '로드 실패',
  'clientVersions.noVersionsDesc': '버전이 없습니다',
  'clientVersions.noVersionsFound': '버전을 찾을 수 없습니다',
  'clientVersions.statusUpdateError': '상태 업데이트 오류',
  'clientVersions.statusUpdated': '상태가 업데이트되었습니다',

  // Additional auth
  'auth.confirmLogout': '로그아웃 확인',
  'auth.confirmLogoutMessage': '정말 로그아웃하시겠습니까?',
  'auth.confirmNewPassword': '새 비밀번호 확인',
  'auth.confirmPasswordRequired': '비밀번호 확인이 필요합니다',
  'auth.didntReceiveEmail': '이메일을 받지 못하셨나요?',
  'auth.emailInvalid': '유효하지 않은 이메일입니다',
  'auth.emailSendFailed': '이메일 전송 실패',
  'auth.emailSent': '이메일이 전송되었습니다',
  'auth.forgotPasswordDescription': '이메일 주소를 입력하시면 비밀번호 재설정 링크를 보내드립니다',
  'auth.forgotPasswordFailed': '비밀번호 재설정 실패',
  'auth.invalidCredentials': '잘못된 인증 정보입니다',
  'auth.invalidResetLink': '유효하지 않은 재설정 링크입니다',
  'auth.loginSuccess': '로그인 성공',
  'auth.loginWithGitHub': 'GitHub로 로그인',
  'auth.loginWithGoogle': 'Google로 로그인',
  'auth.logoutSuccess': '로그아웃 성공',
  'auth.nameMaxLength': '이름은 최대 50자까지 입력 가능합니다',
  'auth.nameMinLength': '이름은 최소 2자 이상 입력해야 합니다',
  'auth.newPassword': '새 비밀번호',
  'auth.passwordMinLength': '비밀번호는 최소 8자 이상이어야 합니다',

  // Additional common
  'common.resource': '리소스',
  'common.sort': '정렬',
  'common.tags': '태그',
  'common.timestamp': '타임스탬프',
  'common.timezone': '시간대',
  'createdAt': '생성일',

  // Dashboard
  'dashboard.administrators': '관리자',
  'dashboard.loadStatsError': '통계 로드 오류',
  'dashboard.pendingApproval': '승인 대기',
  'dashboard.quickActions': '빠른 작업',
  'dashboard.recentActivity': '최근 활동',
  'dashboard.recentActivityPlaceholder': '최근 활동이 없습니다',
  'dashboard.systemOverview': '시스템 개요',

  // Errors
  'errors.deleteError': '삭제 오류',
  'errors.loadError': '로드 오류',
  'errors.saveError': '저장 오류',

  // Game worlds
  'gameWorlds.alreadyBottom': '이미 맨 아래입니다',
  'gameWorlds.alreadyTop': '이미 맨 위입니다'
};

// Comprehensive Chinese translations
const zhTranslations = {
  // Client versions
  'clientVersions.exportError': '导出错误',
  'clientVersions.exportSelectedError': '导出选中项错误',
  'clientVersions.form.duplicateVersion': '重复版本',
  'clientVersions.loadFailed': '加载失败',
  'clientVersions.noVersionsDesc': '没有版本',
  'clientVersions.noVersionsFound': '未找到版本',
  'clientVersions.statusUpdateError': '状态更新错误',
  'clientVersions.statusUpdated': '状态已更新',

  // Common
  'common.action': '操作',
  'common.addTag': '添加标签',
  'common.calendar': '日历',
  'common.confirmDelete': '确认删除',
  'common.copied': '已复制',
  'common.cron': '定时任务',
  'common.day': '日',
  'common.description': '描述',
  'common.end': '结束',
  'common.history': '历史',
  'common.id': 'ID',
  'common.loading': '加载中',
  'common.month': '月',
  'common.name': '名称',
  'common.next': '下一个',
  'common.previous': '上一个',
  'common.repeat': '重复',
  'common.search': '搜索',
  'common.start': '开始',
  'common.status': '状态',
  'common.time': '时间',
  'common.today': '今天',
  'common.total': '总计',
  'common.type': '类型',
  'common.week': '周',
  'common.year': '年',

  // Dashboard
  'dashboard.adminWelcome': '欢迎来到管理员仪表板',
  'dashboard.userWelcome': '欢迎来到用户仪表板',
  'dashboard.welcomeBack': '欢迎回来，{{name}}！',

  // Errors
  'error.generic': '发生错误',
  'error.networkError': '网络错误',
  'error.serverError': '服务器错误',
  'error.unauthorized': '未授权',
  'error.forbidden': '禁止访问',
  'error.notFound': '未找到',

  // Navigation
  'nav.administration': '管理',
  'nav.administrationDesc': '管理用户，查看审计日志，配置系统设置。',

  // Profile
  'profile.accountInfo': '账户信息',
  'profile.changePassword': '更改密码',
  'profile.currentPassword': '当前密码',
  'profile.newPassword': '新密码',
  'profile.personalInfo': '个人信息',
  'profile.updateProfile': '更新资料',

  // Settings
  'settings.appearance': '外观',
  'settings.notifications': '通知',
  'settings.privacy': '隐私',
  'settings.security': '安全',

  // Additional common
  'common.resource': '资源',
  'common.sort': '排序',
  'common.tags': '标签',
  'common.timestamp': '时间戳',
  'common.timezone': '时区',
  'createdAt': '创建时间',

  // Dashboard
  'dashboard.administrators': '管理员',
  'dashboard.loadStatsError': '统计加载错误',
  'dashboard.pendingApproval': '待审批',
  'dashboard.quickActions': '快速操作',
  'dashboard.recentActivity': '最近活动',
  'dashboard.recentActivityPlaceholder': '暂无最近活动',
  'dashboard.systemOverview': '系统概览',

  // Errors
  'errors.deleteError': '删除错误',
  'errors.loadError': '加载错误',
  'errors.saveError': '保存错误',

  // Game worlds
  'gameWorlds.alreadyBottom': '已在底部',
  'gameWorlds.alreadyTop': '已在顶部'
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
  console.log('🌐 Applying bulk translations...\n');
  
  applyTranslations('ko', koTranslations);
  applyTranslations('zh', zhTranslations);
  
  console.log('\n✅ Bulk translation update completed!');
}

if (require.main === module) {
  main();
}

module.exports = { applyTranslations, koTranslations, zhTranslations };
