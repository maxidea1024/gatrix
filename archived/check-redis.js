const Redis = require('ioredis');

// Connect to Redis on localhost:56379 (default dev port)
const redis = new Redis({
  host: 'localhost',
  port: 56379,
  // password: '...' // If needed
});

async function check() {
  try {
    console.log('Checking for inactive services in Redis...');
    const keys = await redis.keys('service-discovery:inactive:*');
    console.log(`Found ${keys.length} inactive keys.`);

    for (const key of keys) {
      const value = await redis.get(key);
      console.log(`Key: ${key}`);
      console.log(`Value: ${value}`);
    }
  } catch (err) {
    console.error('Redis error:', err);
  } finally {
    redis.disconnect();
  }
}

check();
