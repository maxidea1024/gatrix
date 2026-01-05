const fs = require('fs');

// Korean
const koPath = 'packages/frontend/src/locales/ko.json';
const ko = JSON.parse(fs.readFileSync(koPath, 'utf8'));
if (!ko.errors) ko.errors = {};
ko.errors.ResourceLockedException = '이 항목은 변경 요청 "{{title}}"에 의해 잠겨 있습니다. 해당 요청이 처리될 때까지 수정할 수 없습니다.';
if (!ko.errors.CR_DATA_CONFLICT) {
    ko.errors.CR_DATA_CONFLICT = '요청 생성 이후 데이터가 변경되어 충돌이 발생했습니다.';
}
fs.writeFileSync(koPath, JSON.stringify(ko, null, 2) + '\n', 'utf8');
console.log('Updated ko.json');

// English
const enPath = 'packages/frontend/src/locales/en.json';
const en = JSON.parse(fs.readFileSync(enPath, 'utf8'));
if (!en.errors) en.errors = {};
en.errors.ResourceLockedException = 'This item is locked by Change Request "{{title}}". It cannot be modified until the request is processed.';
if (!en.errors.CR_DATA_CONFLICT) {
    en.errors.CR_DATA_CONFLICT = 'Data has changed since the request was created, causing a conflict.';
}
fs.writeFileSync(enPath, JSON.stringify(en, null, 2) + '\n', 'utf8');
console.log('Updated en.json');

// Chinese
const zhPath = 'packages/frontend/src/locales/zh.json';
const zh = JSON.parse(fs.readFileSync(zhPath, 'utf8'));
if (!zh.errors) zh.errors = {};
zh.errors.ResourceLockedException = '此项目已被变更请求"{{title}}"锁定。在请求处理完成之前无法修改。';
if (!zh.errors.CR_DATA_CONFLICT) {
    zh.errors.CR_DATA_CONFLICT = '请求创建后数据已更改，发生冲突。';
}
fs.writeFileSync(zhPath, JSON.stringify(zh, null, 2) + '\n', 'utf8');
console.log('Updated zh.json');

console.log('Done!');
