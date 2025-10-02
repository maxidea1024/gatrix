# System Console Improvements Summary

## Overview
시스템 콘솔에 다양한 유틸리티 커맨드를 추가하여 관리자가 시스템 관리, 보안, 디버깅 작업을 더 효율적으로 수행할 수 있도록 개선했습니다.

## Added Commands

### 1. ID Generation Commands

#### `ulid` - ULID 생성
- **기능**: Universally Unique Lexicographically Sortable Identifier 생성
- **사용법**: 
  ```bash
  ulid          # 1개 생성
  ulid 5        # 5개 생성
  ```
- **특징**:
  - 시간순 정렬 가능
  - UUID보다 짧음 (26자 vs 36자)
  - 대소문자 구분 없음
  - Crockford's Base32 인코딩 사용

### 2. Security & Cryptography Commands

#### `jwt-secret` - JWT Secret 키 생성
- **기능**: 안전한 JWT secret 키 생성
- **사용법**:
  ```bash
  jwt-secret                # 기본 64바이트
  jwt-secret --length 128   # 커스텀 길이
  ```
- **출력**: Base64 인코딩된 랜덤 키 + .env 파일 설정 예시

#### `hash` - Bcrypt 해싱
- **기능**: 비밀번호 등을 bcrypt로 해싱
- **사용법**:
  ```bash
  hash mypassword123
  hash --rounds 14 mypassword123
  ```
- **옵션**:
  - `--rounds <4-20>`: Salt rounds (기본값: 12)

#### `encrypt` - AES-256-GCM 암호화
- **기능**: 텍스트를 AES-256-GCM으로 암호화
- **사용법**:
  ```bash
  encrypt "Secret message"
  encrypt --key <hex-key> "Secret message"
  ```
- **특징**:
  - 인증된 암호화 (Authenticated Encryption)
  - 키가 없으면 자동 생성
  - IV, Auth Tag 포함

#### `decrypt` - AES-256-GCM 복호화
- **기능**: 암호화된 텍스트 복호화
- **사용법**:
  ```bash
  decrypt --key <hex-key> <encrypted>:<iv>:<authTag>
  ```
- **필수**: `--key` 옵션

#### `random` - 랜덤 문자열 생성
- **기능**: 다양한 형식의 랜덤 문자열 생성
- **사용법**:
  ```bash
  random                      # 32바이트 hex
  random --length 64          # 64바이트 hex
  random --base64             # Base64
  random --alphanumeric       # 영숫자만
  ```

### 3. API Token Management

#### `api-key` - API 액세스 토큰 생성
- **기능**: Client/Server API 토큰을 데이터베이스에 직접 생성
- **사용법**:
  ```bash
  api-key --name "My App" --type client
  api-key --name "Backend Service" --type server --description "Production API" --expires 365
  ```
- **필수 옵션**:
  - `--name`: 토큰 이름
  - `--type`: `client` 또는 `server`
- **선택 옵션**:
  - `--description`: 토큰 설명
  - `--expires <days>`: 만료 기간 (일 단위)
- **특징**:
  - 데이터베이스에 직접 저장
  - 생성된 토큰은 한 번만 표시됨
  - 사용 방법 안내 포함

### 4. Database Operations

#### `db-stats` - 데이터베이스 통계
- **기능**: 주요 테이블의 레코드 수 표시
- **사용법**:
  ```bash
  db-stats
  ```
- **표시 테이블**:
  - g_users
  - g_api_access_tokens
  - g_message_templates
  - g_tags
  - g_tag_assignments
  - g_jobs
  - g_client_versions
  - g_game_worlds

## Technical Implementation

### File Modified
- `packages/backend/src/services/ConsoleService.ts`

### Dependencies Added
- `crypto` (Node.js built-in)
- `bcryptjs` (already in dependencies)
- `knex` (already in dependencies)

### Key Features

1. **ULID Implementation**
   - Custom implementation using Crockford's Base32
   - Timestamp-based prefix for sortability
   - Cryptographically secure random suffix

2. **Encryption**
   - AES-256-GCM (Galois/Counter Mode)
   - Authenticated encryption with additional data (AEAD)
   - Random IV generation
   - Auth tag verification

