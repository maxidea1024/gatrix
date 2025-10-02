# Event Lens 설치 및 실행 가이드 🚀

> Gatrix 프로젝트에 Event Lens Analytics Server 추가하기

## 📋 개요

Event Lens는 OpenPanel에서 영감을 받은 강력한 이벤트 추적 및 분석 서비스입니다.
- **Phase 1-4 구현 완료**: 인프라, Event API, Worker, 분석 엔진
- **Frontend 제외**: Backend API만 구현 (Frontend는 추후 검토)

## 🏗️ 아키텍처

```
Frontend
    ↓
Backend (Express :5000)
    ├─→ /api/v1/chat/*      → Chat Server :3001
    └─→ /api/v1/analytics/* → Event Lens :3002
                                    ↓
                              Redis Queue (BullMQ)
                                    ↓
                              Event Lens Worker
                                    ↓
                        ClickHouse + MySQL + Redis
```

## 📦 설치된 구성 요소

### 1. Event Lens Server (packages/event-lens/)
- **포트**: 3002
- **역할**: 이벤트 수집 API, 분석 API
- **기술**: Fastify, TypeScript, Zod

### 2. Event Lens Worker
- **역할**: 배치 이벤트 처리, 프로필 관리, 세션 집계
- **기술**: BullMQ, ClickHouse

### 3. ClickHouse
- **포트**: 8123 (HTTP), 9000 (Native)
- **역할**: 이벤트 데이터 저장 (시계열)
- **버전**: 24.12.2.29-alpine

### 4. Backend Proxy
- **경로**: `/api/v1/analytics/*`
- **역할**: Event Lens로 요청 프록시

## 🚀 빠른 시작

### Step 1: 의존성 설치

```bash
# Event Lens 디렉토리로 이동
cd packages/event-lens

# 의존성 설치
npm install
```

### Step 2: 환경 변수 설정

```bash
# .env 파일 생성
cp .env.example .env

# .env 파일 편집 (필요시)
# 기본값으로도 동작합니다
```

### Step 3: Docker Compose로 인프라 실행

```bash
# 루트 디렉토리로 이동
cd ../..

# ClickHouse 및 Event Lens 서비스 시작
docker-compose up -d clickhouse event-lens event-lens-worker
```

### Step 4: 데이터베이스 마이그레이션

```bash
cd packages/event-lens

# MySQL 마이그레이션 (analytics_projects, analytics_clients 테이블)
npm run migrate:mysql

# ClickHouse 마이그레이션 (events, profiles, sessions 테이블)
npm run migrate:clickhouse
```

### Step 5: 서비스 확인

```bash
# Event Lens 헬스 체크
curl http://localhost:3002/health

# 응답 예시:
# {
#   "status": "ok",
#   "timestamp": "2024-01-15T10:30:00.000Z",
#   "uptime": 123.456
# }
```

## 🧪 테스트

### 1. 프로젝트 및 클라이언트 생성 (MySQL)

```sql
-- MySQL에 접속
mysql -u gatrix_user -p gatrix

-- 프로젝트 생성
INSERT INTO analytics_projects (id, name, domain, userId, createdAt)
VALUES ('test-project-1', 'Test Project', 'localhost', 1, NOW());

-- 클라이언트 생성 (Write 권한)
INSERT INTO analytics_clients (id, name, type, projectId, secret, createdAt)
VALUES (
  'client-123',
  'Test Client',
  'write',
  'test-project-1',
  'secret-456',
  NOW()
);
```

### 2. 이벤트 전송 테스트

```bash
# 단일 이벤트 전송
curl -X POST http://localhost:5000/api/v1/analytics/track \
  -H "event-lens-client-id: client-123" \
  -H "event-lens-client-secret: secret-456" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "track",
    "payload": {
      "name": "page_view",
      "deviceId": "device-001",
      "sessionId": "session-001",
      "path": "/dashboard",
      "properties": {
        "title": "Dashboard"
      }
    }
  }'

# 응답: {"success": true}
```

### 3. 배치 이벤트 전송

```bash
curl -X POST http://localhost:5000/api/v1/analytics/track/batch \
  -H "event-lens-client-id: client-123" \
  -H "event-lens-client-secret: secret-456" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      {
        "type": "track",
        "payload": {
          "name": "page_view",
          "deviceId": "device-001",
          "sessionId": "session-001",
          "path": "/home"
        }
      },
      {
        "type": "track",
        "payload": {
          "name": "button_click",
          "deviceId": "device-001",
          "sessionId": "session-001",
          "properties": {
            "button": "signup"
          }
        }
      }
    ]
  }'
```

### 4. 메트릭 조회

