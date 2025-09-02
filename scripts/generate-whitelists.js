const mysql = require('mysql2/promise');
require('dotenv').config({ path: './packages/backend/.env' });

// 계정 화이트리스트용 목적 데이터
const ACCOUNT_PURPOSES = [
  '개발자 테스트 계정',
  'QA 테스트 계정',
  '운영진 계정',
  '베타 테스터',
  'VIP 사용자',
  '파트너 계정',
  '관리자 계정',
  '고객 지원팀',
  '마케팅팀 계정',
  '외부 협력업체',
  '임시 테스트 계정',
  '데모 계정',
  '교육용 계정',
  '연구용 계정',
  '프리미엄 사용자'
];

// IP 화이트리스트용 목적 데이터
const IP_PURPOSES = [
  '개발 서버 접근',
  '사무실 네트워크',
  'VPN 게이트웨이',
  '파트너사 접근',
  '고객 지원 센터',
  '데이터센터 관리',
  '모니터링 시스템',
  '백업 서버',
  'CDN 노드',
  '로드밸런서',
  '보안 스캐너',
  '외부 API 서버',
  '테스트 환경',
  '스테이징 서버',
  '프로덕션 서버',
  '관리자 접근',
  '긴급 접근용',
  '임시 접근 허용',
  '클라우드 인스턴스',
  '컨테이너 클러스터'
];

async function createConnection() {
  return await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });
}

async function getExistingUsers(connection) {
  const [users] = await connection.execute('SELECT id FROM g_users WHERE status = "active"');
  return users.map(user => user.id);
}

function generateRandomAccountId() {
  const prefixes = ['user', 'test', 'dev', 'qa', 'admin', 'guest', 'demo', 'beta'];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const number = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}_${number}`;
}

function generateRandomIP() {
  // 사설 IP 대역 사용 (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
  const ranges = [
    () => `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
    () => `172.${16 + Math.floor(Math.random() * 16)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`,
    () => `192.168.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`
  ];
  
  const range = ranges[Math.floor(Math.random() * ranges.length)];
  return range();
}

function generateRandomDateRange() {
  const now = new Date();
  const startDate = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000); // 최대 30일 전
  const endDate = new Date(now.getTime() + Math.random() * 365 * 24 * 60 * 60 * 1000); // 최대 1년 후
  
  // 50% 확률로 날짜 범위 없음
  if (Math.random() < 0.5) {
    return { startDate: null, endDate: null };
  }
  
  return { startDate, endDate };
}

function generateRandomTags() {
  const allTags = ['긴급', '공지', '이벤트', '시스템', '업데이트', '보안', '마케팅', '고객지원', '정기점검', '장애'];
  const numTags = Math.floor(Math.random() * 3) + 1; // 1-3개 태그
  const selectedTags = [];
  
  for (let i = 0; i < numTags; i++) {
    const tag = allTags[Math.floor(Math.random() * allTags.length)];
    if (!selectedTags.includes(tag)) {
      selectedTags.push(tag);
    }
  }
  
  return selectedTags;
}

async function generateAccountWhitelists(connection, userIds, count = 100) {
  console.log(`계정 화이트리스트 ${count}개 생성 시작...`);
  
  const batchSize = 50;
  let created = 0;
  
  for (let batch = 0; batch < Math.ceil(count / batchSize); batch++) {
    const whitelists = [];
    
    for (let i = 0; i < batchSize && created < count; i++) {
      const accountId = generateRandomAccountId();
      const memo = ACCOUNT_PURPOSES[Math.floor(Math.random() * ACCOUNT_PURPOSES.length)];
      const { startDate, endDate } = generateRandomDateRange();
      const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
      const tags = generateRandomTags();
      
      // 50% 확률로 IP 주소 포함
      const ipAddress = Math.random() < 0.5 ? generateRandomIP() : null;
      
      whitelists.push([
        accountId,
        ipAddress,
        startDate,
        endDate,
        purpose,
        JSON.stringify(tags),
        randomUserId,
        new Date(),
        new Date()
      ]);
      
      created++;
    }
    
    if (whitelists.length > 0) {
      const placeholders = whitelists.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const values = whitelists.flat();
      
      try {
        await connection.execute(
          `INSERT INTO g_account_whitelist (accountId, ipAddress, startDate, endDate, memo, tags, createdBy, createdAt, updatedAt) VALUES ${placeholders}`,
          values
        );
        
        console.log(`계정 화이트리스트 배치 ${batch + 1} 완료: ${whitelists.length}개 생성 (총 ${created}/${count})`);
      } catch (error) {
        console.error(`계정 화이트리스트 배치 ${batch + 1} 실패:`, error.message);
        // 중복 계정 ID로 인한 오류 시 개별 처리
        for (const whitelist of whitelists) {
          try {
            await connection.execute(
              'INSERT INTO g_account_whitelist (accountId, ipAddress, startDate, endDate, purpose, tags, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              whitelist
            );
          } catch (individualError) {
            // 중복 계정 ID는 무시하고 새로운 ID로 재시도
            const newAccountId = generateRandomAccountId() + '_' + Date.now();
            whitelist[0] = newAccountId;
            try {
              await connection.execute(
                'INSERT INTO g_account_whitelist (accountId, ipAddress, startDate, endDate, purpose, tags, createdBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                whitelist
              );
            } catch (retryError) {
              console.error('계정 화이트리스트 개별 생성 실패:', retryError.message);
            }
          }
        }
      }
    }
  }
  
  console.log(`계정 화이트리스트 ${created}개 생성 완료!`);
}

