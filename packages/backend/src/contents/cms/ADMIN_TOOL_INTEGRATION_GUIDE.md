# 운영툴 보상 선택 UI 통합 가이드

## 개요

이 가이드는 운영툴에서 보상 아이템을 선택하는 UI를 구현하는 방법을 설명합니다.
게임 코드에 의존하지 않고 완전히 독립적으로 동작합니다.

## 1. 룩업 테이블 생성

### 1.1 빌더 실행

```bash
cd server/node/tools
node rewardLookupBuilder.js
```

이 명령은 다음 파일들을 생성합니다:

- `reward-lookup.json`: 운영툴에서 사용할 JSON 데이터
- `reward-lookup.html`: 브라우저에서 확인할 수 있는 HTML 파일

### 1.2 옵션

```bash
# 출력 파일 경로 지정
node rewardLookupBuilder.js \
  --output-json /path/to/output.json \
  --output-html /path/to/output.html \
  --cms-dir /path/to/cms/server
```

## 2. 생성된 데이터 구조

### 2.1 JSON 구조

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
    "itemCount": 10
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
    "itemCount": 500
  }
}
```

## 3. 운영툴 UI 구현 예제

### 3.1 React 예제

```jsx
import React, { useState, useEffect } from 'react';
import rewardLookupData from './reward-lookup.json';

function RewardSelector() {
  const [selectedRewardType, setSelectedRewardType] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState(1);

  // REWARD_TYPE 목록
  const rewardTypes = Object.values(rewardLookupData);

  // 선택된 REWARD_TYPE의 정보
  const selectedTypeInfo = selectedRewardType ? rewardLookupData[selectedRewardType] : null;

  // 선택 가능한 아이템 목록
  const availableItems = selectedTypeInfo?.items || [];

  return (
    <div className="reward-selector">
      <h3>보상 선택</h3>

      {/* Step 1: REWARD_TYPE 선택 */}
      <div className="form-group">
        <label>보상 타입:</label>
        <select
          value={selectedRewardType}
          onChange={(e) => {
            setSelectedRewardType(e.target.value);
            setSelectedItemId(''); // 아이템 선택 초기화
          }}
        >
          <option value="">선택하세요</option>
          {rewardTypes.map((type) => (
            <option key={type.rewardType} value={type.rewardType}>
              {type.rewardTypeName} ({type.rewardType})
              {type.hasTable ? ` - ${type.itemCount}개 아이템` : ' - 수치 입력'}
            </option>
          ))}
        </select>
      </div>

      {/* Step 2: 아이템 선택 또는 수치 입력 */}
      {selectedTypeInfo && (
        <>
          {selectedTypeInfo.hasTable ? (
            // 테이블이 있는 경우: 드롭다운으로 아이템 선택
            <div className="form-group">
              <label>아이템 선택:</label>
              <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)}>
                <option value="">선택하세요</option>
                {availableItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    [{item.id}] {item.name}
                  </option>
                ))}
              </select>
              <p className="help-text">총 {selectedTypeInfo.itemCount}개의 아이템이 있습니다.</p>
            </div>
          ) : (
            // 테이블이 없는 경우: 설명 표시
            <div className="form-group">
              <p className="info-text">
                {selectedTypeInfo.description || '이 보상 타입은 아이템 ID가 필요하지 않습니다.'}
              </p>
            </div>
          )}

          {/* Step 3: 수량 입력 */}
          <div className="form-group">
            <label>수량:</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            />
          </div>

          {/* 선택 결과 표시 */}
          <div className="result">
            <h4>선택된 보상:</h4>
            <pre>
              {JSON.stringify(
                {
                  rewardType: selectedRewardType,
                  rewardTypeName: selectedTypeInfo.rewardTypeName,
                  itemId: selectedItemId || null,
                  itemName: availableItems.find((i) => i.id == selectedItemId)?.name || null,
                  quantity: quantity,
                },
                null,
                2
              )}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}

export default RewardSelector;
```

### 3.2 Vue.js 예제

```vue
<template>
  <div class="reward-selector">
    <h3>보상 선택</h3>

    <!-- REWARD_TYPE 선택 -->
    <div class="form-group">
      <label>보상 타입:</label>
      <select v-model="selectedRewardType" @change="onRewardTypeChange">
        <option value="">선택하세요</option>
        <option v-for="type in rewardTypes" :key="type.rewardType" :value="type.rewardType">
          {{ type.rewardTypeName }} ({{ type.rewardType }})
          {{ type.hasTable ? ` - ${type.itemCount}개 아이템` : ' - 수치 입력' }}
        </option>
      </select>
    </div>

    <!-- 아이템 선택 또는 수치 입력 -->
    <div v-if="selectedTypeInfo">
      <div v-if="selectedTypeInfo.hasTable" class="form-group">
        <label>아이템 선택:</label>
        <select v-model="selectedItemId">
          <option value="">선택하세요</option>
          <option v-for="item in availableItems" :key="item.id" :value="item.id">
            [{{ item.id }}] {{ item.name }}
          </option>
        </select>
      </div>

      <div v-else class="form-group">
        <p class="info-text">
          {{ selectedTypeInfo.description || '이 보상 타입은 아이템 ID가 필요하지 않습니다.' }}
        </p>
      </div>

      <!-- 수량 입력 -->
      <div class="form-group">
        <label>수량:</label>
        <input type="number" min="1" v-model.number="quantity" />
      </div>
    </div>
  </div>
</template>

<script>
import rewardLookupData from './reward-lookup.json';

