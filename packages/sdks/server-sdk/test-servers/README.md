# Test Servers

This directory contains test servers that simulate real-world usage of the Gatrix Server SDK.

## Test Scenario

We simulate a game infrastructure with multiple server types:

1. **authd** - Authentication server (2 instances)
   - Group: `production`
   - Handles user authentication
   - Registers to service discovery

2. **lobbyd** - Lobby server (3 instances)
   - Group: `production`, `staging`
   - Manages game lobbies
   - Uses cached game worlds and popups

3. **chatd** - Chat server (2 instances)
   - Group: `production`
   - Handles in-game chat
   - Listens to custom events

4. **worldd** - World server (4 instances)
   - Groups: `kr-1`, `kr-2`, `us-east`, `us-west`
   - Game world servers
   - Full SDK feature usage

## Running Tests

```bash
# Install dependencies first
npm install

# Run all test servers
npm run test:servers

# Run specific server type
npm run test:authd
npm run test:lobbyd
npm run test:chatd
npm run test:worldd

# Run orchestrator (starts all servers)
npm run test:orchestrator
```

## What Gets Tested

- ✅ SDK initialization
- ✅ Service discovery registration
- ✅ Cache loading (game worlds, popups, surveys)
- ✅ Event listening (Redis PubSub)
- ✅ Heartbeat mechanism
- ✅ Multiple instances of same service type
- ✅ Different service groups
- ✅ Graceful shutdown
- ✅ Error handling
