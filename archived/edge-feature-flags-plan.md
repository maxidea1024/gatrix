# Implementation Plan - Edge Server Feature Flag Support

This plan outlines the steps required to implement feature flag evaluation, definition delivery, and metrics proxying in the Gatrix Edge server.

## Objective
Enable Edge servers to handle feature flag related requests to reduce backend load. Edge acts as a high-performance cache and proxy:
1. **Remote Evaluation (Client SDK)**: Evaluates flags for client SDKs locally using Edge's cache.
2. **Definition Delivery (Server SDK)**: Provides cached flag and segment definitions to other server-side SDKs (Game Servers), acting as a middle-tier cache.
3. **Metrics/Reporting Proxy**: Forwards all reporting data (metrics, unknown flags, etc.) to the Backend.

## Proposed Changes

### 1. Metrics Aggregator Service (`packages/edge/src/services/metricsAggregator.ts`)
Implement an in-memory buffer and aggregator that:
- Collects metrics from both Client and Server SDK requests.
- Aggregates them by `Key = {environment, appName, flagName, enabled, variantName}`.
- For Client SDK, also aggregates `missing` (unknown) flags.
- Periodically flushes aggregated data to the Backend (e.g., every 30-60s) to minimize Backend load.
- Distinguishes between Client Metrics (bucket-style) and Server Metrics (raw aggregated counts).

### 2. Edge Client Routes (`packages/edge/src/routes/client.ts`)
- `POST /api/v1/client/features/:environment/eval`: Evaluate flags locally using `sdk.featureFlag`.
- `POST /api/v1/client/features/:environment/metrics`: Buffer/Aggregate metrics in `metricsAggregator` instead of direct proxying.

### 3. Edge Server Routes (`packages/edge/src/routes/server.ts` - New)
Provide endpoints for Server SDKs (Game Servers) pointing to Edge:
- `GET /api/v1/server/:env/features`: Serve cached flags/segments.
- `GET /api/v1/server/segments`: Serve cached segments.
- `POST /api/v1/server/:env/features/metrics`: Buffer/Aggregate metrics in `metricsAggregator`.
- `POST /api/v1/server/:env/features/unknown`: Proxy unknown flag reporting (or aggregate if supported).

### 4. Verification
- Verify that multiple SDK instances sending metrics to Edge result in a single aggregated request from Edge to Backend.
- Verify that unknown flags reported by Client SDK (in `bucket.missing`) are correctly forwarded.

### Phase 3: Verification
1. Test Remote Evaluation via Edge.
2. Test Metric submission via Edge.
3. Verify Backend correctly receives and processes proxied metrics.

## Considerations
- **Authentication**: Edge must validate the `X-API-Token` before serving or proxying. It already uses `clientAuth` and `tokenMirrorService`.
- **Environment Resolution**: Edge must correctly handle the `:env` or `:environment` parameter.
- **Payload Size**: Metrics buckets can be large; ensure Express limits are appropriate.
