# upload.js 처리 과정 분석

## 개요
클라이언트로부터 크래시 정보를 받아 데이터베이스에 저장하고, 관련 파일들을 관리합니다.

## 입력 데이터 구조

```javascript
const body = {
  "pubId": "14123534",      // 퍼블리셔 ID
  "userId": 234,            // 사용자 ID
  "platform": 1,           // 플랫폼 정보
  "branch": 9,              // 브랜치 정보
  "majorVer": 2,            // 메이저 버전
  "minorVer": 3,            // 마이너 버전
  "buildNum": 10,           // 빌드 번호
  "patchNum": 20,           // 패치 번호
  "userMsg": "...",         // 사용자 메시지
  "stack": "...",           // 스택 트레이스 (ErrWithStack)
  "log": "..."              // 로그 데이터
}
```

## 처리 단계

### 1. 입력 검증 (Validation)
- **필수 필드 검증**: `pubId`, `userId`, `stack`, `platform`, `branch`, 버전 정보들
- **데이터 타입 검증**: 숫자 필드들의 NaN 체크
- **특수 처리**: `pubId`가 빈 문자열인 경우 '0'으로 설정
- **에러 처리**: 잘못된 필드 발견 시 `Bad request body` 에러 발생

### 2. 크래시 해시 생성
```javascript
const chash = crypto.createHash('md5').update(stack).digest('hex');
```
- 스택 트레이스를 MD5 해시로 변환
- 동일한 크래시를 식별하기 위한 고유 키 생성

### 3. 크래시 ID 조회/생성
- **Redis 조회**: `chash + branch` 키로 기존 크래시 ID 검색
- **결과 판단**: 새로운 크래시인지 기존 크래시인지 확인
- **ID 할당**: 새로운 경우 새 ID 생성, 기존 경우 기존 ID 사용

### 4. 크래시 데이터 처리

#### 새로운 크래시인 경우
- **테이블**: `crashes` 테이블에 새 레코드 삽입
- **첫 번째 줄 추출**: 스택 트레이스의 첫 줄을 `firstLine`으로 저장 (최대 200자)
- **초기 카운트**: 발생 횟수를 1로 설정

```sql
INSERT INTO crashes (id, branch, chash, firstLine, count) VALUES (?, ?, ?, ?, 1)
```

#### 기존 크래시인 경우
- **카운트 증가**: `count` 필드 1 증가
- **시간 업데이트**: `lastCrash` 필드를 현재 시간으로 업데이트
- **버전 정보 조회**: 최대 버전 정보들 조회

```sql
UPDATE crashes SET count = count + 1, lastCrash = NOW() WHERE id = ?
```

### 5. 재오픈(Reopen) 로직
CLOSED 상태인 크래시에 대해 재오픈 여부를 판단합니다.

#### 재오픈 조건
- **에디터 브랜치** (`branch !== 9`): 항상 재오픈
- **다른 브랜치**: 현재 버전이 기존 최대 버전보다 높은 경우에만 재오픈

#### 버전 비교 로직
```javascript
function isLatest(maxMajorVer, maxMinorVer, maxBuildNum, maxPatchNum,
                  majorVer, minorVer, buildNum, patchNum) {
  // majorVer > minorVer > buildNum > patchNum 순서로 비교
}
```

#### 재오픈 실행
```sql
UPDATE crashes SET state = 0 WHERE id = ?
```

### 6. 크래시 인스턴스 저장
개별 크래시 발생 정보를 `crash_instances` 테이블에 저장합니다.

```sql
INSERT INTO crash_instances 
(cid, pubId, userId, platform, majorVer, minorVer, buildNum, patchNum, userMsg) 
VALUES (?,?,?,?,?,?,?,?,?)
```

- **사용자 메시지 제한**: 최대 255자로 자르기
- **인스턴스 ID**: 삽입 후 `insertId` 저장

### 7. 파일 저장

#### 스택 트레이스 파일
- **조건**: 새로운 크래시인 경우에만 저장
- **경로**: `public/lcrashes/해시디렉토리/해시파일명`
- **내용**: 전체 스택 트레이스

#### 로그 파일
- **조건**: 로그 텍스트가 존재하는 경우
- **경로**: `public/logs/로그디렉토리/인스턴스ID.txt`
- **크기 제한**: 최대 1MB (초과 시 경고 로그)

## 주요 상수

| 상수명 | 값 | 설명 |
|--------|-----|------|
| `MaxFirstLineLen` | 200 | 첫 번째 줄 최대 길이 |
| `MaxUserMsgLen` | 255 | 사용자 메시지 최대 길이 |
| `MaxLogTextLen` | 1048576 | 로그 텍스트 최대 길이 (1MB) |

## 크래시 상태

| 상태 | 값 | 설명 |
|------|-----|------|
| `OPEN` | 0 | 열린 상태 |
| `CLOSED` | 1 | 닫힌 상태 |
| `DELETED` | 2 | 삭제된 상태 |

## 응답 형식

### 성공 응답
```json
{}
```

### 실패 응답
- **상태 코드**: 500
- **내용**: 에러 메시지

## 주요 특징

1. **중복 제거**: 동일한 스택 트레이스는 해시를 통해 그룹화
2. **버전 관리**: 버전별 크래시 추적 및 재오픈 로직
3. **파일 관리**: 스택 트레이스와 로그를 별도 파일로 저장
4. **브랜치별 처리**: 에디터 브랜치는 특별한 재오픈 정책 적용
5. **데이터 제한**: 각종 텍스트 데이터의 크기 제한으로 안정성 확보

## 데이터베이스 테이블

### crashes 테이블
- 크래시 그룹 정보 저장
- 해시, 브랜치, 첫 번째 줄, 발생 횟수 등

### crash_instances 테이블  
- 개별 크래시 발생 정보 저장
- 사용자 정보, 버전 정보, 메시지 등
