// Add ALL missing feature flag, segment, and context field localization keys
const fs = require('fs');
const path = require('path');

const localesDir = 'packages/frontend/src/locales';

const allMissingKeysKo = {
    // Segment related
    'featureFlags.segmentNameHelp': '세그먼트의 고유 식별자입니다.',
    'featureFlags.segmentDisplayNameHelp': '세그먼트의 표시 이름입니다.',
    'featureFlags.segmentDescriptionHelp': '세그먼트에 대한 설명입니다.',
    'featureFlags.segmentConstraintsHelp': '세그먼트에 포함될 사용자 조건을 정의합니다.',
    'featureFlags.contextField': '컨텍스트 필드',
    'featureFlags.operator': '연산자',
    'featureFlags.constraintValue': '값',

    // Context field related
    'featureFlags.fieldNameHelp': '필드의 고유 식별자입니다.',
    'featureFlags.fieldTypeHelp': '필드의 데이터 타입입니다.',
    'featureFlags.legalValues': '허용된 값',
    'featureFlags.legalValuesHelp': '이 필드에 허용되는 값들을 정의합니다.',

    // Metrics
    'featureFlags.metricsComingSoon': '지표 기능이 곧 제공될 예정입니다.',

    // Strategy types
    'featureFlags.strategyTypes.default': '기본',
    'featureFlags.strategyTypes.userWithId': '사용자 ID',
    'featureFlags.strategyTypes.flexibleRollout': '유연한 롤아웃',
    'featureFlags.strategyTypes.gradualRollout': '점진적 롤아웃',

    // More missing keys
    'featureFlags.typeHelp': '플래그 유형을 선택합니다.',
    'featureFlags.noStrategies': '전략이 없습니다.',
    'featureFlags.noStrategiesDescription': '전략을 추가하여 기능 노출 조건을 정의하세요.',
    'featureFlags.addFirstStrategy': '첫 번째 전략 추가',
    'featureFlags.stickiness': '고정성',
    'featureFlags.userIds': '사용자 ID',
    'featureFlags.userIdsHelp': '쉼표로 구분된 사용자 ID 목록입니다.',
    'featureFlags.editStrategy': '전략 편집',
    'featureFlags.strategySaved': '전략이 저장되었습니다.',
    'featureFlags.strategySaveFailed': '전략 저장에 실패했습니다.',
    'featureFlags.strategyDeleted': '전략이 삭제되었습니다.',
    'featureFlags.strategyDeleteFailed': '전략 삭제에 실패했습니다.',
    'featureFlags.variantsSaved': '변형이 저장되었습니다.',
    'featureFlags.variantsSaveFailed': '변형 저장에 실패했습니다.',
    'featureFlags.saveStrategies': '전략 저장',
    'featureFlags.saveVariants': '변형 저장',
    'featureFlags.variantName': '변형 이름',
    'featureFlags.payload': '페이로드',
    'featureFlags.payloadPlaceholder': '페이로드 값 입력...',
    'featureFlags.editVariant': '변형 편집',
    'featureFlags.variantsDescription': 'A/B 테스트를 위한 변형을 정의합니다.',
};

const allMissingKeysEn = {
    // Segment related
    'featureFlags.segmentNameHelp': 'Unique identifier for the segment.',
    'featureFlags.segmentDisplayNameHelp': 'Display name for the segment.',
    'featureFlags.segmentDescriptionHelp': 'Description of the segment.',
    'featureFlags.segmentConstraintsHelp': 'Define conditions for users to be included in this segment.',
    'featureFlags.contextField': 'Context Field',
    'featureFlags.operator': 'Operator',
    'featureFlags.constraintValue': 'Value',

    // Context field related
    'featureFlags.fieldNameHelp': 'Unique identifier for the field.',
    'featureFlags.fieldTypeHelp': 'Data type of the field.',
    'featureFlags.legalValues': 'Legal Values',
    'featureFlags.legalValuesHelp': 'Define allowed values for this field.',

    // Metrics
    'featureFlags.metricsComingSoon': 'Metrics feature coming soon.',

    // Strategy types
    'featureFlags.strategyTypes.default': 'Default',
    'featureFlags.strategyTypes.userWithId': 'User with ID',
    'featureFlags.strategyTypes.flexibleRollout': 'Flexible Rollout',
    'featureFlags.strategyTypes.gradualRollout': 'Gradual Rollout',

    // More missing keys
    'featureFlags.typeHelp': 'Select the flag type.',
    'featureFlags.noStrategies': 'No strategies.',
    'featureFlags.noStrategiesDescription': 'Add strategies to define feature exposure conditions.',
    'featureFlags.addFirstStrategy': 'Add First Strategy',
    'featureFlags.stickiness': 'Stickiness',
    'featureFlags.userIds': 'User IDs',
    'featureFlags.userIdsHelp': 'Comma-separated list of user IDs.',
    'featureFlags.editStrategy': 'Edit Strategy',
    'featureFlags.strategySaved': 'Strategy saved.',
    'featureFlags.strategySaveFailed': 'Failed to save strategy.',
    'featureFlags.strategyDeleted': 'Strategy deleted.',
    'featureFlags.strategyDeleteFailed': 'Failed to delete strategy.',
    'featureFlags.variantsSaved': 'Variants saved.',
    'featureFlags.variantsSaveFailed': 'Failed to save variants.',
    'featureFlags.saveStrategies': 'Save Strategies',
    'featureFlags.saveVariants': 'Save Variants',
    'featureFlags.variantName': 'Variant Name',
    'featureFlags.payload': 'Payload',
    'featureFlags.payloadPlaceholder': 'Enter payload value...',
    'featureFlags.editVariant': 'Edit Variant',
    'featureFlags.variantsDescription': 'Define variants for A/B testing.',
};

