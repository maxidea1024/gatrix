const fs = require('fs');
const path = require('path');

const localesDir = 'c:/work/uwo/gatrix/packages/frontend/src/locales';

const koPath = path.join(localesDir, 'ko.ini');
const enPath = path.join(localesDir, 'en.ini');
const zhPath = path.join(localesDir, 'zh.ini');

function parseIni(content) {
  const map = new Map();
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(';')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      map.set(trimmed.substring(0, eqIdx).trim(), trimmed.substring(eqIdx + 1).trim());
    }
  }
  return map;
}

const koContent = fs.readFileSync(koPath, 'utf8');
const enContent = fs.readFileSync(enPath, 'utf8');
const zhContent = fs.readFileSync(zhPath, 'utf8');

const koMap = parseIni(koContent);
const enMap = parseIni(enContent);
const zhMap = parseIni(zhContent);

const translations = {
  ko: {
    'argus.settings.noTrackers': '설정된 이슈 트래커가 없습니다',
    'argus.crons.status.ok': '정상',
    'argus.crons.status.error': '오류',
    'argus.crons.status.missed': '누락됨',
    'argus.crons.status.timeout': '시간 초과',
    'argus.crons.status.disabled': '비활성화됨',
    'argus.crons.status.active': '활성화됨',
    'argus.uptime.status.up': '정상',
    'argus.uptime.status.down': '장애',
    'argus.uptime.status.degraded': '성능 저하',
    'argus.uptime.status.disabled': '비활성화됨',
    'argus.crons.subtitle': '예약된 작업 및 백그라운드 태스크 관리',
    'argus.uptime.subtitle': 'HTTP 엔드포인트 가동성 및 응답 시간 모니터링',
    'argus.releases.txns': 'txns',
    'argus.releases.noFilteredReleases': '검색 조건에 맞는 릴리스가 없습니다.',
    'argus.releases.checkSearchConditions': '검색 조건을 확인하거나 필터를 지워주세요.',
    'argus.builder.emptyWarning': '조건이 지정되지 않았습니다',
    'argus.feedback.emptySelection': '피드백을 선택하면 상세 내용을 확인할 수 있습니다.'
  },
  en: {
    'hotTimeBuffEvent.liveWaiting': 'Waiting',
    'hotTimeBuffEvent.more': 'More',
    'argus.issues.tabs.details': 'Details',
    'argus.issues.tabs.activity': 'Activity',
    'argus.issues.tabs.feedback': 'User Feedback',
    'argus.issues.tabs.traces': 'Traces & Logs',
    'argus.issues.tabs.ai': 'AI Analysis',
    'argus.settings.wizard.copied': 'Copied!',
    'argus.settings.wizard.copyUrl': 'Click to copy',
    'argus.settings.wizard.requiredField': 'This field is required',
    'argus.releases.txns': 'txns',
    'argus.releases.noFilteredReleases': 'No releases match your search.',
    'argus.releases.checkSearchConditions': 'Please check your search conditions or clear filters.',
    'argus.builder.emptyWarning': 'No conditions defined',
    'argus.feedback.emptySelection': 'Select a feedback to view details.'
  },
  zh: {
    'hotTimeBuffEvent.liveWaiting': '等待中',
    'hotTimeBuffEvent.more': '查看更多',
    'argus.issues.tabs.details': '详细信息',
    'argus.issues.tabs.activity': '活动记录',
    'argus.issues.tabs.feedback': '用户反馈',
    'argus.issues.tabs.traces': '追踪与日志',
    'argus.issues.tabs.ai': 'AI 分析',
    'argus.settings.wizard.copied': '已复制！',
    'argus.settings.wizard.copyUrl': '点击复制',
    'argus.settings.wizard.requiredField': '此字段是必填项',
    'argus.activity.system': '系统',
    'argus.discover.typeValue': '输入值并按回车',
    'argus.builder.title': '可视查询构建器',
    'argus.builder.open': '打开查询构建器',
    'argus.builder.complexWarning': '检测到复杂查询（包含 OR / 括号）。可视构建器无法解析它。使用构建器将会覆盖当前查询。',
    'argus.builder.match': '匹配以下',
    'argus.builder.conditions': '规则：',
    'argus.builder.addTagFilter': '添加标签过滤器',
    'argus.builder.contains': '包含字符串',
    'argus.builder.notContains': '不包含字符串',
    'argus.builder.noConditions': '没有有效的条件来生成查询。',
    'argus.builder.op.is': '等于 (=)',
    'argus.builder.op.isNot': '不等于 (!=)',
    'argus.builder.op.gt': '大于 (>)',
    'argus.builder.op.gte': '大于等于 (>=)',
    'argus.builder.op.lt': '小于 (<)',
    'argus.builder.op.lte': '小于等于 (<=)',
    'argus.releases.crashFreeSessions': '无崩溃会话率',
    'argus.releases.crashFreeUsers': '无崩溃用户率',
    'argus.releases.perf': '性能',
    'argus.releases.noNewIssues': '无新问题',
    'argus.releases.new': '新增',
    'argus.performance.relatedIssues': '相关问题',
    'argus.performance.insights': '洞察与可疑标签',
    'argus.performance.highVariance': '延迟偏差异常',
    'argus.performance.slowestTag': '最慢环境/标签',
    'argus.performance.slowestTagDesc': '此事务在 {{tag_key}} 为 {{tag_value}} 时特别慢。',
    'argus.performance.noIssues': '未发现相关问题。',
    'argus.performance.noInsights': '未发现显著的异常迹象。',
    'argus.settings.keyLabel': '密钥名称',
    'argus.settings.rateLimit': '速率限制',
    'argus.settings.rateLimitHint': '设置为 0 表示无限制',
    'argus.settings.rateLimitCount': '事件数',
    'argus.settings.rateLimitWindow': '时间窗口 (秒)',
    'argus.settings.eventsPerWindow': '次事件',
    'argus.settings.publicKey': '公钥 (Public Key)',
    'argus.settings.secretKey': '私钥 (Secret Key)',
    'argus.settings.deleteKey': '删除密钥',
    'argus.settings.activeOnly': '仅显示启用密钥',
    'argus.settings.showingActiveOnly': '当前仅显示启用密钥',
    'argus.settings.totalKeys': '共 {{count}} 个密钥 · 正在显示活跃期',
    'argus.settings.dsnKeyNoData': '此时间段内没有收集到数据。',
    'argus.settings.dsnKeyStatsPeriod': '最近 7 天',
    'argus.uptime.createSuccess': '成功创建监控。',
    'argus.uptime.createFailed': '创建监控失败。',
    'argus.crons.createSuccess': '成功创建监控。',
    'argus.crons.createFailed': '创建监控失败。',
    'argus.crons.slug': '标识 (Slug)',
    'common.environment.production': '生产环境 (Production)',
    'common.environment.staging': '预发环境 (Staging)',
    'common.environment.development': '开发环境 (Development)',
    'argus.uptime.urlPlaceholder': 'https://example.com/health',
    'common.time.s': '秒',
    'common.time.m': '分',
    'common.time.h': '小时',
    'common.time.d': '天',
    'common.time.in': '在 ',
    'common.time.ago': '前',
    'common.time.10s': '10秒',
    'common.time.30s': '30秒',
    'common.time.1m': '1分钟',
    'common.time.5m': '5分钟',
    'common.time.10m': '10分钟',
    'argus.logs.panel.selectLog': '选择一条日志事件以查看详细信息。',
    'argus.releases.txns': '次交易',
    'argus.settings.noTrackers': '未配置问题追踪器',
    'argus.crons.status.ok': '健康',
    'argus.crons.status.error': '错误',
    'argus.crons.status.missed': '遗漏',
    'argus.crons.status.timeout': '超时',
    'argus.crons.status.disabled': '已禁用',
    'argus.crons.status.active': '活跃',
    'argus.uptime.status.up': '正常',
    'argus.uptime.status.down': '停机',
    'argus.uptime.status.degraded': '降级',
    'argus.uptime.status.disabled': '已禁用',
    'argus.crons.subtitle': '管理计划任务 and 后台任务',
    'argus.uptime.subtitle': '监控 HTTP 端点可用性和响应时间',
    'argus.releases.noFilteredReleases': '没有匹配搜索条件的版本。',
    'argus.releases.checkSearchConditions': '请检查搜索条件或清除过滤器。',
    'argus.builder.emptyWarning': '未定义任何条件',
    'argus.feedback.emptySelection': '选择一条反馈以查看详细信息。',
    'argus.settings.noActiveKeys': '没有处于活动状态的密钥。',
    '\\nargus.settings.repoAdded': '已添加仓库',
    'argus.settings.repoAddFailed': '添加仓库失败',
    'argus.settings.integrationSettings': '集成设置',
    'argus.settings.configureIntegrationDesc': '添加仓库并管理集成。',
    'argus.settings.repositories': '仓库',
    'argus.settings.codeMappings': '代码映射',
    'argus.settings.connectedRepos': '已连接的仓库',
    'argus.settings.noConnectedRepos': '没有已连接的仓库。',
    'argus.settings.addRepoHint': '从下方列表中查找并添加仓库。',
    'argus.settings.availableRepos': '可添加的仓库',
    'argus.settings.searchRepos': '搜索仓库...',
    'argus.settings.noReposFound': 'GitHub App 没有可访问的仓库。',
    'argus.settings.noSearchResults': '没有搜索结果',
    'argus.settings.connected': '已连接',
    'argus.settings.codeMappingsComingSoon': '代码映射功能即将支持。',
    'argus.issues.aiAnalysis': 'AI 分析',
    'argus.settings.integrationDisconnected': '全局 App 集成已成功断开。',
    'argus.settings.integrationDisconnectFailed': '断开集成失败。',
    'argus.settings.integration': '集成',
    'argus.settings.integrationDesc': '已配置 {{name}} App。连接仓库以关联提交、PR 和发布。',
    'argus.settings.addRepositoryConnection': '添加仓库',
    'argus.settings.disconnect': '断开连接',
    'argus.settings.connectedStatus': '已连接',
    'argus.settings.addRepoHintGlobal': '点击右上角“添加仓库”按钮选择要连接的仓库。',
    'argus.settings.repository': '仓库',
    'argus.settings.status': '状态',
    'argus.settings.connectedDate': '连接日期',
    'argus.settings.disabledStatus': '已禁用',
    'argus.settings.appConnected': 'App 集成已成功完成。\\n'
  }
};

