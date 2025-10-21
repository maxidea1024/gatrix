const axios = require('axios');
require('dotenv').config();

// Configuration
const API_BASE_URL = process.env.BACKEND_URL || 'http://localhost:5000';

// Get credentials from command line or environment
const ADMIN_EMAIL = process.argv[2] || process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.argv[3] || process.env.ADMIN_PASSWORD || 'admin123';

// Get today's date and one week from now
const today = new Date();
const oneWeekLater = new Date(today);
oneWeekLater.setDate(oneWeekLater.getDate() + 7);

const startDate = today.toISOString();
const endDate = oneWeekLater.toISOString();

// Service notice templates for online games
const NOTICE_TEMPLATES = [
  {
    category: 'maintenance',
    title: '[정기 점검] 서버 안정화 및 성능 개선 작업 안내',
    content: `<div style="padding: 20px; background-color: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; margin-bottom: 20px;">
  <p style="margin: 0; font-weight: bold; color: #856404;">안녕하세요, 항해사 여러분.</p>
  <p style="margin: 10px 0 0 0; color: #856404;">더 나은 게임 환경을 위해 정기 점검을 실시합니다.</p>
</div>

<p>이번 점검에서는 서버 안정화 및 성능 개선 작업을 진행합니다.</p>

<div style="background-color: #e7f3ff; padding: 15px; border-left: 4px solid #2196F3; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #1976D2;">🔧 점검 일정</h3>
  <ul style="margin-bottom: 0;">
    <li><strong>점검 시간:</strong> 오전 8시 ~ 오후 2시 (6시간 예정)</li>
    <li><strong>점검 대상:</strong> 전체 서버</li>
    <li><strong>점검 내용:</strong> 서버 안정화, 데이터베이스 최적화, 버그 수정</li>
  </ul>
</div>

<p>점검 시간 동안 게임 접속이 불가능하오니 양해 부탁드립니다.</p>

<p>더 나은 서비스로 보답하겠습니다. 감사합니다.</p>`,
  },
  {
    category: 'event',
    title: '[이벤트] 대항해 축제 - 풍요의 바다 이벤트 개최',
    content: `<div style="padding: 20px; background-color: #e8f5e9; border: 2px solid #4caf50; border-radius: 8px; margin-bottom: 20px;">
  <p style="margin: 0; font-weight: bold; color: #2e7d32;">🎉 대항해 축제가 시작됩니다!</p>
  <p style="margin: 10px 0 0 0; color: #2e7d32;">풍성한 보상과 함께 즐거운 항해를 떠나보세요.</p>
</div>

<h3 style="color: #1976D2;">📅 이벤트 기간</h3>
<p>이벤트 시작일부터 7일간 진행됩니다.</p>

<h3 style="color: #1976D2;">🎁 이벤트 내용</h3>
<ul>
  <li><strong>특별 퀘스트:</strong> 매일 새로운 퀘스트가 열립니다</li>
  <li><strong>보상 2배:</strong> 모든 항해 보상이 2배로 증가합니다</li>
  <li><strong>희귀 아이템:</strong> 이벤트 기간 동안만 획득 가능한 특별 아이템</li>
  <li><strong>경험치 보너스:</strong> 모든 활동에서 경험치 50% 추가 획득</li>
</ul>

<h3 style="color: #1976D2;">⚓ 참여 방법</h3>
<p>게임에 접속하여 이벤트 NPC를 찾아가시면 자동으로 참여됩니다.</p>

<p>많은 참여 부탁드립니다!</p>`,
  },
  {
    category: 'notice',
    title: '[공지] 신규 콘텐츠 업데이트 안내',
    content: `<div style="padding: 20px; background-color: #e3f2fd; border: 2px solid #2196f3; border-radius: 8px; margin-bottom: 20px;">
  <p style="margin: 0; font-weight: bold; color: #1565c0;">📢 신규 콘텐츠가 추가되었습니다!</p>
</div>

<h3 style="color: #1976D2;">🆕 업데이트 내용</h3>

<h4>1. 새로운 항로 추가</h4>
<ul>
  <li>동남아시아 항로 개방</li>
  <li>신규 항구 10곳 추가</li>
  <li>특산품 거래 시스템 확장</li>
</ul>

<h4>2. 선박 시스템 개선</h4>
<ul>
  <li>신규 선박 5종 추가</li>
  <li>선박 강화 시스템 개선</li>
  <li>선박 외형 커스터마이징 기능 추가</li>
</ul>

<h4>3. 전투 시스템 밸런스 조정</h4>
<ul>
  <li>함포 데미지 밸런스 조정</li>
  <li>스킬 쿨타임 최적화</li>
  <li>PvP 매칭 시스템 개선</li>
</ul>

<h4>4. UI/UX 개선</h4>
<ul>
  <li>항해 지도 인터페이스 개선</li>
  <li>인벤토리 정렬 기능 추가</li>
  <li>퀵슬롯 커스터마이징 기능 강화</li>
</ul>

<p>자세한 내용은 게임 내 공지사항을 확인해주세요.</p>`,
  },
  {
    category: 'promotion',
    title: '[프로모션] 신규 항해사 환영 패키지',
    content: `<div style="padding: 20px; background-color: #fff3e0; border: 2px solid #ff9800; border-radius: 8px; margin-bottom: 20px;">
  <p style="margin: 0; font-weight: bold; color: #e65100;">🎁 신규 항해사를 위한 특별 혜택!</p>
  <p style="margin: 10px 0 0 0; color: #e65100;">지금 시작하면 푸짐한 보상을 받을 수 있습니다.</p>
</div>

<h3 style="color: #1976D2;">🎁 패키지 구성</h3>
<ul>
  <li><strong>골드 100,000:</strong> 게임 시작 자금</li>
  <li><strong>고급 선박 1척:</strong> 빠른 성장을 위한 특별 선박</li>
  <li><strong>항해 물자 세트:</strong> 식량, 물, 탄약 각 1,000개</li>
  <li><strong>경험치 부스터 (7일):</strong> 경험치 획득량 50% 증가</li>
  <li><strong>희귀 아이템 상자 5개:</strong> 랜덤 희귀 아이템 획득</li>
</ul>

<h3 style="color: #1976D2;">📋 수령 조건</h3>
<p>신규 계정 생성 후 7일 이내 접속 시 자동 지급됩니다.</p>

<h3 style="color: #1976D2;">⏰ 이벤트 기간</h3>
<p>이벤트 시작일부터 7일간 진행됩니다.</p>

<p>이 기회를 놓치지 마세요!</p>`,
  },
  {
    category: 'maintenance',
    title: '[긴급 점검] 서버 오류 수정 작업',
    content: `<div style="padding: 20px; background-color: #ffebee; border: 2px solid #f44336; border-radius: 8px; margin-bottom: 20px;">
  <p style="margin: 0; font-weight: bold; color: #c62828;">⚠️ 긴급 점검 안내</p>
  <p style="margin: 10px 0 0 0; color: #c62828;">서버 오류 수정을 위해 긴급 점검을 실시합니다.</p>
</div>

<h3 style="color: #1976D2;">🔧 점검 사유</h3>
<p>일부 사용자에게서 발생한 접속 오류 및 아이템 지급 오류를 수정하기 위한 긴급 점검입니다.</p>

<h3 style="color: #1976D2;">⏰ 점검 시간</h3>
<p>약 2시간 소요 예정이며, 상황에 따라 변동될 수 있습니다.</p>

<h3 style="color: #1976D2;">📝 수정 내용</h3>
<ul>
  <li>접속 오류 수정</li>
  <li>아이템 지급 오류 수정</li>
  <li>거래소 버그 수정</li>
  <li>퀘스트 진행 오류 수정</li>
</ul>

<p>불편을 드려 죄송합니다. 빠른 시일 내에 정상화하겠습니다.</p>`,
  },
];