const allMissingKeysZh = {
    // Segment related
    'featureFlags.segmentNameHelp': '细分群体的唯一标识符。',
    'featureFlags.segmentDisplayNameHelp': '细分群体的显示名称。',
    'featureFlags.segmentDescriptionHelp': '细分群体的描述。',
    'featureFlags.segmentConstraintsHelp': '定义用户被纳入此细分群体的条件。',
    'featureFlags.contextField': '上下文字段',
    'featureFlags.operator': '运算符',
    'featureFlags.constraintValue': '值',

    // Context field related
    'featureFlags.fieldNameHelp': '字段的唯一标识符。',
    'featureFlags.fieldTypeHelp': '字段的数据类型。',
    'featureFlags.legalValues': '合法值',
    'featureFlags.legalValuesHelp': '定义此字段允许的值。',

    // Metrics
    'featureFlags.metricsComingSoon': '指标功能即将推出。',

    // Strategy types
    'featureFlags.strategyTypes.default': '默认',
    'featureFlags.strategyTypes.userWithId': '用户ID',
    'featureFlags.strategyTypes.flexibleRollout': '灵活发布',
    'featureFlags.strategyTypes.gradualRollout': '渐进发布',

    // More missing keys
    'featureFlags.typeHelp': '选择标志类型。',
    'featureFlags.noStrategies': '没有策略。',
    'featureFlags.noStrategiesDescription': '添加策略以定义功能展示条件。',
    'featureFlags.addFirstStrategy': '添加第一个策略',
    'featureFlags.stickiness': '粘性',
    'featureFlags.userIds': '用户ID',
    'featureFlags.userIdsHelp': '逗号分隔的用户ID列表。',
    'featureFlags.editStrategy': '编辑策略',
    'featureFlags.strategySaved': '策略已保存。',
    'featureFlags.strategySaveFailed': '保存策略失败。',
    'featureFlags.strategyDeleted': '策略已删除。',
    'featureFlags.strategyDeleteFailed': '删除策略失败。',
    'featureFlags.variantsSaved': '变体已保存。',
    'featureFlags.variantsSaveFailed': '保存变体失败。',
    'featureFlags.saveStrategies': '保存策略',
    'featureFlags.saveVariants': '保存变体',
    'featureFlags.variantName': '变体名称',
    'featureFlags.payload': '负载',
    'featureFlags.payloadPlaceholder': '输入负载值...',
    'featureFlags.editVariant': '编辑变体',
    'featureFlags.variantsDescription': '定义A/B测试的变体。',
};

function addKeysToIni(filePath, keys) {
    let content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const existingKeys = new Set(lines.map(line => line.split('=')[0]));

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

console.log('Adding all missing localization keys...\n');

const koAdded = addKeysToIni(path.join(localesDir, 'ko.ini'), allMissingKeysKo);
console.log(`ko.ini: ${koAdded} keys added`);

const enAdded = addKeysToIni(path.join(localesDir, 'en.ini'), allMissingKeysEn);
console.log(`en.ini: ${enAdded} keys added`);

const zhAdded = addKeysToIni(path.join(localesDir, 'zh.ini'), allMissingKeysZh);
console.log(`zh.ini: ${zhAdded} keys added`);

console.log('\nDone!');
