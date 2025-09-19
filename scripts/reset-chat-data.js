#!/usr/bin/env node

const mysql = require('mysql2/promise');
const Redis = require('ioredis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// 환경별 설정
const configs = {
  backend: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'admin_panel'
  },
  chatServer: {
    host: process.env.CHAT_DB_HOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.CHAT_DB_PORT || process.env.DB_PORT || '3306', 10),
    user: process.env.CHAT_DB_USER || process.env.DB_USER || 'root',
    password: process.env.CHAT_DB_PASSWORD || process.env.DB_PASSWORD || 'password',
    database: process.env.CHAT_DB_NAME || 'gatrix_chat'
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10)
  }
};

async function resetChatData() {
  console.log('🔄 Starting chat data reset...\n');

  let backendDb = null;
  let chatDb = null;
  let redis = null;

  try {
    // 1. Backend DB 연결 (채팅 관련 테이블)
    console.log('📊 Connecting to backend database...');
    backendDb = await mysql.createConnection(configs.backend);
    console.log('✅ Backend database connected');

    // 2. Chat Server DB 연결
    console.log('💬 Connecting to chat server database...');
    chatDb = await mysql.createConnection(configs.chatServer);
    console.log('✅ Chat server database connected');

    // 3. Redis 연결
    console.log('🔴 Connecting to Redis...');
    redis = new Redis(configs.redis);
    await redis.ping();
    console.log('✅ Redis connected');

    // 4. Backend DB 채팅 관련 테이블 초기화
    console.log('\n🗑️  Clearing backend chat-related tables...');
    
    const backendTables = [
      'chat_notifications',
      'chat_user_settings',
      'chat_blocked_users'
    ];

    for (const table of backendTables) {
      try {
        await backendDb.execute(`DELETE FROM ${table}`);
        console.log(`   ✅ Cleared ${table}`);
      } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
          console.log(`   ⚠️  Table ${table} does not exist, skipping`);
        } else {
          console.log(`   ❌ Error clearing ${table}:`, error.message);
        }
      }
    }

    // 5. Chat Server DB 테이블 초기화
    console.log('\n🗑️  Clearing chat server tables...');
    
    const chatTables = [
      'chat_message_reactions',
      'chat_message_attachments', 
      'chat_messages',
      'chat_channel_members',
      'chat_channels',
      'chat_users',
      'chat_invitations'
    ];

    for (const table of chatTables) {
      try {
        await chatDb.execute(`DELETE FROM ${table}`);
        await chatDb.execute(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
        console.log(`   ✅ Cleared ${table}`);
      } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
          console.log(`   ⚠️  Table ${table} does not exist, skipping`);
        } else {
          console.log(`   ❌ Error clearing ${table}:`, error.message);
        }
      }
    }

    // 6. Redis 채팅 관련 키 삭제
    console.log('\n🗑️  Clearing Redis chat data...');
    
    const redisPatterns = [
      'chat:*',
      'channel:*',
      'user:*:typing',
      'user:*:presence',
      'message:*',
      'notification:*',
      'websocket:*'
    ];

    for (const pattern of redisPatterns) {
      try {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
          console.log(`   ✅ Cleared ${keys.length} keys matching ${pattern}`);
        } else {
          console.log(`   ℹ️  No keys found matching ${pattern}`);
        }
      } catch (error) {
        console.log(`   ❌ Error clearing pattern ${pattern}:`, error.message);
      }
    }

    console.log('\n🎉 Chat data reset completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   • All chat messages deleted');
    console.log('   • All channels and memberships cleared');
    console.log('   • All message reactions and attachments removed');
    console.log('   • All chat users cleared');
    console.log('   • All invitations deleted');
    console.log('   • Redis chat cache cleared');
    console.log('   • Auto-increment counters reset');

  } catch (error) {
    console.error('\n❌ Error during chat data reset:', error);
    process.exit(1);
  } finally {
    // 연결 정리
    if (backendDb) {
      await backendDb.end();
      console.log('\n🔌 Backend database connection closed');
    }
    if (chatDb) {
      await chatDb.end();
      console.log('🔌 Chat database connection closed');
    }
    if (redis) {
      redis.disconnect();
      console.log('🔌 Redis connection closed');
    }
  }
}

// CLI 실행
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🔄 Chat Data Reset Tool

Usage: node scripts/reset-chat-data.js [options]

Options:
  --help, -h     Show this help message
  --confirm, -y  Skip confirmation prompt

Description:
  This tool completely resets all chat-related data including:
  • Chat messages and attachments
  • Channels and memberships  
  • Message reactions
  • Chat users and invitations
  • Redis cache data

⚠️  WARNING: This action is irreversible!
`);
    process.exit(0);
  }

  if (!args.includes('--confirm') && !args.includes('-y')) {
    console.log('⚠️  WARNING: This will permanently delete ALL chat data!');
    console.log('   Use --confirm or -y flag to proceed without this prompt.');
    console.log('   Example: node scripts/reset-chat-data.js --confirm');
    process.exit(1);
  }

  resetChatData();
}

module.exports = { resetChatData };
