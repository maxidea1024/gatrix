# Recent Fixes and Improvements Summary

## 1. Message Template Tag Filtering Fix

### Issue
메시지 템플릿 관리에서 여러 개의 태그를 선택했을 때, 선택된 태그 중 **하나라도** 있는 템플릿이 표시되었습니다 (OR 조건). 하지만 요구사항은 선택된 **모든 태그**를 가진 템플릿만 표시하는 것이었습니다 (AND 조건).

### Root Cause
`packages/backend/src/models/MessageTemplate.ts`의 태그 필터링 로직이 `whereIn` 서브쿼리를 사용하여 OR 조건으로 동작했습니다.

**Before (OR condition):**
```typescript
if (filters?.tags && filters.tags.length > 0) {
  query.whereIn('mt.id', function(this: any) {
    this.select('ta.entityId')
      .from('g_tag_assignments as ta')
      .where('ta.entityType', 'message_template')
      .whereIn('ta.tagId', filters.tags);
  });
}
```

### Solution
`whereExists`와 `forEach`를 사용하여 AND 조건으로 변경했습니다. 이는 User 및 ClientVersion 모델에서 이미 사용 중인 패턴과 동일합니다.

**After (AND condition):**
```typescript
// 태그 필터 처리 (AND 조건: 모든 태그를 가진 템플릿만 반환)
if (filters?.tags && filters.tags.length > 0) {
  filters.tags.forEach(tagId => {
    query.whereExists(function(this: any) {
      this.select('*')
        .from('g_tag_assignments as ta')
        .whereRaw('ta.entityId = mt.id')
        .where('ta.entityType', 'message_template')
        .where('ta.tagId', tagId);
    });
  });
}
```

### How It Works
- 선택된 각 태그에 대해 `whereExists` 절을 추가
- 각 `whereExists`는 해당 태그가 템플릿에 할당되어 있는지 확인
- 모든 `whereExists` 조건이 만족되어야 하므로 AND 조건이 됨
- 예: 태그 [1, 2, 3] 선택 시 → 태그 1 AND 태그 2 AND 태그 3을 모두 가진 템플릿만 반환

### Files Modified
- `packages/backend/src/models/MessageTemplate.ts` (lines 70-81)

### Testing
✅ Build successful
✅ No TypeScript errors
✅ Logic consistent with User and ClientVersion models

### Impact
- 사용자가 여러 태그로 정확하게 필터링 가능
- 다른 모델들과 일관된 동작
- 성능 영향 최소 (EXISTS는 효율적인 쿼리)

---

## 2. System Console Improvements

### Overview
시스템 콘솔에 다양한 유틸리티 커맨드를 추가하여 시스템 관리 효율성을 크게 향상시켰습니다.

### New Commands Added

#### ID Generation
1. **`ulid`** - ULID (시간순 정렬 가능한 고유 ID) 생성
   - 사용법: `ulid [count]`
   - 특징: 26자, 시간순 정렬, Crockford's Base32

#### Security & Cryptography
2. **`jwt-secret`** - JWT secret 키 생성
   - 사용법: `jwt-secret [--length <bytes>]`
   - 기본값: 64바이트

3. **`hash`** - Bcrypt 해싱
   - 사용법: `hash <text> [--rounds <4-20>]`
   - 비밀번호 해싱에 사용

4. **`encrypt`** - AES-256-GCM 암호화
   - 사용법: `encrypt [--key <hex>] <text>`
   - 인증된 암호화 (AEAD)

5. **`decrypt`** - AES-256-GCM 복호화
   - 사용법: `decrypt --key <hex> <encrypted:iv:authTag>`

6. **`random`** - 랜덤 문자열 생성
   - 사용법: `random [--length <bytes>] [--hex|--base64|--alphanumeric]`
   - 다양한 형식 지원

