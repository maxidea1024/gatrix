# Cache Keys Constants

이 디렉토리는 애플리케이션에서 사용되는 모든 캐시 키를 중앙 집중식으로 관리합니다.

## 📁 파일 구조

```
constants/
├── cacheKeys.ts    # 캐시 키 상수 정의
└── README.md       # 이 파일
```

## 🎯 목적

### ❌ **기존 문제점**
```typescript
// 하드코딩된 캐시 키 - 유지보수 어려움
await pubSubService.invalidateKey('game_worlds:public');
cacheService.set('game_worlds:public', data, 10 * 60 * 1000);

// 다른 파일에서 오타 발생 가능성
await pubSubService.invalidateKey('game_world:public'); // 오타!
```

### ✅ **개선된 방법**
```typescript
import { GAME_WORLDS, DEFAULT_CONFIG } from '../constants/cacheKeys';

// 타입 안전하고 일관된 캐시 키 사용
await pubSubService.invalidateKey(GAME_WORLDS.PUBLIC);
cacheService.set(GAME_WORLDS.PUBLIC, data, DEFAULT_CONFIG.GAME_WORLDS_PUBLIC_TTL);
```

## 🔧 사용법

### 1. **기본 캐시 키 사용**

```typescript
import { GAME_WORLDS, CLIENT_VERSION, USER } from '../constants/cacheKeys';

// 게임월드 공개 목록
const cacheKey = GAME_WORLDS.PUBLIC; // 'game_worlds:public'

// 클라이언트 버전 (동적 키)
const versionKey = CLIENT_VERSION.BY_CHANNEL('stable', 'main'); 
// 'client_version:stable:main'

// 사용자 프로필 (동적 키)
const profileKey = USER.PROFILE(123); // 'user:123:profile'
```

### 2. **TTL 상수 사용**

```typescript
import { TTL, DEFAULT_CONFIG } from '../constants/cacheKeys';

// 기본 TTL 사용
cacheService.set(key, data, TTL.TEN_MINUTES);

// 설정된 기본값 사용
cacheService.set(GAME_WORLDS.PUBLIC, data, DEFAULT_CONFIG.GAME_WORLDS_PUBLIC_TTL);
```

### 3. **패턴 기반 캐시 무효화**

```typescript
import { PATTERNS } from '../constants/cacheKeys';

// 모든 게임월드 관련 캐시 삭제
await pubSubService.invalidateByPattern(PATTERNS.GAME_WORLDS);

// 특정 사용자의 모든 캐시 삭제
await pubSubService.invalidateByPattern(PATTERNS.USER(123));
```

## 📋 캐시 키 카테고리

### 🎮 **게임월드 관련**
- `GAME_WORLDS.PUBLIC` - 공개 게임월드 목록
- `GAME_WORLDS.ADMIN` - 관리자용 게임월드 목록
- `GAME_WORLDS.DETAIL(id)` - 특정 게임월드 상세 정보
- `GAME_WORLDS.BY_WORLD_ID(worldId)` - 월드 ID로 조회

### 📱 **클라이언트 버전 관련**
- `CLIENT_VERSION.BY_CHANNEL(channel, subChannel)` - 채널별 버전
- `CLIENT_VERSION.ALL` - 모든 버전 목록
- `CLIENT_VERSION.ACTIVE` - 활성화된 버전만

### 👤 **사용자 관련**
- `USER.PROFILE(userId)` - 사용자 프로필
- `USER.PERMISSIONS(userId)` - 사용자 권한
- `USER.SESSION(sessionId)` - 세션 정보

### 🏷️ **태그 관련**
- `TAG.ALL` - 모든 태그 목록
- `TAG.BY_ENTITY(entityType, entityId)` - 엔티티별 태그

### 🛡️ **화이트리스트 관련**
- `WHITELIST.ALL` - 모든 화이트리스트
- `WHITELIST.ACTIVE` - 활성화된 항목만
- `WHITELIST.BY_IP(ip)` - IP별 상태

### 🔧 **점검 관련**
- `MAINTENANCE.STATUS` - 현재 점검 상태
- `MAINTENANCE.TEMPLATES` - 점검 템플릿

### 💬 **메시지 템플릿 관련**
- `MESSAGE_TEMPLATE.ALL` - 모든 템플릿
- `MESSAGE_TEMPLATE.BY_TYPE(type)` - 타입별 템플릿

### 📋 **작업 관련**
- `JOB.ALL` - 모든 작업 목록
- `JOB.TYPES` - 작업 타입 목록
- `JOB.DETAIL(jobId)` - 작업 상세 정보

