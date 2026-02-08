const mysql = require('mysql2/promise');

async function checkRulesConstraints() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'motif_dev',
      password: 'dev123$',
      database: 'uwo_gate',
    });

    console.log('=== g_remote_config_rules 테이블 제약조건 확인 ===\n');

    // 테이블 구조 확인
    const [structure] = await connection.execute('DESCRIBE g_remote_config_rules');
    console.log('📋 테이블 구조:');
    structure.forEach((column) => {
      console.log(
        `  - ${column.Field}: ${column.Type} ${column.Null === 'YES' ? '(NULL 허용)' : '(NOT NULL)'} ${column.Key ? `[${column.Key}]` : ''}`
      );
    });

    // 외래키 제약조건 확인
    const [constraints] = await connection.execute(`
      SELECT 
        CONSTRAINT_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = 'uwo_gate' 
      AND TABLE_NAME = 'g_remote_config_rules'
      AND REFERENCED_TABLE_NAME IS NOT NULL
    `);

    console.log('\n🔗 외래키 제약조건:');
    if (constraints.length > 0) {
      constraints.forEach((constraint) => {
        console.log(
          `  - ${constraint.CONSTRAINT_NAME}: ${constraint.COLUMN_NAME} → ${constraint.REFERENCED_TABLE_NAME}.${constraint.REFERENCED_COLUMN_NAME}`
        );
      });
    } else {
      console.log('  외래키 제약조건이 없습니다.');
    }

    await connection.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkRulesConstraints();
