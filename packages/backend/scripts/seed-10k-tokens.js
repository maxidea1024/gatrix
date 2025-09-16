require('dotenv').config();
const mysql = require('mysql2/promise');
const crypto = require('crypto');

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gatrix_admin',
  port: process.env.DB_PORT || 3306
};

// Enhanced mock data generators for realistic tokens
const companies = [
  'Acme Corp', 'TechFlow', 'DataSync', 'CloudBase', 'WebCore', 'ProTech', 'DevOps Inc', 
  'CodeLab', 'NetSoft', 'AppForge', 'ByteWorks', 'CyberTech', 'DigitalHub', 'FlexSoft',
  'GigaNet', 'HyperCode', 'InnoTech', 'JetStream', 'KodeWorks', 'LogicFlow', 'MetaCore',
  'NexusLab', 'OmniTech', 'PixelForge', 'QuantumSoft', 'RapidDev', 'SkyNet', 'TurboCode',
  'UltraSync', 'VelocityLab', 'WaveCore', 'XenonTech', 'YottaByte', 'ZenithSoft'
];

const services = [
  'API Gateway', 'User Service', 'Payment Service', 'Analytics Engine', 'Data Pipeline',
  'Auth Service', 'Notification Hub', 'File Storage', 'Cache Layer', 'Search Engine',
  'Monitoring System', 'Backup Service', 'CDN Manager', 'Database Proxy', 'Event Bus',
  'Load Balancer', 'Message Queue', 'Session Store', 'Rate Limiter', 'Health Checker',
  'Log Aggregator', 'Metrics Collector', 'Alert Manager', 'Config Service', 'Secret Manager'
];

const environments = [
  'Production', 'Development', 'Testing', 'Staging', 'QA', 'UAT', 'Demo', 'Sandbox',
  'Integration', 'Performance', 'Security', 'Canary', 'Blue', 'Green', 'Alpha', 'Beta'
];

const purposes = [
  'API Access', 'Data Integration', 'Monitoring', 'Analytics', 'Backup', 'Migration',
  'Deployment', 'Testing', 'Development', 'CI/CD', 'Webhook', 'Third Party', 'Mobile App',
  'Web App', 'Microservice', 'ETL Process', 'Scheduled Job', 'Health Check', 'Metrics',
  'Logging', 'Security Scan', 'Performance Test', 'Load Test', 'Smoke Test', 'E2E Test'
];

const clientTypes = [
  'Mobile App', 'Web Application', 'Desktop Client', 'Browser Extension', 'CLI Tool',
  'SDK Integration', 'Third Party App', 'Partner Integration', 'Customer Portal',
  'Admin Dashboard', 'Developer Console', 'Testing Framework', 'Automation Script'
];

const serverTypes = [
  'Microservice', 'Background Worker', 'Scheduled Job', 'Data Processor', 'API Gateway',
  'Load Balancer', 'Proxy Server', 'Cache Server', 'Database Service', 'File Server',
  'Message Broker', 'Event Handler', 'Stream Processor', 'Batch Processor', 'ETL Pipeline'
];

function generateTokenName(tokenType) {
  const company = companies[Math.floor(Math.random() * companies.length)];
  const environment = environments[Math.floor(Math.random() * environments.length)];
  
  if (tokenType === 'client') {
    const clientType = clientTypes[Math.floor(Math.random() * clientTypes.length)];
    return `${company} ${environment} ${clientType}`;
  } else if (tokenType === 'server') {
    const serverType = serverTypes[Math.floor(Math.random() * serverTypes.length)];
    return `${company} ${environment} ${serverType}`;
  } else {
    const service = services[Math.floor(Math.random() * services.length)];
    return `${company} ${environment} ${service}`;
  }
}

function generateDescription(tokenName, tokenType) {
  const purposes_list = purposes[Math.floor(Math.random() * purposes.length)];
  const service = services[Math.floor(Math.random() * services.length)];
  
  const templates = [
    `Used for ${purposes_list.toLowerCase()} in ${tokenName.split(' ')[1].toLowerCase()} environment`,
    `${tokenType.charAt(0).toUpperCase() + tokenType.slice(1)} token for ${service.toLowerCase()} integration`,
    `Provides access to ${service.toLowerCase()} for ${purposes_list.toLowerCase()}`,
    `Authentication token for ${tokenName.split(' ')[2]?.toLowerCase() || 'service'} operations`,
    `Secure access token for ${purposes_list.toLowerCase()} and data processing`,
    `${tokenType.toUpperCase()} token enabling ${service.toLowerCase()} functionality`,
    `Production-grade token for ${purposes_list.toLowerCase()} workflows`,
    `Dedicated ${tokenType} access for ${service.toLowerCase()} operations`
  ];
  
  return templates[Math.floor(Math.random() * templates.length)];
}

