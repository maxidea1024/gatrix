require('dotenv').config();
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gatrix_admin',
  charset: 'utf8mb4'
};

async function verifyPermissions() {
  const connection = await mysql.createConnection(config);
  
  try {
    console.log('Verifying permissions format...');
    
    // Check sample permissions data
    const [result] = await connection.execute(`
      SELECT id, tokenName, permissions 
      FROM g_api_access_tokens 
      LIMIT 10
    `);
    
    console.log('Sample permissions data:');
    let validCount = 0;
    let invalidCount = 0;
    
    result.forEach(row => {
      console.log(`\nID: ${row.id}, Name: ${row.tokenName}`);
      console.log(`Permissions raw: "${row.permissions}"`);
      console.log(`Type: ${typeof row.permissions}`);
      
      try {
        const parsed = JSON.parse(row.permissions);
        console.log(`✅ Parsed successfully: ${JSON.stringify(parsed)}`);
        console.log(`   Array: ${Array.isArray(parsed)}`);
        console.log(`   Length: ${parsed.length}`);
        validCount++;
      } catch (e) {
        console.log(`❌ Parse Error: ${e.message}`);
        invalidCount++;
      }
    });
    
    console.log(`\n📊 Summary:`);
    console.log(`✅ Valid JSON: ${validCount}`);
    console.log(`❌ Invalid JSON: ${invalidCount}`);
    
    // Check all permissions for validity
    const [allResult] = await connection.execute(`
      SELECT COUNT(*) as total FROM g_api_access_tokens
    `);
    
    console.log(`\n📋 Total tokens: ${allResult[0].total}`);
    
  } catch (error) {
    console.error('Error verifying permissions:', error);
  } finally {
    await connection.end();
  }
}

verifyPermissions();
