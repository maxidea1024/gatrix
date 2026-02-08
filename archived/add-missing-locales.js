// Add missing featureFlags localization keys to INI files
const fs = require('fs');
const path = require('path');

const localesDir = 'packages/frontend/src/locales';

// Missing keys to add
const missingKeysKo = {
  // Sidebar
  'sidebar.featureFlagsCategory': '기능 플래그',
  'sidebar.featureSegments': '세그먼트',
  'sidebar.featureContextFields': '컨텍스트 필드',

  // Tabs
  'featureFlags.overview': '개요',
  'featureFlags.targeting': '타게팅',
  'featureFlags.metrics': '지표',

  // Basic info
  'featureFlags.disabled': '비활성화됨',
  'featureFlags.enabled': '활성화됨',
  'featureFlags.flagNameHelp': '고유 식별자로 사용됩니다. 영문, 숫자, 하이픈만 사용 가능합니다.',
  'featureFlags.displayNameHelp': '사용자에게 표시되는 이름입니다.',
  'featureFlags.descriptionHelp': '기능 플래그에 대한 설명입니다.',
  'featureFlags.flagTypeHelp': '기능 플래그의 용도를 나타냅니다.',
  'featureFlags.staleAfterDaysHelp': '지정된 일수 동안 사용되지 않으면 비활성으로 표시됩니다.',
  'featureFlags.impressionDataEnabledHelp': '활성화하면 플래그 사용 시 이벤트가 기록됩니다.',

  // Flag types
  'featureFlags.flagTypes.release': '릴리스',
  'featureFlags.flagTypes.experiment': '실험',
  'featureFlags.flagTypes.operational': '운영',
  'featureFlags.flagTypes.permission': '권한',

  // Strategy
  'featureFlags.activationStrategies': '활성화 전략',
  'featureFlags.strategyType': '전략 타입',
  'featureFlags.strategyTypeHelp': '전략 타입을 선택합니다.',
  'featureFlags.constraints': '조건',
  'featureFlags.constraintsHelp': '조건을 추가하여 전략 적용 범위를 제한합니다.',
  'featureFlags.noConstraints': '조건 없음',
  'featureFlags.addConstraint': '조건 추가',
  'featureFlags.addFirstConstraint': '첫 번째 조건 추가',
  'featureFlags.removeStrategy': '전략 삭제',
  'featureFlags.rolloutPercentage': '롤아웃 비율',
  'featureFlags.rolloutPercentageHelp': '기능을 노출할 사용자 비율입니다.',

  // Common
  'common.days': '일',
};

const missingKeysEn = {
  // Sidebar
  'sidebar.featureFlagsCategory': 'Feature Flags',
  'sidebar.featureSegments': 'Segments',
  'sidebar.featureContextFields': 'Context Fields',

  // Tabs
  'featureFlags.overview': 'Overview',
  'featureFlags.targeting': 'Targeting',
  'featureFlags.metrics': 'Metrics',

  // Basic info
  'featureFlags.disabled': 'Disabled',
  'featureFlags.enabled': 'Enabled',
  'featureFlags.flagNameHelp': 'Unique identifier. Only letters, numbers, and hyphens allowed.',
  'featureFlags.displayNameHelp': 'Display name shown to users.',
  'featureFlags.descriptionHelp': 'Description of the feature flag.',
  'featureFlags.flagTypeHelp': 'Indicates the purpose of the feature flag.',
  'featureFlags.staleAfterDaysHelp': 'Mark as stale if unused for this many days.',
  'featureFlags.impressionDataEnabledHelp':
    'When enabled, events are logged when the flag is used.',

  // Flag types
  'featureFlags.flagTypes.release': 'Release',
  'featureFlags.flagTypes.experiment': 'Experiment',
  'featureFlags.flagTypes.operational': 'Operational',
  'featureFlags.flagTypes.permission': 'Permission',

  // Strategy
  'featureFlags.activationStrategies': 'Activation Strategies',
  'featureFlags.strategyType': 'Strategy Type',
  'featureFlags.strategyTypeHelp': 'Select a strategy type.',
  'featureFlags.constraints': 'Constraints',
  'featureFlags.constraintsHelp': 'Add constraints to limit the strategy scope.',
  'featureFlags.noConstraints': 'No constraints',
  'featureFlags.addConstraint': 'Add Constraint',
  'featureFlags.addFirstConstraint': 'Add First Constraint',
  'featureFlags.removeStrategy': 'Remove Strategy',
  'featureFlags.rolloutPercentage': 'Rollout Percentage',
  'featureFlags.rolloutPercentageHelp': 'Percentage of users to expose the feature to.',

  // Common
  'common.days': 'days',
};

const missingKeysZh = {
  // Sidebar
  'sidebar.featureFlagsCategory': '功能标志',
  'sidebar.featureSegments': '细分群体',
  'sidebar.featureContextFields': '上下文字段',

  // Tabs
  'featureFlags.overview': '概述',
  'featureFlags.targeting': '目标定位',
  'featureFlags.metrics': '指标',

  // Basic info
  'featureFlags.disabled': '已禁用',
  'featureFlags.enabled': '已启用',
  'featureFlags.flagNameHelp': '唯一标识符。仅允许使用字母、数字和连字符。',
  'featureFlags.displayNameHelp': '向用户显示的名称。',
  'featureFlags.descriptionHelp': '功能标志的描述。',
  'featureFlags.flagTypeHelp': '表示功能标志的用途。',
  'featureFlags.staleAfterDaysHelp': '如果未使用此天数，则标记为过期。',
  'featureFlags.impressionDataEnabledHelp': '启用后，使用标志时会记录事件。',

  // Flag types
  'featureFlags.flagTypes.release': '发布',
  'featureFlags.flagTypes.experiment': '实验',
  'featureFlags.flagTypes.operational': '运营',
  'featureFlags.flagTypes.permission': '权限',

  // Strategy
  'featureFlags.activationStrategies': '激活策略',
  'featureFlags.strategyType': '策略类型',
  'featureFlags.strategyTypeHelp': '选择策略类型。',
  'featureFlags.constraints': '约束条件',
  'featureFlags.constraintsHelp': '添加约束条件以限制策略范围。',
  'featureFlags.noConstraints': '无约束条件',
  'featureFlags.addConstraint': '添加约束',
  'featureFlags.addFirstConstraint': '添加第一个约束',
  'featureFlags.removeStrategy': '删除策略',
  'featureFlags.rolloutPercentage': '发布百分比',
  'featureFlags.rolloutPercentageHelp': '向用户展示功能的百分比。',

  // Common
  'common.days': '天',
};

function addKeysToIni(filePath, keys) {
  let content = fs.readFileSync(filePath, 'utf8');
  const existingKeys = new Set(content.split('\n').map((line) => line.split('=')[0]));

  let added = 0;
  for (const [key, value] of Object.entries(keys)) {
    if (!existingKeys.has(key)) {
      content += `\n${key}=${value}`;
      added++;
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
  return added;
}

console.log('Adding missing localization keys...\n');

const koAdded = addKeysToIni(path.join(localesDir, 'ko.ini'), missingKeysKo);
console.log(`ko.ini: ${koAdded} keys added`);

const enAdded = addKeysToIni(path.join(localesDir, 'en.ini'), missingKeysEn);
console.log(`en.ini: ${enAdded} keys added`);

const zhAdded = addKeysToIni(path.join(localesDir, 'zh.ini'), missingKeysZh);
console.log(`zh.ini: ${zhAdded} keys added`);

console.log('\nDone!');
