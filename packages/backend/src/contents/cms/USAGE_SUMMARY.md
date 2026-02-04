# 보상 룩업 테이블 빌더 - 사용 요약

## 🎯 목적

운영툴에서 보상 아이템을 선택하는 UI를 만들기 위한 데이터를 생성합니다.
**게임 코드에 전혀 의존하지 않고** CMS JSON 파일만으로 독립적으로 동작합니다.

## ⚡ 빠른 시작 (3단계)

### 1단계: 빌더 실행

```bash
cd server/node/tools
node rewardLookupBuilder.js
```

**결과:**

- ✅ `reward-lookup.json` 생성 (운영툴에서 사용)
- ✅ `reward-lookup.html` 생성 (브라우저에서 확인)

### 2단계: 예제 UI 확인

브라우저에서 `example-admin-ui.html` 파일을 열어보세요.
실제 동작하는 보상 선택 UI를 확인할 수 있습니다.

### 3단계: 운영툴에 통합

생성된 `reward-lookup.json` 파일을 운영툴 프로젝트에 복사하고 사용하세요.

```javascript
const rewardLookupData = require('./reward-lookup.json');

// REWARD_TYPE 33 (USER_TITLE)의 아이템 목록
const userTitles = rewardLookupData['33'].items;
// [{ id: 1400000, name: "전설적인 도시의 큰 손" }, ...]
```

## 📊 생성된 데이터 예시

### USER_TITLE (칭호) - REWARD_TYPE 33

```json
{
  "33": {
    "rewardType": 33,
    "rewardTypeName": "USER_TITLE",
    "tableFile": "UserTitle.json",
    "hasTable": true,
    "description": null,
    "items": [
      {
        "id": 1400000,
        "name": "전설적인 도시의 큰 손"
      },
      {
        "id": 1400001,
        "name": "전설의 거상"
      }
    ],
    "itemCount": 125
  }
}
```

