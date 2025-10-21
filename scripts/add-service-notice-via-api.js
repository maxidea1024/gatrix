const axios = require('axios');
require('dotenv').config();

// Configuration
const API_BASE_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Service notice data
const SERVICE_NOTICE = {
  isActive: true,
  category: 'maintenance',
  platforms: ['pc', 'pc-wegame', 'ios', 'android', 'harmonyos'],
  startDate: '2025-10-20T00:00:00.000Z',
  endDate: '2025-10-22T23:59:59.999Z',
  tabTitle: '[점검 안내] 10월 24일(목) 정기 점검 및 신규 이벤트 업데이트 안내',
  title: '[점검 안내] 10월 24일(목) 정기 점검 및 신규 이벤트 업데이트 안내',
  content: `<div style="padding: 20px; background-color: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; margin-bottom: 20px;">
  <p style="margin: 0; font-weight: bold; color: #856404;">안녕하세요, 모험가님 여러분.</p>
  <p style="margin: 10px 0 0 0; color: #856404;">항상 저희 게임을 사랑해주시는 모든 분들께 감사드립니다.</p>
</div>

<p>다가오는 <strong>10월 24일(목)</strong>, 보다 안정적인 서비스 제공을 위해 정기 점검을 진행합니다.</p>

<p>이번 점검에서는 일부 서버 작업과 함께 <strong>**신규 이벤트**</strong>  <em>(장미의 항로 축제)</em> **가 시작됩니다!</p>

<div style="background-color: #e7f3ff; padding: 15px; border-left: 4px solid #2196F3; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #1976D2;">🔧 점검 일정</h3>
  <ul style="margin-bottom: 0;">
    <li><strong>점검 일시:</strong> 2025년 10월 24일(목) 오전 8시 ~ 오후 2시 (6시간 예정)</li>
    <li><strong>점검 대상:</strong> 전체 서버</li>
    <li><strong>점검 영향:</strong> 게임 접속, 게임 플레이, 게시 등록 및 커뮤니티 기능 이용 불가</li>
  </ul>
</div>

<p>※ 점검 시간은 내부 사정에 따라 다소 변경될 수 있습니다.</p>

<div style="background-color: #fff9e6; padding: 15px; border-left: 4px solid #ff9800; margin: 20px 0;">
  <h3 style="margin-top: 0; color: #f57c00;">🎉 점검 주요 내용</h3>
  <ol>
    <li><strong>신규 이벤트:</strong> <em>(장미의 항로 축제)</em> 개최 (2025년 10월 24일(목) 점검 후) ~ 11월 14일(목) 23:59까지</li>
    <li><strong>기간:</strong> 2025년 10월 24일(목) 점검 후 ~ 11월 14일(목) 23:59까지</li>
    <li><strong>내용:</strong> 게임 접속, 게임 플레이, 게시 등록 및 커뮤니티 기능 이용 불가</li>
  </ol>
</div>

<p>※ 점검 시간은 내부 사정에 따라 변경될 수 있습니다.</p>`,
  description: '10월 24일 정기 점검 및 신규 이벤트 안내'
};

async function login() {
  try {
    console.log('🔐 Logging in as admin...');
    const response = await axios.post(`${API_BASE_URL}/api/v1/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if (response.data.success && response.data.data.token) {
      console.log('✅ Login successful');
      return response.data.data.token;
    } else {
      throw new Error('Login failed: No token received');
    }
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function createServiceNotice(token) {
  try {
    console.log('\n📝 Creating service notice...');
    console.log('Notice data:', {
      ...SERVICE_NOTICE,
      content: SERVICE_NOTICE.content.substring(0, 100) + '...'
    });

    const response = await axios.post(
      `${API_BASE_URL}/api/v1/admin/service-notices`,
      SERVICE_NOTICE,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.success) {
      console.log('✅ Service notice created successfully!');
      console.log('Notice ID:', response.data.data.notice.id);
      console.log('Title:', response.data.data.notice.title);
      return response.data.data.notice;
    } else {
      throw new Error('Failed to create service notice');
    }
  } catch (error) {
    console.error('❌ Failed to create service notice:', error.response?.data || error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting service notice creation via API...\n');
    console.log(`API Base URL: ${API_BASE_URL}`);
    console.log(`Admin Email: ${ADMIN_EMAIL}\n`);

    // Step 1: Login
    const token = await login();

    // Step 2: Create service notice
    const notice = await createServiceNotice(token);

    console.log('\n✅ All done!');
    console.log('\n📋 Created Notice Summary:');
    console.log('  ID:', notice.id);
    console.log('  Title:', notice.title);
    console.log('  Category:', notice.category);
    console.log('  Platforms:', notice.platforms.join(', '));
    console.log('  Start Date:', notice.startDate);
    console.log('  End Date:', notice.endDate);
    console.log('  Active:', notice.isActive);

  } catch (error) {
    console.error('\n❌ Script failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { createServiceNotice, login };