```bash
# 기본 메트릭
curl "http://localhost:5000/api/v1/analytics/insights/test-project-1/metrics?startDate=2024-01-01&endDate=2024-12-31" \
  -H "event-lens-client-id: client-123" \
  -H "event-lens-client-secret: secret-456"

# 실시간 방문자
curl "http://localhost:5000/api/v1/analytics/insights/test-project-1/live" \
  -H "event-lens-client-id: client-123" \
  -H "event-lens-client-secret: secret-456"

# 시계열 데이터
curl "http://localhost:5000/api/v1/analytics/insights/test-project-1/timeseries?startDate=2024-01-01&endDate=2024-12-31&interval=day" \
  -H "event-lens-client-id: client-123" \
  -H "event-lens-client-secret: secret-456"
```

### 5. 퍼널 분석

```bash
curl -X POST "http://localhost:5000/api/v1/analytics/insights/test-project-1/funnel" \
  -H "event-lens-client-id: client-123" \
  -H "event-lens-client-secret: secret-456" \
  -H "Content-Type: application/json" \
  -d '{
    "steps": ["page_view", "button_click", "signup_complete"],
    "startDate": "2024-01-01",
    "endDate": "2024-12-31"
  }'
```

### 6. 리텐션 분석

```bash
curl "http://localhost:5000/api/v1/analytics/insights/test-project-1/retention?startDate=2024-01-01&endDate=2024-12-31&period=day" \
  -H "event-lens-client-id: client-123" \
  -H "event-lens-client-secret: secret-456"
```

## 📊 ClickHouse 데이터 확인

```bash
# ClickHouse 컨테이너 접속
docker exec -it gatrix-clickhouse clickhouse-client

# 이벤트 조회
SELECT * FROM event_lens.events LIMIT 10;

# 프로젝트별 이벤트 수
SELECT projectId, count() as count
FROM event_lens.events
GROUP BY projectId;

# 일별 방문자 수
SELECT
  toDate(createdAt) as date,
  uniq(deviceId) as uniqueVisitors
FROM event_lens.events
GROUP BY date
ORDER BY date;
```

## 🐛 트러블슈팅

### 1. ClickHouse 연결 실패

```bash
# ClickHouse 상태 확인
docker-compose ps clickhouse

# ClickHouse 로그 확인
docker-compose logs clickhouse

# ClickHouse 재시작
docker-compose restart clickhouse
```

### 2. Worker가 이벤트를 처리하지 않음

```bash
# Worker 로그 확인
docker-compose logs event-lens-worker

# Redis 큐 확인
docker exec -it gatrix-redis redis-cli
> KEYS event-lens:*
> LLEN event-lens:events
```

### 3. 마이그레이션 실패

```bash
# ClickHouse 마이그레이션 재실행
cd packages/event-lens
npm run migrate:clickhouse

# MySQL 마이그레이션 재실행
npm run migrate:mysql
```

## 📁 프로젝트 구조

```
packages/event-lens/
├── src/
│   ├── config/           # ClickHouse, Redis, MySQL, BullMQ 설정
│   ├── routes/           # track, insights API
│   ├── services/         # event-processor, metrics, funnel, retention
│   ├── workers/          # event-worker, profile-worker, session-worker
│   ├── middleware/       # auth, error-handler
│   ├── types/            # TypeScript 타입 정의
│   ├── utils/            # logger
│   ├── app.ts            # Fastify 앱
│   ├── index.ts          # 서버 진입점
│   └── worker.ts         # Worker 진입점
├── migrations/
│   ├── clickhouse/       # ClickHouse 스키마
│   └── mysql/            # MySQL 스키마
├── scripts/              # 마이그레이션 스크립트
├── Dockerfile
├── package.json
└── README.md
```

## 🎯 구현된 기능 (Phase 1-4)

### ✅ Phase 1: 인프라
- ClickHouse, Redis, MySQL 연결
- Fastify 서버 설정
- BullMQ 큐 설정
- Winston 로깅

### ✅ Phase 2: Event API
- POST /track - 이벤트 추적
- POST /track/batch - 배치 이벤트
- 클라이언트 인증 (헤더 기반)
- Rate Limiting
- 이벤트 정규화 (User-Agent, Referrer)

### ✅ Phase 3: Worker
- Event Worker (배치 삽입 1000개)
- Profile Worker (identify, increment, decrement)
- Session Worker (세션 집계)

### ✅ Phase 4: 분석 엔진
- 기본 메트릭 (방문자, 세션, 이탈률)
- 시계열 데이터
- 상위 페이지
- 실시간 방문자
- Referrer 분석
- 디바이스/지리 통계
- 퍼널 분석
- 리텐션 분석

## 🔜 다음 단계 (Frontend - 추후 검토)

- Phase 5: Frontend 대시보드
- Phase 6: 고급 기능 (A/B 테스트, Webhooks)
- Phase 7: 프로덕션 최적화

## 📝 참고 문서

- **상세 통합 계획**: `ANALYTICS_SERVER_INTEGRATION_PLAN.md`
- **Event Lens README**: `packages/event-lens/README.md`
- **OpenPanel 구현 가이드**: `OPENPANEL_IMPLEMENTATION_GUIDE.md`

---

**구현 완료!** 🎉

Event Lens가 성공적으로 Gatrix 프로젝트에 통합되었습니다.

