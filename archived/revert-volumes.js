const fs = require('fs');
const path = require('path');

const gameGatrixDir = 'c:/work/uwo/game/gatrix';

const filesToFix = [
  path.join(gameGatrixDir, 'docker-compose.yml'),
  path.join(gameGatrixDir, 'docker-compose.dev.yml'),
  path.join(gameGatrixDir, 'docker-compose.lite.yml'),
  path.join(gameGatrixDir, 'docker-compose.prod.yml'),
  path.join(gameGatrixDir, 'docker-compose-infra.yml')
];

for (const file of filesToFix) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace gatrix_redis_dev_data or gatrix_redis_data with bind mount
    // For the game prep repo, maybe it uses ~/gatrix-data instead of ./data ?
    // I'll replace with ${DATA_ROOT:-~/gatrix-data}/redis:/data
    content = content.replace(/- gatrix_redis_data:\/data/g, '- ${DATA_ROOT:-~/gatrix-data}/redis:/data');
    content = content.replace(/- gatrix_redis_dev_data:\/data/g, '- ${DATA_ROOT:-~/gatrix-data}/redis:/data');
    
    // Remove the volume declaration at the bottom
    content = content.replace(/  gatrix_redis_data:\r?\n?/g, '');
    content = content.replace(/  gatrix_redis_dev_data:\r?\n?/g, '');
    
    // For Redis service command, ensure we use appendonly if it was removed
    // We can restore it to the old state by looking for the notify-keyspace-events without --appendonly yes
    content = content.replace(/command: redis-server --notify-keyspace-events Ex\r?\n/g, 'command: redis-server --appendonly yes --notify-keyspace-events Ex\n');
    content = content.replace(/command: redis-server \/usr\/local\/etc\/redis\/redis.conf\r?\n/g, 'command: redis-server /usr/local/etc/redis/redis.conf --appendonly yes\n');
    
    fs.writeFileSync(file, content);
    console.log('Fixed', file);
  }
}

// Revert redis.conf
const redisConfPath = path.join(gameGatrixDir, 'docker/redis/redis.conf');
if (fs.existsSync(redisConfPath)) {
  let content = fs.readFileSync(redisConfPath, 'utf8');
  content = content.replace(/# More aggressive save intervals to minimize data loss without AOF\r?\n/, '');
  content = content.replace(/save 60 1\r?\nsave 30 10\r?\nsave 10 10000/g, 'save 900 1\nsave 300 10\nsave 60 10000');
  
  content = content.replace(/# Disabled: AOF is prone to corruption on ungraceful shutdown\.\r?\n/, '');
  content = content.replace(/# Using RDB snapshots with aggressive save intervals instead\.\r?\n/, '');
  content = content.replace(/appendonly no/g, 'appendonly yes\nappendfilename "appendonly.aof"\nappendfsync everysec\nno-appendfsync-on-rewrite no\nauto-aof-rewrite-percentage 100\nauto-aof-rewrite-min-size 64mb\naof-load-truncated yes\naof-use-rdb-preamble yes');
  
  fs.writeFileSync(redisConfPath, content);
  console.log('Fixed redis.conf');
}
