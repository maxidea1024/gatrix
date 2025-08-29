# Date and Time Formatting Utilities

이 문서는 Gate 프로젝트에서 날짜와 시간 포맷팅을 위한 유틸리티 함수들의 사용법을 설명합니다.

## 권장 사용법

**모든 UI 시간 표시에는 `formatDateTimeDetailed`를 사용하여 일관된 포맷을 유지하세요.**

```typescript
import { formatDateTimeDetailed } from '@/utils/dateFormat';
```

## 주요 함수들

### 1. formatDateTime(date)
사용자 설정에 따른 날짜/시간 포맷팅
```typescript
formatDateTime('2024-01-15T10:30:00Z') // "2024-01-15 19:30:00" (Asia/Seoul 기준)
formatDateTime(new Date()) // 현재 시간을 사용자 설정 포맷으로
```

### 2. formatDate(date)
날짜만 포맷팅 (YYYY-MM-DD)
```typescript
formatDate('2024-01-15T10:30:00Z') // "2024-01-15"
```

### 3. formatTime(date)
시간만 포맷팅 (HH:mm:ss)
```typescript
formatTime('2024-01-15T10:30:00Z') // "19:30:00" (Asia/Seoul 기준)
```

### 4. formatDateTimeDetailed(date) ⭐ 권장
**UI 표시용 통일된 날짜/시간 포맷팅 - 모든 테이블, 리스트에서 사용**
```typescript
formatDateTimeDetailed('2024-01-15T10:30:00Z') // "2024-01-15 19:30:00"
formatDateTimeDetailed(job.updated_at) // 테이블에서 사용
formatDateTimeDetailed(user.created_at) // 리스트에서 사용
```

### 5. formatWith(date, format)
커스텀 포맷으로 출력
```typescript
formatWith('2024-01-15T10:30:00Z', 'YYYY년 MM월 DD일') // "2024년 01월 15일"
```

### 6. formatDuration(milliseconds)
시간 간격을 사람이 읽기 쉬운 형태로
```typescript
formatDuration(5000) // "5s"
formatDuration(65000) // "1m 5s"
formatDuration(3665000) // "1h 1m"
```

### 7. formatRelativeTime(date)
상대 시간 표시
```typescript
formatRelativeTime(new Date(Date.now() - 30000)) // "Just now"
formatRelativeTime(new Date(Date.now() - 300000)) // "5 minutes ago"
```

### 8. 날짜 비교 함수들
```typescript
isToday('2024-01-15T10:30:00Z') // boolean
isYesterday('2024-01-14T10:30:00Z') // boolean
```

## 사용자 설정

### 타임존 설정
```typescript
import { getStoredTimezone, setStoredTimezone } from '@/utils/dateFormat';

// 현재 설정된 타임존 가져오기
const timezone = getStoredTimezone(); // "Asia/Seoul"

// 타임존 변경
setStoredTimezone('America/New_York');
```

### 날짜 포맷 설정
```typescript
import { getStoredDateTimeFormat, setStoredDateTimeFormat } from '@/utils/dateFormat';

// 현재 설정된 포맷 가져오기
const format = getStoredDateTimeFormat(); // "YYYY-MM-DD HH:mm:ss"

// 포맷 변경
setStoredDateTimeFormat('YYYY/MM/DD HH:mm');
```

## 지원하는 포맷 예시

- `YYYY-MM-DD HH:mm:ss` (기본값)
- `YYYY/MM/DD HH:mm`
- `YYYY.MM.DD HH:mm:ss`
- `MM/DD/YYYY HH:mm`
- `DD/MM/YYYY HH:mm:ss`

## 마이그레이션 가이드

### 기존 코드 수정
```typescript
// 기존 (deprecated)
import { formatDateTime } from '@/utils/dateUtils';

// 새로운 방식 (권장)
import { formatDateTime } from '@/utils/dateFormat';
```

### 주요 차이점
1. **타임존 지원**: `dateFormat.ts`는 사용자 설정 타임존을 자동으로 적용
2. **일관된 포맷**: 사용자가 설정한 날짜 포맷을 전체 애플리케이션에서 일관되게 사용
3. **null 안전성**: null/undefined 값에 대해 안전하게 '-' 반환
4. **에러 처리**: 파싱 실패 시 안전하게 '-' 반환

## 설정 페이지

사용자는 설정 페이지(`/settings`)에서 다음을 변경할 수 있습니다:
- 타임존 선택
- 날짜/시간 포맷 선택
- 실시간 미리보기

## 주의사항

1. **dateUtils.ts는 deprecated**: 새로운 코드에서는 사용하지 마세요
2. **서버 시간**: 모든 서버 시간은 UTC로 저장되고, 클라이언트에서 사용자 타임존으로 변환됩니다
3. **일관성**: 전체 애플리케이션에서 동일한 포맷팅 함수를 사용하여 일관된 사용자 경험을 제공합니다
