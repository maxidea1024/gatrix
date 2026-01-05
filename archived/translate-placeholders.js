/**
 * Script to translate placeholder keys from Korean to English/Chinese
 */
const fs = require('fs');
const path = require('path');

const localesDir = 'c:/work/uwo/gatrix/packages/frontend/src/locales';

// Translation mappings (Korean -> English)
const koToEn = {
    '주소 (외부)': 'Address (External)',
    '주소 (내부)': 'Address (Internal)',
    '서버 상태 확인 (/health 엔드포인트)': 'Check server status (/health endpoint)',
    '정상: 서버가 응답합니다': 'Healthy: Server is responding',
    '비정상: {{error}}': 'Unhealthy: {{error}}',
    '상태 확인 완료': 'Health check completed',
    '상태 확인 실패': 'Health check failed',
    '상태 확인 오류: {{error}}': 'Health check error: {{error}}',
    '인스턴스 ID': 'Instance ID',
    '서비스': 'Service',
    '그룹': 'Group',
    '환경': 'Environment',
    '클라우드 프로바이더': 'Cloud Provider',
    '클라우드 리전': 'Cloud Region',
    '클라우드 존': 'Cloud Zone',
    '레이블': 'Labels',
    '호스트명': 'Hostname',
    '공인 IP': 'External Address',
    '내부 IP': 'Internal Address',
    '포트': 'Ports',
    '상태': 'Status',
    '통계': 'Stats',
    '메타데이터': 'Metadata',
    '생성일시': 'Created At',
    '수정일시': 'Updated At',
    '작업': 'Actions',
    '그룹화': 'Grouping',
    '그룹 없음': 'None',
    '초기화 중': 'Initializing',
    '준비됨': 'Ready',
    '종료 중': 'Shutting Down',
    '종료됨': 'Terminated',
    '오류': 'Error',
    'JSON 복사': 'Copy JSON',
    '인스턴스 ID 복사': 'Copy Instance ID',
    '호스트명 복사': 'Copy Hostname',
    '주소 복사': 'Copy Address',
    '상태 확인': 'Health Check',
    '서버 버전': 'Server Version',
    '이미 등록된 클라이언트 버전입니다: {{duplicates}}. 같은 환경에서 동일한 플랫폼과 버전 조합은 중복될 수 없습니다.': 'Client version already exists: {{duplicates}}. The same platform and version combination cannot be duplicated in the same environment.',
    '태그': 'Tags',
    '슈퍼 관리자': 'Super Admin',
    '슈퍼 관리자는 모든 권한을 가지며, 새로운 권한이 추가되어도 자동으로 권한이 부여됩니다.': 'Super admins have all permissions and automatically receive any new permissions added.'
};

// Translation mappings (Korean -> Chinese)
const koToZh = {
    '이미 등록된 클라이언트 버전입니다: {{duplicates}}. 같은 환경에서 동일한 플랫폼과 버전 조합은 중복될 수 없습니다.': '客户端版本已存在: {{duplicates}}。同一环境中相同平台和版本组合不能重复。',
    '태그': '标签',
    '슈퍼 관리자': '超级管理员',
    '슈퍼 관리자는 모든 권한을 가지며, 새로운 권한이 추가되어도 자동으로 권한이 부여됩니다.': '超级管理员拥有所有权限，新增权限时自动获得授权。'
};

// Load files
let enContent = fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8');
let zhContent = fs.readFileSync(path.join(localesDir, 'zh.json'), 'utf8');

// Replace [EN] placeholders
let enCount = 0;
for (const [ko, en] of Object.entries(koToEn)) {
    const pattern = `"[EN] ${ko}"`;
    if (enContent.includes(pattern)) {
        enContent = enContent.replace(pattern, `"${en}"`);
        enCount++;
        console.log(`EN: "${ko}" -> "${en}"`);
    }
}

// Replace [ZH] placeholders
let zhCount = 0;
for (const [ko, zh] of Object.entries(koToZh)) {
    const pattern = `"[ZH] ${ko}"`;
    if (zhContent.includes(pattern)) {
        zhContent = zhContent.replace(pattern, `"${zh}"`);
        zhCount++;
        console.log(`ZH: "${ko}" -> "${zh}"`);
    }
}

// Also replace any remaining [EN] or [ZH] prefixes that weren't in our mapping
// by extracting the Korean value
enContent = enContent.replace(/"\[EN\] ([^"]+)"/g, (match, koValue) => {
    console.log(`EN (not translated, keeping Korean): "${koValue}"`);
    return `"${koValue}"`;
});

zhContent = zhContent.replace(/"\[ZH\] ([^"]+)"/g, (match, koValue) => {
    console.log(`ZH (not translated, keeping Korean): "${koValue}"`);
    return `"${koValue}"`;
});

// Save files
fs.writeFileSync(path.join(localesDir, 'en.json'), enContent, 'utf8');
fs.writeFileSync(path.join(localesDir, 'zh.json'), zhContent, 'utf8');

console.log(`\nReplaced ${enCount} keys in en.json`);
console.log(`Replaced ${zhCount} keys in zh.json`);
console.log('Done!');
