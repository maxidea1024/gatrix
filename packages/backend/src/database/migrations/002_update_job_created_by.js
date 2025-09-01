/**
 * Migration to update existing jobs with createdBy values
 */

const mysql = require('mysql2/promise');

async function up(connection) {
  console.log('Running migration: Update job createdBy values');

  try {
    // 첫 번째 관리자 사용자 찾기
    const [adminUsers] = await connection.execute(`
      SELECT id FROM g_users 
      WHERE role = 'admin' 
      ORDER BY id ASC 
      LIMIT 1
    `);

    if (adminUsers.length === 0) {
      console.log('No admin user found, skipping job createdBy update');
      return;
    }

    const adminUserId = adminUsers[0].id;
    console.log(`Found admin user with ID: ${adminUserId}`);

    // createdBy가 null인 모든 Job 업데이트
    const [result] = await connection.execute(`
      UPDATE g_jobs 
      SET createdBy = ?, updatedBy = ?
      WHERE createdBy IS NULL
    `, [adminUserId, adminUserId]);

    console.log(`Updated ${result.affectedRows} jobs with createdBy = ${adminUserId}`);

  } catch (error) {
    console.error('Error updating job createdBy values:', error);
    throw error;
  }
}

async function down(connection) {
  console.log('Rolling back migration: Update job createdBy values');
  
  try {
    // createdBy를 다시 null로 되돌리기 (선택사항)
    const [result] = await connection.execute(`
      UPDATE g_jobs 
      SET createdBy = NULL, updatedBy = NULL
      WHERE createdBy IS NOT NULL
    `);

    console.log(`Rolled back ${result.affectedRows} jobs createdBy to NULL`);

  } catch (error) {
    console.error('Error rolling back job createdBy values:', error);
    throw error;
  }
}

module.exports = { up, down };
