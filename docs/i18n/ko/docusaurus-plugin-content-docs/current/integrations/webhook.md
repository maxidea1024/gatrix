---
sidebar_position: 4
sidebar_label: 웹훅
---

# 웹훅 연동

Gatrix 이벤트를 맞춤형 HTTP 엔드포인트로 전송합니다.

## 설정 방법

1. **설정** > **외부 연동** > **웹훅**으로 이동합니다.
2. 웹훅을 수신할 URL을 입력합니다.
3. 전송할 이벤트를 선택합니다.
4. 필요한 경우 인증 정보를 구성합니다 (선택 사항).
5. **저장**을 클릭합니다.

## 인증 지원

웹훅은 다음 인증 방식을 지원합니다:
- **없음** - 인증 없음
- **Basic Auth** - 사용자 이름 및 비밀번호
- **Bearer Token** - 토큰 방식
- **Custom Header** - 사용자 정의 헤더 이름 및 값

## 페이로드 형식

```json
{
  "event": "feature_flag.updated",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "flagKey": "new_feature",
    "oldValue": false,
    "newValue": true,
    "environment": "production",
    "changedBy": "admin@example.com"
  }
}
```

## 주요 이벤트

| 이벤트 | 설명 |
|-------|-------------|
| `feature_flag.created` | 플래그 생성됨 |
| `feature_flag.updated` | 플래그 수정됨 |
| `feature_flag.deleted` | 플래그 삭제됨 |
| `maintenance.started` | 점검 시작됨 |
| `maintenance.ended` | 점검 종료됨 |

## 재시도 정책

전송에 실패한 웹훅은 지수 백오프 전략에 따라 최대 3회까지 재시도됩니다.
