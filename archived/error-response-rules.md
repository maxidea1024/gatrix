# Error Response Standardization Rules

## IMPORTANT: All API error responses MUST include `error.code`

Frontend에서 현재 error.message를 파싱해서 에러를 구분하는 코드가 많습니다.
이를 방지하기 위해 **모든 에러 응답에는 반드시 `error.code`를 포함**해야 합니다.

## @gatrix/shared 패키지

**ErrorCodes는 `@gatrix/shared` 패키지에서 정의**되며, 아래 패키지들에서 공유합니다:

- `@gatrix/backend` - 에러 응답 생성
- `@gatrix/frontend` - 에러 코드 기반 핸들링
- `@gatrix/server-sdk` - SDK 에러 처리

### 새 ErrorCode 추가 시

`packages/shared/src/errors/index.ts`의 `ErrorCodes` 객체에 추가 후 shared 패키지 빌드:

```bash
yarn workspace @gatrix/shared build
```

## 표준 응답 형식

### 에러 응답

```json
{
  "success": false,
  "error": {
    "code": "SPECIFIC_ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} // Optional: validation errors, etc.
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

## Backend에서 ErrorCodes 사용

`packages/backend/src/utils/apiResponse.ts`에서 re-export하여 사용:

```typescript
import { ErrorCodes, sendBadRequest, sendNotFound, sendInternalError } from '../utils/apiResponse';

// 400 Bad Request
return sendBadRequest(res, 'Invalid input', { field: 'name' });

// 404 Not Found
return sendNotFound(res, 'Resource not found', ErrorCodes.RESOURCE_NOT_FOUND);

// 500 Internal Server Error
return sendInternalError(res, 'Failed to process', error, ErrorCodes.RESOURCE_FETCH_FAILED);

// GatrixError 사용 시
throw new GatrixError('message', 400, true, ErrorCodes.BAD_REQUEST);
```

## Frontend에서 ErrorCodes 사용

`@gatrix/shared`에서 직접 import하여 사용:

```typescript
import { ErrorCodes, extractErrorCode, extractErrorMessage } from '@gatrix/shared';

try {
  await someApiCall();
} catch (error: any) {
  const errorCode = extractErrorCode(error);
  const errorMessage = extractErrorMessage(error);

  switch (errorCode) {
    case ErrorCodes.RESOURCE_ALREADY_EXISTS:
      // 중복 리소스 처리
      break;
    case ErrorCodes.VALIDATION_ERROR:
      // 유효성 검사 에러 처리
      break;
    default:
      // 기본 에러 처리
      enqueueSnackbar(errorMessage, { variant: 'error' });
  }
}
```

## 유틸리티 함수 (Frontend)

`@gatrix/shared`에서 제공하는 유틸리티:

```typescript
import {
  ErrorCodes, // 에러 코드 상수
  extractErrorCode, // error 객체에서 code 추출
  extractErrorMessage, // error 객체에서 message 추출
  isErrorCode, // 특정 에러 코드인지 확인
} from '@gatrix/shared';

// 여러 에러 코드 한번에 체크
if (isErrorCode(errorCode, ErrorCodes.USER_NOT_FOUND, ErrorCodes.RESOURCE_NOT_FOUND)) {
  // Not Found 처리
}
```

## 규칙

1. **절대 `message`만 보내지 마세요** - `error.code`가 없으면 frontend에서 에러를 구분할 수 없습니다.
2. **구체적인 error.code 사용** - `INTERNAL_SERVER_ERROR` 대신 `RESOURCE_NOT_FOUND`, `API_TOKEN_INVALID` 등 구체적인 코드 사용
3. **middleware에서도 동일 적용** - apiTokenAuth.ts 등 미들웨어도 동일 형식 사용
4. **GatrixError 사용 시 code 파라미터 전달** - `throw new GatrixError('message', 400, true, ErrorCodes.BAD_REQUEST)`
5. **새 에러 코드 필요 시 shared 패키지에 추가** - 중복 방지를 위해 한 곳에서 관리
6. **Frontend에서 하드코딩된 문자열 대신 ErrorCodes 상수 사용**

## 예시

❌ **잘못된 패턴 (Backend):**

```typescript
res.status(404).json({
  success: false,
  message: 'User not found', // code 없음!
});
```

❌ **잘못된 패턴 (Frontend):**

```typescript
if (error.message.includes('already exists')) {
  // 문자열 파싱!
  // ...
}
```

✅ **올바른 패턴 (Backend):**

```typescript
sendNotFound(res, 'User not found', ErrorCodes.USER_NOT_FOUND);
```

✅ **올바른 패턴 (Frontend):**

```typescript
import { ErrorCodes, extractErrorCode } from '@gatrix/shared';

const errorCode = extractErrorCode(error);
if (errorCode === ErrorCodes.RESOURCE_ALREADY_EXISTS) {
  // ...
}
```
