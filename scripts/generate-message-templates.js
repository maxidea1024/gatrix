const mysql = require('mysql2/promise');
require('dotenv').config({ path: './packages/backend/.env' });

// 메시지 템플릿 타입들
const MESSAGE_TYPES = ['maintenance', 'general', 'notification', 'email', 'sms', 'push', 'system'];

// 태그 데이터 (실제로 생성할 태그들)
const TAGS_TO_CREATE = [
  { name: '긴급', color: '#F44336', description: '긴급한 메시지' },
  { name: '공지', color: '#2196F3', description: '일반 공지사항' },
  { name: '이벤트', color: '#FF9800', description: '이벤트 관련' },
  { name: '시스템', color: '#9C27B0', description: '시스템 관련' },
  { name: '업데이트', color: '#4CAF50', description: '업데이트 관련' },
  { name: '보안', color: '#795548', description: '보안 관련' },
  { name: '마케팅', color: '#E91E63', description: '마케팅 관련' },
  { name: '고객지원', color: '#00BCD4', description: '고객지원 관련' },
  { name: '정기점검', color: '#607D8B', description: '정기점검 관련' },
  { name: '장애', color: '#FF5722', description: '장애 관련' }
];

// 메시지 템플릿 이름과 내용 생성을 위한 데이터
const MESSAGE_TEMPLATES = {
  maintenance: [
    { name: '정기 서버 점검 안내', content: '안녕하세요. 서비스 품질 향상을 위한 정기 서버 점검을 실시합니다.' },
    { name: '긴급 시스템 점검', content: '긴급 시스템 점검으로 인해 일시적으로 서비스가 중단됩니다.' },
    { name: '데이터베이스 업그레이드', content: '데이터베이스 성능 향상을 위한 업그레이드 작업을 진행합니다.' },
    { name: '네트워크 인프라 점검', content: '네트워크 안정성 확보를 위한 인프라 점검을 실시합니다.' }
  ],
  general: [
    { name: '서비스 이용 안내', content: '서비스를 이용해 주셔서 감사합니다. 더 나은 서비스를 위해 노력하겠습니다.' },
    { name: '새로운 기능 소개', content: '새롭게 추가된 기능을 소개합니다. 많은 이용 부탁드립니다.' },
    { name: '이용약관 변경 안내', content: '서비스 이용약관이 변경되었습니다. 변경사항을 확인해 주세요.' },
    { name: '개인정보처리방침 업데이트', content: '개인정보처리방침이 업데이트되었습니다.' }
  ],
  notification: [
    { name: '중요 공지사항', content: '중요한 공지사항이 있습니다. 반드시 확인해 주세요.' },
    { name: '시스템 업데이트 완료', content: '시스템 업데이트가 완료되었습니다. 새로운 기능을 확인해 보세요.' },
    { name: '보안 업데이트 알림', content: '보안 강화를 위한 업데이트가 적용되었습니다.' },
    { name: '서비스 장애 복구', content: '발생했던 서비스 장애가 복구되었습니다.' }
  ],
  email: [
    { name: '회원가입 환영 메일', content: '회원가입을 환영합니다! 다양한 서비스를 이용해 보세요.' },
    { name: '비밀번호 재설정', content: '비밀번호 재설정 요청을 받았습니다. 아래 링크를 클릭해 주세요.' },
    { name: '이메일 인증', content: '이메일 인증을 완료해 주세요. 인증 후 모든 서비스를 이용할 수 있습니다.' },
    { name: '월간 뉴스레터', content: '이번 달의 주요 소식과 업데이트 내용을 전해드립니다.' }
  ],
  sms: [
    { name: '인증번호 발송', content: '인증번호: {code}. 3분 내에 입력해 주세요.' },
    { name: '로그인 알림', content: '새로운 기기에서 로그인이 감지되었습니다.' },
    { name: '결제 완료 알림', content: '결제가 정상적으로 완료되었습니다.' },
    { name: '예약 확인', content: '예약이 확인되었습니다. 시간에 맞춰 방문해 주세요.' }
  ],
  push: [
    { name: '새 메시지 도착', content: '새로운 메시지가 도착했습니다.' },
    { name: '이벤트 시작 알림', content: '기다리던 이벤트가 시작되었습니다!' },
    { name: '할인 쿠폰 발급', content: '특별 할인 쿠폰이 발급되었습니다.' },
    { name: '친구 요청', content: '새로운 친구 요청이 있습니다.' }
  ],
  system: [
    { name: '시스템 로그 알림', content: '시스템에서 중요한 이벤트가 발생했습니다.' },
    { name: '백업 완료', content: '데이터 백업이 성공적으로 완료되었습니다.' },
    { name: '용량 부족 경고', content: '저장 공간이 부족합니다. 정리가 필요합니다.' },
    { name: '성능 모니터링', content: '시스템 성능 지표를 확인해 주세요.' }
  ]
};

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

