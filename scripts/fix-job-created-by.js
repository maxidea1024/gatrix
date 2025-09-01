const mysql = require('mysql2/promise');

async function fixJobCreatedBy() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix'
  });

  try {
    console.log('Fixing Job createdBy values...');

    // 첫 번째 관리자 사용자 찾기
    const [adminUsers] = await connection.execute(`
      SELECT id, name, email FROM g_users 
      WHERE role = 'admin' 
      ORDER BY id ASC 
      LIMIT 1
    `);

    if (adminUsers.length === 0) {
      console.log('No admin user found, cannot fix job createdBy values');
      return;
    }

    const adminUser = adminUsers[0];
    console.log(`Found admin user: ${adminUser.name} (${adminUser.email}) with ID: ${adminUser.id}`);

    // createdBy가 null인 모든 Job 업데이트
    const [result] = await connection.execute(`
      UPDATE g_jobs 
      SET createdBy = ?, updatedBy = ?
      WHERE createdBy IS NULL
    `, [adminUser.id, adminUser.id]);

    console.log(`Updated ${result.affectedRows} jobs with createdBy = ${adminUser.id}`);

    // 업데이트된 Job 확인
    const [updatedJobs] = await connection.execute(`
      SELECT j.id, j.name, j.createdBy, u.name as createdByName
      FROM g_jobs j
      LEFT JOIN g_users u ON j.createdBy = u.id
      LIMIT 5
    `);

    console.log('Sample updated jobs:');
    updatedJobs.forEach(job => {
      console.log(`  Job ${job.id}: ${job.name} - Created by: ${job.createdByName || 'NULL'}`);
    });

  } catch (error) {
    console.error('Error fixing job createdBy values:', error);
  } finally {
    await connection.end();
  }
}

// 스크립트 실행
if (require.main === module) {
  fixJobCreatedBy().catch(console.error);
}

module.exports = { fixJobCreatedBy };