### 📊 **감사 로그 관련**
- `AUDIT_LOG.RECENT(page, limit)` - 최근 로그
- `AUDIT_LOG.BY_USER(userId, page)` - 사용자별 로그

## ⏱️ TTL 상수

```typescript
// 시간 상수
TTL.ONE_MINUTE      // 1분
TTL.FIVE_MINUTES    // 5분
TTL.TEN_MINUTES     // 10분
TTL.THIRTY_MINUTES  // 30분
TTL.ONE_HOUR        // 1시간
TTL.ONE_DAY         // 1일

// 기본 설정
DEFAULT_CONFIG.GAME_WORLDS_PUBLIC_TTL  // 게임월드 공개 목록 TTL
DEFAULT_CONFIG.CLIENT_VERSION_TTL      // 클라이언트 버전 TTL
DEFAULT_CONFIG.USER_PROFILE_TTL        // 사용자 프로필 TTL
DEFAULT_CONFIG.TAGS_TTL                // 태그 목록 TTL
DEFAULT_CONFIG.WHITELIST_TTL           // 화이트리스트 TTL
DEFAULT_CONFIG.MAINTENANCE_TTL         // 점검 상태 TTL
```

## 🔄 패턴 상수

```typescript
// 패턴 기반 캐시 무효화용
PATTERNS.GAME_WORLDS        // 'game_world*'
PATTERNS.CLIENT_VERSIONS    // 'client_version*'
PATTERNS.USER(userId)       // 'user:123*'
PATTERNS.TAGS               // 'tags*'
PATTERNS.WHITELIST          // 'whitelist*'
PATTERNS.MAINTENANCE        // 'maintenance*'
PATTERNS.MESSAGE_TEMPLATES  // 'message_template*'
PATTERNS.JOBS               // 'job*'
PATTERNS.AUDIT_LOGS         // 'audit_log*'
```

## 📝 새로운 캐시 키 추가하기

### 1. **단순 키 추가**
```typescript
export const NEW_FEATURE = {
  ALL: 'new_feature:all',
  ACTIVE: 'new_feature:active',
} as const;
```

### 2. **동적 키 추가**
```typescript
export const NEW_FEATURE = {
  BY_ID: (id: number) => `new_feature:${id}`,
  BY_TYPE: (type: string) => `new_feature:type:${type}`,
} as const;
```

### 3. **패턴 추가**
```typescript
export const PATTERNS = {
  // ... 기존 패턴들
  NEW_FEATURE: 'new_feature*',
} as const;
```

### 4. **TTL 설정 추가**
```typescript
export const DEFAULT_CONFIG = {
  // ... 기존 설정들
  NEW_FEATURE_TTL: TTL.FIVE_MINUTES,
} as const;
```

## ✅ 모범 사례

### 1. **일관된 네이밍**
- 엔티티명은 대문자와 언더스코어 사용: `GAME_WORLDS`, `CLIENT_VERSION`
- 키 타입은 명확하게: `ALL`, `BY_ID`, `DETAIL`, `ACTIVE`
- 패턴은 와일드카드 포함: `game_world*`

### 2. **타입 안전성**
- 모든 객체에 `as const` 사용
- 동적 키는 함수로 정의하여 타입 체크 활용

### 3. **문서화**
- 각 키의 용도와 TTL을 주석으로 명시
- 무효화 조건 명시

### 4. **마이그레이션**
- 기존 하드코딩된 키를 점진적으로 교체
- 변경 시 관련 테스트 코드도 함께 업데이트

## 🧪 테스트

캐시 키 상수가 제대로 작동하는지 확인:

```bash
# 표시 토글 테스트 (캐시 무효화 확인)
curl -X PATCH http://localhost:5001/api/v1/game-worlds/12/toggle-visibility \
  -H "Authorization: Bearer $TOKEN"

# 클라이언트 API 캐시 테스트
curl http://localhost:5001/api/v1/client/game-worlds
```

서버 로그에서 `Cache delete attempted but key not found: game_worlds:public` 메시지 확인

## 🔗 관련 파일

- `src/services/GameWorldService.ts` - 게임월드 캐시 무효화
- `src/controllers/ClientController.ts` - 클라이언트 API 캐시
- `src/services/CacheService.ts` - 캐시 서비스
- `src/services/PubSubService.ts` - 분산 캐시 무효화
- `CLIENT_API.md` - 클라이언트 API 문서