### POINT (포인트) - REWARD_TYPE 1

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
  }
}
```

### BATTLE_EXP (전투 경험치) - REWARD_TYPE 11

```json
{
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

## 🎨 운영툴 UI 구현 방법

### 기본 로직

```javascript
// 1. 데이터 로드
const rewardLookupData = require('./reward-lookup.json');

// 2. 사용자가 REWARD_TYPE 선택
const selectedRewardType = 33; // USER_TITLE

// 3. 해당 타입 정보 가져오기
const typeInfo = rewardLookupData[selectedRewardType];

// 4. 테이블 보유 여부에 따라 UI 분기
if (typeInfo.hasTable) {
  // 드롭다운으로 아이템 선택
  const items = typeInfo.items;
  // UI에 items 배열을 드롭다운으로 표시
} else {
  // 수치만 입력받음
  // UI에 숫자 입력 필드만 표시
}

// 5. 최종 데이터 생성
const reward = {
  type: selectedRewardType,
  id: selectedItemId, // hasTable이 false면 0
  quantity: quantity,
};
```

### React 예제 (간단 버전)

```jsx
import React, { useState } from 'react';
import rewardLookupData from './reward-lookup.json';

function RewardSelector() {
  const [rewardType, setRewardType] = useState('');
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState(1);

  const typeInfo = rewardType ? rewardLookupData[rewardType] : null;

  return (
    <div>
      {/* 1. REWARD_TYPE 선택 */}
      <select value={rewardType} onChange={(e) => setRewardType(e.target.value)}>
        <option value="">보상 타입 선택</option>
        {Object.values(rewardLookupData).map((type) => (
          <option key={type.rewardType} value={type.rewardType}>
            {type.rewardTypeName} ({type.rewardType})
          </option>
        ))}
      </select>

      {/* 2. 아이템 선택 (테이블이 있는 경우만) */}
      {typeInfo?.hasTable && (
        <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
          <option value="">아이템 선택</option>
          {typeInfo.items.map((item) => (
            <option key={item.id} value={item.id}>
              [{item.id}] {item.name}
            </option>
          ))}
        </select>
      )}

      {/* 3. 수량 입력 */}
      <input
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(parseInt(e.target.value))}
      />

      {/* 4. 결과 */}
      <pre>{JSON.stringify({ type: rewardType, id: itemId, quantity }, null, 2)}</pre>
    </div>
  );
}
```

## 📋 주요 REWARD_TYPE 목록

### 테이블 보유 (드롭다운 필요)

| Type | 이름       | 아이템 수 | 설명              |
| ---- | ---------- | --------- | ----------------- |
| 1    | POINT      | 23        | 두카트, 블루젬 등 |
| 2    | ITEM       | 2,827     | 일반 아이템       |
| 6    | SHIP       | 699       | 선박              |
| 7    | MATE       | 1,407     | 항해사            |
| 33   | USER_TITLE | 125       | 칭호              |
| 36   | PET        | 20        | 반려동물          |

### 수치 입력만 (드롭다운 불필요)

| Type | 이름          | 설명        |
| ---- | ------------- | ----------- |
| 11   | BATTLE_EXP    | 전투 경험치 |
| 12   | TRADE_EXP     | 교역 경험치 |
| 13   | ADVENTURE_EXP | 모험 경험치 |
| 17   | SAILOR        | 선원 수     |
| 19   | ENERGY        | 행동력      |

## 🔍 검색 기능 구현

아이템이 많은 경우 검색 기능을 추가하세요:

```javascript
function searchItems(items, query) {
  const lowerQuery = query.toLowerCase();
  return items.filter(
    (item) =>
      item.name.toLowerCase().includes(lowerQuery) || item.id.toString().includes(lowerQuery)
  );
}

// 사용 예
const searchResults = searchItems(typeInfo.items, '전설');
// [{ id: 1400000, name: "전설적인 도시의 큰 손" }, ...]
```

## 🌐 API 서버 통합

### Express.js 엔드포인트

```javascript
const express = require('express');
const rewardLookupData = require('./reward-lookup.json');

const app = express();

// 전체 룩업 테이블
app.get('/api/rewards/lookup', (req, res) => {
  res.json(rewardLookupData);
});

// 특정 타입의 아이템 목록
app.get('/api/rewards/:type/items', (req, res) => {
  const typeInfo = rewardLookupData[req.params.type];
  res.json(typeInfo ? typeInfo.items : []);
});

// 아이템 검색
app.get('/api/rewards/:type/search', (req, res) => {
  const typeInfo = rewardLookupData[req.params.type];
  const query = req.query.q || '';

  if (!typeInfo || !typeInfo.hasTable) {
    return res.json([]);
  }

  const results = typeInfo.items.filter(
    (item) =>
      item.name.toLowerCase().includes(query.toLowerCase()) || item.id.toString().includes(query)
  );

  res.json(results);
});

app.listen(3000);
```

## 📤 최종 보상 데이터 형식

운영툴에서 게임 서버로 전송할 데이터:

```json
{
  "type": 33,
  "id": 1400000,
  "quantity": 1
}
```

**필드 설명:**

- `type`: REWARD_TYPE 값 (숫자)
- `id`: 아이템 ID (hasTable이 false면 0 또는 생략)
- `quantity`: 수량

## 🔄 데이터 업데이트

CMS 파일이 변경되면 빌더를 다시 실행하세요:

```bash
node rewardLookupBuilder.js
```

## 📁 파일 설명

| 파일                              | 용도                            |
| --------------------------------- | ------------------------------- |
| `rewardLookupBuilder.js`          | 빌더 스크립트 (실행 파일)       |
| `reward-lookup.json`              | 생성된 데이터 (운영툴에서 사용) |
| `reward-lookup.html`              | 생성된 HTML (확인용)            |
| `example-admin-ui.html`           | 실제 동작하는 UI 예제           |
| `README.md`                       | 상세 문서                       |
| `ADMIN_TOOL_INTEGRATION_GUIDE.md` | 통합 가이드                     |
| `USAGE_SUMMARY.md`                | 이 파일 (빠른 참조)             |

## 💡 핵심 포인트

1. ✅ **완전 독립**: 게임 코드 의존성 없음
2. ✅ **간단 실행**: `node rewardLookupBuilder.js` 한 줄로 끝
3. ✅ **JSON 출력**: 운영툴에서 바로 사용 가능
4. ✅ **HTML 출력**: 브라우저에서 확인 가능
5. ✅ **예제 제공**: 실제 동작하는 UI 예제 포함
6. ✅ **검색 지원**: 아이템 검색 기능 구현 예제 제공

## 🆘 도움말

더 자세한 내용은 다음 문서를 참고하세요:

- **README.md**: 전체 문서
- **ADMIN_TOOL_INTEGRATION_GUIDE.md**: React, Vue, Vanilla JS 예제
- **example-admin-ui.html**: 실제 동작하는 UI

## 📞 문의

문제가 발생하면 다음을 확인하세요:

1. CMS 디렉토리 경로가 올바른지 확인
2. `json5` 패키지가 설치되어 있는지 확인
3. 생성된 JSON 파일이 올바른지 확인

```bash
# json5 패키지 설치
npm install json5

# 커스텀 경로로 실행
node rewardLookupBuilder.js --cms-dir /path/to/cms/server
```
