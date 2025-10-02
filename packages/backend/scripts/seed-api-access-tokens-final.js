require('dotenv').config();
const mysql = require('mysql2/promise');
const crypto = require('crypto');

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gatrix_admin',
  charset: 'utf8mb4'
};

// Mock data generators
const companies = ['Acme Corp', 'TechFlow', 'DataSync', 'CloudBase', 'WebCore', 'ProTech', 'DevOps Inc', 'CodeLab', 'NetSoft', 'AppForge'];
const purposes = ['Production', 'Development', 'Testing', 'Staging', 'Analytics', 'Monitoring', 'Integration', 'Backup', 'Migration', 'Deployment'];
const tokenTypes = ['Token', 'Key', 'Access', 'Auth', 'Gateway', 'Bridge', 'Handler', 'Client', 'Service', 'Credential'];

function generateTokenName() {
  const company = companies[Math.floor(Math.random() * companies.length)];
  const purpose = purposes[Math.floor(Math.random() * purposes.length)];
  const type = tokenTypes[Math.floor(Math.random() * tokenTypes.length)];
  return `${company} ${purpose} ${type}`;
}

function generatePermissionsSQL() {
  const rand = Math.random();
  
  if (rand < 0.3) {
    return "JSON_ARRAY('read')";
  } else if (rand < 0.7) {
    return "JSON_ARRAY('read', 'write')";
  } else {
    return "JSON_ARRAY('read', 'write', 'admin')";
  }
}

function generateRandomDate(startDays, endDays) {
  const start = new Date();
  start.setDate(start.getDate() - startDays);
  const end = new Date();
  end.setDate(end.getDate() - endDays);
  
  const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(randomTime);
}

async function seedApiAccessTokens() {
  const connection = await mysql.createConnection(config);
  
  try {
    console.log('Clearing existing API access tokens...');
    await connection.execute('DELETE FROM g_api_access_tokens WHERE id > 0');
    await connection.execute('ALTER TABLE g_api_access_tokens AUTO_INCREMENT = 1');
    
    console.log('Generating 500 API access tokens with proper JSON permissions...');
    
    const tokenTypes = ['client', 'server', 'admin'];
    
    for (let i = 0; i < 500; i++) {
      const tokenName = generateTokenName();
      const tokenType = tokenTypes[Math.floor(Math.random() * tokenTypes.length)];
      
      // Generate secure token hash
      const tokenValue = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');
      
      // Environment ID (null for admin tokens, 1-3 for others)
      const environmentId = tokenType === 'admin' ? null : Math.floor(Math.random() * 3) + 1;
      
      const permissionsSQL = generatePermissionsSQL();
      const isActive = Math.random() > 0.2; // 80% active
      
      // Expiration date (30% no expiration, 70% random future date)
      let expiresAt = null;
      if (Math.random() > 0.3) {
        const daysFromNow = Math.floor(Math.random() * 730) + 30; // 30 days to 2 years
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + daysFromNow);
      }
      
      // Last used date (70% used recently, 30% never used)
      let lastUsedAt = null;
      if (Math.random() > 0.3) {
        lastUsedAt = generateRandomDate(30, 0); // Within last 30 days
      }
      
      const createdBy = 1; // Admin user
      const createdAt = generateRandomDate(180, 1); // Created within last 6 months
      
      // Insert individual token using JSON_ARRAY function
      await connection.execute(`
        INSERT INTO g_api_access_tokens (
          tokenName, tokenHash, tokenType, environmentId, permissions,
          isActive, expiresAt, lastUsedAt, createdBy, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ${permissionsSQL}, ?, ?, ?, ?, ?, ?)
      `, [
        tokenName,
        tokenHash,
        tokenType,
        environmentId,
        // permissions is handled by SQL function
        isActive,
        expiresAt,
        lastUsedAt,
        createdBy,
        createdAt,
        createdAt
      ]);
      
      if ((i + 1) % 50 === 0) {
        console.log(`Inserted ${i + 1}/500 tokens...`);
      }
    }
    
    // Show statistics
    const [stats] = await connection.execute(`
      SELECT 
        tokenType,
        COUNT(*) as count,
        SUM(CASE WHEN isActive = 1 THEN 1 ELSE 0 END) as active_count
      FROM g_api_access_tokens 
      GROUP BY tokenType
    `);
    
    console.log('\n📊 Token Statistics:');
    stats.forEach(stat => {
      console.log(`  ${stat.tokenType}: ${stat.count} total (${stat.active_count} active)`);
    });
    
    const [totalCount] = await connection.execute('SELECT COUNT(*) as count FROM g_api_access_tokens');
    console.log(`\n✅ Successfully created ${totalCount[0].count} API access tokens`);
    
    // Verify JSON format
    console.log('\n🔍 Verifying JSON format...');
    const [sampleResult] = await connection.execute(`
      SELECT id, tokenName, permissions, JSON_VALID(permissions) as json_valid
      FROM g_api_access_tokens 
      LIMIT 3
    `);
    
    sampleResult.forEach(row => {
      console.log(`✅ Token ${row.id}: ${row.tokenName} - JSON Valid: ${row.json_valid} - Permissions: ${JSON.stringify(row.permissions)}`);
    });
    
  } catch (error) {
    console.error('Error creating API access token mock data:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

seedApiAccessTokens();