#### API Token Management
7. **`api-key`** - API 액세스 토큰 생성
   - 사용법: `api-key --name <name> --type <client|server> [--description <desc>] [--expires <days>]`
   - 데이터베이스에 직접 저장
   - Client/Server 토큰 모두 지원

#### Database Operations
8. **`db-stats`** - 데이터베이스 통계
   - 사용법: `db-stats`
   - 주요 테이블의 레코드 수 표시

### Implementation Details

**Files Modified:**
- `packages/backend/src/services/ConsoleService.ts`

**Key Features:**
- Custom ULID implementation (Crockford's Base32)
- AES-256-GCM authenticated encryption
- Bcrypt password hashing with configurable rounds
- Direct database integration for API tokens
- Comprehensive error handling

**Dependencies:**
- `crypto` (Node.js built-in)
- `bcryptjs` (existing)
- `knex` (existing)

### Documentation Created
1. **`packages/backend/docs/CONSOLE_COMMANDS.md`**
   - Complete command reference
   - Usage examples
   - Security notes
   - Best practices

2. **`CONSOLE_IMPROVEMENTS_SUMMARY.md`**
   - Technical implementation details
   - Future enhancement ideas

### Usage Examples

**Generate API Setup:**
```bash
# JWT secret
jwt-secret --length 64

# Client API token
api-key --name "Mobile App" --type client --expires 365

# Server API token
api-key --name "Backend Service" --type server

# Check stats
db-stats
```

**Encrypt Data:**
```bash
# Encrypt
encrypt "Sensitive data"

# Decrypt
decrypt --key <key> <encrypted>:<iv>:<authTag>
```

**Generate IDs:**
```bash
# UUID
uuid

# ULID (sortable)
ulid 10

# Random tokens
random --alphanumeric --length 32
```

### Benefits
1. **Productivity**: 별도 스크립트 불필요
2. **Security**: 표준 암호화 알고리즘 사용
3. **Management**: 직접 데이터베이스 작업 가능
4. **Consistency**: 통일된 인터페이스

### Testing Status
✅ Build successful
✅ No TypeScript errors
✅ All dependencies resolved
✅ Documentation complete

---

## Summary

### Changes Made
1. ✅ Message template tag filtering (OR → AND)
2. ✅ ULID generation command
3. ✅ JWT secret generation command
4. ✅ Encryption/decryption commands (AES-256-GCM)
5. ✅ Password hashing command (bcrypt)
6. ✅ API key generation command (client/server)
7. ✅ Random string generation command
8. ✅ Database statistics command
9. ✅ Comprehensive documentation

### Build Status
✅ Backend build successful
✅ No compilation errors
✅ No diagnostic issues

### Next Steps
1. 백엔드 서버 재시작
2. 시스템 콘솔에서 새 커맨드 테스트
3. 메시지 템플릿 태그 필터링 테스트
4. 필요시 추가 커맨드 구현

### Files Modified
- `packages/backend/src/models/MessageTemplate.ts`
- `packages/backend/src/services/ConsoleService.ts`

### Files Created
- `packages/backend/docs/CONSOLE_COMMANDS.md`
- `CONSOLE_IMPROVEMENTS_SUMMARY.md`
- `RECENT_FIXES_SUMMARY.md`

---

## Recommendations

1. **Security**
   - API 토큰은 데이터베이스에 평문으로 저장되므로 데이터베이스 보안 강화 필요
   - 암호화 키는 환경 변수에 안전하게 보관
   - JWT secret은 프로덕션에서 최소 64바이트 사용

2. **Testing**
   - 메시지 템플릿 태그 필터링 기능 테스트
   - 각 콘솔 커맨드 실행 테스트
   - API 토큰 생성 및 사용 테스트

3. **Documentation**
   - 팀원들에게 새로운 콘솔 커맨드 공유
   - 보안 관련 베스트 프랙티스 교육

4. **Future Enhancements**
   - 캐시 관리 커맨드
   - 사용자 관리 커맨드
   - Job 관리 커맨드
   - 시스템 모니터링 커맨드

