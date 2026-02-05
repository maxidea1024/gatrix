---
sidebar_position: 1
sidebar_label: 클라이언트 API
---

# 클라이언트 API

게임 클라이언트에서 직접 호출할 수 있는 공개 API 엔드포인트입니다.

## 특징

- **인증 불필요**: 클라이언트에서 직접 호출 가능
- **Rate Limit 적용**: 과도한 요청 처리 제한
- **고성능 캐싱**: 로컬 메모리 캐싱을 통한 빠른 응답
- **실시간 캐시 무효화**: 관리자 설정 변경 시 Pub/Sub을 통한 즉각적인 캐시 갱신

## API 엔드포인트

### 1. 클라이언트 버전 정보

```
GET /api/v1/client/client-version
```

게임 클라이언트의 버전 정보를 조회합니다.

#### 쿼리 매개변수
| 매개변수 | 유형 | 설명 |
|----------|------|------|
| channel | string | 채널 필터 (예: PC, Mobile) |
| subChannel | string | 서브 채널 필터 (예: Steam, Google, iOS) |

#### 응답 예시

```json
{
  "success": true,
  "data": {
    "versions": [
      {
        "id": 1,
        "channel": "PC",
        "subChannel": "Steam",
        "clientVersion": "1.0.0",
        "gameServerAddress": "https://game.example.com",
        "patchAddress": "https://patch.example.com",
        "forceUpdate": false
      }
    ]
  }
}
```

### 2. 게임 월드 목록

```
GET /api/v1/client/game-worlds
```

사용 가능한 게임 월드 목록을 조회합니다.

#### 응답 예시

```json
{
  "success": true,
  "data": {
    "worlds": [
      {
        "worldId": "world001",
        "name": "메인 월드",
        "status": "online"
      }
    ]
  }
}
```

### 3. 서비스 공지사항

```
GET /api/v1/client/notices
```

활성 서비스 공지사항을 조회합니다.

### 4. 피처 플래그 평가

```
POST /api/v1/client/evaluate
```

사용자 컨텍스트에 따라 피처 플래그를 평가합니다.

#### 요청 본문
```json
{
  "context": {
    "userId": "user123",
    "country": "KR"
  },
  "flags": ["new_ui", "event_mode"]
}
```
