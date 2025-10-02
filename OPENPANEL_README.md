# OpenPanel 구현 가이드 문서 모음

> **작성일**: 2025-10-02  
> **목적**: OpenPanel과 같은 오픈소스 분석 플랫폼을 직접 구현하기 위한 종합 가이드

---

## 📚 문서 구성

이 문서 모음은 OpenPanel의 모든 기능을 구현 관점에서 상세하게 분석하고 정리한 것입니다.

### 1. [OPENPANEL_IMPLEMENTATION_GUIDE.md](./OPENPANEL_IMPLEMENTATION_GUIDE.md)
**핵심 구현 가이드 (698 → 1203 라인)**

OpenPanel의 전체 시스템을 구현하기 위한 핵심 가이드입니다.

**주요 내용:**
- ✅ 시스템 아키텍처 개요
- ✅ 기술 스택 상세 (Next.js, Fastify, ClickHouse, Redis, BullMQ)
- ✅ 데이터베이스 설계 (PostgreSQL + ClickHouse)
- ✅ 이벤트 수집 시스템
- ✅ 분석 엔진 구현 (메트릭, 퍼널, 리텐션)
- ✅ 대시보드 구현
- ✅ 인증 및 권한 관리 (Arctic + Oslo)
- ✅ 실시간 처리 파이프라인 (BullMQ)
- ✅ API 설계 (Track API, Insights API)
- ✅ 배포 및 인프라 (Docker Compose)
- ✅ 성능 최적화 (ClickHouse, Redis 캐싱)
- ✅ 참고 자료 및 결론

**대상 독자:** 전체 시스템 아키텍처를 이해하고 싶은 개발자

---

### 2. [OPENPANEL_DETAILED_SPECS.md](./OPENPANEL_DETAILED_SPECS.md)
**상세 구현 스펙 (1634 라인)**

각 기능별 상세 구현 스펙과 실제 코드 예제를 제공합니다.

**주요 내용:**
- ✅ 이벤트 데이터 모델 (타입 정의, 정규화)
- ✅ 세션 관리 시스템 (클라이언트/서버 사이드)
- ✅ 사용자 프로필 시스템 (식별, 병합, 속성 관리)
- ✅ 필터링 시스템 (동적 필터 빌더)
- ✅ 차트 및 시각화 (실시간 업데이트)
- ✅ Export 기능 (CSV, JSON, 스트리밍)
- ✅ Webhook 시스템 (이벤트 기반 알림)
- ✅ SDK 구현 상세 (React, Vue, Next.js, Python)
- ✅ 고급 분석 기능 (코호트, 경로 분석)

**대상 독자:** 특정 기능을 깊이 있게 구현하고 싶은 개발자

---

### 3. [OPENPANEL_ARCHITECTURE.md](./OPENPANEL_ARCHITECTURE.md)
**아키텍처 및 데이터 흐름 (300+ 라인)**

시스템 아키텍처와 데이터 흐름을 시각화하고 설명합니다.

**주요 내용:**
- ✅ 전체 시스템 아키텍처 (ASCII 다이어그램)
- ✅ 데이터 흐름 (이벤트 수집, 프로필 업데이트, 대시보드 쿼리, 실시간 업데이트)
- ✅ 데이터베이스 스키마 (PostgreSQL, ClickHouse)
- ✅ 확장성 전략 (수평 확장, 샤딩, 캐싱)
- ✅ 모니터링 및 관찰성 (메트릭, 로깅, 분산 추적)

**대상 독자:** 시스템 설계와 확장성을 고민하는 아키텍트

---

### 4. [OPENPANEL_IMPLEMENTATION_CHECKLIST.md](./OPENPANEL_IMPLEMENTATION_CHECKLIST.md)
**구현 체크리스트 (300+ 라인)**

단계별 구현 체크리스트와 우선순위를 제공합니다.

**주요 내용:**
- ✅ Phase 1: 기본 인프라 구축
- ✅ Phase 2: 이벤트 수집 시스템
- ✅ Phase 3: 데이터 처리 파이프라인
- ✅ Phase 4: 분석 엔진
- ✅ Phase 5: 대시보드 구현
- ✅ Phase 6: 고급 기능
- ✅ Phase 7: 프로덕션 준비
- ✅ 구현 우선순위 (High/Medium/Low)
- ✅ 예상 개발 기간 (17주, 2명)
- ✅ 주요 기술적 도전 과제

**대상 독자:** 프로젝트 매니저, 팀 리더

---

## 🎯 빠른 시작 가이드

### 1단계: 문서 읽기 순서

처음 시작하는 경우 다음 순서로 읽는 것을 권장합니다:

