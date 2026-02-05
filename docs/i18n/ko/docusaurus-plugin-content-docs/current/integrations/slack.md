---
sidebar_position: 2
sidebar_label: Slack
---

# Slack 연동

Gatrix 알림을 Slack으로 전송합니다.

## 설정 방법

### 1. Slack 앱 생성

1. [api.slack.com/apps](https://api.slack.com/apps)로 이동합니다.
2. **Create New App**을 클릭합니다.
3. **From scratch**를 선택합니다.
4. 앱 이름을 입력하고 워크스페이스를 선택합니다.

### 2. Incoming Webhooks 구성

1. Slack 앱 설정에서 **Incoming Webhooks** 메뉴로 이동합니다.
2. **Activate Incoming Webhooks**를 On으로 설정합니다.
3. **Add New Webhook to Workspace**를 클릭합니다.
4. 알림을 받을 채널을 선택합니다.
5. 생성된 Webhook URL을 복사합니다.

### 3. Gatrix에 등록

1. **설정** > **외부 연동** > **Slack**으로 이동합니다.
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
