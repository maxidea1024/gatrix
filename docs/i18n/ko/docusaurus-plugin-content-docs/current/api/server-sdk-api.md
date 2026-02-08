---
sidebar_position: 2
sidebar_label: 서버 SDK API
---

# 서버 SDK API

게임 서버에서 Gatrix와 통신하기 위한 SDK API 문서입니다.

## 초기화

```typescript
import { GatrixClient } from '@gatrix/server-sdk';

const client = new GatrixClient({
  apiKey: 'your-api-key',
  environment: 'production',
});
```

## 주요 기능

### 1. 피처 플래그 평가

```typescript
const isEnabled = await client.getFeatureFlag('new_battle_mode', {
  userId: 'player_1',
  level: 50,
});
```

### 2. 점검 상태 확인

```typescript
const maintenance = await client.getCurrentMaintenance();
if (maintenance.isActive) {
  console.log('점검 중:', maintenance.message);
}
```

### 3. 화이트리스트 확인

```typescript
const isWhitelisted = await client.whitelist.isIpWhitelisted('1.2.3.4');
```

## 오류 처리

SDK는 네트워크 호출 실패 시 지수 백오프 전략을 사용하여 자동으로 재시도합니다.

```typescript
try {
  const flags = await client.getAllFlags(context);
} catch (error) {
  // 최종 실패 시 처리
  console.error('SDK 호출 실패:', error);
}
```
