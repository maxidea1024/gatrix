---
sidebar_position: 2
---

# 세그먼트

세그먼트는 사용자를 그룹화하여 피처 플래그를 특정 사용자에게만 적용할 수 있게 합니다.

## 개요

세그먼트를 사용하면 다음과 같은 타겟팅이 가능합니다:

- 베타 테스터에게만 새 기능 노출
- 특정 국가/지역 사용자에게 기능 제공
- VIP 사용자에게 프리미엄 기능 제공
- 점진적 롤아웃 (1% → 10% → 50% → 100%)

## 세그먼트 생성

1. **Feature Flags** > **Segments** 메뉴로 이동합니다.
2. **새 세그먼트** 버튼을 클릭합니다.
3. 세그먼트 정보를 입력합니다:
   - **이름**: 세그먼트 식별 이름
   - **설명**: 세그먼트 용도 설명

## 규칙 설정

세그먼트 규칙은 컨텍스트 필드를 기반으로 사용자를 필터링합니다.

### 연산자

| 연산자        | 설명          | 예시                            |
| ------------- | ------------- | ------------------------------- |
| `equals`      | 정확히 일치   | `country equals "KR"`           |
| `notEquals`   | 일치하지 않음 | `status notEquals "banned"`     |
| `contains`    | 포함          | `email contains "@company.com"` |
| `startsWith`  | 시작 문자열   | `userId startsWith "test_"`     |
| `endsWith`    | 끝 문자열     | `email endsWith ".kr"`          |
| `greaterThan` | 보다 큼       | `level greaterThan 10`          |
| `lessThan`    | 보다 작음     | `age lessThan 18`               |
| `in`          | 목록에 포함   | `country in ["KR", "JP", "CN"]` |

### 예시: 베타 테스터 세그먼트

```json
{
  "name": "Beta Testers",
  "rules": [
    {
      "field": "userType",
      "operator": "equals",
      "value": "beta"
    }
  ]
}
```

### 예시: 한국 VIP 사용자

```json
{
  "name": "Korean VIP",
  "rules": [
    {
      "field": "country",
      "operator": "equals",
      "value": "KR"
    },
    {
      "field": "isPremium",
      "operator": "equals",
      "value": true
    }
  ]
}
```

## 피처 플래그에 세그먼트 적용

1. 피처 플래그 편집 화면으로 이동합니다.
2. **Override Rules** 섹션에서 세그먼트를 선택합니다.
3. 해당 세그먼트에 적용할 값을 설정합니다.

## 우선순위

여러 세그먼트가 적용될 경우, 우선순위에 따라 값이 결정됩니다. 우선순위는 드래그 앤 드롭으로 조정할 수 있습니다.
