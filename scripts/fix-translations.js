#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = 'packages/frontend/src/locales';

// Korean translations mapping
const koTranslations = {
  // Account suspended
  'accountSuspended.title': '계정 정지',
  'accountSuspended.message': '귀하의 계정이 정지되었습니다',
  'accountSuspended.contactSupport': '지원팀에 문의하세요',
  'accountSuspended.backToLogin': '로그인으로 돌아가기',
  'accountSuspended.additionalInfo': '추가 정보',

  // Admin dashboard
  'admin.dashboard.title': '관리자 대시보드',
  'admin.dashboard.subtitle': '시스템 현황 및 통계',
  'admin.dashboard.systemPerformance': '시스템 성능',
  'admin.dashboard.serverUptime': '서버 가동시간',
  'admin.dashboard.totalSessions': '총 세션 수',
  'admin.dashboard.avgResponseTime': '평균 응답시간',
  'admin.dashboard.errorRate': '오류율',
  'admin.dashboard.recentActivities': '최근 활동',

  // Admin maintenance
  'admin.maintenance.applyEndsAt': '종료 시간 적용',
  'admin.maintenance.confirmStartTitle': '점검 시작 확인',
  'admin.maintenance.confirmStartMessage': '점검을 시작하려면 "start maintenance"를 입력하세요.',
  'admin.maintenance.confirmStopTitle': '점검 종료 확인',
  'admin.maintenance.confirmStopMessage': '점검을 종료하려면 "stop maintenance"를 입력하세요.',
  'admin.maintenance.defaultMessage': '시스템 점검 중입니다. 잠시 후 다시 시도해주세요.',
  'admin.maintenance.defaultMessageHint': '사용자에게 표시될 기본 메시지',
  'admin.maintenance.directInput': '직접 입력',
  'admin.maintenance.useTemplate': '템플릿 사용',
  'admin.maintenance.selectTemplate': '템플릿 선택',
  'admin.maintenance.start': '점검 시작',
  'admin.maintenance.stop': '점검 종료',
  'admin.maintenance.statusOn': '점검 중',
  'admin.maintenance.statusOff': '정상',

  // Admin scheduler
  'admin.scheduler.noPastBeforeToday': '오늘 이전의 스케줄은 등록할 수 없습니다.',

  // Admin users
  'admin.users.form.nameHelp': '사용자의 실명을 입력하세요',
  'admin.users.form.emailHelp': '유효한 이메일 주소를 입력하세요',
  'admin.users.form.passwordHelp': '8자 이상의 안전한 비밀번호를 입력하세요',
  'admin.users.searchPlaceholder': '이름 또는 이메일로 검색',
  'admin.users.statusFilter': '상태 필터',
  'admin.users.roleFilter': '역할 필터',
  'admin.users.cannotModifyOwnAccount': '자신의 계정은 수정할 수 없습니다',
  'admin.users.roleUpdated': '역할이 업데이트되었습니다',
  'admin.users.updateError': '업데이트 중 오류가 발생했습니다',
  'admin.users.activate': '활성화',

  // Common
  'admindUrl': '관리자 URL',
  'apiKey': 'API 키',
  'auditLogs': '감사 로그',
  'backToLogin': '로그인으로 돌아가기',
  'changeLanguage': '언어 변경',
  'confirmDelete': '삭제 확인',
  'contactSupport': '지원팀 문의',
  'createUser': '사용자 생성',
  'deleteUser': '사용자 삭제',
  'editUser': '사용자 편집',
  'emailVerified': '이메일 인증됨',
  'genericWebhookUrl': '일반 웹훅 URL',
  'lastLogin': '마지막 로그인',
  'memberSince': '가입일',
  'noData': '데이터 없음',
  'promoteToAdmin': '관리자로 승격',
  'demoteToUser': '사용자로 강등',
  'suspendUser': '사용자 정지',
  'userManagement': '사용자 관리',
  'viewProfile': '프로필 보기',

  // Errors
  'errors.generic': '오류가 발생했습니다',
  'errors.networkError': '네트워크 오류',
  'errors.unauthorized': '인증되지 않음',
  'errors.forbidden': '접근 금지',
  'errors.notFound': '찾을 수 없음',
  'errors.serverError': '서버 오류',
  'errors.validationError': '유효성 검사 오류',
  'errors.sessionExpired': '세션이 만료되었습니다',
  'errors.tryAgain': '다시 시도하세요',
  'errors.contactSupport': '지원팀에 문의하세요',

  // Profile
  'profile.title': '프로필',
  'profile.personalInfo': '개인 정보',
  'profile.accountSettings': '계정 설정',
  'profile.securitySettings': '보안 설정',
  'profile.memberSince': '가입일',
  'profile.lastLogin': '마지막 로그인',
  'profile.emailVerified': '이메일 인증됨',
  'profile.changePassword': '비밀번호 변경',
  'profile.currentPassword': '현재 비밀번호',
  'profile.newPassword': '새 비밀번호',
  'profile.confirmPassword': '비밀번호 확인',

  // Settings
  'settings.title': '설정',
  'settings.general': '일반',
  'settings.general.title': '일반 설정',
  'settings.notifications': '알림',
  'settings.security': '보안',
  'settings.appearance': '외관',

  // Users
  'users.role': '역할',
  'users.roles.admin': '관리자',
  'users.roles.user': '사용자',
  'users.statuses.active': '활성',
  'users.statuses.pending': '대기',
  'users.statuses.suspended': '정지',
  'users.promoteToAdmin': '관리자로 승격',
  'users.demoteToUser': '사용자로 강등',

  // Language
  'language.changeLanguage': '언어 변경',

  // Theme
  'theme': '테마',
  'theme.light': '밝은 테마',
  'theme.dark': '어두운 테마',
  'theme.auto': '자동',

  // Maintenance
  'maintenance.title': '점검 관리',
  'maintenance.status': '점검 상태',
  'maintenance.message': '점검 메시지',
  'maintenance.schedule': '점검 일정',
  'maintenance.history': '점검 이력',

  // Additional admin maintenance
  'admin.maintenance.title': '점검 관리',
  'admin.maintenance.type': '점검 유형',
  'admin.maintenance.types.regular': '정기 점검',
  'admin.maintenance.types.emergency': '긴급 점검',
  'admin.maintenance.endsAt': '종료 시간',
  'admin.maintenance.messageSource': '메시지 소스',
  'admin.maintenance.perLanguageMessage': '언어별 메시지',

  // Admin maintenance templates
  'admin.maintenanceTemplates.title': '점검 템플릿 관리',

  // Admin scheduler
  'admin.scheduler.message': '제목 / 메시지',
  'admin.scheduler.runAt': '시작',

  // Auth
  'auth.invalidToken': '유효하지 않은 토큰',
  'auth.invalidTokenDescription': '토큰이 유효하지 않거나 만료되었습니다',
  'auth.requestNewReset': '새 재설정 요청',
  'auth.validatingToken': '토큰 검증 중',

  // Client
  'clientStatus': '클라이언트 상태',
  'clientVersion': '클라이언트 버전',
  'clientVersions.bulkDeleteError': '일괄 삭제 오류',
  'clientVersions.bulkDeleteTitle': '일괄 삭제',
  'clientVersions.bulkDeleteWarning': '일괄 삭제 경고',
  'clientVersions.deleteError': '삭제 오류',

  // Dashboard
  'dashboard.title': '대시보드',
  'dashboard.welcome': '환영합니다',
  'dashboard.overview': '개요',
  'dashboard.stats': '통계',
  'dashboard.activities': '활동',

  // Forms
  'form.required': '필수 항목',
  'form.optional': '선택 항목',
  'form.save': '저장',
  'form.cancel': '취소',
  'form.submit': '제출',
  'form.reset': '재설정',

  // Navigation
  'nav.home': '홈',
  'nav.dashboard': '대시보드',
  'nav.users': '사용자',
  'nav.settings': '설정',
  'nav.logout': '로그아웃',

  // Status
  'status.active': '활성',
  'status.inactive': '비활성',
  'status.pending': '대기 중',
  'status.completed': '완료',
  'status.failed': '실패',

  // Actions
  'action.create': '생성',
  'action.edit': '편집',
  'action.delete': '삭제',
  'action.view': '보기',
  'action.update': '업데이트',
  'action.refresh': '새로고침'
};

