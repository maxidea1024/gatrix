# API Token Usage Tracking

API 토큰 사용량 추적 시스템은 캐시 기반으로 구현되어 높은 성능을 제공하면서도 정확한 사용 통계를 수집합니다.

## 주요 기능

- **실시간 사용량 추적**: API 토큰 사용 시마다 캐시에 기록
- **주기적 DB 동기화**: 설정 가능한 주기로 캐시 데이터를 DB에 동기화
- **다중 인스턴스 지원**: 여러 Gatrix 인스턴스의 사용량을 집계
- **캐시 무효화**: DB 업데이트 시 관련 캐시 자동 무효화
- **장애 복구**: 캐시 실패 시에도 API 요청 처리 계속

## 아키텍처

```
API Request → Token Validation → Cache Update → Periodic DB Sync
                                      ↓
                              QueueService (1분 주기)
                                      ↓
                              Aggregate & Update DB
                                      ↓
                              Invalidate Token Cache
```

## 설정

### 환경 변수

```bash
# API 토큰 사용량 동기화 주기 (밀리초, 기본값: 60000 = 1분)
API_TOKEN_SYNC_INTERVAL_MS=60000
```

### 데이터베이스 마이그레이션

```bash
# usageCount 컬럼 추가
npm run migrate:add-usage-count
```

## 사용법

### 1. 서비스 초기화

서비스는 애플리케이션 시작 시 자동으로 초기화됩니다:

```typescript
// src/index.ts에서 자동 초기화
await apiTokenUsageService.initialize();
```

### 2. 토큰 사용량 기록

API 토큰 인증 시 자동으로 사용량이 기록됩니다:

```typescript
// ApiAccessToken.validateAndUse()에서 자동 호출
await apiTokenUsageService.recordTokenUsage(tokenId);
```

### 3. 사용량 조회

```typescript
// 토큰 모델에서 사용량 확인
const token = await ApiAccessToken.query().findById(tokenId);
console.log(`Usage count: ${token.usageCount}`);
console.log(`Last used: ${token.lastUsedAt}`);
```

## 캐시 구조

### 토큰 사용량 캐시

```
Key: token_usage:{tokenId}:{instanceId}
Value: {
  usageCount: number,
  lastUsedAt: Date,
  instanceId: string
}
TTL: 동기화 주기의 2배
```

### 토큰 인증 캐시

```
Key: api_token:{partial_token}...
Value: ApiAccessToken 객체
TTL: 5분
```

## 동기화 프로세스

### 1. 캐시 수집
- 모든 `token_usage:*` 패턴의 캐시 키 검색
- 각 토큰별로 여러 인스턴스의 사용량 집계

### 2. 데이터 집계
```typescript
interface AggregatedStats {
  totalUsageCount: number;    // 모든 인스턴스의 사용량 합계
  latestUsedAt: Date;        // 가장 최근 사용 시간
  instances: string[];       // 사용한 인스턴스 목록
}
```

### 3. DB 업데이트
- 현재 DB 사용량에 집계된 사용량 추가
- 마지막 사용 시간 업데이트
- 관련 토큰 캐시 무효화

### 4. 캐시 정리
- 성공적으로 동기화된 캐시 항목 삭제

## 로깅

### 디버그 로그
```typescript
// 토큰 사용 기록
logger.debug('Token usage recorded in cache', {
  tokenId,
  usageCount: stats.usageCount,
  instanceId: this.instanceId
});

// DB 업데이트
logger.debug('Database updated for token', {
  tokenId,
  previousUsageCount,
  addedUsageCount,
  newUsageCount,
  lastUsedAt,
  instances
});
```

### 정보 로그
```typescript
// 동기화 시작/완료
logger.info('Starting token usage synchronization', { instanceId });
logger.info('Token usage synchronization completed', { instanceId });

// 집계 결과
logger.info(`Successfully synced usage data for ${tokenCount} tokens`);
```

### 에러 로그
```typescript
// 캐시 실패 (API 요청은 계속 처리)
logger.error('Failed to record token usage in cache:', error);

// 동기화 실패 (QueueService가 재시도)
logger.error('Token usage synchronization failed:', error);
```

## 모니터링

### 주요 메트릭
- 동기화 성공/실패율
- 캐시 히트율
- 동기화 지연 시간
- 인스턴스별 사용량 분포

### 알림 조건
- 동기화 연속 실패
- 캐시 사용량 급증
- 비정상적인 토큰 사용 패턴

## 장애 처리

### 캐시 장애
- 사용량 기록 실패 시 로그만 남기고 API 요청 계속 처리
- 동기화 시 캐시 읽기 실패한 항목은 건너뛰기

### DB 장애
- QueueService의 재시도 메커니즘 활용
- 지수 백오프로 재시도 간격 증가

### 네트워크 분할
- 각 인스턴스가 독립적으로 캐시 관리
- 복구 후 자동으로 집계 및 동기화

## 성능 최적화

### 캐시 최적화
- TTL을 동기화 주기의 2배로 설정하여 데이터 손실 방지
- 인스턴스별 캐시 키로 동시성 문제 해결

### DB 최적화
- 배치 업데이트로 DB 부하 분산
- 인덱스 추가로 조회 성능 향상

### 메모리 최적화
- 동기화 완료 후 캐시 항목 즉시 삭제
- 만료된 캐시 항목 주기적 정리

## 확장성

### 수평 확장
- 여러 Gatrix 인스턴스가 동일한 Redis 공유
- 인스턴스별 고유 ID로 사용량 구분

### 수직 확장
- 동기화 주기 조정으로 성능 튜닝
- 캐시 TTL 조정으로 메모리 사용량 제어

## 문제 해결

### 사용량 불일치
1. 캐시와 DB 간 일시적 불일치는 정상
2. 동기화 주기 후 일치 확인
3. 필요시 수동 동기화 실행

### 성능 저하
1. 동기화 주기 증가 고려
2. 캐시 TTL 조정
3. DB 인덱스 확인

### 메모리 사용량 증가
1. 캐시 정리 주기 확인
2. TTL 설정 검토
3. 동기화 주기 단축 고려