export default {
  name: 'RewardSelector',
  data() {
    return {
      rewardLookupData,
      selectedRewardType: '',
      selectedItemId: '',
      quantity: 1,
    };
  },
  computed: {
    rewardTypes() {
      return Object.values(this.rewardLookupData);
    },
    selectedTypeInfo() {
      return this.selectedRewardType ? this.rewardLookupData[this.selectedRewardType] : null;
    },
    availableItems() {
      return this.selectedTypeInfo?.items || [];
    },
  },
  methods: {
    onRewardTypeChange() {
      this.selectedItemId = '';
    },
  },
};
</script>
```

### 3.3 순수 JavaScript (Vanilla JS) 예제

```html
<!DOCTYPE html>
<html>
  <head>
    <title>보상 선택기</title>
    <style>
      .form-group {
        margin: 15px 0;
      }
      label {
        display: block;
        margin-bottom: 5px;
        font-weight: bold;
      }
      select,
      input {
        padding: 8px;
        width: 300px;
      }
    </style>
  </head>
  <body>
    <div id="reward-selector">
      <h3>보상 선택</h3>

      <div class="form-group">
        <label>보상 타입:</label>
        <select id="rewardType"></select>
      </div>

      <div id="itemSelector" class="form-group" style="display:none;">
        <label>아이템 선택:</label>
        <select id="itemId"></select>
      </div>

      <div id="description" class="form-group" style="display:none;">
        <p id="descriptionText"></p>
      </div>

      <div class="form-group">
        <label>수량:</label>
        <input type="number" id="quantity" min="1" value="1" />
      </div>

      <div id="result"></div>
    </div>

    <script>
      // reward-lookup.json 데이터를 로드
      fetch('reward-lookup.json')
        .then((response) => response.json())
        .then((rewardLookupData) => {
          initRewardSelector(rewardLookupData);
        });

      function initRewardSelector(rewardLookupData) {
        const rewardTypeSelect = document.getElementById('rewardType');
        const itemSelector = document.getElementById('itemSelector');
        const itemIdSelect = document.getElementById('itemId');
        const description = document.getElementById('description');
        const descriptionText = document.getElementById('descriptionText');

        // REWARD_TYPE 옵션 추가
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '선택하세요';
        rewardTypeSelect.appendChild(defaultOption);

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

        // REWARD_TYPE 변경 이벤트
        rewardTypeSelect.addEventListener('change', function () {
          const selectedType = this.value;

          if (!selectedType) {
            itemSelector.style.display = 'none';
            description.style.display = 'none';
            return;
          }

          const typeInfo = rewardLookupData[selectedType];

          if (typeInfo.hasTable) {
            // 아이템 선택 드롭다운 표시
            itemSelector.style.display = 'block';
            description.style.display = 'none';

            // 아이템 옵션 추가
            itemIdSelect.innerHTML = '<option value="">선택하세요</option>';
            typeInfo.items.forEach((item) => {
              const option = document.createElement('option');
              option.value = item.id;
              option.textContent = `[${item.id}] ${item.name}`;
              itemIdSelect.appendChild(option);
            });
          } else {
            // 설명 표시
            itemSelector.style.display = 'none';
            description.style.display = 'block';
            descriptionText.textContent =
              typeInfo.description || '이 보상 타입은 아이템 ID가 필요하지 않습니다.';
          }
        });
      }
    </script>
  </body>
</html>
```

## 4. API 서버 통합

### 4.1 Express.js 예제

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
  const rewardType = req.params.rewardType;
  const typeInfo = rewardLookupData[rewardType];

  if (!typeInfo) {
    return res.status(404).json({ error: 'Reward type not found' });
  }

  res.json({
    rewardType: typeInfo.rewardType,
    rewardTypeName: typeInfo.rewardTypeName,
    hasTable: typeInfo.hasTable,
    items: typeInfo.items,
  });
});

// 아이템 검색
app.get('/api/rewards/:rewardType/search', (req, res) => {
  const rewardType = req.params.rewardType;
  const query = req.query.q?.toLowerCase() || '';
  const typeInfo = rewardLookupData[rewardType];

  if (!typeInfo || !typeInfo.hasTable) {
    return res.status(404).json({ error: 'Reward type not found or has no items' });
  }

  const filteredItems = typeInfo.items.filter(
    (item) => item.name.toLowerCase().includes(query) || item.id.toString().includes(query)
  );

  res.json({
    rewardType: typeInfo.rewardType,
    rewardTypeName: typeInfo.rewardTypeName,
    query: query,
    results: filteredItems,
  });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

## 5. 데이터 업데이트

CMS 데이터가 변경되면 룩업 테이블을 다시 생성해야 합니다:

```bash
# 빌더 재실행
node rewardLookupBuilder.js

# 또는 자동화 스크립트에 포함
npm run build-reward-lookup
```

package.json에 스크립트 추가:

```json
{
  "scripts": {
    "build-reward-lookup": "node tools/rewardLookupBuilder.js"
  }
}
```

## 6. 주의사항

1. **REWARD_TYPE 값 사용**: 드롭다운에서 선택한 값은 숫자(1, 2, 33 등)입니다.
2. **아이템 ID**: `hasTable`이 `true`인 경우에만 아이템 ID를 선택해야 합니다.
3. **데이터 동기화**: CMS 파일이 업데이트되면 룩업 테이블도 재생성해야 합니다.
4. **검색 기능**: 아이템이 많은 경우 검색 기능을 추가하는 것이 좋습니다.

## 7. 완성된 보상 데이터 형식

운영툴에서 서버로 전송할 최종 데이터 형식:

```json
{
  "type": 33,
  "id": 100001,
  "quantity": 1
}
```

- `type`: REWARD_TYPE 값 (숫자)
- `id`: 선택한 아이템 ID (hasTable이 false면 0 또는 null)
- `quantity`: 수량
