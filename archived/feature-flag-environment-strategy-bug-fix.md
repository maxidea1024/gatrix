# Feature Flag 환경별 전략 분리 버그 수정

## 문제

피처 플래그에서 특정 환경(예: development)에만 전략을 추가했는데, 모든 환경(cbt, review 등)에서도 동일한 전략이 표시되는 문제.

## 근본 원인

**2가지 문제가 있었음:**

### 1. API Interceptor의 환경 헤더 덮어쓰기 문제

`packages/frontend/src/services/api.ts`의 axios interceptor에서 **모든 요청에 대해** localStorage의 환경값으로 `X-Environment` 헤더를 설정하고 있었음.

```typescript
// 문제의 코드 (기존)
const environment = localStorage.getItem('gatrix_selected_environment');
if (environment) {
  config.headers['X-Environment'] = environment; // 항상 덮어씀!
}
```

`loadEnvStrategies`에서 각 환경별로 `x-environment` 헤더를 수동으로 설정해도, interceptor가 나중에 실행되면서 **localStorage 값(현재 선택된 환경)**으로 덮어쓰고 있었음.

**해결:**

```typescript
// 수정된 코드
const hasEnvironmentHeader = config.headers['x-environment'] || config.headers['X-Environment'];
if (!hasEnvironmentHeader) {
  const environment = localStorage.getItem('gatrix_selected_environment');
  if (environment) {
    config.headers['X-Environment'] = environment;
  }
}
```

→ 요청에서 **명시적으로 환경 헤더를 설정한 경우** interceptor가 덮어쓰지 않도록 수정.

### 2. 백엔드 환경 Fallback 문제

`packages/backend/src/routes/admin/features.ts`에서 환경이 없으면 `'development'`로 fallback하고 있었음:

```typescript
// 문제의 코드 (기존)
const environment = req.environment || 'development'; // 모호함!
```

**해결:**

```typescript
// 수정된 코드
const environment = req.environment;
if (!environment) {
  return res
    .status(400)
    .json({ success: false, error: 'Environment is required (x-environment header)' });
}
```

→ 환경이 없으면 **명시적으로 오류 반환**. Fallback은 모호함을 유발하므로 제거.

## 교훈

1. **Interceptor 주의**: axios interceptor에서 헤더를 설정할 때, 요청별로 명시적으로 설정된 헤더를 덮어쓰지 않도록 주의.
2. **Fallback 피하기**: 환경과 같은 중요한 컨텍스트는 fallback을 사용하지 말고 명시적으로 요구해야 함. fallback은 디버깅을 어렵게 만듬.
3. **HTTP 헤더 대소문자**: HTTP 헤더는 대소문자를 구분하지 않지만, JavaScript에서 객체 키로 사용할 때는 `x-environment`와 `X-Environment` 모두 체크해야 함.

## 수정된 파일

- `packages/frontend/src/services/api.ts` - interceptor에서 명시적 헤더 우선 처리
- `packages/backend/src/routes/admin/features.ts` - 모든 라우트에서 `|| 'development'` fallback 제거
