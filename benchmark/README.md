# Gatrix Edge Performance Benchmark

This folder contains performance testing scripts for the Gatrix Edge server using [Artillery](https://artillery.io/).

## Prerequisites

- [Artillery](https://artillery.io/) must be installed globally:
  ```bash
  npm install -g artillery
  ```

## Configuration

The test scripts are configured to use the following by default:
- **Target**: `http://localhost:3410` (Edge Server)
- **Token**: `gatrix-unsecured-edge-api-token`
- **Environment**: `production`

You can override these values using command-line arguments.

## Running Tests

### 1. Basic Performance Test

Run the standard performance test:
```bash
artillery run edge-performance.yml
```

### 2. Override Target or Environment

To test a different environment or a remote Edge server:
```bash
artillery run --target http://edge-server-address:3410 --variables '{"environment": "staging"}' edge-performance.yml
```

### 3. Quick Report

To generate an HTML report after the test:
```bash
artillery run --output report.json edge-performance.yml
artillery report report.json
```

## Test Scenarios

The `edge-performance.yml` script covers the following client endpoints:
1. `GET /api/v1/client/{env}/client-version` (Public/Cached)
2. `GET /api/v1/client/{env}/game-worlds` (Public/Cached)
3. `GET /api/v1/client/{env}/banners` (Authenticated/Cached)
4. `GET /api/v1/client/{env}/service-notices` (Authenticated/Cached)
5. `GET /api/v1/client/{env}/ingame-popup-notices` (Authenticated/Cached)

## Load Phases

- **Warm up**: 1 minute, ramping from 5 to 50 arrivals per second.
- **Sustained load**: 2 minutes, constant 50 arrivals per second.
- **Stress**: 1 minute, ramping from 50 to 100 arrivals per second.
