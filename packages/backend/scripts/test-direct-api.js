require('dotenv').config();
const knex = require('knex')({
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'gatrix_admin',
    charset: 'utf8mb4'
  }
});

async function testDirectAPI() {
  try {
    console.log('🔍 Testing direct database query...');
    
    // Simulate the same query as the controller
    const page = 1;
    const limit = 10;
    const offset = (page - 1) * limit;
    
    // Build query
    let query = knex('g_api_access_tokens');
    
    // Get total count (separate query)
    let countQuery = knex('g_api_access_tokens');
    const [{ count: total }] = await countQuery.count('* as count');
    
    console.log('📊 Total tokens in database:', total);
    
    // Get tokens with pagination (separate query)
    const tokens = await query
      .orderBy('createdAt', 'desc')
      .limit(Number(limit))
      .offset(Number(offset));
    
    console.log('📦 Raw tokens from database:', tokens.length, 'tokens');
    console.log('🔍 First token sample:', tokens[0] ? {
      id: tokens[0].id,
      tokenName: tokens[0].tokenName,
      description: tokens[0].description,
      tokenType: tokens[0].tokenType,
      permissions: tokens[0].permissions,
      permissionsType: typeof tokens[0].permissions
    } : 'No tokens');
    
    // Format tokens (hide sensitive data)
    const formattedTokens = tokens.map((token) => {
      let permissions = [];
      
      // Handle different permission formats
      if (typeof token.permissions === 'string') {
        try {
          // Try to parse as JSON first
          permissions = JSON.parse(token.permissions);
        } catch (e) {
          // If JSON parse fails, treat as comma-separated string
          permissions = token.permissions.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
        }
      } else if (Array.isArray(token.permissions)) {
        permissions = token.permissions;
      } else {
        permissions = [];
      }
      
      return {
        ...token,
        tokenHash: token.tokenHash.substring(0, 8) + '••••••••••••••••', // Show only first 8 chars
        permissions,
        isActive: Boolean(token.isActive)
      };
    });
    
    console.log('✅ Formatted tokens:', formattedTokens.length, 'tokens');
    console.log('🔍 First formatted token:', formattedTokens[0] ? {
      id: formattedTokens[0].id,
      tokenName: formattedTokens[0].tokenName,
      description: formattedTokens[0].description,
      tokenType: formattedTokens[0].tokenType,
      permissions: formattedTokens[0].permissions,
      isActive: formattedTokens[0].isActive
    } : 'No tokens');
    
    // Simulate the API response structure
    const apiResponse = {
      success: true,
      data: {
        tokens: formattedTokens,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(Number(total) / Number(limit))
        }
      }
    };
    
    console.log('🎯 Final API response structure:', {
      success: apiResponse.success,
      dataKeys: Object.keys(apiResponse.data),
      tokensCount: apiResponse.data.tokens.length,
      pagination: apiResponse.data.pagination
    });
    
  } catch (error) {
    console.error('❌ Error testing direct API:', error);
  } finally {
    await knex.destroy();
  }
}

testDirectAPI();