// Chinese translations mapping
const zhTranslations = {
  // Account suspended
  'accountSuspended.title': '账户已暂停',
  'accountSuspended.message': '您的账户已被暂停',
  'accountSuspended.contactSupport': '联系支持团队',
  'accountSuspended.backToLogin': '返回登录',
  'accountSuspended.additionalInfo': '附加信息',

  // Admin dashboard
  'admin.dashboard.title': '管理员仪表板',
  'admin.dashboard.subtitle': '系统状态和统计',
  'admin.dashboard.systemPerformance': '系统性能',
  'admin.dashboard.serverUptime': '服务器运行时间',
  'admin.dashboard.totalSessions': '总会话数',
  'admin.dashboard.avgResponseTime': '平均响应时间',
  'admin.dashboard.errorRate': '错误率',
  'admin.dashboard.recentActivities': '最近活动',

  // Admin maintenance
  'admin.maintenance.confirmStartTitle': '确认开始维护',
  'admin.maintenance.confirmStartMessage': '请输入 "start maintenance" 来开始维护。',
  'admin.maintenance.confirmStopTitle': '确认结束维护',
  'admin.maintenance.confirmStopMessage': '请输入 "stop maintenance" 来结束维护。',

  // Admin scheduler
  'admin.scheduler.noPastBeforeToday': '不能在今天之前创建计划。',

  // Admin users
  'admin.users.form.nameHelp': '请输入用户的真实姓名',
  'admin.users.form.emailHelp': '请输入有效的电子邮件地址',
  'admin.users.form.passwordHelp': '请输入8位以上的安全密码',

  // Common
  'admindUrl': '管理员URL',
  'apiKey': 'API密钥',
  'auditLogs': '审计日志',
  'backToLogin': '返回登录',
  'changeLanguage': '更改语言',
  'confirmDelete': '确认删除',
  'contactSupport': '联系支持',
  'createUser': '创建用户',
  'deleteUser': '删除用户',
  'editUser': '编辑用户',
  'emailVerified': '邮箱已验证',
  'genericWebhookUrl': '通用Webhook URL',
  'lastLogin': '最后登录',
  'memberSince': '注册时间',
  'noData': '无数据',
  'promoteToAdmin': '提升为管理员',
  'demoteToUser': '降级为用户',
  'suspendUser': '暂停用户',
  'userManagement': '用户管理',
  'viewProfile': '查看资料',

  // Language
  'language.changeLanguage': '更改语言',

  // Theme
  'theme': '主题',
  'theme.light': '浅色主题',
  'theme.dark': '深色主题',
  'theme.auto': '自动',

  // Auth
  'auth.invalidToken': '无效令牌',
  'auth.invalidTokenDescription': '令牌无效或已过期',
  'auth.requestNewReset': '请求新的重置',
  'auth.validatingToken': '验证令牌中',

  // Client
  'clientStatus': '客户端状态',
  'clientVersion': '客户端版本',
  'clientVersions.bulkDeleteError': '批量删除错误',
  'clientVersions.bulkDeleteTitle': '批量删除',
  'clientVersions.bulkDeleteWarning': '批量删除警告',
  'clientVersions.deleteError': '删除错误',

  // Dashboard
  'dashboard.title': '仪表板',
  'dashboard.welcome': '欢迎',
  'dashboard.overview': '概览',
  'dashboard.stats': '统计',
  'dashboard.activities': '活动',

  // Forms
  'form.required': '必填项',
  'form.optional': '可选项',
  'form.save': '保存',
  'form.cancel': '取消',
  'form.submit': '提交',
  'form.reset': '重置',

  // Navigation
  'nav.home': '首页',
  'nav.dashboard': '仪表板',
  'nav.users': '用户',
  'nav.settings': '设置',
  'nav.logout': '退出登录',

  // Status
  'status.active': '活跃',
  'status.inactive': '非活跃',
  'status.pending': '待处理',
  'status.completed': '已完成',
  'status.failed': '失败',

  // Actions
  'action.create': '创建',
  'action.edit': '编辑',
  'action.delete': '删除',
  'action.view': '查看',
  'action.update': '更新',
  'action.refresh': '刷新'
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
  console.log('🌐 Fixing incomplete translations...\n');
  
  applyTranslations('ko', koTranslations);
  applyTranslations('zh', zhTranslations);
  
  console.log('\n✅ Translation fixes completed!');
}

if (require.main === module) {
  main();
}

module.exports = { applyTranslations, koTranslations, zhTranslations };
