# Edge Server 구축 계획서

## 1. 개요

### 1.1 배경

현재 게임 클라이언트가 Backend API에 직접 요청하는 구조는 다음과 같은 문제가 있습니다:

- **보안 취약점**: Backend 서버가 외부에 직접 노출
- **스케일링 한계**: 클라이언트 요청과 관리자 요청이 동일 서버에서 처리
- **단일 장애점**: Backend 장애 시 전체 서비스 중단

### 1.2 목표

- 클라이언트 전용 Edge 서버 분리
- Backend 서버 보안 강화 (내부 네트워크로 격리)
- 독립적인 스케일링 가능한 구조
- 캐시 기반 고성능 응답
- **Backend 장애 시에도 서비스 연속성 보장**

### 1.3 핵심 설계 원칙: 고가용성 (High Availability)

> ⚠️ **Edge 서버는 Backend에 장애가 발생해도 서비스가 중단되면 안됩니다.**

| 상황         | Edge 서버 동작                         |
| ------------ | -------------------------------------- |
| Backend 정상 | 최신 캐시 데이터로 응답                |
| Backend 장애 | **캐싱된 데이터(stale)로 계속 응답**   |
| Backend 복구 | 자동으로 캐시 갱신 후 최신 데이터 응답 |

**설계 원칙**:

1. **Stale 데이터라도 응답**: 오래된 데이터가 무응답보다 낫다
2. **Backend 의존성 최소화**: 초기화 이후에는 Backend 없이 독립 운영
3. **Graceful Degradation**: 일부 기능 장애 시 나머지 기능은 정상 제공
4. **캐시 무기한 유지**: TTL 만료되어도 새 데이터 받을 때까지 기존 캐시 유지
5. **⛔ 데이터베이스 직접 접근 금지**: 모든 데이터는 SDK를 통해서만 조회

> ⛔ **절대 원칙**: Edge 서버는 MySQL, Redis 등 데이터베이스에 **직접 연결하지 않습니다**.
> 모든 데이터는 Server SDK → Backend API를 통해서만 가져옵니다.
> Redis는 오직 PubSub 이벤트 수신용으로만 사용합니다.

### 1.3 기본 사양

| 항목        | 값                                   |
| ----------- | ------------------------------------ |
| 서버명      | `edge`                               |
| 메인 포트   | 3400 (외부 노출) - Client API 전용   |
| 메트릭 포트 | 9400 (내부 전용) - Prometheus 메트릭 |
| 기술 스택   | Node.js + Express + TypeScript       |
| 캐시 방식   | Server SDK 기반 메모리 캐시          |
| 동기화      | Redis PubSub (이벤트) 또는 Polling   |

> ⚠️ **보안 주의**: 메트릭 포트(9337)는 **절대 외부에 노출하면 안됩니다**.
> 내부 네트워크에서만 접근 가능하도록 방화벽/네트워크 설정 필수.

---

## 2. 아키텍처

### 2.1 현재 구조 (AS-IS)

```
┌──────────────┐         ┌──────────────┐
│ Game Client  │────────▶│   Backend    │
│              │         │  (Port 5000) │
└──────────────┘         └──────────────┘
                                │
                         ┌──────┴──────┐
                         │    MySQL    │
                         │    Redis    │
                         └─────────────┘
```

### 2.2 목표 구조 (TO-BE)

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│ Game Client  │────────▶│    Edge      │◀───────▶│   Backend    │
│              │         │  (Port 3400) │  SDK    │  (Port 5000) │
└──────────────┘         └──────────────┘         └──────────────┘
                                │                        │
                                │    ┌──────────────┐    │
                                └───▶│    Redis     │◀───┘
                                     │   (PubSub)   │
                                     └──────────────┘
