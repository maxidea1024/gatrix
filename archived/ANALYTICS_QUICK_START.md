# Analytics Server 빠른 시작 가이드

> **목적**: Gatrix 프로젝트에 Analytics Server를 최대한 빠르게 추가하기

---

## 🚀 5분 안에 시작하기

### Step 1: 프로젝트 생성 (1분)

```bash
# Analytics Server 디렉토리 생성
mkdir -p packages/analytics-server/src/{config,routes,services,workers,middleware,models,utils,types}
cd packages/analytics-server

# package.json 생성
cat > package.json << 'EOF'
{
  "name": "@gatrix/analytics-server",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "dev": "nodemon src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@clickhouse/client": "^1.0.0",
    "@fastify/cors": "^8.4.2",
    "@fastify/helmet": "^11.1.1",
    "bullmq": "^5.0.0",
    "dotenv": "^16.3.1",
    "fastify": "^4.25.0",
    "ioredis": "^5.3.2",
    "mysql2": "^3.15.0",
    "winston": "^3.11.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/node": "^20.10.4",
    "nodemon": "^3.0.2",
    "ts-node": "^10.9.1",
    "typescript": "^5.3.2"
  }
}
EOF

# 의존성 설치
npm install
```

### Step 2: TypeScript 설정 (30초)

```bash
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true
  }
}
EOF
```

### Step 3: 기본 서버 코드 (2분)

```bash
# src/index.ts
cat > src/index.ts << 'EOF'
import Fastify from 'fastify';

const app = Fastify({ logger: true });

app.get('/health', async () => ({ status: 'ok' }));

app.post('/track', async (request) => {
  console.log('Event received:', request.body);
  return { success: true };
});

app.listen({ port: 3002, host: '0.0.0.0' }, (err) => {
  if (err) throw err;
  console.log('🚀 Analytics Server running on port 3002');
});
EOF
```

### Step 4: Docker Compose 수정 (1분)

```bash
# 루트 디렉토리의 docker-compose.yml에 추가
cd ../..

# ClickHouse 서비스 추가
cat >> docker-compose.yml << 'EOF'

  # ClickHouse
  clickhouse:
    image: clickhouse/clickhouse-server:24.12.2.29-alpine
    container_name: gatrix-clickhouse
    restart: unless-stopped
    ports:
      - "8123:8123"
      - "9000:9000"
    volumes:
      - clickhouse_data:/var/lib/clickhouse
    networks:
      - gatrix-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8123/ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Analytics Server
  analytics-server:
    build:
      context: .
      dockerfile: packages/analytics-server/Dockerfile
    container_name: gatrix-analytics
    restart: unless-stopped
    environment:
      PORT: 3002
      CLICKHOUSE_HOST: clickhouse
      REDIS_HOST: redis
      MYSQL_HOST: mysql
    ports:
      - "3002:3002"
    depends_on:
      - mysql
      - redis
      - clickhouse
    networks:
      - gatrix-network
EOF

# volumes 섹션에 추가
sed -i '/volumes:/a\  clickhouse_data:\n    driver: local' docker-compose.yml
```

### Step 5: 실행 (30초)

```bash
# 개발 모드로 실행
cd packages/analytics-server
npm run dev

# 또는 Docker로 실행
docker-compose up -d clickhouse
docker-compose up analytics-server
```

### Step 6: 테스트

```bash
# Health check
curl http://localhost:3002/health

# 이벤트 전송 테스트
curl -X POST http://localhost:3002/track \
  -H "Content-Type: application/json" \
  -d '{
    "type": "track",
    "payload": {
      "name": "page_view",
      "path": "/dashboard"
    }
  }'
```

---

## 📊 다음 단계

### 1. Backend Proxy 추가

```typescript
// packages/backend/src/routes/analytics.ts
import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const router = express.Router();

router.use(
  '/',
  createProxyMiddleware({
    target: 'http://localhost:3002',
    changeOrigin: true,
    pathRewrite: { '^/api/v1/analytics': '' },
  })
);

export default router;
```

```typescript
// packages/backend/src/app.ts에 추가
import analyticsRoutes from './routes/analytics';
app.use('/api/v1/analytics', analyticsRoutes);
```

### 2. Frontend SDK 추가

```typescript
// packages/frontend/src/lib/analytics.ts
class Analytics {
  track(event: string, properties?: any) {
    return fetch('/api/v1/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'track',
        payload: { name: event, properties },
      }),
    });
  }
}

export const analytics = new Analytics();
```

### 3. ClickHouse 테이블 생성

```sql
-- ClickHouse에 접속
docker exec -it gatrix-clickhouse clickhouse-client

-- 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS analytics;

-- 이벤트 테이블 생성
CREATE TABLE analytics.events (
  id UUID DEFAULT generateUUIDv4(),
  project_id String,
  name String,
  device_id String,
  created_at DateTime DEFAULT now(),
  properties String
)
ENGINE = MergeTree()
PARTITION BY toYYYYMM(created_at)
ORDER BY (project_id, created_at, device_id);
```

---

## 🎯 주요 엔드포인트

| 엔드포인트                     | 메서드 | 설명          |
| ------------------------------ | ------ | ------------- |
| `/health`                      | GET    | 헬스 체크     |
| `/track`                       | POST   | 이벤트 추적   |
| `/insights/:projectId/metrics` | GET    | 메트릭 조회   |
| `/insights/:projectId/live`    | GET    | 실시간 방문자 |

---

## 📁 프로젝트 구조

```
packages/analytics-server/
├── src/
│   ├── index.ts              # 서버 진입점
│   ├── app.ts                # Fastify 앱
│   ├── config/               # 설정
│   ├── routes/               # 라우트
│   ├── services/             # 비즈니스 로직
│   ├── workers/              # BullMQ Workers
│   └── middleware/           # 미들웨어
├── package.json
├── tsconfig.json
└── Dockerfile
```

---

## 🔧 환경 변수

```bash
# .env
PORT=3002
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_DATABASE=analytics
REDIS_HOST=localhost
REDIS_PORT=6379
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=gatrix
```

---

## 📚 참고 문서

- **상세 통합 계획**: `ANALYTICS_SERVER_INTEGRATION_PLAN.md`
- **OpenPanel 구현 가이드**: `OPENPANEL_IMPLEMENTATION_GUIDE.md`
- **아키텍처 문서**: `OPENPANEL_ARCHITECTURE.md`

---

## ✅ 체크리스트

- [ ] Analytics Server 프로젝트 생성
- [ ] 기본 Fastify 서버 실행
- [ ] ClickHouse 컨테이너 실행
- [ ] Backend Proxy 설정
- [ ] Frontend SDK 통합
- [ ] 이벤트 추적 테스트
- [ ] ClickHouse 테이블 생성
- [ ] Worker 구현
- [ ] 메트릭 조회 API 구현
- [ ] 대시보드 UI 추가

---

**시작 준비 완료!** 🎉
