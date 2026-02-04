# 운영툴에서 보상 선택 UI가 동작하는 원리

## 🎯 핵심 개념

**`reward-lookup.json` 파일 하나에 모든 정보가 들어있습니다!**

이 파일은 각 REWARD_TYPE별로:

- 어떤 테이블을 참조하는지
- 선택 가능한 아이템 목록이 무엇인지
- ID가 필요한지, 수치만 필요한지

모든 정보를 담고 있습니다.

## 📊 데이터 구조

### reward-lookup.json 구조

```json
{
  "1": {
    "rewardType": 1,
    "rewardTypeName": "POINT",
    "tableFile": "Point.json",
    "hasTable": true,
    "items": [
      { "id": 100001, "name": "두카트" },
      { "id": 100003, "name": "블루젬" }
    ],
    "itemCount": 23
  },
  "33": {
    "rewardType": 33,
    "rewardTypeName": "USER_TITLE",
    "tableFile": "UserTitle.json",
    "hasTable": true,
    "items": [
      { "id": 1400000, "name": "전설적인 도시의 큰 손" },
      { "id": 1400001, "name": "전설의 거상" }
    ],
    "itemCount": 125
  },
  "11": {
    "rewardType": 11,
    "rewardTypeName": "BATTLE_EXP",
    "tableFile": null,
    "hasTable": false,
    "description": "전투 경험치 (amount만큼 전투 경험치 증가)",
    "items": [],
    "itemCount": 0
  }
}
```

## 🔄 동작 흐름

### 1단계: JSON 파일 로드

```javascript
// 운영툴 시작 시 한 번만 로드
fetch('/api/reward-lookup.json')
  .then((res) => res.json())
  .then((data) => {
    window.rewardLookupData = data;
    initializeUI();
  });
```

### 2단계: REWARD_TYPE 드롭다운 채우기

```javascript
function initializeUI() {
  const rewardTypeSelect = document.getElementById('rewardType');

  // rewardLookupData의 모든 타입을 드롭다운에 추가
  Object.values(rewardLookupData).forEach((type) => {
    const option = document.createElement('option');
    option.value = type.rewardType;
    option.textContent = `${type.rewardTypeName} (${type.rewardType})`;

    if (type.hasTable) {
      option.textContent += ` - ${type.itemCount}개 아이템`;
    } else {
      option.textContent += ' - 수치 입력';
    }

    rewardTypeSelect.appendChild(option);
  });
}
```

**결과:**

```
드롭다운 목록:
- POINT (1) - 23개 아이템
- ITEM (2) - 2827개 아이템
- ...
- BATTLE_EXP (11) - 수치 입력
- ...
- USER_TITLE (33) - 125개 아이템
```

### 3단계: 사용자가 REWARD_TYPE 선택

```javascript
rewardTypeSelect.addEventListener('change', function () {
  const selectedType = this.value; // 예: "33"

  // 선택한 타입의 정보 가져오기
  const typeInfo = rewardLookupData[selectedType];

  console.log(typeInfo);
  /*
  {
    "rewardType": 33,
    "rewardTypeName": "USER_TITLE",
    "tableFile": "UserTitle.json",
    "hasTable": true,
    "items": [
      { "id": 1400000, "name": "전설적인 도시의 큰 손" },
      { "id": 1400001, "name": "전설의 거상" },
      ...125개
    ],
    "itemCount": 125
  }
  */
});
```

### 4단계: 아이템 목록 채우기

```javascript
function onRewardTypeChange() {
  const selectedType = document.getElementById('rewardType').value;
  const typeInfo = rewardLookupData[selectedType];

  if (typeInfo.hasTable) {
    // 테이블이 있으면 아이템 드롭다운 표시
    showItemDropdown(typeInfo.items);
  } else {
    // 테이블이 없으면 수치 입력만 표시
    showAmountInput(typeInfo.description);
  }
}

function showItemDropdown(items) {
  const itemSelect = document.getElementById('itemId');
  itemSelect.innerHTML = '<option value="">선택하세요</option>';

  // items 배열을 드롭다운에 채우기
  items.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `[${item.id}] ${item.name}`;
    itemSelect.appendChild(option);
  });

  itemSelect.style.display = 'block';
}
```

**결과 (USER_TITLE 선택 시):**

```
아이템 드롭다운:
- [1400000] 전설적인 도시의 큰 손
- [1400001] 전설의 거상
- [1400002] 해전의 지배자
- [1400003] 시대의 모험가
- ...125개
```

## 💡 핵심 포인트

### Q: 어떻게 USER_TITLE을 선택하면 칭호 목록이 나오는지?

**A: `reward-lookup.json` 파일에 이미 모든 칭호 목록이 들어있기 때문입니다!**

