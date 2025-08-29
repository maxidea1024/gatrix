# Client API Documentation

클라이언트에서 직접 호출할 수 있는 공개 API 엔드포인트입니다.

## 특징

- **인증 불필요**: 클라이언트에서 직접 호출 가능
- **Rate Limit 없음**: 대량의 요청 처리 가능
- **고성능 캐싱**: 로컬 메모리 캐싱으로 빠른 응답
- **자동 캐시 무효화**: 관리자 수정 시 pub/sub를 통한 실시간 캐시 갱신

## API 엔드포인트

### 1. 클라이언트 버전 정보 조회

```
GET /api/v1/client/client-version
```

게임 클라이언트에서 사용할 버전 정보를 조회합니다.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| channel | string | 채널 필터 (예: A1, PC) |
| subChannel | string | 서브채널 필터 (예: QQ, WeChat, iOS) |

#### Response

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
        "gameServerAddressForWhiteList": "https://game-vip.example.com",
        "patchAddress": "https://patch.example.com",
        "patchAddressForWhiteList": "https://patch-vip.example.com",
        "guestModeAllowed": true,
        "externalClickLink": "https://website.example.com",
        "customPayload": {
          "feature1": true,
          "setting1": "value1"
        },
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 1,
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "cached": false
}
```

#### 캐시 정보

- **캐시 키**: `CLIENT_VERSION.BY_CHANNEL(channel, subChannel)`
- **캐시 TTL**: 5분 (`DEFAULT_CONFIG.CLIENT_VERSION_TTL`)
- **무효화**: 클라이언트 버전 생성/수정/삭제 시

### 2. 게임월드 목록 조회

```
GET /api/v1/client/game-worlds
```

사용 가능한 게임월드 목록을 조회합니다.

#### Response

```json
{
  "success": true,
  "data": {
    "worlds": [
      {
        "id": 1,
        "worldId": "world001",
        "name": "메인 월드",
        "description": "기본 게임 월드입니다",
        "displayOrder": 1,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "total": 1,
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "cached": false
}
```

#### 필터링

- **visible**: `true`인 월드만 반환
- **maintenance**: `false`인 월드만 반환 (점검 중이 아닌 월드)
- **정렬**: `displayOrder` 오름차순

#### 캐시 정보

- **캐시 키**: `GAME_WORLDS.PUBLIC`
- **캐시 TTL**: 10분 (`DEFAULT_CONFIG.GAME_WORLDS_PUBLIC_TTL`)
- **무효화**: 게임월드 생성/수정/삭제 시

### 3. 캐시 통계 조회

```
GET /api/v1/client/cache-stats
```

캐시 성능 통계를 조회합니다. (모니터링 용도)

#### Response

```json
{
  "success": true,
  "data": {
    "totalItems": 10,
    "validItems": 8,
    "expiredItems": 2,
    "memoryUsage": {
      "rss": 50331648,
      "heapTotal": 20971520,
      "heapUsed": 15728640,
      "external": 1048576,
      "arrayBuffers": 524288
    }
  }
}
```

## 캐시 시스템

### 로컬 메모리 캐싱

- **CacheService**: 인메모리 캐시 관리
- **자동 만료**: TTL 기반 자동 정리
- **패턴 매칭**: 정규식을 통한 일괄 삭제

### BullMQ 기반 큐 시스템

- **PubSubService**: BullMQ를 통한 안정적인 캐시 무효화 큐
- **QueueService**: 이메일, 감사로그, 정리 작업 등을 위한 범용 큐 시스템
- **실시간 동기화**: 관리자 수정 시 모든 인스턴스의 캐시 즉시 무효화
- **재시도 메커니즘**: 실패한 작업 자동 재시도 (지수 백오프)
- **장애 허용**: Redis 연결 실패 시에도 로컬 캐시는 정상 동작

### 캐시 무효화 시나리오

1. **클라이언트 버전 변경**
   - 생성/수정/삭제/상태변경 시
   - 패턴: `client_version:.*`
   - 큐를 통한 비동기 처리

2. **게임월드 변경**
   - 생성/수정/삭제 시
   - 키: `game_worlds:public`
   - 큐를 통한 비동기 처리

### 큐 시스템 특징

- **높은 우선순위**: 캐시 무효화 작업은 우선순위 10으로 처리
- **자동 정리**: 완료된 작업 100개, 실패한 작업 50개까지 보관
- **동시성 제어**: 워커당 최대 5개 작업 동시 처리
- **모니터링**: 큐 상태 실시간 모니터링 가능

## 성능 최적화

### 응답 시간

- **캐시 히트**: ~1ms
- **캐시 미스**: ~50-100ms (DB 조회)
- **캐시 무효화**: ~2-5ms (BullMQ 큐 추가)
- **큐 처리**: ~10-50ms (백그라운드 처리)

### 메모리 사용량

- **예상 사용량**: 항목당 ~1-5KB
- **자동 정리**: 만료된 항목 1분마다 정리
- **큐 정리**: 완료/실패 작업 자동 정리
- **메모리 모니터링**: `/api/v1/client/cache-stats`로 확인

## 사용 예시

### JavaScript (게임 클라이언트)

```javascript
// 클라이언트 버전 정보 조회
async function getClientVersion(channel, subChannel) {
  const params = new URLSearchParams();
  if (channel) params.append('channel', channel);
  if (subChannel) params.append('subChannel', subChannel);
  
  const response = await fetch(`/api/v1/client/client-version?${params}`);
  const data = await response.json();
  
  if (data.success) {
    return data.data.versions;
  }
  throw new Error('Failed to get client version');
}

// 게임월드 목록 조회
async function getGameWorlds() {
  const response = await fetch('/api/v1/client/game-worlds');
  const data = await response.json();
  
  if (data.success) {
    return data.data.worlds;
  }
  throw new Error('Failed to get game worlds');
}
```

### Unity C# (게임 클라이언트)

```csharp
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;

public class ClientAPI : MonoBehaviour
{
    private const string BASE_URL = "https://api.example.com/api/v1/client";
    
    public IEnumerator GetClientVersion(string channel, string subChannel)
    {
        string url = $"{BASE_URL}/client-version";
        if (!string.IsNullOrEmpty(channel))
            url += $"?channel={channel}";
        if (!string.IsNullOrEmpty(subChannel))
            url += $"&subChannel={subChannel}";
            
        using (UnityWebRequest request = UnityWebRequest.Get(url))
        {
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                string json = request.downloadHandler.text;
                // JSON 파싱 및 처리
                Debug.Log($"Client version data: {json}");
            }
        }
    }
}
```

## 모니터링

### 로그 확인

```bash
# 캐시 관련 로그 확인
tail -f logs/app.log | grep -i cache

# PubSub 관련 로그 확인
tail -f logs/app.log | grep -i pubsub
```

### 캐시 및 큐 통계 모니터링

```bash
# 캐시 및 큐 통계 API 호출
curl http://localhost:3000/api/v1/client/cache-stats
```

**응답 예시:**
```json
{
  "success": true,
  "data": {
    "cache": {
      "totalItems": 10,
      "validItems": 8,
      "expiredItems": 2,
      "memoryUsage": { ... }
    },
    "queue": {
      "waiting": 0,
      "active": 1,
      "completed": 150,
      "failed": 2,
      "total": 153
    },
    "pubsub": {
      "connected": true,
      "timestamp": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

### BullMQ 대시보드 (선택사항)

BullMQ UI를 통한 큐 모니터링:

```bash
# BullMQ UI 설치 (개발 환경)
npm install -g @bull-board/ui

# 대시보드 실행
bull-board
```
