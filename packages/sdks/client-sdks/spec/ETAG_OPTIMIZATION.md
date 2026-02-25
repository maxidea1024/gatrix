# ETag Optimization for Feature Flag Evaluation

## Overview
This document describes the ETag-based optimization implemented in the Gatrix Edge and Backend servers to reduce redundant data transfer and processing when client evaluation contexts result in the same feature flag values.

## Problem Description
Client SDKs frequently poll for feature flag updates. Even with server-side caching of flag definitions, the evaluation process (mapping context to flags) can be expensive when performed for every request. If the evaluation result is identical to what the client already has, sending the full JSON payload (which can be large) is a waste of bandwidth.

## Optimization Strategy

### 1. Consistent ETag Generation
An ETag is generated based on the evaluated flag set. To ensure the ETag is consistent for the same set of flags, the following rules are applied:
- **Sorting**: Evaluation results are sorted by their Unique Identifier (ULID/ID) in descending order.
- **Content Hashing**: The ETag source string is constructed using:
    - Flag Name
    - Flag Version
    - Enabled State
    - Variant Name (and variant's enabled state)
- **Context Pinning**: The `contextHash` is included in the ETag source to ensure that if the same flags are evaluated under a different context (which might matter for future audit logs or reason tracking), they are treated distinctly, although usually, same flags + same version = same result.

### 2. Early Exit (304 Not Modified)
The server performs the 304 check at two stages for maximum efficiency:

#### Phase A: Cache Hit (Zero Evaluation)
If the evaluation result for the specific `contextHash` + `flagNames` + `definitionsHash` is already in the server's cache:
1. Retrieve the cached ETag and Response.
2. Compare the cached ETag with the client's `If-None-Match` header.
3. If they match, return `304 Not Modified` immediately without touch the response payload.

#### Phase B: Cache Miss but Result Match (Post-Evaluation Optimization)
If the evaluation must be performed (cache miss):
1. Evaluate flags for the context.
2. Generate the ETag for the new result.
3. **CRITICAL**: Compare the new ETag with the client's `If-None-Match` header **BEFORE** creating the full response object and before saving to cache.
4. If they match, return `304 Not Modified`. This avoids serializing the full response and redundant cache writes for identical results.

## Implementation Details

### Cross-Platform Implementation
This optimization is consistently implemented across:
- **Gatrix Backend (Node.js)**: Both in explicit controllers and the `respondWithEtagCache` utility.
- **Gatrix Edge (Node.js)**: In the feature flag evaluation route.
- **Gatrix Edge (.NET)**: In the `ClientController` (organized into partial classes).

### Logic Flow (High Level)
```csharp
// 1. Generate ETag Source (including contextHash for pinning)
var etagSource = contextHash + "|" + string.Join("|", results.Select(r => $"{r.Name}:{r.Version}:{r.Enabled}:{r.Variant.Name}"));
var etag = $"\"{ComputeHash(etagSource)}\"";

// 2. Optimization: Check ETag BEFORE creating response object or caching
var requestEtag = Request.Headers.IfNoneMatch.FirstOrDefault();
if (requestEtag == etag)
    return StatusCode(304);

// 3. Only if different, proceed with full object creation and cache update
var responseObj = CreateResponse(results);
_cache.Set(evalCacheKey, (etag, responseObj), TTL);
```

## Benefits
- **Bandwidth Savings**: Clients receive tiny 304 responses instead of large flag arrays.
- **CPU/Memory Savings**: The server avoids JSON serialization and large object allocations when results haven't changed.
- **Reduced Latency**: Faster response times for repeat polls.
