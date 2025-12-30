# Error Response Standardization Rules

## IMPORTANT: All API error responses MUST include `error.code`

Frontend에서 현재 error.message를 파싱해서 에러를 구분하는 코드가 많습니다.
이를 방지하기 위해 **모든 에러 응답에는 반드시 `error.code`를 포함**해야 합니다.

## 표준 응답 형식

### 에러 응답
```json
{
  "success": false,
  "error": {
    "code": "SPECIFIC_ERROR_CODE",
    "message": "Human-readable error message",
    "details": {}  // Optional: validation errors, etc.
  }
}
```

### 성공 응답
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

## ErrorCodes 사용

`packages/backend/src/utils/apiResponse.ts`에 정의된 `ErrorCodes`를 사용:

```typescript
import { ErrorCodes, sendBadRequest, sendNotFound, sendInternalError } from '../utils/apiResponse';

// 400 Bad Request
return sendBadRequest(res, 'Invalid input', { field: 'name' });

// 404 Not Found  
return sendNotFound(res, 'Resource not found', ErrorCodes.RESOURCE_NOT_FOUND);

// 500 Internal Server Error
return sendInternalError(res, 'Failed to process', error, ErrorCodes.RESOURCE_FETCH_FAILED);
```

## 규칙

1. **절대 `message`만 보내지 마세요** - `error.code`가 없으면 frontend에서 에러를 구분할 수 없습니다.
2. **구체적인 error.code 사용** - `INTERNAL_SERVER_ERROR` 대신 `RESOURCE_NOT_FOUND`, `API_TOKEN_INVALID` 등 구체적인 코드 사용
3. **middleware에서도 동일 적용** - apiTokenAuth.ts 등 미들웨어도 동일 형식 사용
4. **GatrixError 사용 시 code 파라미터 전달** - `throw new GatrixError('message', 400, true, ErrorCodes.BAD_REQUEST)`
5. **새 에러 코드 필요 시 apiResponse.ts에 추가** - 중복 방지를 위해 한 곳에서 관리

## 예시

❌ **잘못된 패턴:**
```typescript
res.status(404).json({
  success: false,
  message: 'User not found'  // code 없음!
});
```

✅ **올바른 패턴:**
```typescript
res.status(404).json({
  success: false,
  error: {
    code: ErrorCodes.USER_NOT_FOUND,  // 구체적인 에러 코드
    message: 'User not found'
  }
});

// 또는 유틸리티 함수 사용
sendNotFound(res, 'User not found', ErrorCodes.USER_NOT_FOUND);
```
