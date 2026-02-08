const fs = require('fs');
const path = require('path');

const localesDir = 'packages/frontend/src/locales';
const files = ['ko.json', 'en.json', 'zh.json'];

// Keys to add under serverList
const serverListKeys = {
  ko: {
    hostname: '호스트명',
    externalAddress: '공인 IP',
    internalAddress: '내부 IP',
    ports: '포트',
    cloudProvider: '클라우드 프로바이더',
    cloudRegion: '클라우드 리전',
    cloudZone: '클라우드 존',
    serverVersion: '서버 버전',
    labels: '레이블',
  },
  en: {
    hostname: 'Hostname',
    externalAddress: 'External IP',
    internalAddress: 'Internal IP',
    ports: 'Ports',
    cloudProvider: 'Cloud Provider',
    cloudRegion: 'Cloud Region',
    cloudZone: 'Cloud Zone',
    serverVersion: 'Server Version',
    labels: 'Labels',
  },
  zh: {
    hostname: '主机名',
    externalAddress: '公网 IP',
    internalAddress: '内网 IP',
    ports: '端口',
    cloudProvider: '云提供商',
    cloudRegion: '云区域',
    cloudZone: '可用区',
    serverVersion: '服务器版本',
    labels: '标签',
  },
};

files.forEach((file) => {
  const lang = file.split('.')[0];
  const filePath = path.join(localesDir, file);
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(content);

  // Ensure serverList exists
  if (!parsed.serverList) {
    parsed.serverList = {};
  }

  // Add missing keys
  Object.entries(serverListKeys[lang]).forEach(([key, value]) => {
    if (!parsed.serverList[key]) {
      parsed.serverList[key] = value;
    }
  });

  fs.writeFileSync(filePath, JSON.stringify(parsed, null, 2) + '\n');
  console.log(`Updated ${file} with serverList keys`);
});

console.log('Done!');