3. **API Token Generation**
   - Direct database insertion
   - Support for both client and server tokens
   - Optional expiration dates
   - Automatic timestamp management

4. **Security Best Practices**
   - Bcrypt with configurable rounds
   - Cryptographically secure random generation
   - Proper key length validation
   - Error handling and user feedback

## Documentation

### Created Files
1. `packages/backend/docs/CONSOLE_COMMANDS.md`
   - Complete command reference
   - Usage examples
   - Security notes
   - Best practices

2. `CONSOLE_IMPROVEMENTS_SUMMARY.md` (this file)
   - Overview of changes
   - Technical details
   - Implementation notes

## Usage Examples

### Complete API Setup Workflow
```bash
# 1. Generate JWT secret for authentication
jwt-secret --length 64

# 2. Create client API token for mobile app
api-key --name "Mobile App v1.0" --type client --expires 365

# 3. Create server API token for backend service
api-key --name "Payment Service" --type server --description "Production payment gateway"

# 4. Verify database state
db-stats
```

### Data Encryption Workflow
```bash
# 1. Encrypt sensitive data
encrypt "Credit card: 1234-5678-9012-3456"

# 2. Copy the key and encrypted data
# 3. Store key in environment variable
# 4. Decrypt when needed
decrypt --key <saved-key> <encrypted>:<iv>:<authTag>
```

### ID Generation
```bash
# Generate UUIDs for general use
uuid

# Generate ULIDs for time-sortable IDs
ulid 10

# Generate random tokens
random --length 32 --hex
random --alphanumeric --length 16
```

## Benefits

1. **Improved Productivity**
   - No need to write separate scripts
   - Instant access to common utilities
   - Consistent interface

2. **Enhanced Security**
   - Proper cryptographic implementations
   - Secure random generation
   - Industry-standard algorithms

3. **Better System Management**
   - Direct database operations
   - Real-time statistics
   - Integrated with existing auth system

4. **Developer Experience**
   - Clear command syntax
   - Helpful error messages
   - Comprehensive documentation

## Security Considerations

1. **API Tokens**
   - Stored as plain text in database (ensure database security)
   - Shown only once during creation
   - Support for expiration dates

2. **Encryption**
   - AES-256-GCM provides confidentiality and authenticity
   - Keys must be stored securely
   - IV is randomly generated for each encryption

3. **Password Hashing**
   - Bcrypt with configurable rounds
   - Default 12 rounds (good balance)
   - Increase rounds for higher security

4. **Console Access**
   - Requires admin authentication
   - All operations are logged
   - User context available in commands

## Future Enhancements

Potential additions for future versions:

1. **Database Management**
   - `db-backup` - Create database backup
   - `db-query` - Execute safe read-only queries
   - `db-migrate` - Run migrations

2. **Cache Management**
   - `cache-clear` - Clear Redis cache
   - `cache-stats` - Show cache statistics
   - `cache-get/set` - Inspect cache values

3. **User Management**
   - `user-create` - Create new user
   - `user-reset-password` - Reset user password
   - `user-list` - List users with filters

4. **Job Management**
   - `job-run` - Manually trigger job
   - `job-status` - Check job status
   - `job-logs` - View job execution logs

5. **System Monitoring**
   - `metrics` - Show system metrics
   - `connections` - Show active connections
   - `processes` - Show running processes

## Testing

To test the new commands:

1. Start the backend server
2. Navigate to System Console in admin panel
3. Try each command:
   ```bash
   help
   ulid
   jwt-secret
   hash test123
   encrypt "Hello World"
   random --alphanumeric
   api-key --name "Test" --type client
   db-stats
   ```

## Build Status

✅ Build successful
✅ No TypeScript errors
✅ All dependencies resolved
✅ Documentation complete

## Conclusion

시스템 콘솔이 단순한 명령어 실행 도구에서 강력한 시스템 관리 플랫폼으로 발전했습니다. 추가된 커맨드들은 일상적인 관리 작업을 크게 간소화하고, 보안 관련 작업을 더 안전하게 수행할 수 있게 해줍니다.

