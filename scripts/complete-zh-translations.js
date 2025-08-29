#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = 'packages/frontend/src/locales';

// Comprehensive Chinese translations for all missing keys
const zhTranslations = {
  // Common - missing translations
  "common.actions": "操作",
  "common.add": "添加",
  "common.all": "全部",
  "common.allRoles": "所有角色",
  "common.allStatuses": "所有状态",
  "common.back": "返回",
  "common.cancel": "取消",
  "common.clearFilters": "清除筛选",
  "common.clearSelection": "清除选择",
  "common.close": "关闭",
  "common.collapse": "折叠",
  "common.confirm": "确认",
  "common.copy": "复制",
  "common.create": "创建",
  "common.createdAt": "创建时间",
  "common.createdBy": "创建者",
  "common.delete": "删除",
  "common.edit": "编辑",
  "common.enabled": "启用",
  "common.error": "错误",
  "common.expand": "展开",
  "common.export": "导出",
  "common.filter": "筛选",
  "common.filters": "筛选器",
  "common.import": "导入",
  "common.lastModified": "最后修改",
  "common.noData": "无数据",
  "common.ok": "确定",
  "common.page": "页面",
  "common.refresh": "刷新",
  "common.save": "保存",
  "common.select": "选择",
  "common.selectAll": "全选",
  "common.submit": "提交",
  "common.update": "更新",
  "common.updatedAt": "更新时间",
  "common.updatedBy": "更新者",
  "common.view": "查看",

  // Client versions - missing translations
  "clientVersions.addNew": "添加新版本",
  "clientVersions.bulkDeleteError": "批量删除错误",
  "clientVersions.bulkDeleteTitle": "批量删除",
  "clientVersions.bulkDeleteWarning": "批量删除警告",
  "clientVersions.bulkStatusTitle": "批量状态更改",
  "clientVersions.changeStatus": "更改状态",
  "clientVersions.copySuccess": "复制成功",
  "clientVersions.copyVersion": "复制版本",
  "clientVersions.createSuccess": "创建成功",
  "clientVersions.customPayload": "自定义载荷",
  "clientVersions.deleteConfirmTitle": "确认删除",
  "clientVersions.deleteError": "删除错误",
  "clientVersions.deleteSuccess": "删除成功",
  "clientVersions.exportError": "导出错误",
  "clientVersions.exportSelectedError": "导出选中项错误",
  "clientVersions.externalClickLink": "外部点击链接",
  "clientVersions.form.additionalSettings": "附加设置",
  "clientVersions.form.basicInfo": "基本信息",
  "clientVersions.form.copyTitle": "复制标题",
  "clientVersions.form.customPayloadHelp": "请输入自定义载荷",
  "clientVersions.form.editTitle": "编辑标题",
  "clientVersions.form.externalClickLinkHelp": "请输入外部点击链接",
  "clientVersions.form.gameServerAddressForWhiteListHelp": "请输入白名单游戏服务器地址",
  "clientVersions.form.gameServerAddressHelp": "请输入游戏服务器地址",
  "clientVersions.form.gameServerRequired": "游戏服务器必填",
  "clientVersions.form.guestModeAllowedHelp": "选择是否允许访客模式",
  "clientVersions.form.memoHelp": "请输入备注",
  "clientVersions.form.patchAddressForWhiteListHelp": "请输入白名单补丁地址",
  "clientVersions.form.patchAddressHelp": "请输入补丁地址",
  "clientVersions.form.patchAddressRequired": "补丁地址必填",
  "clientVersions.form.platformHelp": "请选择平台",
  "clientVersions.form.platformRequired": "平台必填",
  "clientVersions.form.serverAddresses": "服务器地址",
  "clientVersions.form.statusHelp": "请选择状态",
  "clientVersions.form.title": "标题",
  "clientVersions.form.versionHelp": "请输入版本号",
  "clientVersions.form.versionInvalid": "版本号无效",
  "clientVersions.form.versionRequired": "版本号必填",
  "clientVersions.gameServer": "游戏服务器",
  "clientVersions.gameServerAddress": "游戏服务器地址",
  "clientVersions.gameServerAddressForWhiteList": "白名单游戏服务器地址",
  "clientVersions.guestMode": "访客模式",
  "clientVersions.guestModeAllowed": "允许访客模式",
  "clientVersions.memo": "备注",
  "clientVersions.patchAddress": "补丁地址",
  "clientVersions.patchAddressForWhiteList": "白名单补丁地址",
  "clientVersions.platform": "平台",
  "clientVersions.searchHelperText": "搜索帮助文本",
  "clientVersions.searchPlaceholder": "请输入搜索关键词",
  "clientVersions.selectedItems": "选中项目",
  "clientVersions.statusLabel": "状态标签",
  "clientVersions.title": "客户端版本",
  "clientVersions.updateSuccess": "更新成功",
  "clientVersions.version": "版本",

  // Dashboard
  "dashboard.administrators": "管理员",
  "dashboard.adminWelcome": "欢迎来到管理员仪表板",
  "dashboard.loadStatsError": "统计加载错误",
  "dashboard.pendingApproval": "待审批",
  "dashboard.quickActions": "快速操作",
  "dashboard.recentActivity": "最近活动",
  "dashboard.recentActivityPlaceholder": "暂无最近活动",
  "dashboard.systemOverview": "系统概览",
  "dashboard.userWelcome": "欢迎来到用户仪表板",
  "dashboard.welcomeBack": "欢迎回来，{{name}}！",

  // Errors
  "errors.deleteError": "删除错误",
  "errors.generic": "发生错误",
  "errors.loadError": "加载错误",
  "errors.networkError": "网络错误",
  "errors.saveError": "保存错误",
  "errors.unauthorized": "未授权",
  "errors.forbidden": "禁止访问",
  "errors.notFound": "未找到",
  "errors.serverError": "服务器错误",
  "errors.validationError": "验证错误",
  "errors.sessionExpired": "会话已过期",
  "errors.tryAgain": "请重试",
  "errors.contactSupport": "联系支持",

  // Game worlds
  "gameWorlds.alreadyBottom": "已在底部",
  "gameWorlds.alreadyTop": "已在顶部",
  "gameWorlds.worldName": "世界名称",

  // Language
  "language.changeLanguage": "更改语言",

  // Navigation
  "nav.administration": "管理",
  "nav.administrationDesc": "管理用户，查看审计日志，配置系统设置。",

  // Not found
  "notFound.causeUrlTypo": "URL输入错误",

  // Pending approval
  "pendingApproval.additionalInfo": "附加信息",
  "pendingApproval.backToLogin": "返回登录",
  "pendingApproval.message": "消息",
  "pendingApproval.title": "待审批",

  // Platform
  "platform": "平台",

  // Profile
  "profile.editProfile": "编辑资料",
  "profile.memberSince": "注册时间",

  // Roles
  "roles.admin": "管理员",
  "roles.user": "用户",

  // Settings
  "settings.integrations.slackWebhook": "Slack Webhook URL",
  "settings.network.admindUrl": "Admind 连接地址",

  // Sign up prompt
  "signUpPrompt.backToLogin": "返回登录",
  "signUpPrompt.createAccount": "创建账户",
  "signUpPrompt.message": "消息",
  "signUpPrompt.title": "注册提示",

  // Slack webhook
  "slackWebhookUrl": "Slack Webhook URL",

  // Theme
  "theme": "主题",

  // Users
  "users.role": "角色",
  "users.roles.admin": "管理员",
  "users.roles.user": "用户",
  "users.statuses.active": "活跃",
  "users.statuses.pending": "待处理",
  "users.statuses.suspended": "已暂停",
  "users.promoteToAdmin": "提升为管理员",
  "users.demoteToUser": "降级为用户",

  // Additional missing keys
  "createdAt": "创建时间",
  "div": "分隔",
  "genericWebhookUrl": "通用Webhook URL",

  // Final missing translations
  "status.deleted": "已删除",
  "status.suspended": "已暂停",

  // Tags
  "tags.description": "描述",
  "tags.duplicateName": "重复名称",
  "tags.name": "名称",
  "tags.title": "标题",

  // Token
  "token": "令牌",

  // Users additional
  "users.userCreated": "用户已创建",

  // Whitelist
  "whitelist.columns.ipAddress": "IP地址",
  "whitelist.dialog.bulkPlaceholder": "张三  192.168.1.100   VIP用户\n李四               普通用户\n管理员       10.0.0.1        管理员",
  "whitelist.form.ipAddressOpt": "IP地址（可选）"
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
  console.log('🌐 Completing Chinese translations...\n');
  
  applyTranslations('zh', zhTranslations);
  
  console.log('\n✅ Chinese translation completion finished!');
}

if (require.main === module) {
  main();
}

module.exports = { applyTranslations, zhTranslations };