```

### 2.3 데이터 흐름

1. **초기화**: Edge 서버 시작 시 Backend API에서 데이터 로드 → 메모리 캐시
2. **동기화**: Redis PubSub 또는 Polling으로 실시간 동기화
3. **요청 처리**: 클라이언트 요청 → 메모리 캐시에서 응답 (Backend 호출 없음)
4. **이벤트 수신**: Backend에서 데이터 변경 시 → Redis 이벤트 → 캐시 갱신

### 2.4 장애 시나리오별 동작

```
┌─────────────────────────────────────────────────────────────────────┐
│                        정상 운영 시                                  │
├─────────────────────────────────────────────────────────────────────┤
│  Client ──▶ Edge (캐시) ◀──동기화──▶ Backend ◀──▶ DB               │
│             최신 데이터 응답                                         │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     Backend 장애 시                                  │
├─────────────────────────────────────────────────────────────────────┤
│  Client ──▶ Edge (캐시) ◀──X──▶ Backend (DOWN)                      │
│             캐시된 데이터로 계속 응답 ✅                               │
│             (동기화 실패 로그만 기록, 서비스 정상 유지)                │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      Redis 장애 시                                   │
├─────────────────────────────────────────────────────────────────────┤
│  Client ──▶ Edge (캐시) ◀──X──▶ Redis (DOWN)                        │
│             캐시된 데이터로 계속 응답 ✅                               │
│             (Polling 모드로 자동 전환 또는 캐시 유지)                  │
└─────────────────────────────────────────────────────────────────────┘
```

**Edge 서버 장애 대응 원칙**:

- 캐시 갱신 실패 시 → 기존 캐시 유지, 에러 로그만 기록
- TTL 만료 시 → 새 데이터 가져올 때까지 만료된 캐시 계속 사용
- Backend 연결 불가 시 → 재연결 시도하며 기존 캐시로 서비스 유지

---

## 3. 기능 요구사항

### 3.1 Edge 서버가 처리할 API 목록

| 엔드포인트                               | 메서드 | 설명                 | 인증      |
| ---------------------------------------- | ------ | -------------------- | --------- |
| `/api/v1/client/client-version`          | GET    | 클라이언트 버전 정보 | API Token |
| `/api/v1/client/game-worlds`             | GET    | 게임 월드 목록       | 선택적    |
| `/api/v1/client/banners`                 | GET    | 배너 목록            | API Token |
| `/api/v1/client/remote-config/templates` | GET    | 원격 설정 템플릿     | API Token |
| `/api/v1/client/remote-config/evaluate`  | POST   | 원격 설정 평가       | API Token |
| `/api/v1/client/crashes/upload`          | POST   | 크래시 리포트 업로드 | API Token |
| `/api/v1/public/service-notices`         | GET    | 서비스 공지 목록     | 없음      |
| `/api/v1/public/service-notices/:id`     | GET    | 서비스 공지 상세     | 없음      |
| `/health`                                | GET    | 헬스체크             | 없음      |
| `/ready`                                 | GET    | 준비 상태            | 없음      |
| `/metrics`                               | GET    | Prometheus 메트릭    | 없음      |

### 3.2 헤더 호환성 요구사항

Edge 서버는 기존 Backend와 동일한 헤더를 지원해야 합니다:

```typescript
// 필수 헤더
'x-api-token'; // API 토큰
'x-application-name'; // 애플리케이션 이름
'x-environment-id'; // 환경 ID (멀티 환경 지원)

// 선택적 헤더
'x-user-id'; // 사용자 ID
'authorization'; // Bearer 토큰 (대체 방식)
```

### 3.3 환경 지원 (⚠️ 중요한 차이점)

> ⚠️ **하나의 SDK, 두 가지 모드** - Edge 전용 SDK를 별도로 만들지 않고 기존 SDK를 확장합니다.

| 항목      | 단일 환경 모드 (기본)              | 멀티 환경 모드 (Edge)                            |
| --------- | ---------------------------------- | ------------------------------------------------ |
| 설정      | `environments` 미지정 또는 빈 배열 | `environments: ['env_prod', 'env_dev', ...]`     |
| 사용 서버 | 게임 서버, API 서버 등             | Edge 서버                                        |
| API 호출  | `/api/v1/server/xxx`               | `/api/v1/server/xxx?environments=env1,env2,env3` |
| 캐싱 구조 | 모든 데이터 → 'default' 키         | 환경별로 분리된 Map                              |
| 조회      | `getCached()`                      | `getCached(environmentId)`                       |

**게임 서버 (단일 환경 모드 - 기본)**:

```typescript
const sdk = new GatrixServerSDK({
  gatrixUrl: 'http://backend:3000',
  apiToken: 'xxx',
  applicationName: 'game-server',
  // environments 미지정 = 단일 환경 모드 (기본값)
  features: {
    clientVersion: true, // 필요한 기능만 활성화
  },
});

