# Event Lens 🔍

> Gatrix의 강력한 이벤트 추적 및 분석 서비스

Event Lens는 OpenPanel에서 영감을 받은 오픈소스 분석 플랫폼으로, 웹 및 제품 분석 기능을 제공합니다.

## 🎯 주요 기능

### 웹 분석
- ✅ 방문자 추적 (Unique Visitors)
- ✅ 세션 분석 (Session Duration, Bounce Rate)
- ✅ 페이지 뷰 추적
- ✅ Referrer 분석
- ✅ 디바이스/브라우저/OS 통계
- ✅ 지리적 위치 분석

### 제품 분석
- ✅ 커스텀 이벤트 추적
- ✅ 퍼널 분석 (Funnel Analysis)
- ✅ 리텐션 분석 (Retention Analysis)
- ✅ 사용자 프로필 관리
- ✅ 실시간 분석

### 고급 기능
- ✅ 배치 이벤트 처리 (1000개/배치)
- ✅ 실시간 데이터 처리
- ✅ Materialized Views (사전 집계)
- ✅ Redis 캐싱 (5분 TTL)
- ✅ Rate Limiting

## 🏗️ 아키텍처

```
Frontend → Backend Proxy → Event Lens API (Fastify :3002)
                                ↓
                          Redis Queue (BullMQ)
                                ↓
                            Workers
                                ↓
                          ClickHouse + MySQL
```

## 🚀 빠른 시작

### 1. 의존성 설치

```bash
cd packages/event-lens
npm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
# .env 파일 수정
```

### 3. 데이터베이스 마이그레이션

```bash
# MySQL 마이그레이션
npm run migrate:mysql

# ClickHouse 마이그레이션
npm run migrate:clickhouse
```

### 4. 서버 실행

```bash
# 개발 모드
npm run dev

# Worker 실행 (별도 터미널)
npm run dev:worker
```

### 5. 프로덕션 빌드

```bash
npm run build
npm start
npm run start:worker
```

## 📊 API 엔드포인트

### 이벤트 추적

#### POST /track
이벤트 추적

```bash
curl -X POST http://localhost:5200/track \
  -H "event-lens-client-id: YOUR_CLIENT_ID" \
  -H "event-lens-client-secret: YOUR_CLIENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "track",
    "payload": {
      "name": "page_view",
      "deviceId": "device-123",
      "sessionId": "session-456",
      "path": "/dashboard",
      "properties": {
        "title": "Dashboard"
      }
    }
  }'
```

#### POST /track/batch
배치 이벤트 추적 (최대 100개)

```bash
curl -X POST http://localhost:5200/track/batch \
  -H "event-lens-client-id: YOUR_CLIENT_ID" \
  -H "event-lens-client-secret: YOUR_CLIENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "events": [
      {
        "type": "track",
        "payload": { "name": "page_view", "path": "/home" }
      },
      {
        "type": "track",
        "payload": { "name": "button_click", "properties": { "button": "signup" } }
      }
    ]
  }'
```

### 분석 API

#### GET /insights/:projectId/metrics
기본 메트릭 조회

```bash
curl "http://localhost:5200/insights/project-123/metrics?startDate=2024-01-01&endDate=2024-01-31" \
  -H "event-lens-client-id: YOUR_CLIENT_ID" \
  -H "event-lens-client-secret: YOUR_CLIENT_SECRET"
```

#### GET /insights/:projectId/timeseries
시계열 데이터

```bash
curl "http://localhost:5200/insights/project-123/timeseries?startDate=2024-01-01&endDate=2024-01-31&interval=day" \
  -H "event-lens-client-id: YOUR_CLIENT_ID" \
  -H "event-lens-client-secret: YOUR_CLIENT_SECRET"
```

#### GET /insights/:projectId/live
실시간 방문자

```bash
curl "http://localhost:5200/insights/project-123/live" \
  -H "event-lens-client-id: YOUR_CLIENT_ID" \
  -H "event-lens-client-secret: YOUR_CLIENT_SECRET"
```

#### POST /insights/:projectId/funnel
퍼널 분석

```bash
curl -X POST "http://localhost:5200/insights/project-123/funnel" \
  -H "event-lens-client-id: YOUR_CLIENT_ID" \
  -H "event-lens-client-secret: YOUR_CLIENT_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "steps": ["page_view", "signup_click", "signup_complete"],
    "startDate": "2024-01-01",
    "endDate": "2024-01-31"
  }'
```

#### GET /insights/:projectId/retention
리텐션 분석

```bash
curl "http://localhost:5200/insights/project-123/retention?startDate=2024-01-01&endDate=2024-01-31&period=day" \
  -H "event-lens-client-id: YOUR_CLIENT_ID" \
  -H "event-lens-client-secret: YOUR_CLIENT_SECRET"
```

## 🔧 기술 스택

- **Fastify**: 고성능 웹 프레임워크
- **ClickHouse**: 시계열 데이터 저장 (이벤트)
- **MySQL**: 메타데이터 저장 (프로젝트, 클라이언트)
- **Redis**: 캐싱, 큐, Pub/Sub
- **BullMQ**: 백그라운드 작업 큐
- **TypeScript**: 타입 안전성
- **Zod**: 스키마 검증
- **Winston**: 로깅

## 📁 프로젝트 구조

```
packages/event-lens/
├── src/
│   ├── config/           # 설정 (ClickHouse, Redis, MySQL, BullMQ)
│   ├── routes/           # API 라우트
│   ├── services/         # 비즈니스 로직
│   ├── workers/          # BullMQ Workers
│   ├── middleware/       # 미들웨어 (인증, 에러 핸들러)
│   ├── types/            # TypeScript 타입
│   ├── utils/            # 유틸리티 (로거)
│   ├── app.ts            # Fastify 앱
│   ├── index.ts          # 서버 진입점
│   └── worker.ts         # Worker 진입점
├── migrations/
│   ├── clickhouse/       # ClickHouse 마이그레이션
│   └── mysql/            # MySQL 마이그레이션
├── Dockerfile
├── package.json
└── tsconfig.json
```

## 🐳 Docker

```bash
# 이미지 빌드
docker build -t event-lens .

# 컨테이너 실행
docker run -p 5200:5200 --env-file .env event-lens
```

## 📝 라이선스

MIT

## 👥 기여

Gatrix Team

