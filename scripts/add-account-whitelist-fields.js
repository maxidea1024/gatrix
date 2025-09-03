const mysql = require('mysql2/promise');
require('dotenv').config({ path: './packages/backend/.env' });

async function addAccountWhitelistFields() {
  let connection;
  
  try {
    console.log('데이터베이스 연결 중...');
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'motif_dev',
      password: process.env.DB_PASSWORD || 'dev123$',
      database: process.env.DB_NAME || 'uwo_gate'
    });
    console.log('데이터베이스 연결 성공!');
    
    // 현재 테이블 구조 확인
    console.log('\n=== 현재 g_account_whitelist 테이블 구조 ===');
    const [currentColumns] = await connection.execute('DESCRIBE g_account_whitelist');
    console.table(currentColumns);
    
    // isEnabled 필드가 이미 있는지 확인
    const hasIsEnabled = currentColumns.some(col => col.Field === 'isEnabled');
    const hasUpdatedBy = currentColumns.some(col => col.Field === 'updatedBy');
    
    console.log(`\nisEnabled 필드 존재: ${hasIsEnabled}`);
    console.log(`updatedBy 필드 존재: ${hasUpdatedBy}`);
    
    // isEnabled 필드 추가
    if (!hasIsEnabled) {
      console.log('\n=== isEnabled 필드 추가 중... ===');
      await connection.execute(`
        ALTER TABLE g_account_whitelist 
        ADD COLUMN isEnabled TINYINT(1) NOT NULL DEFAULT 1 AFTER purpose
      `);
      
      // 인덱스 추가
      await connection.execute(`
        ALTER TABLE g_account_whitelist 
        ADD INDEX idx_account_whitelist_enabled (isEnabled)
      `);
      
      console.log('✅ isEnabled 필드 추가 완료');
    } else {
      console.log('⚠️ isEnabled 필드가 이미 존재합니다.');
    }
    
    // updatedBy 필드 추가
    if (!hasUpdatedBy) {
      console.log('\n=== updatedBy 필드 추가 중... ===');
      await connection.execute(`
        ALTER TABLE g_account_whitelist 
        ADD COLUMN updatedBy INT UNSIGNED NULL AFTER createdBy
      `);
      
      // 인덱스 추가
      await connection.execute(`
        ALTER TABLE g_account_whitelist 
        ADD INDEX idx_account_whitelist_updated_by (updatedBy)
      `);
      
      // 외래키 제약조건 추가
      await connection.execute(`
        ALTER TABLE g_account_whitelist 
        ADD CONSTRAINT fk_account_whitelist_updated_by 
        FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL
      `);
      
      console.log('✅ updatedBy 필드 추가 완료');
    } else {
      console.log('⚠️ updatedBy 필드가 이미 존재합니다.');
    }
    
    // 기존 데이터의 updatedBy 필드를 createdBy와 동일하게 설정
    if (!hasUpdatedBy) {
      console.log('\n=== 기존 데이터의 updatedBy 필드 업데이트 중... ===');
      const [updateResult] = await connection.execute(`
        UPDATE g_account_whitelist 
        SET updatedBy = createdBy 
        WHERE updatedBy IS NULL
      `);
      console.log(`✅ ${updateResult.affectedRows}개 레코드의 updatedBy 필드 업데이트 완료`);
    }
    
    // 수정된 테이블 구조 확인
    console.log('\n=== 수정된 g_account_whitelist 테이블 구조 ===');
    const [newColumns] = await connection.execute('DESCRIBE g_account_whitelist');
    console.table(newColumns);
    
    // 샘플 데이터 확인
    console.log('\n=== 샘플 데이터 확인 (첫 3개) ===');
    const [sampleData] = await connection.execute('SELECT * FROM g_account_whitelist LIMIT 3');
    console.table(sampleData);
    
    console.log('\n✅ 모든 작업이 완료되었습니다!');
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n데이터베이스 연결 종료');
    }
  }
}

// 스크립트 실행
addAccountWhitelistFields().catch(console.error);
