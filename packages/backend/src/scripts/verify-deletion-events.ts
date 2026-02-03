import { pubSubService } from '../services/PubSubService';
import { Redis } from 'ioredis';
import { config } from '../config';

async function main() {
  console.log('Initializing Redis connection for verification...');

  // Create a subscriber to listen for SDK events
  const subscriber = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
  });

  await subscriber.subscribe('gatrix-sdk-events');
  console.log('Subscribed to gatrix-sdk-events channel');

  subscriber.on('message', (channel, message) => {
    const event = JSON.parse(message);
    console.log(`[Redis Listener] Received event: ${event.type}`, event.data);
  });

  // Verify Service Notice Deleted Event
  console.log('\n--- Verifying Service Notice Deleted Event ---');
  await pubSubService.publishSDKEvent({
    type: 'service_notice.deleted',
    data: {
      id: 9999,
      environment: 'development',
      timestamp: Date.now(),
    },
  });
  console.log('Published service_notice.deleted event');

  // Verify Client Version Deleted Event
  console.log('\n--- Verifying Client Version Deleted Event ---');
  await pubSubService.publishSDKEvent({
    type: 'client_version.deleted',
    data: {
      id: 8888,
      environment: 'development',
      timestamp: Date.now(),
    },
  });
  console.log('Published client_version.deleted event');

  // Wait a bit for events to be processed and logs to appear
  await new Promise((resolve) => setTimeout(resolve, 2000));

  console.log('\nVerification complete. Watch the logs for "removing from cache" messages.');
  process.exit(0);
}

main().catch(console.error);
