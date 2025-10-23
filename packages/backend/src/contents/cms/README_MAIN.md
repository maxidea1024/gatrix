# 운영툴 데이터 생성 도구

## 📋 개요

운영툴에서 사용하는 모든 데이터 파일을 자동으로 생성하는 통합 빌더입니다.

## 🚀 빠른 시작

```bash
cd server/node/tools
node adminToolDataBuilder.js
```

**실행 결과:**
- ✅ 7개의 JSON 파일 생성 (약 2초 소요)
- ✅ 보상 아이템 21,556개 처리
- ✅ 국가/마을/촌락 447개 처리
- ✅ 로컬라이징 50,222개 처리

## 📦 생성되는 파일

### 보상 아이템 관련 (5개)
- `reward-lookup.json` - 전체 보상 아이템 목록 (~1.5MB)
- `reward-type-list.json` - REWARD_TYPE 드롭다운용 (~7KB)
- `reward-localization-kr.json` - 한국어 번역 (~3KB)
- `reward-localization-us.json` - 영어 번역 (~3KB)
- `reward-localization-cn.json` - 중국어 번역 (~3KB)

### UI 목록 데이터 (1개)
- `ui-list-data.json` - 국가/마을/촌락 목록 (~34KB)

### 로컬라이징 테이블 (1개)
- `loctab` - 한글→중국어 번역 테이블 (~3.3MB)

## 💻 사용 예제

### 1. 보상 아이템 선택

```javascript
import rewardTypeList from './reward-type-list.json';
import rewardLookup from './reward-lookup.json';

// REWARD_TYPE 드롭다운
const types = rewardTypeList.filter(t => t.hasTable);

// 아이템 목록
const items = rewardLookup[selectedType].items;
```

### 2. 국가/마을 선택

```javascript
import uiListData from './ui-list-data.json';

// 국가 목록
const nations = uiListData.nations;

// 특정 국가의 마을
const towns = uiListData.towns.filter(t => t.nationId === nationId);
```

### 3. 로컬라이징

```javascript
import loctab from './loctab';

const chinese = loctab['공격력']; // "攻击力"
```

## 🔧 옵션

```bash
# 전체 생성 (기본값)
node adminToolDataBuilder.js

# 보상 아이템만
node adminToolDataBuilder.js --rewards

# UI 목록만
node adminToolDataBuilder.js --ui-lists

# 로컬라이징만
node adminToolDataBuilder.js --localization

# 도움말
node adminToolDataBuilder.js --help
```

## 📚 상세 문서

- **[빠른 시작 가이드](QUICK_START.md)** - 1분 안에 시작하기
- **[상세 가이드](ADMIN_TOOL_DATA_BUILDER.md)** - 모든 기능 설명
- **[운영툴 통합](ADMIN_TOOL_USAGE.md)** - 운영툴에서 사용하는 방법
- **[REWARD_TYPE 참조](REWARD_TYPE_REFERENCE.md)** - 보상 타입 상세 설명

## 🎯 주요 기능

### 1. 보상 아이템 자동 포맷팅
플레이스홀더를 실제 이름으로 자동 변환:
- `{0} 도면` → `타렛테 도면`, `바르카 도면`
- `{0} 계약서` → `조안 페레로 계약서`, `카탈리나 에란초 계약서`

### 2. 다국어 지원
한국어, 영어, 중국어 3개 언어 자동 생성

### 3. 타입별 필터링
- ITEM: 일반 아이템만 (type != 7)
- QUEST_ITEM: 퀘스트 아이템만 (type == 7)

### 4. 참조 테이블 자동 해석
Ship, Mate, Character, InvestSeason 등 자동 조회

## 📊 성능

| 항목 | 값 |
|------|------|
| 실행 시간 | ~2초 |
| 처리 항목 | 50,000+ |
| 생성 파일 | 7개 |
| 총 크기 | ~5MB |

## 🛠️ 문제 해결

### CMS 파일을 찾을 수 없음
```bash
node adminToolDataBuilder.js --cms-dir /path/to/cms/server
```

### loctab-source 파일이 없음
로컬라이징 테이블 생성을 건너뛰려면:
```bash
node adminToolDataBuilder.js --rewards --ui-lists
```

## 🔄 업데이트

CMS 파일이 업데이트되면 빌더를 다시 실행하세요:
```bash
node adminToolDataBuilder.js
```

## 📝 파일 구조

```
server/node/tools/
├── adminToolDataBuilder.js          # 통합 빌더 (메인)
├── README_MAIN.md                   # 이 파일
├── QUICK_START.md                   # 빠른 시작 가이드
├── ADMIN_TOOL_DATA_BUILDER.md       # 상세 가이드
├── ADMIN_TOOL_USAGE.md              # 운영툴 통합 가이드
├── REWARD_TYPE_REFERENCE.md         # REWARD_TYPE 참조
│
├── loctab-source                    # 로컬라이징 소스 (CSV)
│
└── 생성된 파일들:
    ├── reward-lookup.json
    ├── reward-type-list.json
    ├── reward-localization-kr.json
    ├── reward-localization-us.json
    ├── reward-localization-cn.json
    ├── ui-list-data.json
    └── loctab
```

## 🎉 완료!

이제 운영툴에서 생성된 파일들을 사용할 수 있습니다!

더 자세한 내용은 [QUICK_START.md](QUICK_START.md)를 참고하세요.

