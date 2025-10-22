# 보상 룩업 테이블 빌더

## 📋 개요

운영툴에서 보상 아이템을 선택하는 UI를 구현하기 위한 독립 실행형 도구입니다.
게임 코드에 의존하지 않고 CMS JSON 파일만을 사용하여 완전히 독립적으로 동작합니다.

## 🎯 주요 기능

- ✅ **완전 독립 실행**: 게임 코드 의존성 없음 (REWARD_TYPE 등 모두 자체 정의)
- ✅ **CMS 파일 직접 읽기**: JSON/JSON5 파일을 직접 파싱
- ✅ **JSON 출력**: 운영툴 API에서 사용할 수 있는 JSON 데이터 생성
- ✅ **HTML 출력**: 브라우저에서 확인 가능한 시각화된 결과
- ✅ **검색 기능**: 아이템 이름/ID로 검색 가능한 예제 UI 제공

## 📁 파일 구조

```
server/node/tools/
├── rewardLookupBuilder.js          # 메인 빌더 스크립트
├── README.md                        # 이 파일
├── ADMIN_TOOL_INTEGRATION_GUIDE.md # 운영툴 통합 가이드
├── example-admin-ui.html           # 실제 사용 가능한 UI 예제
├── reward-lookup.json              # 생성된 JSON 데이터 (빌더 실행 후)
└── reward-lookup.html              # 생성된 HTML 결과 (빌더 실행 후)
```

## 🚀 빠른 시작

### 1. 빌더 실행

```bash
cd server/node/tools
node rewardLookupBuilder.js
```

### 2. 생성된 파일 확인

- `reward-lookup.json`: 운영툴에서 사용할 JSON 데이터
- `reward-lookup.html`: 브라우저에서 확인할 수 있는 HTML 파일

### 3. 예제 UI 확인

`example-admin-ui.html` 파일을 브라우저에서 열어서 실제 동작을 확인하세요.

## 📊 생성되는 데이터 구조

### JSON 구조

```json
{
  "1": {
    "rewardType": 1,
    "rewardTypeName": "POINT",
    "tableFile": "Point.json",
    "hasTable": true,
    "description": null,
    "items": [
      {
        "id": 100001,
        "name": "두카트"
      },
      {
        "id": 100003,
        "name": "블루젬"
      }
    ],
    "itemCount": 23
  },
  "33": {
    "rewardType": 33,
    "rewardTypeName": "USER_TITLE",
    "tableFile": "UserTitle.json",
    "hasTable": true,
    "description": null,
    "items": [
      {
        "id": 100001,
        "name": "칭호 이름"
      }
    ],
    "itemCount": 125
  },
  "11": {
    "rewardType": 11,
    "rewardTypeName": "BATTLE_EXP",
    "tableFile": null,
    "hasTable": false,
    "description": "Battle experience points",
    "items": [],
    "itemCount": 0
  }
}
```

### 필드 설명

- `rewardType`: REWARD_TYPE 숫자 값 (1, 2, 33 등)
- `rewardTypeName`: REWARD_TYPE 이름 (POINT, ITEM, USER_TITLE 등)
- `tableFile`: 참조하는 CMS 파일 이름 (있는 경우)
- `hasTable`: 테이블 보유 여부 (true/false)
- `description`: 테이블이 없는 경우 설명
- `items`: 선택 가능한 아이템 목록
- `itemCount`: 아이템 개수

## 🎨 운영툴 UI 구현 예제

### 기본 사용 패턴

```javascript
// 1. JSON 데이터 로드
const rewardLookupData = require('./reward-lookup.json');

// 2. REWARD_TYPE 선택
const selectedRewardType = 33; // USER_TITLE

// 3. 해당 타입의 정보 가져오기
const typeInfo = rewardLookupData[selectedRewardType];

// 4. 테이블 보유 여부 확인
if (typeInfo.hasTable) {
  // 드롭다운으로 아이템 선택
  const items = typeInfo.items;
  // items = [{ id: 100001, name: "칭호1" }, ...]
} else {
  // 수치만 입력받음
  console.log(typeInfo.description);
}
```

### React 컴포넌트 예제

```jsx
import rewardLookupData from './reward-lookup.json';

function RewardSelector() {
  const [rewardType, setRewardType] = useState('');
  const [itemId, setItemId] = useState('');
  
  const typeInfo = rewardType ? rewardLookupData[rewardType] : null;
  
  return (
    <div>
      {/* REWARD_TYPE 선택 */}
      <select onChange={(e) => setRewardType(e.target.value)}>
        {Object.values(rewardLookupData).map(type => (
          <option key={type.rewardType} value={type.rewardType}>
            {type.rewardTypeName}
          </option>
        ))}
      </select>
      
      {/* 아이템 선택 (테이블이 있는 경우만) */}
      {typeInfo?.hasTable && (
        <select onChange={(e) => setItemId(e.target.value)}>
          {typeInfo.items.map(item => (
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

더 자세한 예제는 `ADMIN_TOOL_INTEGRATION_GUIDE.md`를 참고하세요.

## 🔧 고급 사용법

### 커스텀 경로 지정

```bash
node rewardLookupBuilder.js \
  --output-json /path/to/output.json \
  --output-html /path/to/output.html \
  --cms-dir /path/to/cms/server
```

### 옵션 설명

- `--output-json <file>`: JSON 출력 파일 경로 (기본: reward-lookup.json)
- `--output-html <file>`: HTML 출력 파일 경로 (기본: reward-lookup.html)
- `--cms-dir <dir>`: CMS 디렉토리 경로 (기본: ../../../cms/server)

### Node.js 모듈로 사용

```javascript
const { buildRewardLookupTable, REWARD_TYPE } = require('./rewardLookupBuilder');

