# etcd 기반 서비스 디스커버리 구현 문서

## 1. 개요

본 문서는 Node.js(TypeScript) 기반 게임 서버 환경에서 etcd를 이용한 서비스 디스커버리 및 상태 관리 시스템 구현 방법을 설명합니다.  
각 서버 인스턴스는 etcd에 등록되어 상태(`initializing`, `ready`, `shutting_down`, `error`)를 공유하고, 클라이언트는 SSE를 통해 실시간 변경사항을 수신합니다.  
또한 TTL 기반 자동 제거 로직을 적용해 비정상 종료된 서버를 일정 시간 이후 자동으로 제거합니다.

---

## 2. 전체 구조

```
+----------------------+
|  Game Server A       |
| - Type: world        |
| - Ports: [8001,8002] |
| - Status: ready      |
+----------+-----------+
           |
           | register/update (TTL, etcd)
           v
+----------------------+
|      etcd cluster    |
| /services/<type>/<id>|
+----------+-----------+
           |
           | watch (SSE broadcast)
           v
+----------------------+
|  Discovery API       |
| - Express + etcd3    |
| - /api/services      |
| - /api/subscribe     |
+----------+-----------+
           |
           | sse stream
           v
+----------------------+
|  GM Dashboard (MUI)  |
| - 실시간 상태 갱신   |
+----------------------+
```

---

## 3. etcd 데이터 구조

```
/services/{serverType}/{instanceId} = {
  id: string,              // ULID
  type: string,            // world, auth, channel 등
  host: string,            // 주 NIC 주소
  ports: number[],         // TCP 포트 목록
  status: string,          // initializing | ready | shutting_down | error
  updatedAt: string,       // ISO8601
  customState?: string     // 로딩 중 리소스명 등
}
```

TTL을 설정하여 heartbeat가 멈추면 일정 시간 후 자동 삭제됩니다.

---

## 4. 서버 사이드 구현

### 4.1 의존성

```bash
npm install etcd3 express ulid
npm install --save-dev typescript @types/express
```

### 4.2 초기 등록 및 heartbeat

```ts
import { Etcd3 } from 'etcd3';
import { ulid } from 'ulid';

const etcd = new Etcd3({ hosts: 'http://localhost:2379' });

const serverInfo = {
  id: ulid(),
  type: 'world',
  host: '10.0.0.5',
  ports: [8001, 8002],
  status: 'initializing',
};

const lease = etcd.lease(10); // TTL 10초

async function register() {
  await lease
    .put(`/services/${serverInfo.type}/${serverInfo.id}`)
    .value(JSON.stringify(serverInfo));
  console.log('Registered server to etcd.');
}

async function heartbeat() {
  setInterval(async () => {
    await lease.keepaliveOnce();
  }, 5000);
}

register();
heartbeat();
```

### 4.3 상태 변경 API

```ts
async function updateStatus(status: string, customState?: string) {
  serverInfo.status = status;
  if (customState) serverInfo.customState = customState;
  serverInfo.updatedAt = new Date().toISOString();
  await lease
    .put(`/services/${serverInfo.type}/${serverInfo.id}`)
    .value(JSON.stringify(serverInfo));
}
```

---

## 5. Discovery API 서버

```ts
import express from 'express';
import { Etcd3 } from 'etcd3';

const app = express();
const etcd = new Etcd3({ hosts: 'http://localhost:2379' });
const servicesCache = new Map<string, any>();

// 초기 로드
async function loadServices() {
  const keys = await etcd.getAll().prefix('/services/').keys();
  for (const key of keys) {
    const value = await etcd.get(key).string();
    if (value) servicesCache.set(key, JSON.parse(value));
  }
}

// SSE 구독
app.get('/api/subscribe', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  const send = (type: string, data: any) =>
    res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);

  for (const [, service] of servicesCache) send('init', service);

  const watcher = etcd.watch().prefix('/services/').create();

  watcher.then((w) => {
    w.on('put', (kv) => {
      const data = JSON.parse(kv.value.toString());
      servicesCache.set(kv.key.toString(), data);
      send('update', data);
    });
    w.on('delete', (kv) => {
      servicesCache.delete(kv.key.toString());
      send('remove', kv.key.toString());
    });
  });
});

app.listen(3000, async () => {
  await loadServices();
  console.log('Discovery API running on port 3000');
});
```

---

## 6. TTL 기반 자동 제거

- 각 서버는 10초 TTL 리스 임대(`lease`)를 사용합니다.
- 서버가 종료되면 `lease.revoke()` 호출로 명시적 종료를 알립니다.
- 네트워크 오류 등으로 heartbeat 중단 시, TTL 만료 후 자동 삭제됩니다.
- 관리 도구에서는 “불량(offline)” 상태를 감지하여 일정 시간 후 제거합니다.

---

## 7. 클라이언트(MUI 대시보드)

React + MUI + React Query 기반으로 실시간 상태를 표시합니다.  
SSE를 통해 서버 목록 변화를 즉시 반영합니다.

### 주요 포인트

- `/api/subscribe` SSE 이벤트 수신
- 상태 컬러 태그 표시 (`ready=green`, `error=red`, `shutting_down=orange`)
- “새로고침” 없이 자동 갱신
- 커스텀 상태(`customState`) 표시 지원

---

## 8. 향후 확장

- WebSocket으로 확장하여 양방향 제어 가능
- 서버 그룹 기반 라우팅 또는 부하 분산
- etcd 장애 대비 로컬 캐시 및 복구 로직 추가
