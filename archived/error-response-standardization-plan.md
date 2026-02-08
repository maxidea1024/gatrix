# Error Response Standardization Plan

## Overview

Standardize error responses across all backend services to use a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "SPECIFIC_ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

## Utility Created

- `packages/backend/src/utils/apiResponse.ts` - Contains:
  - `ErrorCodes` - Standard error code constants
  - `sendErrorResponse()` - Main error response function
  - Convenience methods: `sendBadRequest()`, `sendNotFound()`, `sendInternalError()`, etc.

## Files to Update

### High Priority (Controllers)

- [ ] `controllers/ServiceNoticeController.ts`
- [ ] `controllers/ServiceDiscoveryController.ts`
- [ ] `controllers/ServiceDiscoveryConfigController.ts`
- [ ] `controllers/ServerUserController.ts`
- [ ] `controllers/GameWorldController.ts`
- [ ] `controllers/ClientVersionController.ts`
- [ ] `controllers/BannerController.ts`
- [ ] `controllers/RemoteConfigController.ts`
- [ ] `controllers/RemoteConfigClientController.ts`
- [ ] `controllers/RemoteConfigSDKController.ts`
- [ ] `controllers/IngamePopupNoticeController.ts`
- [ ] `controllers/CouponController.ts`
- [ ] `controllers/CouponSDKController.ts`
- [ ] `controllers/SurveyController.ts`
- [ ] `controllers/TagController.ts`
- [ ] `controllers/UserController.ts`
- [ ] `controllers/InternalApiTokensController.ts`
- [ ] `controllers/MonitoringAlertController.ts`
- [ ] `controllers/jobController.ts`
- [ ] `controllers/jobExecutionController.ts`
- [ ] `controllers/jobTypeController.ts`
- [ ] `controllers/ServerLifecycleController.ts`

### Medium Priority (Routes)

- [ ] `routes/mails.ts`
- [ ] `routes/server/serviceDiscovery.ts`
- [ ] `routes/public/serviceNotices.ts`
- [ ] `routes/chat/index.ts`
- [ ] `routes/admin/serviceDiscovery.ts`
- [ ] `routes/admin/notifications.ts`

### Medium Priority (Middleware)

- [ ] `middleware/environmentResolver.ts`
- [ ] `middleware/environmentMiddleware.ts`
- [ ] `middleware/apiTokenAuth.ts`
- [ ] `middleware/auth.ts`

### Other Packages

- [ ] `packages/edge/src/**` - Edge service
- [ ] `packages/chat-server/src/**` - Chat server
- [ ] `packages/event-lens/src/**` - Event lens service

## Error Code Guidelines

1. Use specific error codes (e.g., `GAME_WORLD_NOT_FOUND` instead of `NOT_FOUND`)
2. Use `INTERNAL_SERVER_ERROR` only as a last resort when the error is truly unidentifiable
3. Always include a meaningful human-readable message
4. Log internal errors with full stack traces for debugging

## Migration Steps

1. Import `apiResponse` utilities in each file
2. Replace `res.status(XXX).json({ error: ... })` with appropriate helper functions
3. Ensure error codes are specific and meaningful
4. Test each endpoint after migration

## Example Conversion

### Before

```typescript
catch (error) {
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to retrieve game world'
    }
  });
}
```

### After

```typescript
import { sendInternalError, ErrorCodes } from '../utils/apiResponse';

catch (error) {
  return sendInternalError(
    res,
    'Failed to retrieve game world',
    error,
    ErrorCodes.GAME_WORLD_NOT_FOUND
  );
}
```
