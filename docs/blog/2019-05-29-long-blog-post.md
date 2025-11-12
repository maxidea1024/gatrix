---
slug: mastering-job-management-system
title: "Gatrix 작업 관리 시스템 완전 가이드: 자동화의 새로운 차원"
authors: [gatrix-team]
tags: [gatrix, jobs, tutorial, features]
---

Gatrix의 작업 관리 시스템은 게임 운영을 자동화하는 강력한 도구입니다. 이 포스트에서는 작업 관리 시스템의 모든 기능을 자세히 살펴보고, 실제 사용 사례와 함께 단계별로 설정하는 방법을 알려드립니다.

<!-- truncate -->

## 🎯 작업 관리 시스템이란?

Gatrix의 작업 관리 시스템은 BullMQ 기반의 고성능 작업 큐 시스템으로, 다음과 같은 기능을 제공합니다:

- **다양한 작업 유형**: 이메일, HTTP 요청, SSH 명령, 로깅
- **유연한 스케줄링**: Cron 문법을 사용한 반복 작업 및 일회성 실행
- **실시간 모니터링**: Bull Board를 통한 큐 상태 모니터링
- **자동 재시도**: 지수 백오프를 사용한 자동 재시도 메커니즘
- **에러 처리**: 포괄적인 에러 로깅 및 복구

## 📧 1. 이메일 작업 (Mail Send Jobs)

### 기본 설정

이메일 작업은 템플릿 지원과 동적 콘텐츠를 사용하여 이메일을 전송합니다.

```json
{
  "to": "user@example.com",
  "subject": "게임 업데이트 알림",
  "template": "game-update",
  "data": {
    "playerName": "홍길동",
    "updateVersion": "1.2.0",
    "newFeatures": ["새로운 던전", "아이템 강화 시스템"]
  }
}
```

### 실제 사용 사례

**사용자 등록 환영 이메일**
```json
{
  "to": "{{email}}",
  "subject": "Gatrix에 오신 것을 환영합니다!",
  "template": "welcome",
  "data": {
    "username": "{{username}}",
    "loginUrl": "https://gatrix.example.com/login",
    "supportEmail": "support@gatrix.com"
  }
}
```

**게임 서버 점검 알림**
```json
{
  "to": "{{email}}",
  "subject": "게임 서버 점검 안내",
  "template": "maintenance-notice",
  "data": {
    "maintenanceTime": "2024-01-15 02:00-06:00",
    "affectedServices": ["게임 서버", "채팅 서버"],
    "estimatedDuration": "4시간"
  }
}
```

## 🌐 2. HTTP 요청 작업 (HTTP Request Jobs)

### 기본 설정

외부 API와의 통합을 위한 HTTP 요청 작업입니다.

```json
{
  "method": "POST",
  "url": "https://api.example.com/webhook",
  "headers": {
    "Authorization": "Bearer {{apiToken}}",
    "Content-Type": "application/json"
  },
  "body": {
    "event": "user_registration",
    "userId": "{{userId}}",
    "timestamp": "{{timestamp}}"
  }
}
```

### 실제 사용 사례

**게임 통계 업데이트**
```json
{
  "method": "PUT",
  "url": "https://analytics.example.com/api/stats",
  "headers": {
    "X-API-Key": "{{analyticsKey}}"
  },
  "body": {
    "gameId": "uwo",
    "date": "{{date}}",
    "activeUsers": "{{activeUsers}}",
    "newRegistrations": "{{newRegistrations}}"
  }
}
```

**결제 시스템 연동**
```json
{
  "method": "POST",
  "url": "https://payment.example.com/api/transactions",
  "headers": {
    "Authorization": "Bearer {{paymentToken}}"
  },
  "body": {
    "transactionId": "{{transactionId}}",
    "amount": "{{amount}}",
    "currency": "KRW",
    "userId": "{{userId}}"
  }
}
```

## 🖥️ 3. SSH 명령 작업 (SSH Command Jobs)

### 기본 설정

원격 서버에서 명령을 실행하는 SSH 작업입니다.

```json
{
  "host": "game-server-01.example.com",
  "port": 22,
  "username": "admin",
  "command": "sudo systemctl restart game-server",
  "timeout": 30000
}
```

### 실제 사용 사례

**게임 서버 재시작**
```json
{
  "host": "{{serverHost}}",
  "username": "{{sshUser}}",
  "command": "cd /opt/game && ./restart-server.sh {{serverId}}",
  "timeout": 60000
}
```

**로그 파일 정리**
```json
{
  "host": "{{logServer}}",
  "username": "{{sshUser}}",
  "command": "find /var/log/game -name '*.log' -mtime +7 -delete",
  "timeout": 30000
}
```

