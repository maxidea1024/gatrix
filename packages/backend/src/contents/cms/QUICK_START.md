# 빠른 시작 가이드 (Quick Start)

## 🎯 목적

운영툴에서 사용할 데이터 파일을 생성합니다.

## ⚡ 1분 안에 시작하기

### 1단계: 빌더 실행

```bash
cd server/node/tools
node adminToolDataBuilder.js
```

### 2단계: 생성된 파일 확인

```bash
ls -lh *.json loctab
```

7개의 파일이 생성됩니다:
- ✅ `reward-lookup.json` - 보상 아이템 전체 목록
- ✅ `reward-type-list.json` - 보상 타입 드롭다운용
- ✅ `reward-localization-kr.json` - 한국어 번역
- ✅ `reward-localization-us.json` - 영어 번역
- ✅ `reward-localization-cn.json` - 중국어 번역
- ✅ `ui-list-data.json` - 국가/마을/촌락 목록
- ✅ `loctab` - 한글→중국어 번역 테이블

### 3단계: 운영툴에 복사

```bash
# 운영툴 프로젝트로 복사
cp *.json /path/to/admin-tool/public/data/
cp loctab /path/to/admin-tool/public/data/
```

## 📖 사용 예제

### 보상 아이템 선택 UI

```javascript
import rewardTypeList from './reward-type-list.json';
import rewardLookup from './reward-lookup.json';

// 1. REWARD_TYPE 드롭다운 생성
const rewardTypes = rewardTypeList.filter(t => t.hasTable);

// 2. 선택된 타입의 아이템 목록 가져오기
const items = rewardLookup[selectedTypeValue].items;

// 3. 아이템 드롭다운 생성
items.forEach(item => {
  console.log(`[${item.id}] ${item.name}`);
});
```

### 국가/마을 선택 UI

```javascript
import uiListData from './ui-list-data.json';

// 1. 국가 드롭다운
uiListData.nations.forEach(nation => {
  console.log(`[${nation.id}] ${nation.name}`);
});

// 2. 선택된 국가의 마을만 필터링
const towns = uiListData.towns.filter(t => t.nationId === selectedNationId);
```

### 로컬라이징

```javascript
import loctab from './loctab';

function localize(koreanText) {
  return loctab[koreanText] || koreanText;
}

console.log(localize('공격력')); // "攻击力"
```

## 🔧 옵션

### 일부만 생성하기

```bash
# 보상 아이템만
node adminToolDataBuilder.js --rewards

# UI 목록만
node adminToolDataBuilder.js --ui-lists

# 로컬라이징만
node adminToolDataBuilder.js --localization
```

### 경로 지정

```bash
# CMS 디렉토리 지정
node adminToolDataBuilder.js --cms-dir /custom/path/to/cms

# 출력 디렉토리 지정
node adminToolDataBuilder.js --output-dir /custom/output/path
```

## 📊 생성 데이터 통계

| 파일 | 크기 | 항목 수 | 설명 |
|------|------|---------|------|
| reward-lookup.json | ~1.5MB | 21,556개 | 전체 보상 아이템 |
| reward-type-list.json | ~7KB | 35개 | REWARD_TYPE 목록 |
| reward-localization-kr.json | ~3KB | 70개 | 한국어 번역 |
| reward-localization-us.json | ~3KB | 70개 | 영어 번역 |
| reward-localization-cn.json | ~3KB | 70개 | 중국어 번역 |
| ui-list-data.json | ~34KB | 447개 | 국가/마을/촌락 |
| loctab | ~3.3MB | 50,222개 | 한글→중국어 |

## ❓ 자주 묻는 질문

### Q: CMS 파일이 업데이트되면?

A: 빌더를 다시 실행하면 됩니다.

```bash
node adminToolDataBuilder.js
```

### Q: 특정 파일만 다시 생성하려면?

A: 옵션을 사용하세요.

```bash
node adminToolDataBuilder.js --rewards
```

### Q: loctab-source 파일이 없으면?

A: 로컬라이징 테이블 생성을 건너뜁니다. 경고만 표시되고 나머지는 정상 생성됩니다.

### Q: 생성 시간이 오래 걸리면?

A: 일반적으로 2초 이내입니다. 더 오래 걸린다면 CMS 파일 크기를 확인하세요.

## 📚 더 알아보기

- **상세 가이드**: `ADMIN_TOOL_DATA_BUILDER.md`
- **운영툴 통합**: `ADMIN_TOOL_USAGE.md`
- **REWARD_TYPE 참조**: `REWARD_TYPE_REFERENCE.md`

## 🎉 완료!

이제 운영툴에서 생성된 파일들을 사용할 수 있습니다!

