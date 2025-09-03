const mysql = require('mysql2/promise');
require('dotenv').config({ path: './packages/backend/.env' });

async function fixUpdatedByField() {
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
    
    // 현재 updatedBy 필드 타입 확인
    console.log('\n=== 현재 updatedBy 필드 타입 확인 ===');
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'g_account_whitelist' AND COLUMN_NAME = 'updatedBy'
    `, [process.env.DB_NAME || 'uwo_gate']);
    
    if (columns.length > 0) {
      console.table(columns);
      
      // updatedBy 필드 타입을 int로 변경
      console.log('\n=== updatedBy 필드 타입을 int로 변경 중... ===');
      await connection.execute(`
        ALTER TABLE g_account_whitelist 
        MODIFY COLUMN updatedBy INT NULL
      `);
      
      console.log('✅ updatedBy 필드 타입 변경 완료');
      
      // 외래키 제약조건 추가
      console.log('\n=== 외래키 제약조건 추가 중... ===');
      await connection.execute(`
        ALTER TABLE g_account_whitelist 
        ADD CONSTRAINT fk_account_whitelist_updated_by 
        FOREIGN KEY (updatedBy) REFERENCES g_users(id) ON DELETE SET NULL
      `);
      
      console.log('✅ 외래키 제약조건 추가 완료');
      
      // 기존 데이터의 updatedBy 필드를 createdBy와 동일하게 설정
      console.log('\n=== 기존 데이터의 updatedBy 필드 업데이트 중... ===');
      const [updateResult] = await connection.execute(`
        UPDATE g_account_whitelist 
        SET updatedBy = createdBy 
        WHERE updatedBy IS NULL
      `);
      console.log(`✅ ${updateResult.affectedRows}개 레코드의 updatedBy 필드 업데이트 완료`);
      
    } else {
      console.log('⚠️ updatedBy 필드가 존재하지 않습니다.');
    }
    
    // 수정된 테이블 구조 확인
    console.log('\n=== 수정된 g_account_whitelist 테이블 구조 ===');
    const [newColumns] = await connection.execute('DESCRIBE g_account_whitelist');
    console.table(newColumns);
    
    // 외래키 제약조건 확인
    console.log('\n=== 외래키 제약조건 확인 ===');
    const [foreignKeys] = await connection.execute(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'g_account_whitelist' 
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [process.env.DB_NAME || 'uwo_gate']);
    console.table(foreignKeys);
    
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
fixUpdatedByField().catch(console.error);