**데이터베이스 백업**
```json
{
  "host": "{{dbServer}}",
  "username": "{{sshUser}}",
  "command": "mysqldump -u {{dbUser}} -p{{dbPass}} {{dbName}} > /backup/{{dbName}}_$(date +%Y%m%d).sql",
  "timeout": 300000
}
```

## 📝 4. 로그 메시지 작업 (Log Message Jobs)

### 기본 설정

구조화된 로깅을 위한 로그 메시지 작업입니다.

```json
{
  "level": "info",
  "message": "사용자 로그인 성공",
  "context": {
    "userId": "{{userId}}",
    "ipAddress": "{{ipAddress}}",
    "userAgent": "{{userAgent}}"
  },
  "tags": ["authentication", "user-activity"]
}
```

### 실제 사용 사례

**보안 이벤트 로깅**
```json
{
  "level": "warn",
  "message": "비정상적인 로그인 시도 감지",
  "context": {
    "ipAddress": "{{ipAddress}}",
    "attemptCount": "{{attemptCount}}",
    "lastAttempt": "{{lastAttempt}}"
  },
  "tags": ["security", "authentication", "suspicious-activity"]
}
```

**성능 메트릭 로깅**
```json
{
  "level": "info",
  "message": "서버 성능 메트릭",
  "context": {
    "serverId": "{{serverId}}",
    "cpuUsage": "{{cpuUsage}}",
    "memoryUsage": "{{memoryUsage}}",
    "responseTime": "{{responseTime}}"
  },
  "tags": ["performance", "monitoring", "metrics"]
}
```

## ⏰ 5. 스케줄링 설정

### Cron 문법 사용

```bash
# 매일 오전 2시에 실행
0 2 * * *

# 매주 월요일 오전 9시에 실행
0 9 * * 1

# 매월 1일 오전 0시에 실행
0 0 1 * *

# 매 5분마다 실행
*/5 * * * *

# 평일 오전 9시부터 오후 6시까지 매시간 실행
0 9-18 * * 1-5
```

### 실제 스케줄링 예시

**일일 통계 리포트**
- **스케줄**: `0 1 * * *` (매일 오전 1시)
- **작업**: HTTP 요청으로 일일 통계를 외부 시스템에 전송

**주간 데이터 정리**
- **스케줄**: `0 3 * * 0` (매주 일요일 오전 3시)
- **작업**: SSH 명령으로 오래된 로그 파일 정리

**월간 백업**
- **스케줄**: `0 2 1 * *` (매월 1일 오전 2시)
- **작업**: SSH 명령으로 데이터베이스 백업

## 📊 6. 모니터링 및 관리

### Bull Board 대시보드

작업 큐 상태를 실시간으로 모니터링할 수 있습니다:

- **대기 중인 작업**: 큐에서 실행을 기다리는 작업
- **실행 중인 작업**: 현재 처리 중인 작업
- **완료된 작업**: 성공적으로 완료된 작업
- **실패한 작업**: 에러가 발생한 작업

### 알림 설정

중요한 작업의 실패 시 알림을 받을 수 있습니다:

```json
{
  "jobType": "critical-backup",
  "failureNotification": {
    "email": "admin@example.com",
    "webhook": "https://hooks.slack.com/services/..."
  }
}
```

## 🚀 7. 고급 사용 팁

### 1. 작업 우선순위 설정

```json
{
  "priority": 10,  // 높은 우선순위
  "delay": 5000,   // 5초 지연
  "attempts": 3    // 최대 3회 재시도
}
```

### 2. 작업 체이닝

한 작업이 완료되면 다음 작업을 자동으로 실행:

```json
{
  "jobType": "backup-database",
  "onSuccess": {
    "jobType": "notify-backup-complete",
    "data": {
      "backupFile": "{{backupFile}}"
    }
  }
}
```

### 3. 조건부 실행

특정 조건에서만 작업을 실행:

```json
{
  "condition": "{{serverLoad}} < 50",
  "jobType": "maintenance-task"
}
```

## 🎯 결론

Gatrix의 작업 관리 시스템은 게임 운영을 자동화하고 효율성을 높이는 강력한 도구입니다. 이 가이드를 통해 다양한 작업 유형을 설정하고 관리하는 방법을 배웠습니다.

다음 포스트에서는 채팅 서버 설정과 실시간 통신 구현에 대해 알아보겠습니다!

---

**관련 자료**:
- [작업 관리 시스템 문서](/docs/features/job-management)
- [API 문서](/docs/api/client-api)
- [GitHub 저장소](https://github.com/motifgames/gatrix)

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Pellentesque elementum dignissim ultricies. Fusce rhoncus ipsum tempor eros aliquam consequat. Lorem ipsum dolor sit amet
