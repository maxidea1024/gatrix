# SQL Execution Tool

이 도구는 MySQL CLI가 없는 환경에서 SQL 파일을 실행할 수 있게 해주는 Node.js 기반 커맨드입니다.

## 사용법

### 기본 명령어

```bash
# SQL 파일 실행
npm run sql -- --file ./data/sample-users.sql

# 직접 SQL 쿼리 실행
npm run sql -- --query "SELECT * FROM g_users LIMIT 5"

# 도움말 보기
npm run sql -- --help
```

### 옵션

- `-f, --file <path>`: 실행할 SQL 파일 경로
- `-q, --query <sql>`: 직접 실행할 SQL 쿼리
- `-d, --database <name>`: 데이터베이스 이름 (기본값: 설정 파일의 데이터베이스)
- `-v, --verbose`: 상세한 출력
- `--dry-run`: 실제 실행 없이 실행될 내용만 확인
- `--stop-on-error`: 첫 번째 오류에서 실행 중단
- `-h, --help`: 도움말 표시

### 예제

```bash
# 샘플 사용자 데이터 삽입
npm run sql -- --file ./data/sample-users.sql --verbose

# 목 데이터 삽입
npm run sql -- --file ./data/mock-data.sql

# 데이터베이스 상태 확인
npm run sql -- --file ./data/status-check.sql

# 테스트 데이터 정리
npm run sql -- --file ./data/cleanup.sql

# 특정 데이터베이스에 실행
npm run sql -- --file ./data/sample-users.sql --database test_db

# 드라이런으로 실행 내용 확인
npm run sql -- --file ./data/mock-data.sql --dry-run

# 직접 쿼리 실행
npm run sql -- --query "SHOW TABLES"

# 사용자 목록 조회
npm run sql -- --query "SELECT id, name, email, role FROM g_users"
```

## 제공되는 SQL 파일들

### sample-users.sql
기본적인 샘플 데이터를 생성합니다:
- 테스트 사용자들
- 기본 게임 월드
- 기본 태그
- 메시지 템플릿
- 화이트리스트 엔트리

### mock-data.sql
더 현실적이고 포괄적인 목 데이터를 생성합니다:
- 다양한 역할의 사용자들
- 여러 환경의 게임 월드
- 우선순위별 태그
- 다양한 시나리오의 메시지 템플릿
- 목적별 화이트리스트 엔트리

### cleanup.sql
테스트/샘플 데이터를 정리합니다:
- 테스트 사용자 삭제
- 테스트 게임 월드 삭제
- 테스트 관련 모든 데이터 정리

### status-check.sql
데이터베이스 현재 상태를 확인합니다:
- 테이블별 레코드 수
- 사용자 통계
- 최근 활동
- 테이블 크기
- 활성화된 항목 수

## 주의사항

1. **백업**: 중요한 데이터가 있는 환경에서는 실행 전에 백업을 권장합니다.

2. **권한**: 데이터베이스 연결 권한이 필요합니다.

3. **환경 변수**: `.env` 파일에 올바른 데이터베이스 설정이 있어야 합니다.

4. **트랜잭션**: 각 SQL 문장은 개별적으로 실행되므로, 트랜잭션이 필요한 경우 SQL 파일 내에서 명시적으로 처리해야 합니다.

## 개발 시나리오

### 새로운 기능 개발 시
```bash
# 1. 깨끗한 상태로 시작
npm run sql -- --file ./data/cleanup.sql

# 2. 기본 데이터 설정
npm run sql -- --file ./data/sample-users.sql

# 3. 개발 중 추가 데이터 필요 시
npm run sql -- --file ./data/mock-data.sql
```

### 테스트 환경 설정
```bash
# 포괄적인 테스트 데이터 설정
npm run sql -- --file ./data/mock-data.sql --database test_db
```

### 데이터베이스 상태 모니터링
```bash
# 정기적인 상태 확인
npm run sql -- --file ./data/status-check.sql
```

## 문제 해결

### 연결 오류
- `.env` 파일의 데이터베이스 설정 확인
- MySQL 서버 실행 상태 확인
- 네트워크 연결 확인

### 권한 오류
- 데이터베이스 사용자 권한 확인
- 특정 테이블에 대한 INSERT/UPDATE/DELETE 권한 확인

### SQL 구문 오류
- `--dry-run` 옵션으로 실행 전 확인
- `--verbose` 옵션으로 상세한 오류 정보 확인