1. **OPENPANEL_IMPLEMENTATION_GUIDE.md** (전체 개요 파악)
2. **OPENPANEL_ARCHITECTURE.md** (아키텍처 이해)
3. **OPENPANEL_IMPLEMENTATION_CHECKLIST.md** (구현 계획 수립)
4. **OPENPANEL_DETAILED_SPECS.md** (상세 구현 시작)

### 2단계: 개발 환경 설정

```bash
# 1. Monorepo 초기화
mkdir openpanel-clone
cd openpanel-clone
pnpm init

# 2. Docker Compose로 인프라 실행
docker-compose up -d

# 3. 데이터베이스 마이그레이션
pnpm prisma migrate dev
pnpm clickhouse-migrate
```

### 3단계: MVP 구현

**우선순위 1 (High Priority):**
1. Event API 구현
2. Web SDK 구현
3. Event Worker 구현
4. 기본 메트릭 구현
5. 대시보드 UI 구현

**예상 기간:** 8주 (2명)

---

## 🏗️ 기술 스택

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/ui
- **State Management**: tRPC + React Query
- **Charts**: Recharts / Chart.js

### Backend
- **Event API**: Fastify
- **API Layer**: tRPC
- **Queue**: BullMQ
- **Authentication**: Arctic + Oslo + Lucia

### Database
- **Metadata**: PostgreSQL 14
- **Events**: ClickHouse 24.12
- **Cache/Queue**: Redis 7.2

### Infrastructure
- **Container**: Docker
- **Orchestration**: Kubernetes (선택)
- **Monitoring**: Prometheus + Grafana
- **Logging**: Pino + ELK Stack

---

## 📊 주요 기능

### 웹 분석
- ✅ 방문자 추적 (Unique Visitors, Sessions)
- ✅ 페이지 분석 (Top Pages, Entry/Exit Pages)
- ✅ 소스 분석 (Referrers, UTM Parameters)
- ✅ 디바이스 분석 (Browser, OS, Device Type)
- ✅ 지리 분석 (Country, City, Region)

### 제품 분석
- ✅ 이벤트 추적 (Custom Events)
- ✅ 퍼널 분석 (Conversion Funnel)
- ✅ 리텐션 분석 (Cohort Retention)
- ✅ 경로 분석 (User Path)
- ✅ 프로필 관리 (User Profiles)

### 고급 기능
- ✅ 실시간 분석 (Live Visitors)
- ✅ A/B 테스팅
- ✅ Webhook 통합
- ✅ Export (CSV, JSON)
- ✅ 예약 리포트

---

## 🔧 핵심 구현 포인트

### 1. 이벤트 수집
```typescript
// SDK에서 이벤트 전송
openpanel.track('button_click', {
  button_name: 'signup',
  page: '/landing',
});

// API에서 수신 및 처리
fastify.post('/track', async (request, reply) => {
  // 1. 인증
  // 2. 검증
  // 3. 정규화
  // 4. 큐에 추가
  await eventQueue.add('process-event', event);
});
```

### 2. 데이터 저장
```typescript
// Worker에서 배치 처리
const events = await eventQueue.getJobs(1000);
await clickhouse.insert({
  table: 'events',
  values: events,
  format: 'JSONEachRow',
});
```

### 3. 분석 쿼리
```sql
-- 일별 방문자 수
SELECT
  toDate(createdAt) as date,
  uniq(deviceId) as unique_visitors,
  uniq(sessionId) as total_sessions
FROM events
WHERE projectId = 'proj_123'
  AND createdAt >= '2024-01-01'
  AND createdAt <= '2024-12-31'
GROUP BY date
ORDER BY date;
```

### 4. 실시간 업데이트
```typescript
// Redis Pub/Sub로 실시간 브로드캐스트
await redis.publish('metrics:update', JSON.stringify({
  projectId: 'proj_123',
  metric: 'live_visitors',
  value: 42,
}));

// 대시보드에서 수신
socket.on('metric-update', (data) => {
  setLiveVisitors(data.value);
});
```

---

## 📈 확장성 고려사항

### 수평 확장
- **API 서버**: Kubernetes HPA로 자동 확장
- **Worker**: 큐 크기에 따라 동적 확장
- **ClickHouse**: 분산 테이블로 샤딩

### 성능 최적화
- **배치 삽입**: 1000개씩 묶어서 삽입
- **캐싱**: Redis로 5분 TTL 캐싱
- **인덱스**: ClickHouse bloom filter 인덱스
- **Materialized View**: 사전 집계

### 데이터 관리
- **파티셔닝**: 월별 파티션
- **TTL**: 90일 후 자동 삭제
- **압축**: ZSTD(3) 압축

---

## 🚀 배포 전략

### 개발 환경
```bash
docker-compose up -d
pnpm dev
```