// 룩업 테이블 빌드
const lookupTable = buildRewardLookupTable('/path/to/cms/server');

// 특정 타입의 아이템 가져오기
const userTitles = lookupTable[REWARD_TYPE.USER_TITLE].items;
```

## 📈 통계

현재 지원하는 REWARD_TYPE:

- **총 보상 타입**: 24개
- **테이블 보유**: 18개
- **수치 입력만**: 6개

### 테이블 보유 타입

| REWARD_TYPE | 이름 | 테이블 파일 | 아이템 수 |
|-------------|------|-------------|-----------|
| 1 | POINT | Point.json | 23 |
| 2 | ITEM | Item.json | 2,827 |
| 3 | DEPART_SUPPLY | DepartSupply.json | 4 |
| 4 | TRADE_GOODS | TradeGoods.json | 698 |
| 5 | MATE_EQUIP | CEquip.json | 3,966 |
| 6 | SHIP | Ship.json | 699 |
| 7 | MATE | Mate.json | 1,407 |
| 8 | SHIP_BLUEPRINT | ShipBlueprint.json | 442 |
| 9 | SHIP_SLOT_ITEM | ShipSlot.json | 7,617 |
| 10 | QUEST_ITEM | Item.json | 2,827 |
| 22 | TAX_FREE_PERMIT | TaxFreePermit.json | 18 |
| 25 | SHIELD_NON_PURCHASE_COUNT | Shield.json | 4 |
| 26 | SHIELD_PURCHASE_COUNT | Shield.json | 4 |
| 32 | SHIP_CAMOUFLAGE | ShipCamouflage.json | 31 |
| 33 | USER_TITLE | UserTitle.json | 125 |
| 36 | PET | Pet.json | 20 |
| 37 | SMUGGLE_GOODS | SmuggleGoods.json | 48 |
| 38 | REWERD_SEASON_ITEMS | RewardSeasonItems.json | 810 |

### 수치 입력만 필요한 타입

| REWARD_TYPE | 이름 | 설명 |
|-------------|------|------|
| 11 | BATTLE_EXP | Battle experience points |
| 12 | TRADE_EXP | Trade experience points |
| 13 | ADVENTURE_EXP | Adventure experience points |
| 14 | BATTLE_FAME | Battle fame points |
| 15 | TRADE_FAME | Trade fame points |
| 16 | ADVENTURE_FAME | Adventure fame points |
| 17 | SAILOR | Sailor count |
| 18 | MATE_INTIMACY_OR_LOYALTY | Mate intimacy or loyalty points |
| 19 | ENERGY | Energy points |
| 27 | ARENA_TICKET | Arena ticket count |
| 28 | WESTERN_SHIP_BUILD_EXP | Western ship building experience |
| 29 | ORIENTAL_SHIP_BUILD_EXP | Oriental ship building experience |
| 31 | CHOICE_BOX | Choice box (requires special handling) |
| 34 | FREE_SWEEP_TICKET | Free sweep ticket count |
| 35 | BUY_SWEEP_TICKET | Purchased sweep ticket count |
| 100 | CAPTURED_SHIP | Captured ship (special handling required) |
| 101 | SOUND_PACK | Sound pack |

## 🔄 데이터 업데이트

CMS 파일이 변경되면 룩업 테이블을 다시 생성해야 합니다:

```bash
node rewardLookupBuilder.js
```

자동화를 위해 package.json에 스크립트를 추가할 수 있습니다:

```json
{
  "scripts": {
    "build-reward-lookup": "node tools/rewardLookupBuilder.js"
  }
}
```

## 🌐 운영툴 API 통합

### Express.js 예제

```javascript
const express = require('express');
const rewardLookupData = require('./reward-lookup.json');

const app = express();

// 전체 룩업 테이블 반환
app.get('/api/rewards/lookup', (req, res) => {
  res.json(rewardLookupData);
});

// 특정 REWARD_TYPE의 아이템 목록 반환
app.get('/api/rewards/:rewardType/items', (req, res) => {
  const typeInfo = rewardLookupData[req.params.rewardType];
  if (!typeInfo) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.json(typeInfo);
});
```

## 📝 최종 보상 데이터 형식

운영툴에서 서버로 전송할 데이터 형식:

```json
{
  "type": 33,
  "id": 100001,
  "quantity": 1
}
```

- `type`: REWARD_TYPE 값 (숫자)
- `id`: 아이템 ID (hasTable이 false면 0)
- `quantity`: 수량

## 🐛 문제 해결

### CMS 파일을 찾을 수 없음

```
Warning: Point.json or Point.json5 not found
```

**해결**: `--cms-dir` 옵션으로 올바른 CMS 디렉토리 경로를 지정하세요.

```bash
node rewardLookupBuilder.js --cms-dir /correct/path/to/cms/server
```

### JSON5 파싱 오류

**해결**: `json5` 패키지가 설치되어 있는지 확인하세요.

```bash
npm install json5
```

## 📚 추가 문서

- `ADMIN_TOOL_INTEGRATION_GUIDE.md`: 운영툴 통합 상세 가이드
- `example-admin-ui.html`: 실제 동작하는 UI 예제

## 💡 팁

1. **검색 기능 추가**: 아이템이 많은 경우 검색 기능을 구현하세요 (예제 참고)
2. **디바운싱 적용**: 검색 입력 시 디바운싱을 적용하여 성능 향상
3. **캐싱**: 룩업 테이블을 메모리에 캐싱하여 반복 로딩 방지
4. **자동 업데이트**: CI/CD 파이프라인에 빌더 실행을 포함시켜 자동 업데이트

## 📄 라이선스

COPYRIGHT (C)2017 BY MOTIF CO., LTD. ALL RIGHTS RESERVED.