```javascript
// USER_TITLE (33)을 선택하면
const typeInfo = rewardLookupData['33'];

// typeInfo.items에 이미 125개의 칭호가 들어있음
typeInfo.items = [
  { id: 1400000, name: '전설적인 도시의 큰 손' },
  { id: 1400001, name: '전설의 거상' },
  // ...123개 더
];

// 이걸 그대로 드롭다운에 채우면 끝!
```

### Q: 매번 서버에서 칭호 목록을 가져와야 하나?

**A: 아니요! `reward-lookup.json` 파일 하나만 로드하면 됩니다.**

```javascript
// 앱 시작 시 한 번만 로드
const rewardLookupData = await fetch('/api/reward-lookup.json').then((r) => r.json());

// 이후에는 메모리에서 바로 사용
const userTitles = rewardLookupData['33'].items; // 즉시 사용 가능
const points = rewardLookupData['1'].items; // 즉시 사용 가능
const ships = rewardLookupData['6'].items; // 즉시 사용 가능
```

### Q: CMS 파일이 업데이트되면?

**A: 빌더를 다시 실행해서 `reward-lookup.json`을 재생성하면 됩니다.**

```bash
# CMS 파일 업데이트 후
cd server/node/tools
node rewardLookupBuilder.js

# 새로운 reward-lookup.json 생성됨
# 운영툴에 복사하면 끝!
```

## 🎨 실제 구현 예제

### React 예제

```jsx
import React, { useState, useEffect } from 'react';
import rewardLookupData from './reward-lookup.json';

function RewardSelector() {
  const [rewardType, setRewardType] = useState('');
  const [itemId, setItemId] = useState('');

  // 선택된 타입의 정보
  const typeInfo = rewardType ? rewardLookupData[rewardType] : null;

  return (
    <div>
      {/* 1. REWARD_TYPE 선택 */}
      <select onChange={(e) => setRewardType(e.target.value)}>
        <option value="">보상 타입 선택</option>
        {Object.values(rewardLookupData).map((type) => (
          <option key={type.rewardType} value={type.rewardType}>
            {type.rewardTypeName} ({type.rewardType})
            {type.hasTable ? ` - ${type.itemCount}개` : ' - 수치 입력'}
          </option>
        ))}
      </select>

      {/* 2. 아이템 선택 (hasTable이 true인 경우만) */}
      {typeInfo?.hasTable && (
        <select onChange={(e) => setItemId(e.target.value)}>
          <option value="">아이템 선택</option>
          {typeInfo.items.map((item) => (
            <option key={item.id} value={item.id}>
              [{item.id}] {item.name}
            </option>
          ))}
        </select>
      )}

      {/* 3. 수치 입력 (hasTable이 false인 경우) */}
      {typeInfo && !typeInfo.hasTable && (
        <div>
          <p>{typeInfo.description}</p>
          <input type="number" placeholder="수치 입력" />
        </div>
      )}
    </div>
  );
}
```

### Vue 예제

```vue
<template>
  <div>
    <!-- REWARD_TYPE 선택 -->
    <select v-model="rewardType">
      <option value="">보상 타입 선택</option>
      <option v-for="type in allTypes" :key="type.rewardType" :value="type.rewardType">
        {{ type.rewardTypeName }} ({{ type.rewardType }})
        {{ type.hasTable ? ` - ${type.itemCount}개` : ' - 수치 입력' }}
      </option>
    </select>

    <!-- 아이템 선택 -->
    <select v-if="selectedTypeInfo?.hasTable" v-model="itemId">
      <option value="">아이템 선택</option>
      <option v-for="item in selectedTypeInfo.items" :key="item.id" :value="item.id">
        [{{ item.id }}] {{ item.name }}
      </option>
    </select>
  </div>
</template>

<script>
import rewardLookupData from './reward-lookup.json';

export default {
  data() {
    return {
      rewardLookupData,
      rewardType: '',
      itemId: '',
    };
  },
  computed: {
    allTypes() {
      return Object.values(this.rewardLookupData);
    },
    selectedTypeInfo() {
      return this.rewardType ? this.rewardLookupData[this.rewardType] : null;
    },
  },
};
</script>
```

## 📝 요약

1. **빌더 실행** → `reward-lookup.json` 생성
2. **운영툴에서 JSON 로드** → 모든 정보 메모리에 저장
3. **REWARD_TYPE 선택** → `rewardLookupData[선택한타입]`으로 정보 가져오기
4. **아이템 목록 채우기** → `typeInfo.items` 배열을 드롭다운에 표시
5. **완료!**

**핵심: CMS 파일을 직접 읽지 않고, 미리 생성된 JSON 파일만 사용합니다!**

## 🔗 실제 동작 확인

`server/node/tools/example-admin-ui.html` 파일을 브라우저에서 열어보세요.
실제로 어떻게 동작하는지 직접 확인할 수 있습니다!

```bash
# 브라우저에서 열기
open server/node/tools/example-admin-ui.html

# 또는 파일 경로로 직접 열기
file:///c:/work/uwo/game/server/node/tools/example-admin-ui.html
```
