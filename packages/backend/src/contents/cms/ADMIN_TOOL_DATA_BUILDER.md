# 운영툴 데이터 빌더 (Admin Tool Data Builder)

## 📋 개요

운영툴에서 사용하는 모든 데이터 파일을 한 번에 생성하는 통합 빌더입니다.

### 주요 기능

1. **보상 아이템 데이터** - 35개 REWARD_TYPE별 아이템 목록 및 로컬라이징
2. **UI 목록 데이터** - 국가, 마을, 촌락 검색/선택용 데이터
3. **로컬라이징 테이블** - 한글→중국어 번역 테이블 (loctab)

## 🚀 빠른 시작

### 기본 사용 (모든 데이터 생성)

```bash
cd server/node/tools
node adminToolDataBuilder.js
```

실행 결과:

- ✅ 7개의 JSON 파일 생성
- ✅ 약 2초 소요
- ✅ 총 50,000+ 항목 처리

### 선택적 빌드

```bash
# 보상 아이템 데이터만 생성
node adminToolDataBuilder.js --rewards

# UI 목록 데이터만 생성
node adminToolDataBuilder.js --ui-lists

# 로컬라이징 테이블만 생성
node adminToolDataBuilder.js --localization
```

### 커스텀 경로 지정

```bash
# CMS 디렉토리 지정
node adminToolDataBuilder.js --cms-dir /path/to/cms/server

# 출력 디렉토리 지정
node adminToolDataBuilder.js --output-dir /path/to/output
```

## 📦 생성되는 파일

### 1. 보상 아이템 관련 (5개 파일)

#### `reward-lookup.json` (~1.5MB)

전체 REWARD_TYPE별 아이템 목록

```json
{
  "1": {
    "rewardType": 1,
    "rewardTypeName": "POINT",
    "hasTable": true,
    "items": [
      { "id": 100001, "name": "두카트" },
      { "id": 100003, "name": "명성" }
    ],
    "itemCount": 23
  }
}
```

#### `reward-type-list.json` (~7KB)

REWARD_TYPE 드롭다운용 목록

```json
[
  {
    "value": 1,
    "name": "POINT",
    "nameKey": "REWARD_TYPE_POINT",
    "hasTable": true,
    "itemCount": 23
  }
]
```

#### `reward-localization-kr.json` (~3KB)

한국어 로컬라이징

```json
{
  "REWARD_TYPE_POINT": "포인트",
  "REWARD_TYPE_ITEM": "아이템",
  "REWARD_TYPE_SHIP": "선박"
}
```

#### `reward-localization-us.json` (~3KB)

영어 로컬라이징

```json
{
  "REWARD_TYPE_POINT": "Point",
  "REWARD_TYPE_ITEM": "Item",
  "REWARD_TYPE_SHIP": "Ship"
}
```

#### `reward-localization-cn.json` (~3KB)

중국어 로컬라이징

```json
{
  "REWARD_TYPE_POINT": "点数",
  "REWARD_TYPE_ITEM": "道具",
  "REWARD_TYPE_SHIP": "船只"
}
```

### 2. UI 목록 데이터 (1개 파일)

#### `ui-list-data.json` (~34KB)

국가, 마을, 촌락 목록

```json
{
  "nations": [
    { "id": 10000000, "name": "포르투갈" },
    { "id": 10000001, "name": "에스파냐" }
  ],
  "towns": [
    { "id": 11000000, "name": "리스본", "nationId": 10000000 },
    { "id": 11000001, "name": "세비야", "nationId": 10000001 }
  ],
  "villages": [{ "id": 70500000, "name": "스비아인의 마을" }]
}
```

**통계:**

- 국가: 153개
- 마을: 222개
- 촌락: 72개

### 3. 로컬라이징 테이블 (1개 파일)

#### `loctab` (~3.3MB)

한글→중국어 번역 테이블

```json
{
  "공격력": "攻击力",
  "방어력": "防御力",
  "속도": "速度"
}
```

**통계:**

- 총 50,222개 항목
- 중복 제거: 686개

## 💻 운영툴에서 사용하기

### 1. 보상 아이템 선택 UI

