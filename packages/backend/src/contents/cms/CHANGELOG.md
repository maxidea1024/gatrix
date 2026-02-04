# 변경 이력 (Changelog)

## 통합 빌더 (adminToolDataBuilder.js)

### 2025-10-23 - 통합 빌더 생성

#### 🎉 새로운 기능

**통합 빌더 생성**

- 3개의 독립 기능을 하나의 파일로 통합
- 보상 아이템 데이터 생성
- UI 목록 데이터 생성 (국가/마을/촌락)
- 로컬라이징 테이블 변환

**주요 개선사항**

- ✅ 단일 명령어로 모든 데이터 생성
- ✅ 선택적 빌드 옵션 추가 (`--rewards`, `--ui-lists`, `--localization`)
- ✅ 커스텀 경로 지정 가능 (`--cms-dir`, `--output-dir`)
- ✅ 깔끔한 콘솔 출력 (박스 디자인, 이모지)
- ✅ 상세한 통계 정보 표시
- ✅ 실행 시간 측정

**생성되는 파일**

1. `reward-lookup.json` - 전체 보상 아이템 목록
2. `reward-type-list.json` - REWARD_TYPE 드롭다운용
3. `reward-localization-kr.json` - 한국어 번역
4. `reward-localization-us.json` - 영어 번역
5. `reward-localization-cn.json` - 중국어 번역
6. `ui-list-data.json` - 국가/마을/촌락 목록
7. `loctab` - 한글→중국어 번역 테이블

**문서화**

- `README_MAIN.md` - 메인 README
- `QUICK_START.md` - 빠른 시작 가이드
- `ADMIN_TOOL_DATA_BUILDER.md` - 상세 가이드
- `CHANGELOG.md` - 이 파일

#### 📊 성능

| 항목         | 값      |
| ------------ | ------- |
| 실행 시간    | ~2초    |
| 처리 항목 수 | 50,000+ |
| 생성 파일 수 | 7개     |
| 총 파일 크기 | ~5MB    |

#### 🔧 기술적 개선

**코드 구조**

- 모듈화된 함수 구조
- 재사용 가능한 유틸리티 함수
- 명확한 에러 처리

**기능 통합**

- `rewardLookupBuilder.js` 기능 통합
- `loctabConverter.js` 기능 통합
- UI 목록 데이터 생성 기능 추가

**사용성 개선**

- 명령줄 옵션 파싱
- 도움말 메시지 (`--help`)
- 진행 상황 표시
- 상세한 통계 출력

---

## 이전 버전

### rewardLookupBuilder.js

#### 2025-10-23 - UI 목록 데이터 생성 추가

**새로운 기능**

- `generateUIListData()` 함수 추가
- Nation, Town, Village 테이블 처리
- `ui-list-data.json` 파일 생성

**통계**

- 국가: 153개
- 마을: 222개
- 촌락: 72개

#### 2025-10-23 - Item 타입 필터링 추가

**개선사항**

- ITEM (type 2): type != 7 필터링
- QUEST_ITEM (type 10): type == 7만 포함
- 2,813개 일반 아이템 + 14개 퀘스트 아이템

#### 2025-10-23 - 아이템 이름 포맷팅 추가

**새로운 기능**

- `formatItemName()` 함수 구현
- descFormat/descFormatType 파싱
- 참조 테이블 자동 조회 (Ship, Mate, Character, etc.)
- Mate → Character 이름 변환
- RewardSeasonItems 이름 생성

**개선사항**

- 1,702개 아이템 이름 포맷팅
- 플레이스홀더 자동 변환
- 중복 이름 제거

#### 2025-10-23 - 초기 버전

**기능**

- REWARD_TYPE별 아이템 목록 생성
- 다국어 지원 (kr, us, cn)
- JSON 출력

---

### loctabConverter.js

#### 2025-10-23 - 중복 키 처리 개선

**개선사항**

- 정확한 중복 키 제거
- 대소문자 구분 없는 중복 키 제거
- 상세한 통계 출력

#### 2025-10-23 - 초기 버전

**기능**

- CSV 파싱 (큰따옴표 처리)
- 한글 키 → 중국어 값 매핑
- JSON 출력

---

## 마이그레이션 가이드

### 기존 사용자

**이전 방식:**

```bash
# 보상 아이템
node rewardLookupBuilder.js

# 로컬라이징
node loctabConverter.js
```

**새로운 방식:**

```bash
# 모든 데이터 한 번에
node adminToolDataBuilder.js

# 또는 선택적으로
node adminToolDataBuilder.js --rewards
node adminToolDataBuilder.js --localization
```

### 생성 파일 변경 없음

기존 파일들과 동일한 형식으로 생성되므로 운영툴 코드 수정 불필요:

- ✅ `reward-lookup.json` - 동일
- ✅ `reward-type-list.json` - 동일
- ✅ `reward-localization-*.json` - 동일
- ✅ `ui-list-data.json` - 동일
- ✅ `loctab` - 동일

### 권장사항

1. **새 프로젝트**: `adminToolDataBuilder.js` 사용
2. **기존 프로젝트**: 점진적 마이그레이션 가능
3. **CI/CD**: `adminToolDataBuilder.js`로 업데이트 권장

---

## 향후 계획

### 계획된 기능

- [ ] 증분 빌드 (변경된 파일만 처리)
- [ ] 병렬 처리 (성능 개선)
- [ ] 캐싱 (반복 실행 시 속도 향상)
- [ ] 검증 기능 (생성된 데이터 무결성 체크)
- [ ] 압축 옵션 (파일 크기 최적화)

### 고려 중인 개선사항

- [ ] TypeScript 마이그레이션
- [ ] 설정 파일 지원 (config.json)
- [ ] 플러그인 시스템
- [ ] 웹 UI (브라우저에서 실행)
- [ ] 실시간 모니터링

---

## 기여

버그 리포트나 기능 제안은 이슈로 등록해주세요.

## 라이선스

내부 프로젝트용
