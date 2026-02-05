---
sidebar_position: 3
sidebar_label: Microsoft Teams
---

# Microsoft Teams 연동

Gatrix 알림을 Microsoft Teams로 전송합니다.

## 설정 방법

### 1. Teams에서 Incoming Webhook 생성

1. Microsoft Teams에서 알림을 받을 채널로 이동합니다.
2. 메뉴(**...**) > **커넥터(Connectors)**를 클릭합니다.
3. **Incoming Webhook**을 찾아 **구성(Configure)**을 클릭합니다.
4. 이름을 입력하고 선택적으로 아이콘을 추가합니다.
5. **만들기(Create)**를 클릭합니다.
6. 생성된 Webhook URL을 복사합니다.

### 2. Gatrix에 등록

1. **설정** > **외부 연동** > **Microsoft Teams**로 이동합니다.
2. 복사한 Webhook URL을 붙여넣습니다.
3. 알림을 받을 이벤트를 구성합니다.
4. **저장**을 클릭합니다.

## 알림 이벤트

| 이벤트 | 설명 |
|-------|-------------|
| 피처 플래그 변경 | 플래그 생성/수정/삭제 시 알림 |
| 점검 상태 | 점검 시작/종료 시 알림 |
| 시스템 오류 | 시스템 오류 발생 시 알림 |

## 테스트

**테스트 메시지 전송**을 클릭하여 연동이 정상적으로 작동하는지 확인합니다.