// environmentId 파라미터 무시됨 (항상 자신의 환경 데이터만)
const versions = sdk.getClientVersions();
```

**Edge 서버 (멀티 환경 모드)**:

```typescript
const sdk = new GatrixServerSDK({
  gatrixUrl: 'http://backend:3000',
  apiToken: 'xxx',
  applicationName: 'edge-server',
  environments: ['env_prod', 'env_staging', 'env_dev'], // ✅ 관심 환경 지정
  features: {
    gameWorld: false, // Edge에서 불필요
    survey: false, // Edge에서 불필요
    clientVersion: true,
    serviceNotice: true,
    banner: true,
  },
});

// 요청의 환경에 맞는 데이터 조회
const envId = req.headers['x-environment-id'];
const versions = sdk.getClientVersions(envId);
const notices = sdk.getServiceNotices(envId);
```

**내부 캐시 동작**:

```typescript
// 단일 환경 모드: 모든 데이터가 'default' 키에 저장
cachedVersionsByEnv.get('default'); // → ClientVersion[]

// 멀티 환경 모드: 환경별로 분리 저장
cachedVersionsByEnv.get('env_prod'); // → ClientVersion[] (프로덕션)
cachedVersionsByEnv.get('env_staging'); // → ClientVersion[] (스테이징)
```

**요청 처리 흐름 (Edge)**:

1. 클라이언트 요청 → `X-Environment-Id` 헤더 추출
2. `sdk.getXxx(environmentId)`로 해당 환경 캐시 조회
3. 환경별 필터링된 데이터 반환

---

## 4. SDK 확장 요구사항

### 4.1 현재 SDK 캐싱 지원 현황

| 데이터 타입        | 현재 지원 | Edge 필요 | 비고               |
| ------------------ | --------- | --------- | ------------------ |
| GameWorld          | ✅        | ✅        | 기존 지원          |
| PopupNotice        | ✅        | ✅        | 기존 지원          |
| Survey             | ✅        | ❌        | Edge 불필요        |
| Whitelist          | ✅        | ✅        | 기존 지원          |
| ServiceMaintenance | ✅        | ✅        | 기존 지원          |
| **ClientVersion**  | ❌        | ✅        | **신규 추가 필요** |
| **ServiceNotice**  | ❌        | ✅        | **신규 추가 필요** |
| **Banner**         | ❌        | ✅        | **신규 추가 필요** |
| **API Token**      | ❌        | ✅        | **신규 추가 필요** |

### 4.2 SDK 설정 확장

**핵심 변경사항**: 기존 기능들도 모두 옵션화하여 서버별로 필요한 기능만 활성화

```typescript
interface GatrixSDKConfig {
  // 기존 필드
  gatrixUrl: string;
  apiToken: string;
  applicationName: string;
  redis?: RedisConfig;
  cache?: CacheConfig;

  // 기능 토글 - 모든 캐싱 기능 옵션화
  features?: {
    // 기존 기능 (현재는 무조건 활성화 → 옵션화 필요)
    gameWorld?: boolean; // default: true (기존 동작 유지)
    popupNotice?: boolean; // default: true
    survey?: boolean; // default: true
    whitelist?: boolean; // default: true
    serviceMaintenance?: boolean; // default: true

    // 신규 기능 (Edge 전용)
    clientVersion?: boolean; // default: false
    serviceNotice?: boolean; // default: false
    banner?: boolean; // default: false
    apiTokenCache?: boolean; // default: false
  };
}
```

### 4.3 서버별 사용 예시

```typescript
// Edge 서버 - 클라이언트 API 서빙용
const edgeSDK = new GatrixServerSDK({
  features: {
    gameWorld: true,
    popupNotice: false, // Edge에서 불필요
    survey: false, // Edge에서 불필요
    whitelist: true,
    serviceMaintenance: true,
    clientVersion: true, // Edge 전용
    serviceNotice: true, // Edge 전용
    banner: true, // Edge 전용
    apiTokenCache: true, // Edge 전용
  },
});