// Remove permissions function since the table doesn't have this column

function generateRandomDate(startDays, endDays) {
  const start = new Date();
  start.setDate(start.getDate() - startDays);
  const end = new Date();
  end.setDate(end.getDate() - endDays);
  
  const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());
  return new Date(randomTime);
}

async function seed10kTokens() {
  const connection = await mysql.createConnection(config);
  
  try {
    console.log('🚀 Starting to generate 10,000 API tokens...');
    console.log('⚠️  This will clear existing tokens and create new ones.');
    
    // Clear existing tokens
    console.log('🗑️  Clearing existing API access tokens...');
    await connection.execute('DELETE FROM g_api_access_tokens WHERE id > 0');
    await connection.execute('ALTER TABLE g_api_access_tokens AUTO_INCREMENT = 1');

    console.log('📊 Generating 10,000 realistic API access tokens...');
    
    const batchSize = 100;
    const totalTokens = 10000;
    const tokenTypes = ['client', 'server'];
    
    for (let batch = 0; batch < totalTokens / batchSize; batch++) {
      const tokens = [];
      
      for (let i = 0; i < batchSize; i++) {
        const tokenType = tokenTypes[Math.floor(Math.random() * tokenTypes.length)];
        const tokenName = generateTokenName(tokenType);
        const description = generateDescription(tokenName, tokenType);
        
        // Generate secure token hash
        const tokenValue = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');
        
        // Environment ID (1-3 for client/server tokens)
        const environmentId = Math.floor(Math.random() * 3) + 1;
        
        // Expiration date (40% no expiration, 60% random future date)
        let expiresAt = null;
        if (Math.random() > 0.4) {
          const daysFromNow = Math.floor(Math.random() * 1095) + 30; // 30 days to 3 years
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + daysFromNow);
        }
        
        // Last used date (75% used recently, 25% never used)
        let lastUsedAt = null;
        if (Math.random() > 0.25) {
          lastUsedAt = generateRandomDate(60, 0); // Within last 60 days
        }
        
        const createdBy = 1; // Admin user
        const createdAt = generateRandomDate(365, 1); // Created within last year
        
        tokens.push([
          tokenName,
          description,
          tokenHash,
          tokenType,
          environmentId,
          expiresAt,
          lastUsedAt,
          createdBy,
          createdBy, // updatedBy = createdBy
          createdAt,
          createdAt  // updatedAt = createdAt
        ]);
      }
      
      // Batch insert
      const placeholders = tokens.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      const flatValues = tokens.flat();

      await connection.execute(`
        INSERT INTO g_api_access_tokens (
          tokenName, description, tokenHash, tokenType, environmentId,
          expiresAt, lastUsedAt, createdBy, updatedBy, createdAt, updatedAt
        ) VALUES ${placeholders}
      `, flatValues);
      
      const completed = (batch + 1) * batchSize;
      console.log(`✅ Inserted ${completed}/${totalTokens} tokens (${Math.round(completed/totalTokens*100)}%)`);
    }
    
    // Show statistics
    const stats = await connection.execute(`
      SELECT
        tokenType,
        COUNT(*) as count,
        SUM(CASE WHEN expiresAt IS NULL THEN 1 ELSE 0 END) as no_expiry_count
      FROM g_api_access_tokens
      GROUP BY tokenType
    `);
    
    console.log('\n📈 Token Generation Statistics:');
    console.log('================================');
    stats[0].forEach(stat => {
      console.log(`${stat.tokenType.toUpperCase()} tokens: ${stat.count} total, ${stat.no_expiry_count} never expire`);
    });
    
    const totalCount = await connection.execute('SELECT COUNT(*) as total FROM g_api_access_tokens');
    console.log(`\n🎉 Successfully generated ${totalCount[0][0].total} API tokens!`);
    
  } catch (error) {
    console.error('❌ Error generating tokens:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// Run the seed function
seed10kTokens()
  .then(() => {
    console.log('✨ Token generation completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Token generation failed:', error);
    process.exit(1);
  });
