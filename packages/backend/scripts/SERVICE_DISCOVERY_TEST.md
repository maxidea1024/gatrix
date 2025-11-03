# Service Discovery Test Script

This script allows you to spawn and despawn dummy servers for testing the service discovery system.

## Prerequisites

1. **Create an API Token** in the admin panel:
   - Go to Admin Panel → API Tokens
   - Create a new token with type "Server SDK"
   - Copy the token value

2. **Get Admin JWT Token** (for listing servers):
   - Login to the admin panel
   - Open browser DevTools → Application → Local Storage
   - Copy the `token` value

## Environment Variables

```bash
# Required for spawning/despawning servers
export API_TOKEN="your-server-sdk-token-here"

# Required for listing servers
export ADMIN_TOKEN="your-admin-jwt-token-here"

# Optional: Backend API URL (default: http://localhost:5000)
export API_URL="http://localhost:5000"
```

## Usage

### Spawn Dummy Servers

Spawn 5 dummy servers:
```bash
ts-node scripts/test-service-discovery.ts --spawn 5
```

Spawn 10 servers with etcd mode:
```bash
ts-node scripts/test-service-discovery.ts --spawn 10 --mode etcd
```

### Despawn Servers

Despawn 2 servers:
```bash
ts-node scripts/test-service-discovery.ts --despawn 2
```

### List All Registered Servers

```bash
ts-node scripts/test-service-discovery.ts --list
```

### Clear All Active Servers

```bash
ts-node scripts/test-service-discovery.ts --clear
```

### Combined Operations

Spawn 10 servers and list them:
```bash
ts-node scripts/test-service-discovery.ts --spawn 10 --list
```

## How It Works

1. **Spawning**: Creates dummy servers with random:
   - Server types (world, auth, channel, chat, lobby, match)
   - IP addresses (10.0.x.x)
   - Ports (3000-4000 range)
   - Status (initializing, ready, shutting_down, error)

2. **Heartbeat**: Automatically sends heartbeat every 15 seconds to keep servers alive

3. **TTL**: Servers have a 60-second TTL. If heartbeat stops, they will be automatically removed

4. **Graceful Shutdown**: Press Ctrl+C to unregister all spawned servers and exit

## Example Session

```bash
# Terminal 1: Start backend
cd packages/backend
yarn dev

# Terminal 2: Spawn test servers
export API_TOKEN="your-token-here"
ts-node scripts/test-service-discovery.ts --spawn 5

# Keep this terminal running to maintain heartbeats
# Press Ctrl+C when done to cleanup

# Terminal 3: View in admin panel
# Open http://localhost:3000/admin/server-list
# You should see the 5 dummy servers with real-time updates
```

## Testing Real-time Updates

1. Spawn some servers in Terminal 2
2. Open the admin panel Server List page
3. Watch the servers appear in real-time
4. Spawn more servers or despawn some
5. See the changes reflected immediately in the UI

## Troubleshooting

### "Failed to register server: 401 Unauthorized"
- Make sure you've set the `API_TOKEN` environment variable
- Verify the token is valid and has "Server SDK" type

### "Failed to list servers: 401 Unauthorized"
- Make sure you've set the `ADMIN_TOKEN` environment variable
- Verify you're logged in and the token is fresh

### Servers not appearing in UI
- Check that the backend is running
- Verify the SSE connection is established (look for "Real-time Connected" badge)
- Check browser console for errors

### Servers disappearing after 60 seconds
- This is expected behavior if the script is not running
- The script must keep running to send heartbeats
- Press Ctrl+C to gracefully shutdown and cleanup

