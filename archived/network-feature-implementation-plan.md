# 네트워크 기능 구현 계획

## 개요
Unleash Network와 동일한 기능을 구현합니다. 어플리케이션별로 세그먼트와 플래그 정의를 몇 번 가져갔는지 1분 단위의 트래픽을 추적합니다.

## 기능 요구사항
1. **네트워크 트래픽 추적**: SDK가 `/api/v1/server/:env/features` 및 `/api/v1/server/segments` API를 호출할 때마다 트래픽을 기록
2. **1분 단위 집계**: 트래픽 데이터를 1분 단위로 집계하여 저장
3. **어플리케이션별 분류**: `appName` 헤더를 기반으로 어플리케이션별 트래픽 분류
4. **대시보드 UI**: 트래픽 현황을 시각화하는 네트워크 페이지

---

## 구현 계획

### Phase 1: 백엔드 - 데이터베이스 스키마 (Migration)

**파일**: `packages/backend/src/database/migrations/036_add_network_traffic_table.js`

```sql
CREATE TABLE IF NOT EXISTS NetworkTraffic (
    id INT AUTO_INCREMENT PRIMARY KEY,
    environment VARCHAR(100) NOT NULL,
    appName VARCHAR(255) NOT NULL DEFAULT 'unknown',
    endpoint VARCHAR(50) NOT NULL,  -- 'features' | 'segments'
    trafficBucket DATETIME NOT NULL,  -- 1분 단위 버킷 (예: 2026-02-01 17:38:00)
    requestCount INT NOT NULL DEFAULT 0,
    createdAt DATETIME DEFAULT UTC_TIMESTAMP(),
    updatedAt DATETIME DEFAULT UTC_TIMESTAMP() ON UPDATE UTC_TIMESTAMP(),
    
    -- 인덱스
    INDEX idx_network_traffic_bucket (trafficBucket),
    INDEX idx_network_traffic_env_app (environment, appName),
    UNIQUE KEY unique_bucket (environment, appName, endpoint, trafficBucket)
);
```

### Phase 2: 백엔드 - 트래픽 기록 서비스

**파일**: `packages/backend/src/services/NetworkTrafficService.ts`

```typescript
class NetworkTrafficService {
    // 트래픽 기록 (1분 버킷으로 집계)
    async recordTraffic(environment: string, appName: string, endpoint: 'features' | 'segments'): Promise<void>
    
    // 특정 기간의 트래픽 조회
    async getTraffic(params: {
        environment?: string;
        appName?: string;
        startDate: Date;
        endDate: Date;
        groupBy?: 'minute' | 'hour' | 'day';
    }): Promise<TrafficData[]>
    
    // 활성 어플리케이션 목록 조회
    async getActiveApplications(environment?: string): Promise<string[]>
}
```

### Phase 3: 백엔드 - 트래픽 기록 미들웨어/컨트롤러 수정

**파일**: `packages/backend/src/controllers/ServerFeatureFlagController.ts`

- `getFeatureFlags()` 메서드에 트래픽 기록 추가
- `getSegments()` 메서드에 트래픽 기록 추가
- 비동기로 처리하여 응답 지연 방지

```typescript
// getFeatureFlags 내부
const appName = req.headers['x-application-name'] as string || 'unknown';
// Fire and forget - don't await
networkTrafficService.recordTraffic(env, appName, 'features').catch(console.error);
```

### Phase 4: 백엔드 - Admin API 엔드포인트

**파일**: `packages/backend/src/controllers/AdminFeatureFlagController.ts`

```typescript
// GET /api/admin/features/network/traffic
// 네트워크 트래픽 조회
async getNetworkTraffic(req: Request, res: Response): Promise<void>

// GET /api/admin/features/network/applications
// 활성 어플리케이션 목록 조회
async getNetworkApplications(req: Request, res: Response): Promise<void>
```

### Phase 5: 프론트엔드 - 라우팅 및 네비게이션

**파일 수정**:
1. `packages/frontend/src/config/navigation.tsx` - 네트워크 메뉴 추가
2. `packages/frontend/src/App.tsx` - 라우트 추가
3. `packages/frontend/src/locales/*.ini` - 로컬라이징 키 추가

```typescript
// navigation.tsx - Feature Flags 카테고리에 추가
{ text: 'sidebar.featureNetwork', icon: 'Hub', path: '/feature-flags/network', permission: 'feature-flags' },
```

### Phase 6: 프론트엔드 - 네트워크 페이지 컴포넌트

**파일**: `packages/frontend/src/pages/game/FeatureNetworkPage.tsx`

#### UI 구성요소:
1. **필터 컨트롤**
   - 환경 선택 (토글 버튼)
   - 어플리케이션 선택 (토글 버튼)
   - 기간 선택 (드롭다운: 최근 1시간, 6시간, 24시간, 7일)

2. **차트 영역**
   - 라인 차트: 시간별 요청 횟수 (Features API, Segments API 구분)
   - X축: 시간
   - Y축: 요청 횟수

3. **요약 카드**
   - 총 요청 횟수
   - 활성 어플리케이션 수
   - 분당 평균 요청

4. **상세 테이블** (접기/펴기)
   - 시간별 상세 트래픽 데이터
   - 환경, 어플리케이션, 엔드포인트, 요청 횟수

---

## 파일 목록

### 신규 생성 파일
| 파일 | 설명 |
|------|------|
| `packages/backend/src/database/migrations/036_add_network_traffic_table.js` | 마이그레이션 |
| `packages/backend/src/services/NetworkTrafficService.ts` | 트래픽 서비스 |
| `packages/frontend/src/pages/game/FeatureNetworkPage.tsx` | 네트워크 페이지 |

### 수정 파일
| 파일 | 설명 |
|------|------|
| `packages/backend/src/controllers/ServerFeatureFlagController.ts` | 트래픽 기록 추가 |
| `packages/backend/src/controllers/AdminFeatureFlagController.ts` | Admin API 추가 |
| `packages/backend/src/routes/admin.ts` | 라우트 추가 |
| `packages/frontend/src/config/navigation.tsx` | 메뉴 추가 |
| `packages/frontend/src/App.tsx` | 라우트 추가 |
| `packages/frontend/src/locales/ko.ini` | 한국어 로컬라이징 |
| `packages/frontend/src/locales/en.ini` | 영어 로컬라이징 |
| `packages/frontend/src/locales/zh.ini` | 중국어 로컬라이징 |

---

## 구현 순서

1. ✅ Phase 1: 데이터베이스 마이그레이션 생성
2. ✅ Phase 2: NetworkTrafficService 구현
3. ✅ Phase 3: ServerFeatureFlagController 트래픽 기록 추가
4. ✅ Phase 4: Admin API 엔드포인트 구현
5. ✅ Phase 5: 프론트엔드 라우팅 및 네비게이션
6. ✅ Phase 6: 네트워크 페이지 UI 구현
7. ✅ 로컬라이징 추가
8. ✅ 마이그레이션 실행 및 테스트
9. ✅ 빌드 확인 및 린트 수정

---

## 예상 소요 시간
- 전체 구현: 약 30-40분
