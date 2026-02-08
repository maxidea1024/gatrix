# Client crash 보고 체계

## 개요

클라이언트로부터 크래시 정보를 받아 데이터베이스에 저장하고, 관련 파일들을 관리합니다.

## 입력 데이터 구조

```javascript
const body = {
  "platform": "windows",        // 플랫폼(OS) 정보(문자열, ios, android, windows, mac, ...) - required
  "marketType": "googleplay",   // 마켓 타입 정보(문자열, google, apple, ...) - required
  "branch": "qa_2025",          // 브랜치 정보(문자열) - required
  "environment": "qa",          // 환경 정보(문자열, dev, staging, production, ...) - required
  "isEditor": false,            // 에디터 여부 - optional
  "appVersion": "1.0.1",        // App version(문자열) - optional
  "resVersion": "1.0.1"         // Resource version(문자열) - optional
  "accountId": "14123534",      // 계정 ID(문자열) - optional
  "characterId": "....",        // 캐릭터 ID(문자열) - optional
  "gameUserId": "...",          // 게임 사용자 ID(문자열) - optional
  "userName": "...",            // 사용자 이름(문자열) - optional
  "gameServerId": "...",        // 게임 서버 ID(문자열) - optional
  "userMessage": "...",         // 사용자 메시지 - optional
  "stack": "...",               // 스택 트레이스 (ErrWithStack) - optional
  "log": "..."                  // 로그 데이터 - optional
}
```

- `ip` 는 http reqest에서 추출해서 기록해준다.
- `stack` 은 crashes 테이블의 `stack` 을 join해서 사용한다. 개별로 저장하기에는 너무 큰 데이터이기 때문에.
- `appVersion` 은 `semver` 형식을 따르도록 한다. (`resVersion`은 그냥 문자열)

## 처리 단계

### 1. 입력 검증 (Validation)

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

- 추가로 담당자, 상태(처리상태), Jira 티켓 주소를 지정할수 있어야함.

#### 기존 크래시인 경우

- **카운트 증가**: `count` 필드 1 증가
- **업데이트**: `lastCrashEventId`, `lastCrashAt` 필드 업데이트
- **버전 정보 조회**: 최대 버전 정보들 조회

```sql
UPDATE crashes SET count = count + 1, lastCrashEventId = ? WHERE id = ?
```

### 5. 재오픈(Reopen) 로직

CLOSED 상태인 크래시에 대해 재오픈 여부를 판단합니다.

#### 재오픈 조건

- **에디터환경** (isEditor==true): 항상 재오픈
- **다른 환경**: 현재 버전이 기존 최대 버전보다 높은 경우에만 재오픈

#### 재오픈 실행

이미 닫힌 crash이지만, 새버전에서도 여전히 발생한다면 다시 자동으로 열어주는게 맞다. 자동으로 열어주었다는 표시를 해주는것도 좋을듯하다.

버전의 대소 비교는 `semver` 를 사용한다.

```sql
UPDATE crashes SET state = 0 WHERE id = ?
```

### 6. 크래시 이벤트 저장

개별 크래시 발생 이벤트 정보를 `crash_events` 테이블에 저장합니다.

- **사용자 메시지 제한**: 최대 255자로 자르기
- **인스턴스 ID**: 삽입 후 `insertId` 저장

### 7. 파일 저장

#### 스택 트레이스 파일

- **조건**: 새로운 크래시인 경우에만 저장
- **경로**: `public/crashes/해시디렉토리/해시파일명`
- **내용**: 전체 스택 트레이스

#### 로그 파일

- **조건**: 로그 텍스트가 존재하는 경우
- **경로**: `public/crashes/로그디렉토리/이벤트ID.txt`
- **크기 제한**: 최대 1MB (초과 시 경고 로그)

## 주요 상수

| 상수명            | 값      | 설명                        |
| ----------------- | ------- | --------------------------- |
| `MaxFirstLineLen` | 200     | 첫 번째 줄 최대 길이        |
| `MaxUserMsgLen`   | 255     | 사용자 메시지 최대 길이     |
| `MaxLogTextLen`   | 1048576 | 로그 텍스트 최대 길이 (1MB) |

## 크래시 상태

| 상태       | 값  | 설명                                               |
| ---------- | --- | -------------------------------------------------- |
| `OPEN`     | 0   | 열린 상태                                          |
| `CLOSED`   | 1   | 닫힌 상태                                          |
| `DELETED`  | 2   | 삭제된 상태                                        |
| `RESOLVED` | 3   | 해결된 상태                                        |
| `REPEATED` | 4   | 해결되었지만, 새버전에서 발생하는 경우 강제 재오픈 |

## 응답 형식

### 성공 응답

```json
{
  "result": "OK"
}
```

### 실패 응답

- **상태 코드**: 에러 상황에 맞는 HTTP 상태 코드
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
- 해시, 환경, 첫 번째 줄(stack에서 첫번째 줄 추출), 발생 횟수 등
- 첫번째 발생이벤트 ID, 마지막 발생 이벤트 ID, 첫번째 이벤트 시각, 마지막 이벤트 시각
- 담당자, 상태, 해결여부, Jira 정보 등
- 스택 트레이스 경로

### crash_events 테이블

- 개별 크래시 발생 정보 저장
- 사용자 정보, 버전 정보, 메시지, IP 등

### 주의사항

- 모든 생성되어야하는 id는 데이터베이스의 `auto increment` 를 사용하지 않고 `ulid` 를 사용해서 생성한것을 부여해함.
- 크래시 이벤트, 크래시, 콜스택 파일, 로그파일 최대 보존 기간 설정 가능해야함.
