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

function generatePermissions() {
  const allPermissions = ['read', 'write', 'admin'];
  const numPermissions = Math.floor(Math.random() * 3) + 1; // 1-3 permissions
  const selectedPermissions = [];

  // Always include 'read'
  selectedPermissions.push('read');

  if (numPermissions > 1) {
    if (Math.random() > 0.5) selectedPermissions.push('write');
  }

  if (numPermissions > 2) {
    if (Math.random() > 0.7) selectedPermissions.push('admin');
  }

  // Return as proper JSON array (not string)
  const uniquePermissions = [...new Set(selectedPermissions)];
  return uniquePermissions; // Return array directly, not JSON string
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
    
    const tokens = [];
    const tokenTypes = ['client', 'server', 'admin'];
    
    for (let i = 0; i < 1; i++) { // Debug: only 1 token
      const tokenName = generateTokenName();
      const tokenType = tokenTypes[Math.floor(Math.random() * tokenTypes.length)];
      
      // Generate secure token hash
      const tokenValue = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');
      
      // Environment ID (null for admin tokens, 1-3 for others)
      const environmentId = tokenType === 'admin' ? null : Math.floor(Math.random() * 3) + 1;
      
      const permissionsArray = generatePermissions();
      // Store as JSON string for MySQL JSON column
      const permissions = JSON.stringify(permissionsArray);

      console.log(`Debug - Token ${i+1}: permissions array = ${JSON.stringify(permissionsArray)}, JSON string = ${permissions}`);
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
      
      tokens.push([
        tokenName,
        tokenHash,
        tokenType,
        environmentId,
        permissions,
        isActive,
        expiresAt,
        lastUsedAt,
        createdBy,
        createdAt,
        createdAt
      ]);
    }
    
    console.log('Inserting tokens into database...');
    
    // Insert tokens in batches of 50
    const batchSize = 50;
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const values = batch.flat();
      
      await connection.execute(`
        INSERT INTO g_api_access_tokens (
          tokenName, tokenHash, tokenType, environmentId, permissions,
          isActive, expiresAt, lastUsedAt, createdBy, createdAt, updatedAt
        ) VALUES ${placeholders}
      `, values);
      
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(tokens.length / batchSize)}`);
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
    
  } catch (error) {
    console.error('Error creating API access token mock data:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

seedApiAccessTokens();