// 게임 서버 - 게임 로직용
const gameServerSDK = new GatrixServerSDK({
  features: {
    gameWorld: true,
    popupNotice: true,
    survey: false, // 게임 서버에서 불필요
    whitelist: true,
    serviceMaintenance: true,
    // 나머지는 기본값 false
  },
});

// 이벤트 서버 - 설문/이벤트용
const eventServerSDK = new GatrixServerSDK({
  features: {
    gameWorld: false,
    popupNotice: true,
    survey: true, // 설문 필요
    whitelist: false,
    serviceMaintenance: true,
  },
});
```

---

## 5. 상세 작업 목록

### Phase 1: SDK 확장 (필수 선행 작업)

#### Task 1.1: SDK Config 확장 (모든 캐싱 기능 옵션화)

**파일**: `packages/sdks/server-sdk/src/types/config.ts`

```typescript
// 추가할 인터페이스 - 기존/신규 모든 기능 옵션화
export interface FeaturesConfig {
  // 기존 기능 (현재 무조건 활성화 → 옵션화)
  gameWorld?: boolean; // 게임 월드 캐싱 (default: true)
  popupNotice?: boolean; // 팝업 공지 캐싱 (default: true)
  survey?: boolean; // 설문 캐싱 (default: true)
  whitelist?: boolean; // 화이트리스트 캐싱 (default: true)
  serviceMaintenance?: boolean; // 서비스 점검 캐싱 (default: true)

  // 신규 기능 (Edge 전용)
  clientVersion?: boolean; // 클라이언트 버전 캐싱 (default: false)
  serviceNotice?: boolean; // 서비스 공지 캐싱 (default: false)
  banner?: boolean; // 배너 캐싱 (default: false)
  apiTokenCache?: boolean; // API 토큰 캐싱 (default: false)
}

// GatrixSDKConfig에 추가
export interface GatrixSDKConfig {
  // ... existing fields
  features?: FeaturesConfig;
}
```

**주요 변경점**:

- 기존에 무조건 로드하던 Survey, PopupNotice 등도 옵션으로 변경
- 서버별로 필요한 기능만 활성화하여 메모리/네트워크 최적화

#### Task 1.2: ClientVersionService 구현

**파일**: `packages/sdks/server-sdk/src/services/ClientVersionService.ts`

**기능**:

- `list(platform?: string)`: 클라이언트 버전 목록 조회
- `getByPlatformAndVersion(platform, version)`: 특정 버전 조회
- `getLatest(platform, status?)`: 최신 버전 조회
- `getCached()`: 캐시된 데이터 반환
- `refresh()`: 캐시 갱신

**API 엔드포인트**: `GET /api/v1/server/client-versions`

#### Task 1.3: ServiceNoticeService 구현

**파일**: `packages/sdks/server-sdk/src/services/ServiceNoticeService.ts`

**기능**:

- `list(filters?)`: 서비스 공지 목록 조회
- `getById(id)`: 특정 공지 조회
- `getActive(filters?)`: 활성 공지 조회
- `getCached()`: 캐시된 데이터 반환
- `refresh()`: 캐시 갱신

**API 엔드포인트**: `GET /api/v1/server/service-notices`

#### Task 1.4: BannerService 구현

**파일**: `packages/sdks/server-sdk/src/services/BannerService.ts`

**기능**:

- `list()`: 배너 목록 조회
- `getPublished()`: 발행된 배너 조회
- `getCached()`: 캐시된 데이터 반환
- `refresh()`: 캐시 갱신

**API 엔드포인트**: `GET /api/v1/server/banners`

#### Task 1.5: ApiTokenCacheService 구현

**파일**: `packages/sdks/server-sdk/src/services/ApiTokenCacheService.ts`

**기능**:

- `validateToken(token)`: 토큰 유효성 검증 (캐시 우선)
- `getTokenInfo(token)`: 토큰 정보 조회
- `invalidateToken(token)`: 캐시에서 토큰 제거
- `refresh()`: 전체 토큰 캐시 갱신

**API 엔드포인트**: `GET /api/v1/server/api-tokens/validate`

#### Task 1.6: CacheManager 확장 (모든 기능 조건부 로딩)

**파일**: `packages/sdks/server-sdk/src/cache/CacheManager.ts`

```typescript
// 모든 캐싱 기능을 조건부로 변경
async initialize(): Promise<void> {
  const promises: Promise<any>[] = [];
  const features = this.config.features || {};

  // 기존 기능 - 기본값 true (하위 호환성 유지)
  if (features.gameWorld !== false) {
    promises.push(this.gameWorldService.list());
  }
  if (features.popupNotice !== false) {
    promises.push(this.popupNoticeService.list());
  }
  if (features.survey !== false) {
    promises.push(this.surveyService.list({ isActive: true }));
  }
  if (features.whitelist !== false) {
    promises.push(this.whitelistService.list());
  }
  if (features.serviceMaintenance !== false) {
    promises.push(this.refreshServiceMaintenanceInternal());
  }

  // 신규 기능 - 기본값 false (명시적 활성화 필요)
  if (features.clientVersion) {
    promises.push(this.clientVersionService.list());
  }
  if (features.serviceNotice) {
    promises.push(this.serviceNoticeService.list());
  }
  if (features.banner) {
    promises.push(this.bannerService.list());
  }
  if (features.apiTokenCache) {
    promises.push(this.apiTokenCacheService.loadAll());
  }

  await Promise.all(promises);
}
```

**하위 호환성**:

- 기존 기능은 `!== false` 체크로 기본 활성화 유지
- 신규 기능은 명시적으로 `true`일 때만 활성화

#### Task 1.7: GatrixServerSDK 메서드 추가

**파일**: `packages/sdks/server-sdk/src/GatrixServerSDK.ts`

```typescript
// 새로운 public 메서드
getClientVersions(): ClientVersion[];
getClientVersion(platform: string, version?: string): ClientVersion | null;
getLatestClientVersion(platform: string): ClientVersion | null;