async function generateIpWhitelists(connection, userIds, count = 100) {
  console.log(`IP 화이트리스트 ${count}개 생성 시작...`);
  
  const batchSize = 50;
  let created = 0;
  
  for (let batch = 0; batch < Math.ceil(count / batchSize); batch++) {
    const whitelists = [];
    
    for (let i = 0; i < batchSize && created < count; i++) {
      const ipAddress = generateRandomIP();
      const purpose = IP_PURPOSES[Math.floor(Math.random() * IP_PURPOSES.length)];
      const { startDate, endDate } = generateRandomDateRange();
      const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
      const isEnabled = Math.random() < 0.9; // 90% 확률로 활성화
      const tags = generateRandomTags();
      
      whitelists.push([
        ipAddress,
        purpose,
        isEnabled,
        startDate,
        endDate,
        JSON.stringify(tags),
        randomUserId,
        randomUserId, // updatedBy
        new Date(),
        new Date()
      ]);
      
      created++;
    }
    
    if (whitelists.length > 0) {
      const placeholders = whitelists.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const values = whitelists.flat();
      
      try {
        await connection.execute(
          `INSERT INTO g_ip_whitelist (ipAddress, purpose, isEnabled, startDate, endDate, tags, createdBy, updatedBy, createdAt, updatedAt) VALUES ${placeholders}`,
          values
        );
        
        console.log(`IP 화이트리스트 배치 ${batch + 1} 완료: ${whitelists.length}개 생성 (총 ${created}/${count})`);
      } catch (error) {
        console.error(`IP 화이트리스트 배치 ${batch + 1} 실패:`, error.message);
        // 개별 처리
        for (const whitelist of whitelists) {
          try {
            await connection.execute(
              'INSERT INTO g_ip_whitelist (ipAddress, purpose, isEnabled, startDate, endDate, tags, createdBy, updatedBy, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              whitelist
            );
          } catch (individualError) {
            console.error('IP 화이트리스트 개별 생성 실패:', individualError.message);
          }
        }
      }
    }
  }
  
  console.log(`IP 화이트리스트 ${created}개 생성 완료!`);
}

async function main() {
  let connection;
  
  try {
    console.log('데이터베이스 연결 중...');
    connection = await createConnection();
    console.log('데이터베이스 연결 성공!');
    
    // 기존 사용자 조회
    console.log('기존 사용자 조회 중...');
    const userIds = await getExistingUsers(connection);
    console.log(`${userIds.length}명의 활성 사용자 발견`);
    
    if (userIds.length === 0) {
      throw new Error('활성 사용자가 없습니다. 먼저 사용자를 생성해 주세요.');
    }
    
    // 계정 화이트리스트 생성
    await generateAccountWhitelists(connection, userIds, 100);
    
    // IP 화이트리스트 생성
    await generateIpWhitelists(connection, userIds, 100);
    
    // 결과 확인
    const [accountCountResult] = await connection.execute('SELECT COUNT(*) as count FROM g_account_whitelist');
    const [ipCountResult] = await connection.execute('SELECT COUNT(*) as count FROM g_ip_whitelist');
    
    console.log(`\n✅ 작업 완료!`);
    console.log(`👤 총 계정 화이트리스트 수: ${accountCountResult[0].count}`);
    console.log(`🌐 총 IP 화이트리스트 수: ${ipCountResult[0].count}`);
    
  } catch (error) {
    console.error('❌ 오류 발생:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('데이터베이스 연결 종료');
    }
  }
}

// 스크립트 실행
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
