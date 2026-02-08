// Add strategy parameter localization keys
const fs = require('fs');
const path = require('path');

const localesDir = 'packages/frontend/src/locales';

const keys = {
  ko: {
    'featureFlags.groupId': '그룹 ID',
    'featureFlags.groupIdHelp': '동일한 그룹 ID를 가진 플래그는 일관된 롤아웃을 보장합니다',
    'featureFlags.stickiness': '고정 기준',
    'featureFlags.ipAddresses': 'IP 주소 목록',
    'featureFlags.ipAddressesHelp': '쉼표 또는 줄바꿈으로 구분하여 IP 주소를 입력하세요',
    'featureFlags.hostnames': '호스트네임 목록',
    'featureFlags.hostnamesHelp': '쉼표 또는 줄바꿈으로 구분하여 호스트네임을 입력하세요',
  },
  en: {
    'featureFlags.groupId': 'Group ID',
    'featureFlags.groupIdHelp': 'Flags with the same group ID ensure consistent rollout',
    'featureFlags.stickiness': 'Stickiness',
    'featureFlags.ipAddresses': 'IP Addresses',
    'featureFlags.ipAddressesHelp': 'Enter IP addresses separated by commas or newlines',
    'featureFlags.hostnames': 'Hostnames',
    'featureFlags.hostnamesHelp': 'Enter hostnames separated by commas or newlines',
  },
  zh: {
    'featureFlags.groupId': '组ID',
    'featureFlags.groupIdHelp': '具有相同组ID的标志确保一致的推出',
    'featureFlags.stickiness': '粘性',
    'featureFlags.ipAddresses': 'IP地址列表',
    'featureFlags.ipAddressesHelp': '用逗号或换行符分隔IP地址',
    'featureFlags.hostnames': '主机名列表',
    'featureFlags.hostnamesHelp': '用逗号或换行符分隔主机名',
  },
};

function addKeysToIni(filePath, keysToAdd) {
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const existingKeys = new Set(lines.map((line) => line.split('=')[0]));

  for (const [key, value] of Object.entries(keysToAdd)) {
    if (!existingKeys.has(key)) {
      content += `\n${key}=${value}`;
      console.log(`Added: ${key}`);
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

console.log('Adding strategy parameter keys...\n');
addKeysToIni(path.join(localesDir, 'ko.ini'), keys.ko);
addKeysToIni(path.join(localesDir, 'en.ini'), keys.en);
addKeysToIni(path.join(localesDir, 'zh.ini'), keys.zh);
console.log('\nDone!');
