# Survey Seeding Script

1000개의 테스트 설문지를 API를 통해 생성하는 스크립트입니다.

## 사용 방법

### 1. Access Token 얻기

1. 관리자 계정으로 로그인
2. 브라우저 개발자 도구 열기 (F12)
3. Application/Storage > Local Storage 이동
4. `accessToken` 값 복사

### 2. 스크립트 실행

```bash
# 환경 변수로 토큰 전달
ACCESS_TOKEN="your_token_here" npx tsx scripts/seed-surveys.ts

# 또는 .env 파일 사용
echo "ACCESS_TOKEN=your_token_here" > .env
npx tsx scripts/seed-surveys.ts
```

### 3. API URL 변경 (선택사항)

기본값은 `http://localhost:5000/api/v1`입니다. 다른 URL을 사용하려면:

```bash
API_URL="https://your-api-url.com/api/v1" ACCESS_TOKEN="your_token" npx tsx scripts/seed-surveys.ts
```

## 생성되는 데이터

### 설문지 ID
- 형식: `SURVEY_00001` ~ `SURVEY_01000`
- 5자리 숫자로 패딩

### 발동 조건
- **유저 레벨**: 1-50 사이 랜덤 (70% 확률로 포함)
- **가입일**: 1-30일 사이 랜덤 (50% 확률로 포함, 레벨 조건이 없을 때만)
- 최소 1개 조건은 반드시 포함

### 보상
- 1-3개의 랜덤 보상
- 보상 타입: 1-5 중 랜덤
- 아이템 ID: 100001-100008 중 랜덤
- 수량: 100-1000 (100 단위)

### 활성 상태
- 90% 확률로 활성화
- 10% 확률로 비활성화

### 제목 및 내용
- 제목: `【有奖调研】诚邀提督大人参与《大航海时代：起源》问卷调研 #1` ~ `#1000`
- 내용: `敬请通过以下问卷链接参与调查，完成后将获赠奖励。这是第 N 个问卷调查。`

### 보상 메일
- 제목: `问卷完成奖励`
- 내용: `感谢您参与问卷调查。`

## 배치 처리

- 한 번에 10개씩 배치로 처리
- 배치 사이에 100ms 딜레이
- 서버 부하 방지

## 출력 예시

```
🚀 Starting to seed 1000 surveys...

✅ [1/1000] Created survey: SURVEY_00001
✅ [2/1000] Created survey: SURVEY_00002
✅ [3/1000] Created survey: SURVEY_00003
...
❌ [500/1000] Failed to create survey SURVEY_00500: Platform survey ID already exists
...

📊 Summary:
✅ Successfully created: 995 surveys
❌ Failed: 5 surveys
📈 Success rate: 99.50%

✨ Done!
```

## 주의사항

1. **중복 실행 방지**: 이미 생성된 설문지 ID는 중복 에러가 발생합니다.
2. **데이터베이스 백업**: 프로덕션 환경에서는 실행 전 백업을 권장합니다.
3. **토큰 만료**: 토큰이 만료되면 401 에러가 발생합니다. 새로운 토큰을 얻어야 합니다.
4. **네트워크**: 안정적인 네트워크 연결이 필요합니다.

## 생성된 데이터 삭제

생성된 테스트 데이터를 삭제하려면:

```sql
-- 특정 패턴의 설문지만 삭제
DELETE FROM g_surveys WHERE platformSurveyId LIKE 'SURVEY_%';

-- 또는 관리자 페이지에서 일괄 삭제 기능 사용
```

