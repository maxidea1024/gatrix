---
sidebar_position: 3
---

# 환경

환경(Environment)은 피처 플래그를 개발, 스테이징, 프로덕션 등 다른 단계에서 독립적으로 관리할 수 있게 합니다.

## 기본 환경

Gatrix는 기본적으로 다음 환경을 제공합니다:

- **development** - 개발 환경
- **staging** - 스테이징/QA 환경  
- **production** - 프로덕션 환경

## 환경별 피처 플래그 관리

각 환경에서 피처 플래그의 값을 독립적으로 설정할 수 있습니다.

예를 들어, `new_feature` 플래그는:
- **development**: `true` (개발자가 테스트)
- **staging**: `true` (QA 팀이 검증)
- **production**: `false` (아직 출시 전)

## 환경 추가

1. **Settings** > **Environments** 메뉴로 이동합니다.
2. **새 환경** 버튼을 클릭합니다.
3. 환경 정보를 입력합니다:
   - **이름**: 환경 식별 이름 (예: `canary`, `beta`)
   - **설명**: 환경 용도 설명

## SDK에서 환경 지정

게임 서버 SDK에서 환경을 지정하여 해당 환경의 피처 플래그 값을 가져올 수 있습니다.

```typescript
const gatrix = new GatrixServerSDK({
  apiKey: 'your-api-key',
  environment: 'production',  // 환경 지정
});

const isEnabled = await gatrix.featureFlags.getBoolValue('new_feature');
```

## 환경 복사

기존 환경의 피처 플래그 설정을 새 환경으로 복사할 수 있습니다.

1. 환경 목록에서 복사할 환경의 **...** 메뉴를 클릭합니다.
2. **환경 복사**를 선택합니다.
3. 새 환경 이름을 입력합니다.
