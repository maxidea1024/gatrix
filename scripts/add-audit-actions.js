#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = 'packages/frontend/src/locales';

// All audit log actions that need translation
const auditActions = {
  en: {
    'user_login': 'User Login',
    'user_register': 'User Register',
    'user_update': 'User Update',
    'user_delete': 'User Delete',
    'user_approve': 'User Approve',
    'user_reject': 'User Reject',
    'user_suspend': 'User Suspend',
    'user_unsuspend': 'User Unsuspend',
    'user_promote': 'User Promote',
    'user_demote': 'User Demote',
    'password_change': 'Password Change',
    'profile_update': 'Profile Update',
    'whitelist_create': 'Whitelist Create',
    'whitelist_update': 'Whitelist Update',
    'whitelist_delete': 'Whitelist Delete',
    'client_version_create': 'Client Version Create',
    'client_version_update': 'Client Version Update',
    'client_version_delete': 'Client Version Delete',
    'game_world_create': 'Game World Create',
    'game_world_update': 'Game World Update',
    'game_world_delete': 'Game World Delete',
    'game_world_update_orders': 'Game World Reorder'
  },
  ko: {
    'user_login': '사용자 로그인',
    'user_register': '사용자 등록',
    'user_update': '사용자 수정',
    'user_delete': '사용자 삭제',
    'user_approve': '사용자 승인',
    'user_reject': '사용자 반려',
    'user_suspend': '사용자 정지',
    'user_unsuspend': '사용자 정지 해제',
    'user_promote': '사용자 승격',
    'user_demote': '사용자 강등',
    'password_change': '비밀번호 변경',
    'profile_update': '프로필 수정',
    'whitelist_create': '화이트리스트 생성',
    'whitelist_update': '화이트리스트 수정',
    'whitelist_delete': '화이트리스트 삭제',
    'client_version_create': '클라이언트 버전 생성',
    'client_version_update': '클라이언트 버전 수정',
    'client_version_delete': '클라이언트 버전 삭제',
    'game_world_create': '게임 월드 생성',
    'game_world_update': '게임 월드 수정',
    'game_world_delete': '게임 월드 삭제',
    'game_world_update_orders': '게임 월드 순서 변경'
  },
  zh: {
    'user_login': '用户登录',
    'user_register': '用户注册',
    'user_update': '用户更新',
    'user_delete': '用户删除',
    'user_approve': '用户批准',
    'user_reject': '用户拒绝',
    'user_suspend': '用户暂停',
    'user_unsuspend': '用户解除暂停',
    'user_promote': '用户提升',
    'user_demote': '用户降级',
    'password_change': '密码更改',
    'profile_update': '个人资料更新',
    'whitelist_create': '白名单创建',
    'whitelist_update': '白名单更新',
    'whitelist_delete': '白名单删除',
    'client_version_create': '客户端版本创建',
    'client_version_update': '客户端版本更新',
    'client_version_delete': '客户端版本删除',
    'game_world_create': '游戏世界创建',
    'game_world_update': '游戏世界更新',
    'game_world_delete': '游戏世界删除',
    'game_world_update_orders': '游戏世界重新排序'
  }
};

// Resource types for auditLogs.resources
const auditResources = {
  en: {
    'user': 'User',
    'whitelist': 'Whitelist',
    'client_version': 'Client Version',
    'game_world': 'Game World'
  },
  ko: {
    'user': '사용자',
    'whitelist': '화이트리스트',
    'client_version': '클라이언트 버전',
    'game_world': '게임 월드'
  },
  zh: {
    'user': '用户',
    'whitelist': '白名单',
    'client_version': '客户端版本',
    'game_world': '游戏世界'
  }
};

function addAuditTranslations() {
  Object.entries(auditActions).forEach(([lang, actions]) => {
    console.log(`\n🔧 Adding audit actions to ${lang}.json...`);
    
    const filePath = path.join(LOCALES_DIR, `${lang}.json`);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    // Add actions
    if (!data.auditLogs) {
      data.auditLogs = {};
    }
    data.auditLogs.actions = actions;
    
    // Add resources
    data.auditLogs.resources = auditResources[lang];
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
    console.log(`  ✅ Added ${Object.keys(actions).length} actions and ${Object.keys(auditResources[lang]).length} resources`);
  });
}

if (require.main === module) {
  addAuditTranslations();
  console.log('\n✅ All audit log actions and resources have been added!');
}

module.exports = { addAuditTranslations };