### 스테이징 환경
```bash
docker build -t openpanel:staging .
docker push registry.example.com/openpanel:staging
kubectl apply -f k8s/staging/
```

### 프로덕션 환경
```bash
docker build -t openpanel:v1.0.0 .
docker push registry.example.com/openpanel:v1.0.0
kubectl apply -f k8s/production/
```

---

## 🧪 테스트 전략

### 단위 테스트
```typescript
describe('EventNormalizer', () => {
  it('should normalize timestamp', () => {
    const normalizer = new EventNormalizer();
    const event = { timestamp: '2024-01-01T00:00:00Z' };
    const normalized = normalizer.normalize(event);
    expect(normalized.timestamp).toBe('2024-01-01T00:00:00.000Z');
  });
});
```

### 통합 테스트
```typescript
describe('Event API', () => {
  it('should accept valid event', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/track',
      headers: {
        'openpanel-client-id': 'test_client',
        'openpanel-client-secret': 'test_secret',
      },
      payload: {
        type: 'track',
        payload: { name: 'test_event' },
      },
    });
    
    expect(response.statusCode).toBe(200);
  });
});
```

### E2E 테스트
```typescript
test('should track page view', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForSelector('[data-testid="live-visitors"]');
  
  const liveVisitors = await page.textContent('[data-testid="live-visitors"]');
  expect(parseInt(liveVisitors)).toBeGreaterThan(0);
});
```

---

## 📝 개발 로드맵

### Phase 1: MVP (8주)
- [x] 기본 인프라 구축
- [x] 이벤트 수집 시스템
- [x] 기본 메트릭
- [x] 대시보드 UI

### Phase 2: 고급 기능 (6주)
- [ ] 퍼널 분석
- [ ] 리텐션 분석
- [ ] 프로필 시스템
- [ ] 실시간 업데이트

### Phase 3: 프로덕션 준비 (3주)
- [ ] 성능 최적화
- [ ] 보안 강화
- [ ] 모니터링 설정
- [ ] 배포 자동화

**총 예상 기간: 17주 (약 4개월)**

---

## 🤝 기여 가이드

이 문서는 OpenPanel의 구현을 위한 참고 자료입니다. 실제 구현 과정에서 발견한 개선사항이나 추가 정보가 있다면 문서를 업데이트해주세요.

### 문서 업데이트 방법
1. 해당 문서 파일 수정
2. 변경 사항 커밋
3. Pull Request 생성

---

## 📚 참고 자료

### 공식 문서
- [OpenPanel 공식 사이트](https://openpanel.dev/)
- [OpenPanel GitHub](https://github.com/Openpanel-dev/openpanel)
- [OpenPanel 문서](https://openpanel.dev/docs)

### 기술 스택 문서
- [Next.js](https://nextjs.org/docs)
- [Fastify](https://fastify.dev/)
- [ClickHouse](https://clickhouse.com/docs)
- [tRPC](https://trpc.io/docs)
- [BullMQ](https://docs.bullmq.io/)
- [Prisma](https://www.prisma.io/docs)

### 유사 프로젝트
- [Plausible Analytics](https://github.com/plausible/analytics)
- [Umami](https://github.com/umami-software/umami)
- [PostHog](https://github.com/PostHog/posthog)

---

## 💡 주요 학습 포인트

이 프로젝트를 통해 배울 수 있는 것들:

1. **대용량 데이터 처리**: ClickHouse를 활용한 시계열 데이터 처리
2. **실시간 시스템**: Redis Pub/Sub와 WebSocket을 활용한 실시간 업데이트
3. **비동기 처리**: BullMQ를 활용한 큐 기반 아키텍처
4. **타입 안전성**: TypeScript + tRPC + Zod를 활용한 엔드투엔드 타입 안전성
5. **확장성**: 수평 확장 가능한 마이크로서비스 아키텍처
6. **모니터링**: Prometheus + Grafana를 활용한 시스템 관찰성

---

## ⚠️ 주의사항

### 라이선스
OpenPanel은 AGPL-3.0 라이선스를 사용합니다. 상업적 사용 시 라이선스를 확인하세요.

### 데이터 프라이버시
사용자 데이터를 수집할 때는 GDPR, CCPA 등 관련 법규를 준수해야 합니다.

### 성능
초기 구현 시 성능 최적화보다는 기능 구현에 집중하고, 이후 프로파일링을 통해 최적화하세요.

---

## 📞 문의

문서에 대한 질문이나 제안사항이 있다면 이슈를 생성해주세요.

---

**마지막 업데이트**: 2025-10-02  
**문서 버전**: 1.0.0  
**총 라인 수**: 약 3,500+ 라인


