/**
 * 테스트용 클라이언트 버전 데이터 생성 스크립트
 */

const mysql = require('mysql2/promise');

async function createTestClientVersion() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'motif_dev',
    password: process.env.DB_PASSWORD || 'dev123$',
    database: process.env.DB_NAME || 'uwo_gate'
  });

  try {
    console.log('데이터베이스 연결 성공');

    // 기존 데이터 확인
    const [existing] = await connection.execute(`
      SELECT COUNT(*) as count FROM g_client_versions
    `);
    console.log('기존 클라이언트 버전 수:', existing[0].count);

    // 기존 데이터 조회
    const [allData] = await connection.execute(`
      SELECT id, platform, clientVersion, clientStatus, gameServerAddress,
             patchAddress, guestModeAllowed, memo, createdAt
      FROM g_client_versions
      ORDER BY createdAt DESC
    `);
    console.log('기존 클라이언트 버전 목록:');
    allData.forEach((item, index) => {
      console.log(`${index + 1}. ID: ${item.id}, Platform: ${item.platform}, Version: ${item.clientVersion}, Status: ${item.clientStatus}`);
    });

    return; // 데이터 조회만 하고 종료

    // 테스트 데이터 생성
    const testData = {
      platform: 'pc',
      clientVersion: '1.0.0',
      clientStatus: 'online',
      gameServerAddress: 'https://game.example.com',
      gameServerAddressForWhiteList: null,
      patchAddress: 'https://patch.example.com',
      patchAddressForWhiteList: null,
      guestModeAllowed: true,
      externalClickLink: null,
      memo: '테스트 클라이언트 버전',
      customPayload: null,
      createdBy: 1,
      updatedBy: 1,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const [result] = await connection.execute(`
      INSERT INTO g_client_versions (
        platform, clientVersion, clientStatus, gameServerAddress, 
        gameServerAddressForWhiteList, patchAddress, patchAddressForWhiteList,
        guestModeAllowed, externalClickLink, memo, customPayload,
        createdBy, updatedBy, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      testData.platform,
      testData.clientVersion,
      testData.clientStatus,
      testData.gameServerAddress,
      testData.gameServerAddressForWhiteList,
      testData.patchAddress,
      testData.patchAddressForWhiteList,
      testData.guestModeAllowed,
      testData.externalClickLink,
      testData.memo,
      testData.customPayload,
      testData.createdBy,
      testData.updatedBy,
      testData.createdAt,
      testData.updatedAt
    ]);

    console.log('테스트 클라이언트 버전 생성 완료. ID:', result.insertId);

    // 생성된 데이터 확인
    const [newCount] = await connection.execute(`
      SELECT COUNT(*) as count FROM g_client_versions
    `);
    console.log('현재 클라이언트 버전 수:', newCount[0].count);

    // 생성된 데이터 조회
    const [created] = await connection.execute(`
      SELECT * FROM g_client_versions WHERE id = ?
    `, [result.insertId]);
    console.log('생성된 데이터:', created[0]);

  } catch (error) {
    console.error('오류 발생:', error);
  } finally {
    await connection.end();
  }
}

// 스크립트 실행
createTestClientVersion().catch(console.error);