async function login() {
  try {
    console.log('🔐 Logging in...');
    console.log(`   Email: ${ADMIN_EMAIL}`);

    const response = await axios.post(`${API_BASE_URL}/api/v1/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (response.data.success && response.data.data && response.data.data.accessToken) {
      console.log('✅ Login successful');
      return response.data.data.accessToken;
    } else if (response.data.success && response.data.data && response.data.data.token) {
      console.log('✅ Login successful');
      return response.data.data.token;
    } else if (response.data.token) {
      // Some APIs return token directly
      console.log('✅ Login successful (direct token)');
      return response.data.token;
    } else {
      throw new Error('Login failed: No token received');
    }
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function createServiceNotice(token, noticeData) {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/v1/admin/service-notices`,
      noticeData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.success) {
      return response.data.data.notice;
    } else {
      throw new Error('Failed to create service notice');
    }
  } catch (error) {
    console.error('❌ Failed to create service notice:', error.response?.data || error.message);
    throw error;
  }
}

function generateNoticeData(index) {
  const template = NOTICE_TEMPLATES[index % NOTICE_TEMPLATES.length];
  const platforms = ['pc', 'pc-wegame', 'ios', 'android', 'harmonyos'];
  
  return {
    isActive: true,
    category: template.category,
    platforms: platforms,
    startDate: startDate,
    endDate: endDate,
    tabTitle: `${template.title} #${index + 1}`,
    title: `${template.title} #${index + 1}`,
    content: template.content,
    description: `서비스 공지 #${index + 1}`,
  };
}

async function main() {
  try {
    console.log('🚀 Starting bulk service notice creation...\n');
    console.log(`API Base URL: ${API_BASE_URL}`);
    console.log(`Creating 100 service notices`);
    console.log(`Period: ${today.toLocaleDateString()} ~ ${oneWeekLater.toLocaleDateString()}\n`);

    // Step 1: Login
    const token = await login();

    // Step 2: Create 100 service notices
    console.log('\n📝 Creating service notices...\n');
    
    const createdNotices = [];
    for (let i = 0; i < 100; i++) {
      const noticeData = generateNoticeData(i);
      
      try {
        const notice = await createServiceNotice(token, noticeData);
        createdNotices.push(notice);
        
        // Progress indicator
        if ((i + 1) % 10 === 0) {
          console.log(`✅ Created ${i + 1}/100 notices`);
        }
      } catch (error) {
        console.error(`❌ Failed to create notice #${i + 1}:`, error.message);
      }
      
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n✅ All done!');
    console.log(`\n📊 Summary:`);
    console.log(`  Total created: ${createdNotices.length}/100`);
    console.log(`  Categories:`);
    
    const categoryCounts = createdNotices.reduce((acc, notice) => {
      acc[notice.category] = (acc[notice.category] || 0) + 1;
      return acc;
    }, {});
    
    Object.entries(categoryCounts).forEach(([category, count]) => {
      console.log(`    - ${category}: ${count}`);
    });

  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Usage: node add-100-service-notices.js [email] [password]

Arguments:
  email     Admin email (default: from .env or admin@example.com)
  password  Admin password (default: from .env or admin123)

Examples:
  node add-100-service-notices.js
  node add-100-service-notices.js admin@example.com mypassword
  yarn add:100-notices
    `);
    process.exit(0);
  }
  
  main();
}

module.exports = { createServiceNotice, login, generateNoticeData };