async function createTags(connection, userIds) {
  console.log('태그 생성 중...');
  const createdTags = [];
  
  for (const tag of TAGS_TO_CREATE) {
    try {
      const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
      const [result] = await connection.execute(
        'INSERT INTO g_tags (name, color, description, createdBy) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)',
        [tag.name, tag.color, tag.description, randomUserId]
      );
      createdTags.push(result.insertId);
      console.log(`태그 생성: ${tag.name}`);
    } catch (error) {
      console.error(`태그 생성 실패 (${tag.name}):`, error.message);
    }
  }
  
  return createdTags;
}

function generateRandomTemplate(type, index) {
  const templates = MESSAGE_TEMPLATES[type];
  const baseTemplate = templates[index % templates.length];
  
  // 이름에 번호 추가하여 유니크하게 만들기
  const name = `${baseTemplate.name} #${index + 1}`;
  
  // 내용에 변화 추가
  const variations = [
    '추가 정보는 고객센터로 문의해 주세요.',
    '자세한 내용은 공식 홈페이지를 확인해 주세요.',
    '문의사항이 있으시면 언제든 연락 주세요.',
    '이용에 불편을 드려 죄송합니다.',
    '더 나은 서비스를 위해 노력하겠습니다.',
    '항상 저희 서비스를 이용해 주셔서 감사합니다.',
    '빠른 시일 내에 개선하도록 하겠습니다.',
    '고객님의 소중한 의견을 반영하겠습니다.'
  ];
  
  const variation = variations[index % variations.length];
  const content = `${baseTemplate.content} ${variation}`;
  
  return { name, content };
}

async function generateMessageTemplates(connection, userIds, tagIds, batchSize = 100) {
  console.log('메시지 템플릿 생성 시작...');
  
  const totalTemplates = 10000;
  let created = 0;
  
  for (let batch = 0; batch < Math.ceil(totalTemplates / batchSize); batch++) {
    const templates = [];
    const tagAssignments = [];
    
    for (let i = 0; i < batchSize && created < totalTemplates; i++) {
      const type = MESSAGE_TYPES[created % MESSAGE_TYPES.length];
      const { name, content } = generateRandomTemplate(type, created);
      const randomUserId = userIds[Math.floor(Math.random() * userIds.length)];
      
      templates.push([
        name,
        type,
        true, // isEnabled
        false, // supportsMultiLanguage
        content,
        randomUserId, // createdBy
        randomUserId, // updatedBy
        new Date(),
        new Date()
      ]);
      
      created++;
    }
    
    // 배치로 템플릿 삽입
    if (templates.length > 0) {
      const placeholders = templates.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const values = templates.flat();
      
      const [result] = await connection.execute(
        `INSERT INTO g_message_templates (name, type, isEnabled, supportsMultiLanguage, defaultMessage, createdBy, updatedBy, createdAt, updatedAt) VALUES ${placeholders}`,
        values
      );
      
      // 태그 할당 (각 템플릿에 1-3개의 랜덤 태그)
      const startId = result.insertId;
      for (let i = 0; i < templates.length; i++) {
        const templateId = startId + i;
        const numTags = Math.floor(Math.random() * 3) + 1; // 1-3개 태그
        const selectedTags = [];
        
        for (let j = 0; j < numTags; j++) {
          const randomTagId = tagIds[Math.floor(Math.random() * tagIds.length)];
          if (!selectedTags.includes(randomTagId)) {
            selectedTags.push(randomTagId);
            tagAssignments.push([
              'message_template',
              templateId,
              randomTagId,
              new Date()
            ]);
          }
        }
      }
      
      console.log(`배치 ${batch + 1} 완료: ${templates.length}개 템플릿 생성 (총 ${created}/${totalTemplates})`);
    }
    
    // 태그 할당 배치 삽입
    if (tagAssignments.length > 0) {
      const tagPlaceholders = tagAssignments.map(() => '(?, ?, ?, ?)').join(', ');
      const tagValues = tagAssignments.flat();
      
      await connection.execute(
        `INSERT INTO g_tag_assignments (entityType, entityId, tagId, createdAt) VALUES ${tagPlaceholders}`,
        tagValues
      );
    }
  }
  
  console.log(`총 ${created}개의 메시지 템플릿 생성 완료!`);
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
    
    // 태그 생성
    const tagIds = await createTags(connection, userIds);
    console.log(`${tagIds.length}개의 태그 생성 완료`);
    
    // 메시지 템플릿 생성
    await generateMessageTemplates(connection, userIds, tagIds);
    
    // 결과 확인
    const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM g_message_templates');
    console.log(`\n✅ 작업 완료!`);
    console.log(`📊 총 메시지 템플릿 수: ${countResult[0].count}`);
    
    const [tagCountResult] = await connection.execute('SELECT COUNT(*) as count FROM g_tags');
    console.log(`🏷️  총 태그 수: ${tagCountResult[0].count}`);
    
    const [assignmentCountResult] = await connection.execute('SELECT COUNT(*) as count FROM g_tag_assignments WHERE entityType = "message_template"');
    console.log(`🔗 총 태그 할당 수: ${assignmentCountResult[0].count}`);
    
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
