---
sidebar_position: 1
---

# 피처 플래그

피처 플래그는 코드 배포 없이 기능을 실시간으로 제어할 수 있는 도구입니다.

## 개요

피처 플래그(Feature Flags)는 코드 배포 없이 기능의 활성화/비활성화를 제어하고, 특정 사용자 그룹에게만 기능을 노출할 수 있습니다.

## 주요 기능

- **실시간 기능 토글** - 코드 변경 없이 기능 On/Off
- **타겟팅 설정** - 개발/테스트/프로덕션 환경별 제어
- **세그먼트 기반 롤아웃** - 특정 사용자 그룹에게만 기능 노출
- **A/B 테스트 지원** - 점진적 출시 및 테스트
- **즉시 롤백** - 문제 발생 시 즉각적인 기능 비활성화

## 피처 플래그 생성

1. 대시보드에서 **Feature Flags** 메뉴로 이동합니다.
2. **새 피처 플래그** 버튼을 클릭합니다.
3. 다음 정보를 입력합니다:
   - **키(Key)**: 고유 식별자 (예: `new_payment_system`)
   - **이름**: 표시 이름
   - **설명**: 기능에 대한 설명
   - **타입**: Boolean, String, Number, JSON 중 선택

## 피처 플래그 타입

### Boolean

가장 간단한 형태로, On/Off 상태를 나타냅니다.

```json
{
  "key": "enable_dark_mode",
  "value": true
}
```

### String

문자열 값을 반환합니다.

```json
{
  "key": "welcome_message",
  "value": "환영합니다!"
}
```

### Number

숫자 값을 반환합니다.

```json
{
  "key": "max_items_per_page",
  "value": 50
}
```

### JSON

복잡한 설정을 JSON 객체로 반환합니다.

```json
{
  "key": "feature_config",
  "value": {
    "enabled": true,
    "maxRetries": 3,
    "timeout": 5000
  }
}
```

## 환경별 설정

각 환경(development, staging, production)에서 독립적으로 피처 플래그 값을 설정할 수 있습니다.

## 다음 단계

- [세그먼트](./segments) - 사용자 그룹별 타겟팅
- [환경](./environments) - 환경별 설정 관리