```javascript
import rewardTypeList from './reward-type-list.json';
import rewardLookup from './reward-lookup.json';

function RewardSelector() {
  const [selectedType, setSelectedType] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');

  // REWARD_TYPE 드롭다운
  const rewardTypes = rewardTypeList.filter((t) => t.hasTable);

  // 선택된 타입의 아이템 목록
  const items = selectedType ? rewardLookup[selectedType].items : [];

  return (
    <div>
      <select onChange={(e) => setSelectedType(e.target.value)}>
        <option value="">보상 타입 선택</option>
        {rewardTypes.map((type) => (
          <option key={type.value} value={type.value}>
            {type.name} ({type.itemCount}개)
          </option>
        ))}
      </select>

      {selectedType && (
        <select onChange={(e) => setSelectedItemId(e.target.value)}>
          <option value="">아이템 선택</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              [{item.id}] {item.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
```

### 2. 국가/마을 선택 UI

```javascript
import uiListData from './ui-list-data.json';

function LocationSelector() {
  const [selectedNation, setSelectedNation] = useState('');
  const [selectedTown, setSelectedTown] = useState('');

  // 선택된 국가의 마을만 필터링
  const filteredTowns = selectedNation
    ? uiListData.towns.filter((t) => t.nationId === parseInt(selectedNation))
    : uiListData.towns;

  return (
    <div>
      <select onChange={(e) => setSelectedNation(e.target.value)}>
        <option value="">국가 선택</option>
        {uiListData.nations.map((nation) => (
          <option key={nation.id} value={nation.id}>
            [{nation.id}] {nation.name}
          </option>
        ))}
      </select>

      <select onChange={(e) => setSelectedTown(e.target.value)}>
        <option value="">마을 선택</option>
        {filteredTowns.map((town) => (
          <option key={town.id} value={town.id}>
            [{town.id}] {town.name}
          </option>
        ))}
      </select>
    </div>
  );
}
```

### 3. 로컬라이징 사용

```javascript
import loctab from './loctab';

function localize(koreanText) {
  return loctab[koreanText] || koreanText;
}

// 사용 예
console.log(localize('공격력')); // "攻击力"
console.log(localize('방어력')); // "防御力"
```

## 🔧 고급 사용법

### 프로그래밍 방식으로 사용

```javascript
const builder = require('./adminToolDataBuilder');

// 개별 함수 호출
const lookupTable = builder.buildRewardLookupTable('/path/to/cms');
const uiListData = builder.generateUIListData('/path/to/cms');
const loctab = builder.convertLocalizationTable('loctab-source', 'loctab');
```

### CI/CD 파이프라인에 통합

```yaml
# .github/workflows/build-admin-data.yml
name: Build Admin Tool Data

on:
  push:
    paths:
      - 'cms/server/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build admin tool data
        run: |
          cd server/node/tools
          node adminToolDataBuilder.js
      - name: Upload artifacts
        uses: actions/upload-artifact@v2
        with:
          name: admin-tool-data
          path: server/node/tools/*.json
```

## 📊 성능

| 항목              | 값      |
| ----------------- | ------- |
| **실행 시간**     | ~2초    |
| **처리 항목 수**  | 50,000+ |
| **생성 파일 수**  | 7개     |
| **총 파일 크기**  | ~5MB    |
| **메모리 사용량** | ~100MB  |

## 🛠️ 문제 해결

### CMS 파일을 찾을 수 없음

```bash
# CMS 디렉토리 경로 확인
node adminToolDataBuilder.js --cms-dir ../../../cms/server
```

### loctab-source 파일이 없음

로컬라이징 테이블 변환을 건너뛰려면:

```bash
node adminToolDataBuilder.js --rewards --ui-lists
```

### 특정 REWARD_TYPE 아이템이 없음

CMS 테이블 파일이 존재하는지 확인:

- `cms/server/Item.json`
- `cms/server/Ship.json`
- `cms/server/Mate.json`
- 등등...

## 📝 참고 문서

- `ADMIN_TOOL_USAGE.md` - 운영툴 통합 가이드
- `REWARD_TYPE_REFERENCE.md` - REWARD_TYPE 상세 설명
- `HOW_IT_WORKS.md` - 동작 원리 설명

## 🎉 완료!

이제 운영툴에서 생성된 7개의 JSON 파일을 사용하면 됩니다!