getServiceNotices(): ServiceNotice[];
getActiveServiceNotices(filters?): ServiceNotice[];

getBanners(): Banner[];
getPublishedBanners(): Banner[];

validateApiToken(token: string): Promise<ApiTokenInfo | null>;
```

#### Task 1.8: EventListener 확장

**파일**: `packages/sdks/server-sdk/src/cache/EventListener.ts`

```typescript
// 새로운 이벤트 타입 지원
private registerEventHandlers(): void {
  // 기존 이벤트
  this.subscribe('gameworld.*', ...);
  this.subscribe('popup.*', ...);

  // 새로운 이벤트
  this.subscribe('clientversion.*', this.handleClientVersionEvent);
  this.subscribe('servicenotice.*', this.handleServiceNoticeEvent);
  this.subscribe('banner.*', this.handleBannerEvent);
  this.subscribe('apitoken.*', this.handleApiTokenEvent);
}
```

#### Task 1.9: Backend API 엔드포인트 추가

**파일**: `packages/backend/src/routes/server/index.ts`

```typescript
// 새로운 Server SDK 엔드포인트
router.get('/client-versions', serverSDKAuth, ClientVersionController.list);
router.get('/service-notices', serverSDKAuth, ServiceNoticeController.list);
router.get('/banners', serverSDKAuth, BannerController.list);
router.get('/api-tokens/validate', serverSDKAuth, ApiTokenController.validate);
```

---

### Phase 2: Edge 서버 구현

#### Task 2.1: 패키지 초기화

**디렉토리 구조**:

```
packages/edge/
├── package.json
├── tsconfig.json
├── Dockerfile
├── src/
│   ├── index.ts              # 엔트리포인트
│   ├── app.ts                # Express 앱 설정
│   ├── config/
│   │   └── index.ts          # 환경 설정
│   ├── routes/
│   │   ├── index.ts          # 라우터 통합
│   │   ├── client.ts         # Client API
│   │   └── public.ts         # Public API (서비스 공지)
│   ├── middleware/
│   │   ├── auth.ts           # API 토큰 인증
│   │   ├── errorHandler.ts   # 에러 핸들러
│   │   └── requestLogger.ts  # 요청 로깅
│   ├── services/
│   │   └── EdgeService.ts    # SDK 래퍼 서비스
│   └── types/
│       └── index.ts          # 타입 정의
```

#### Task 2.2: Express 앱 설정

**파일**: `packages/edge/src/app.ts`

주요 미들웨어:

- `helmet`: 보안 헤더
- `cors`: CORS 처리
- `compression`: 응답 압축
- `express.json`: JSON 파싱

#### Task 2.3: EdgeService (SDK 래퍼)

**파일**: `packages/edge/src/services/EdgeService.ts`

SDK 초기화 및 래핑 서비스:

- `initialize()`: SDK 초기화 (features 활성화)
- `isInitialized()`: 준비 상태 확인
- `getSDK()`: SDK 인스턴스 반환

#### Task 2.4: 인증 미들웨어

**파일**: `packages/edge/src/middleware/auth.ts`

API 토큰 검증:

- `x-api-token` 또는 `Authorization: Bearer` 헤더에서 토큰 추출
- SDK 캐시를 통한 토큰 유효성 검증
- 토큰 타입 확인 (client 타입만 허용)

#### Task 2.5: Client API 라우터

**파일**: `packages/edge/src/routes/client.ts`

Backend `/api/v1/client/*` 엔드포인트와 동일한 API 제공:

- `GET /client-version`
- `GET /game-worlds`
- `GET /banners`
- `GET /remote-config/templates`
- `POST /remote-config/evaluate`
- `POST /crashes/upload` (Backend로 프록시)

#### Task 2.6: Public API 라우터

**파일**: `packages/edge/src/routes/public.ts`

서비스 공지 API:

- `GET /service-notices`
- `GET /service-notices/:id`

---

### Phase 3: Docker 및 인프라

#### Task 3.1: Dockerfile

**파일**: `packages/edge/Dockerfile`

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
COPY packages/edge/package.json ./packages/edge/
COPY packages/sdks/server-sdk/package.json ./packages/sdks/server-sdk/
RUN yarn install --frozen-lockfile

COPY packages/edge ./packages/edge
COPY packages/sdks/server-sdk ./packages/sdks/server-sdk
RUN yarn workspace @gatrix/edge build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/packages/edge/dist ./dist
COPY --from=builder /app/packages/edge/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3400
CMD ["node", "dist/index.js"]
```

#### Task 3.2: docker-compose.yml 수정

```yaml
services:
  edge:
    build:
      context: .
      dockerfile: packages/edge/Dockerfile
    ports:
      - '3400:3400'
    environment:
      - NODE_ENV=production
      - PORT=3400
      - GATRIX_URL=http://backend:5000
      - GATRIX_API_TOKEN=${GATRIX_SERVER_API_TOKEN:-gatrix-unsecured-server-api-token}
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - CACHE_REFRESH_METHOD=event
    depends_on:
      backend:
        condition: service_healthy
      redis:
        condition: service_started
    healthcheck:
      test: ['CMD', 'wget', '-q', '--spider', 'http://localhost:3400/health']
      interval: 30s
      timeout: 10s
      retries: 3
    restart: unless-stopped
```

---

## 6. 작업 우선순위 및 일정

### 높은 우선순위 (Week 1)

| 순서 | 작업                            | 예상 시간 |
| ---- | ------------------------------- | --------- |
| 1    | SDK Config 확장 (features 옵션) | 1h        |
| 2    | ClientVersionService 구현       | 3h        |
| 3    | ServiceNoticeService 구현       | 3h        |
| 4    | BannerService 구현              | 2h        |
| 5    | ApiTokenCacheService 구현       | 4h        |
| 6    | CacheManager 확장               | 2h        |
| 7    | Backend API 엔드포인트 추가     | 4h        |

### 중간 우선순위 (Week 2)

| 순서 | 작업                 | 예상 시간 |
| ---- | -------------------- | --------- |
| 8    | Edge 패키지 초기화   | 2h        |
| 9    | Express 앱 기본 설정 | 2h        |
| 10   | EdgeService 구현     | 2h        |
| 11   | 인증 미들웨어        | 3h        |
| 12   | Client API 라우터    | 4h        |
| 13   | Public API 라우터    | 2h        |

### 낮은 우선순위 (Week 3)

| 순서 | 작업                | 예상 시간 |
| ---- | ------------------- | --------- |
| 14   | Dockerfile 작성     | 2h        |
| 15   | docker-compose 수정 | 1h        |
| 16   | 테스트 작성         | 4h        |
| 17   | 문서화              | 2h        |

---

## 7. 테스트 계획

### 7.1 단위 테스트

- SDK 서비스 캐싱 테스트
- 인증 미들웨어 테스트
- API 응답 형식 테스트

### 7.2 통합 테스트

- Backend ↔ Redis ↔ Edge 동기화 테스트
- 이벤트 기반 캐시 갱신 테스트
- 다중 환경 처리 테스트

### 7.3 성능 테스트

- 캐시 히트율 측정
- 응답 시간 측정 (목표: < 10ms)
- 동시 연결 처리 (목표: 10,000+ RPS)

---

## 8. 모니터링 및 운영

### 8.1 메트릭스 (Prometheus)

```
# 요청 메트릭
edge_http_requests_total{method, path, status}
edge_http_request_duration_seconds{method, path}

# 캐시 메트릭
edge_cache_hits_total{type}
edge_cache_misses_total{type}
edge_cache_refresh_total{type}
edge_cache_last_refresh_timestamp{type}

# SDK 메트릭
edge_sdk_errors_total{operation}
edge_sdk_sync_duration_seconds
```

### 8.2 로깅

- 요청/응답 로깅 (JSON 형식)
- 에러 로깅 (스택 트레이스 포함)
- 캐시 갱신 로깅

### 8.3 알림

- 캐시 동기화 실패 시
- 에러율 임계치 초과 시
- 응답 시간 임계치 초과 시

---

## 9. 보안 고려사항

### 9.1 네트워크

- Edge 메인 포트만 외부 노출 (3400 포트)
- Backend는 내부 네트워크로 격리
- TLS 적용 (Reverse Proxy에서)

### 9.2 메트릭 엔드포인트 보안 (⚠️ 중요)

> ⛔ **`/metrics` 엔드포인트는 절대 외부에 노출하면 안됩니다!**

**취약점 위험:**

1. **정보 유출**: 내부 시스템 상태, 요청 패턴, 에러율 등 공격에 활용 가능
2. **공격 벡터**: 시스템 부하 상태 파악 후 최적 시점에 공격 가능
3. **비즈니스 정보 유출**: 트래픽 패턴, 사용자 수 등 민감한 비즈니스 메트릭

**필수 조치:**

- 메트릭은 별도 포트(9337)에서 제공
- 메트릭 포트는 내부 네트워크에서만 접근 가능하도록 방화벽 설정
- docker-compose에서 메트릭 포트는 호스트에 바인딩하지 않거나 내부 네트워크 전용으로 설정

```yaml
# docker-compose.yml - 메트릭 포트는 외부 노출 금지!
services:
  edge:
    ports:
      - '3400:3400' # 메인 API 포트 (외부 노출)
      # - "9400:9400"      # ⛔ 절대 외부 노출 금지!
    networks:
      - public # 외부 접근용
      - internal # 내부 통신용

  prometheus:
    networks:
      - internal # 내부에서만 edge:9337 접근
```

### 9.3 인증

- API 토큰 캐시 무효화 지원
- 토큰 유효 기간 검증
- Rate Limiting 적용

### 9.4 데이터

- 민감 정보 로깅 제외
- 응답에 내부 정보 노출 방지
- CORS 정책 적용

---

## 10. 롤백 계획

### 10.1 즉시 롤백

- Edge 서버 장애 시 Backend 직접 연결로 전환
- 클라이언트 설정에서 API URL 변경

### 10.2 점진적 전환

- 일부 트래픽만 Edge로 라우팅 (Canary)
- 문제 발생 시 비율 조절

---

_문서 작성일: 2025-12-05_
_버전: 1.0_