const allKeys = new Set([
  ...koMap.keys(),
  ...enMap.keys(),
  ...zhMap.keys(),
  ...Object.keys(translations.ko),
  ...Object.keys(translations.en),
  ...Object.keys(translations.zh)
]);

console.log(`Total union keys: ${allKeys.size}`);

const appends = { ko: [], en: [], zh: [] };

for (const key of allKeys) {
  // ko.ini
  if (!koMap.has(key)) {
    const val = translations.ko[key] || enMap.get(key) || zhMap.get(key) || key;
    appends.ko.push(`${key}=${val}`);
  }
  // en.ini
  if (!enMap.has(key)) {
    const val = translations.en[key] || koMap.get(key) || zhMap.get(key) || key;
    appends.en.push(`${key}=${val}`);
  }
  // zh.ini
  if (!zhMap.has(key)) {
    const val = translations.zh[key] || enMap.get(key) || koMap.get(key) || key;
    appends.zh.push(`${key}=${val}`);
  }
}

// Append new values
if (appends.ko.length > 0) {
  console.log(`Appending to ko.ini: ${appends.ko.length} keys`);
  let newKo = koContent.trim() + '\n' + appends.ko.join('\n') + '\n';
  fs.writeFileSync(koPath, newKo, 'utf8');
}
if (appends.en.length > 0) {
  console.log(`Appending to en.ini: ${appends.en.length} keys`);
  let newEn = enContent.trim() + '\n' + appends.en.join('\n') + '\n';
  fs.writeFileSync(enPath, newEn, 'utf8');
}
if (appends.zh.length > 0) {
  console.log(`Appending to zh.ini: ${appends.zh.length} keys`);
  let newZh = zhContent.trim() + '\n' + appends.zh.join('\n') + '\n';
  fs.writeFileSync(zhPath, newZh, 'utf8');
}

console.log('Sync complete!');
