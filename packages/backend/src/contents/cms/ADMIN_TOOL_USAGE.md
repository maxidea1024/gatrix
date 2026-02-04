# 운영툴에서 보상 선택 UI 구현 가이드

## 🎯 주요 기능

이 빌더는 다음과 같은 기능을 제공합니다:

- ✅ **REWARD_TYPE별 아이템 목록 생성**: 35개 REWARD_TYPE에 대한 완전한 아이템 목록
- ✅ **다국어 지원**: 한국어(kr), 영어(us), 중국어 간체(cn) 3개 언어
- ✅ **아이템 이름 자동 포맷팅**: 플레이스홀더(`{0}`, `{1}` 등)를 실제 이름으로 자동 변환
  - 선박 도면: `{0} 도면` → `타렛테 도면`, `바르카 도면` 등
  - 항해사 계약서: `{0} 계약서` → `조안 페레로 계약서`, `카탈리나 에란초 계약서` 등
  - 시즌 보상 아이템: `RewardSeasonItems 100090001` → `투자 시즌 1 - 투자 시즌 1 종료 상자 (외 3개)` 등
- ✅ **참조 테이블 자동 해석**: Ship, Mate, Character, InvestSeason 등 참조 테이블 자동 조회
- ✅ **UI 목록 데이터 생성**: 국가, 마을, 촌락 검색/선택 UI용 데이터 자동 생성

## 📦 생성된 파일들

빌더를 실행하면 6개의 JSON 파일이 생성됩니다:

### 1. `reward-type-list.json` - REWARD_TYPE 드롭다운용

운영툴에서 REWARD_TYPE 드롭다운을 만들 때 사용합니다.

```json
[
  {
    "value": 1,
    "name": "POINT",
    "nameKey": "REWARD_TYPE_POINT",
    "hasTable": true,
    "tableFile": "Point.json",
    "itemCount": 23,
    "descriptionKey": null
  },
  {
    "value": 33,
    "name": "USER_TITLE",
    "nameKey": "REWARD_TYPE_USER_TITLE",
    "hasTable": true,
    "tableFile": "UserTitle.json",
    "itemCount": 125,
    "descriptionKey": null
  },
  {
    "value": 11,
    "name": "BATTLE_EXP",
    "nameKey": "REWARD_TYPE_BATTLE_EXP",
    "hasTable": false,
    "tableFile": null,
    "itemCount": 0,
    "descriptionKey": "REWARD_TYPE_DESC_BATTLE_EXP"
  }
]
```

### 2. `reward-lookup.json` - 전체 아이템 데이터

각 REWARD_TYPE별 선택 가능한 아이템 목록이 포함되어 있습니다.

```json
{
  "33": {
    "rewardType": 33,
    "rewardTypeName": "USER_TITLE",
    "hasTable": true,
    "items": [
      { "id": 1400000, "name": "전설적인 도시의 큰 손" },
      { "id": 1400001, "name": "전설의 거상" }
    ],
    "itemCount": 125
  }
}
```

### 3. 로컬라이징 파일 (3개 언어)

운영툴의 로컬라이징 시스템에 바로 사용할 수 있는 번역 파일들입니다.

#### `reward-localization-kr.json` - 한국어

```json
{
  "REWARD_TYPE_POINT": "포인트",
  "REWARD_TYPE_USER_TITLE": "칭호",
  "REWARD_TYPE_BATTLE_EXP": "전투 경험치",
  "REWARD_TYPE_DESC_BATTLE_EXP": "전투 경험치 (수치만큼 전투 경험치 증가)"
}
```

#### `reward-localization-us.json` - 영어

```json
{
  "REWARD_TYPE_POINT": "Point",
  "REWARD_TYPE_USER_TITLE": "Title",
  "REWARD_TYPE_BATTLE_EXP": "Battle EXP",
  "REWARD_TYPE_DESC_BATTLE_EXP": "Battle experience points (increases by amount)"
}
```

#### `reward-localization-cn.json` - 간체 중국어

```json
{
  "REWARD_TYPE_POINT": "点数",
  "REWARD_TYPE_USER_TITLE": "称号",
  "REWARD_TYPE_BATTLE_EXP": "战斗经验值",
  "REWARD_TYPE_DESC_BATTLE_EXP": "战斗经验值 (增加指定数值的战斗经验值)"
}
```

## 🎯 운영툴 구현 방법

### 1단계: 파일 로드

```javascript
// 앱 시작 시 한 번만 로드
const rewardTypeList = await fetch('/api/reward-type-list.json').then((r) => r.json());
const rewardLookupData = await fetch('/api/reward-lookup.json').then((r) => r.json());
```

### 2단계: REWARD_TYPE 드롭다운 생성

```javascript
// 로컬라이징 헬퍼 함수 (운영툴에서 제공)
function t(key, defaultValue) {
  return localization.get(key) || defaultValue;
}

// REWARD_TYPE 드롭다운 채우기
function populateRewardTypeDropdown() {
  const select = document.getElementById('rewardType');

  rewardTypeList.forEach((type) => {
    const option = document.createElement('option');
    option.value = type.value;

    // 로컬라이징된 이름 사용
    const localizedName = t(type.nameKey, type.name);
    option.textContent = `${localizedName} (${type.value})`;

    if (type.hasTable) {
      option.textContent += ` - ${type.itemCount}개`;
    } else {
      option.textContent += ' - 수치 입력';
    }

    select.appendChild(option);
  });
}
```

### 3단계: REWARD_TYPE 선택 시 처리

```javascript
function onRewardTypeChange(selectedValue) {
  // reward-type-list.json에서 선택된 타입 정보 가져오기
  const typeInfo = rewardTypeList.find((t) => t.value === selectedValue);

  if (typeInfo.hasTable) {
    // 아이템 선택 드롭다운 표시
    const items = rewardLookupData[selectedValue].items;
    populateItemDropdown(items);
  } else {
    // 수치 입력 필드 표시
    const description = t(typeInfo.descriptionKey, '');
    showAmountInput(description);
  }
}
```

### 4단계: 아이템 드롭다운 채우기

```javascript
function populateItemDropdown(items) {
  const select = document.getElementById('itemId');
  select.innerHTML = '<option value="">선택하세요</option>';

  items.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = `[${item.id}] ${item.name}`;
    select.appendChild(option);
  });

  select.style.display = 'block';
}
```

## 🗺️ UI 목록 데이터 사용 (국가/마을/촌락)

### 6. `ui-list-data.json` - 국가/마을/촌락 검색 UI용

운영툴에서 국가, 마을, 촌락을 검색하거나 선택할 때 사용하는 목록 데이터입니다.

```json
{
  "nations": [
    {
      "id": 10000000,
      "name": "포르투갈"
    },
    {
      "id": 10000001,
      "name": "에스파냐"
    }
  ],
  "towns": [
    {
      "id": 11000000,
      "name": "리스본",
      "nationId": 10000000
    },
    {
      "id": 11000001,
      "name": "세비야",
      "nationId": 10000001
    }
  ],
  "villages": [
    {
      "id": 70500000,
      "name": "스비아인의 마을"
    },
    {
      "id": 70500001,
      "name": "흑해 인근 마을"
    }
  ]
}
```

### UI 목록 데이터 사용 예제

```javascript
// 데이터 로드
import uiListData from './ui-list-data.json';

// 국가 드롭다운 생성
function createNationDropdown() {
  const select = document.getElementById('nationId');
  select.innerHTML = '<option value="">국가 선택</option>';

  uiListData.nations.forEach((nation) => {
    const option = document.createElement('option');
    option.value = nation.id;
    option.textContent = `[${nation.id}] ${nation.name}`;
    select.appendChild(option);
  });
}

// 마을 검색 (국가별 필터링)
function searchTowns(nationId, searchText) {
  let filteredTowns = uiListData.towns;

  // 국가별 필터링
  if (nationId) {
    filteredTowns = filteredTowns.filter((town) => town.nationId === nationId);
  }

  // 텍스트 검색
  if (searchText) {
    filteredTowns = filteredTowns.filter(
      (town) => town.name.includes(searchText) || town.id.toString().includes(searchText)
    );
  }

  return filteredTowns;
}

// 촌락 자동완성
function autocompleteVillage(searchText) {
  return uiListData.villages
    .filter(
      (village) => village.name.includes(searchText) || village.id.toString().includes(searchText)
    )
    .slice(0, 10); // 최대 10개만 표시
}
```

### React 예제 - 국가/마을 선택

```jsx
import React, { useState } from 'react';
import uiListData from './ui-list-data.json';

function LocationSelector() {
  const [selectedNation, setSelectedNation] = useState('');
  const [selectedTown, setSelectedTown] = useState('');

  // 선택된 국가에 속한 마을만 필터링
  const filteredTowns = selectedNation
    ? uiListData.towns.filter((town) => town.nationId === parseInt(selectedNation))
    : uiListData.towns;

  return (
    <div>
      <div>
        <label>국가:</label>
        <select value={selectedNation} onChange={(e) => setSelectedNation(e.target.value)}>
          <option value="">전체</option>
          {uiListData.nations.map((nation) => (
            <option key={nation.id} value={nation.id}>
              [{nation.id}] {nation.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label>마을:</label>
        <select value={selectedTown} onChange={(e) => setSelectedTown(e.target.value)}>
          <option value="">선택하세요</option>
          {filteredTowns.map((town) => (
            <option key={town.id} value={town.id}>
              [{town.id}] {town.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
```

## 🌐 로컬라이징 통합

### 로컬라이징 파일 사용

생성된 3개 언어 파일을 운영툴의 로컬라이징 시스템에 바로 통합할 수 있습니다.

```javascript
// 한국어 로컬라이징 로드
import krLocalization from './reward-localization-kr.json';

// 영어 로컬라이징 로드
import usLocalization from './reward-localization-us.json';

// 중국어 로컬라이징 로드
import cnLocalization from './reward-localization-cn.json';

// 운영툴의 로컬라이징 시스템에 병합
const localizationData = {
  kr: { ...existingKrData, ...krLocalization },
  us: { ...existingUsData, ...usLocalization },
  cn: { ...existingCnData, ...cnLocalization },
};
```

### 로컬라이징 사용

```javascript
// 드롭다운 옵션 생성 시
const localizedName = t('REWARD_TYPE_USER_TITLE');
// 한국어: "칭호"
// 영어: "Title"
// 중국어: "称号"

// 설명 표시 시
const description = t('REWARD_TYPE_DESC_BATTLE_EXP');
// 한국어: "전투 경험치 (수치만큼 전투 경험치 증가)"
// 영어: "Battle experience points (increases by amount)"
// 중국어: "战斗经验值 (增加指定数值的战斗经验值)"
```

## 📝 완전한 예제 (React)

### 기본 예제 - 아이템 이름 한국어만 표시

```jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // 또는 운영툴의 로컬라이징 시스템

function RewardSelector() {
  const { t } = useTranslation();
  const [rewardTypeList, setRewardTypeList] = useState([]);
  const [rewardLookupData, setRewardLookupData] = useState({});
  const [selectedType, setSelectedType] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [amount, setAmount] = useState(1);

  // 데이터 로드
  useEffect(() => {
    Promise.all([
      fetch('/api/reward-type-list.json').then((r) => r.json()),
      fetch('/api/reward-lookup.json').then((r) => r.json()),
    ]).then(([typeList, lookupData]) => {
      setRewardTypeList(typeList);
      setRewardLookupData(lookupData);
    });
  }, []);

  // 선택된 타입 정보
  const selectedTypeInfo = rewardTypeList.find((t) => t.value === parseInt(selectedType));
  const selectedLookupInfo = selectedType ? rewardLookupData[selectedType] : null;

  return (
    <div className="reward-selector">
      <h3>{t('REWARD_SELECTOR_TITLE', '보상 선택')}</h3>

      {/* REWARD_TYPE 드롭다운 */}
      <div className="form-group">
        <label>{t('REWARD_TYPE_LABEL', '보상 타입')}:</label>
        <select
          value={selectedType}
          onChange={(e) => {
            setSelectedType(e.target.value);
            setSelectedItemId('');
          }}
        >
          <option value="">{t('SELECT_PLACEHOLDER', '선택하세요')}</option>
          {rewardTypeList.map((type) => (
            <option key={type.value} value={type.value}>
              {t(type.nameKey, type.name)} ({type.value})
              {type.hasTable ? ` - ${type.itemCount}개` : ` - ${t('AMOUNT_INPUT', '수치 입력')}`}
            </option>
          ))}
        </select>
      </div>

      {/* 아이템 선택 (hasTable이 true인 경우) */}
      {selectedTypeInfo?.hasTable && selectedLookupInfo && (
        <div className="form-group">
          <label>{t('ITEM_SELECT_LABEL', '아이템 선택')}:</label>
          <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)}>
            <option value="">{t('SELECT_PLACEHOLDER', '선택하세요')}</option>
            {selectedLookupInfo.items.map((item) => (
              <option key={item.id} value={item.id}>
                [{item.id}] {item.name} {/* 한국어 이름만 표시 */}
              </option>
            ))}
          </select>
          <p className="help-text">
            {t('TOTAL_ITEMS', '총 {{count}}개의 아이템', { count: selectedLookupInfo.itemCount })}
          </p>
        </div>
      )}

      {/* 수치 입력 (hasTable이 false인 경우) */}
      {selectedTypeInfo && !selectedTypeInfo.hasTable && (
        <div className="form-group">
          <div className="info-box">{t(selectedTypeInfo.descriptionKey, '')}</div>
        </div>
      )}

      {/* 수량/수치 입력 */}
      {selectedTypeInfo && (
        <div className="form-group">
          <label>
            {selectedTypeInfo.hasTable ? t('QUANTITY_LABEL', '수량') : t('AMOUNT_LABEL', '수치')}:
          </label>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value) || 1)}
          />
        </div>
      )}

      {/* 결과 */}
      {selectedType && (
        <div className="result">
          <h4>{t('SELECTED_REWARD', '선택된 보상')}:</h4>
          <pre>
            {JSON.stringify(
              {
                type: parseInt(selectedType),
                id: selectedItemId ? parseInt(selectedItemId) : 0,
                quantity: amount,
              },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}

export default RewardSelector;
```

### 고급 예제 - 아이템 이름 다국어 지원

```jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

function RewardSelectorWithItemLocalization() {
  const { t, i18n } = useTranslation();
  const [rewardTypeList, setRewardTypeList] = useState([]);
  const [rewardLookupData, setRewardLookupData] = useState({});
  const [itemNames, setItemNames] = useState({}); // 언어별 아이템 이름
  const [selectedType, setSelectedType] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [amount, setAmount] = useState(1);

  // 데이터 로드
  useEffect(() => {
    Promise.all([
      fetch('/api/reward-type-list.json').then((r) => r.json()),
      fetch('/api/reward-lookup.json').then((r) => r.json()),
      // 운영툴의 언어별 아이템 이름 테이블 로드
      fetch('/api/item-names.json').then((r) => r.json()),
    ]).then(([typeList, lookupData, itemNamesData]) => {
      setRewardTypeList(typeList);
      setRewardLookupData(lookupData);
      setItemNames(itemNamesData);
    });
  }, []);

  // 현재 언어에 맞는 아이템 이름 가져오기
  const getItemName = (itemId) => {
    const currentLang = i18n.language; // 'kr', 'us', 'cn'

    // 언어별 아이템 이름 테이블에서 가져오기
    if (itemNames[currentLang] && itemNames[currentLang][itemId]) {
      return itemNames[currentLang][itemId];
    }

    // 없으면 한국어 기본값 사용
    const koreanItem = rewardLookupData[selectedType]?.items.find((item) => item.id === itemId);
    return koreanItem?.name || `[${itemId}]`;
  };

  // 선택된 타입 정보
  const selectedTypeInfo = rewardTypeList.find((t) => t.value === parseInt(selectedType));
  const selectedLookupInfo = selectedType ? rewardLookupData[selectedType] : null;

  return (
    <div className="reward-selector">
      <h3>{t('REWARD_SELECTOR_TITLE')}</h3>

      {/* REWARD_TYPE 드롭다운 */}
      <div className="form-group">
        <label>{t('REWARD_TYPE_LABEL')}:</label>
        <select
          value={selectedType}
          onChange={(e) => {
            setSelectedType(e.target.value);
            setSelectedItemId('');
          }}
        >
          <option value="">{t('SELECT_PLACEHOLDER')}</option>
          {rewardTypeList.map((type) => (
            <option key={type.value} value={type.value}>
              {t(type.nameKey)} ({type.value})
              {type.hasTable ? ` - ${type.itemCount}개` : ` - ${t('AMOUNT_INPUT')}`}
            </option>
          ))}
        </select>
      </div>

      {/* 아이템 선택 (다국어 지원) */}
      {selectedTypeInfo?.hasTable && selectedLookupInfo && (
        <div className="form-group">
          <label>{t('ITEM_SELECT_LABEL')}:</label>
          <select value={selectedItemId} onChange={(e) => setSelectedItemId(e.target.value)}>
            <option value="">{t('SELECT_PLACEHOLDER')}</option>
            {selectedLookupInfo.items.map((item) => (
              <option key={item.id} value={item.id}>
                [{item.id}] {getItemName(item.id)} {/* 현재 언어로 표시 */}
              </option>
            ))}
          </select>
          <p className="help-text">{t('TOTAL_ITEMS', { count: selectedLookupInfo.itemCount })}</p>
        </div>
      )}

      {/* 수치 입력 */}
      {selectedTypeInfo && !selectedTypeInfo.hasTable && (
        <div className="form-group">
          <div className="info-box">{t(selectedTypeInfo.descriptionKey)}</div>
        </div>
      )}

      {/* 수량/수치 입력 */}
      {selectedTypeInfo && (
        <div className="form-group">
          <label>{selectedTypeInfo.hasTable ? t('QUANTITY_LABEL') : t('AMOUNT_LABEL')}:</label>
          <input
            type="number"
            min="1"
            value={amount}
            onChange={(e) => setAmount(parseInt(e.target.value) || 1)}
          />
        </div>
      )}

      {/* 결과 */}
      {selectedType && (
        <div className="result">
          <h4>{t('SELECTED_REWARD')}:</h4>
          {selectedItemId && (
            <p>
              {t('SELECTED_ITEM')}: [{selectedItemId}] {getItemName(parseInt(selectedItemId))}
            </p>
          )}
          <pre>
            {JSON.stringify(
              {
                type: parseInt(selectedType),
                id: selectedItemId ? parseInt(selectedItemId) : 0,
                quantity: amount,
              },
              null,
              2
            )}
          </pre>
        </div>
      )}
    </div>
  );
}

export default RewardSelectorWithItemLocalization;
```

### 아이템 이름 테이블 구조 예제

운영툴에서 관리하는 `item-names.json` 파일 구조:

```json
{
  "kr": {
    "1400000": "전설적인 도시의 큰 손",
    "1400001": "전설의 거상",
    "100001": "두카트"
  },
  "us": {
    "1400000": "Legendary City Tycoon",
    "1400001": "Legendary Merchant",
    "100001": "Ducat"
  },
  "cn": {
    "1400000": "传说中的城市大亨",
    "1400001": "传说中的巨商",
    "100001": "杜卡特"
  }
}
```

## 🎨 아이템 이름 다국어 처리 가이드

### 문제 상황

`reward-lookup.json`의 아이템 이름은 **한국어만** 포함되어 있습니다:

```json
{
  "33": {
    "items": [{ "id": 1400000, "name": "전설적인 도시의 큰 손" }]
  }
}
```

### 해결 방법

#### 옵션 1: ID만 표시 (가장 간단)

드롭다운에 아이템 ID만 표시하고, 선택 후 운영툴의 아이템 테이블에서 이름을 가져옵니다.

```jsx
// 드롭다운
<select>
  <option value="1400000">[1400000]</option>
  <option value="1400001">[1400001]</option>
</select>

// 선택 후 표시
<div>
  선택된 아이템: [{selectedItemId}] {getItemNameFromAdminDB(selectedItemId)}
</div>
```

#### 옵션 2: 운영툴의 아이템 테이블 활용 (권장)

운영툴이 이미 게임 아이템 데이터를 가지고 있다면 재사용합니다.

```javascript
// 운영툴의 기존 아이템 조회 API 사용
async function getItemName(itemId, language) {
  const response = await fetch(`/api/items/${itemId}?lang=${language}`);
  const item = await response.json();
  return item.name;
}

// 또는 운영툴의 아이템 캐시 사용
const itemName = adminToolItemCache[language][itemId];
```

#### 옵션 3: CMS 파일에서 직접 생성

운영툴에서 CMS 파일을 읽어서 언어별 아이템 이름 테이블을 생성합니다.

**CMS 파일 구조:**

- 한국어: `cms/server/Item.json`
- 중국어: `cms/server/Item_BCCN.json`
- 영어: 한국어와 동일하거나 별도 번역 필요

**생성 스크립트 예제:**

```javascript
// generateItemNames.js
const fs = require('fs');
const path = require('path');

const cmsDir = path.join(__dirname, '..', '..', 'cms', 'server');

// 한국어 아이템 로드
const itemKr = JSON.parse(fs.readFileSync(path.join(cmsDir, 'Item.json'), 'utf8'));

// 중국어 아이템 로드 (있는 경우)
let itemCn = {};
const itemCnPath = path.join(cmsDir, 'Item_BCCN.json');
if (fs.existsSync(itemCnPath)) {
  itemCn = JSON.parse(fs.readFileSync(itemCnPath, 'utf8'));
}

// 아이템 이름 테이블 생성
const itemNames = {
  kr: {},
  us: {}, // 영어는 별도 번역 필요
  cn: {},
};

// 한국어
Object.values(itemKr).forEach((item) => {
  itemNames.kr[item.id] = item.name;
});

// 중국어
Object.values(itemCn).forEach((item) => {
  itemNames.cn[item.id] = item.name;
});

// 영어 (한국어 복사 또는 별도 번역)
itemNames.us = { ...itemNames.kr };

// 저장
fs.writeFileSync(
  path.join(__dirname, 'item-names.json'),
  JSON.stringify(itemNames, null, 2),
  'utf8'
);

console.log('✅ item-names.json 생성 완료!');
```

**사용:**

```javascript
import itemNames from './item-names.json';

function getItemName(itemId, language) {
  return itemNames[language]?.[itemId] || `[${itemId}]`;
}

// 드롭다운
{
  items.map((item) => (
    <option key={item.id} value={item.id}>
      [{item.id}] {getItemName(item.id, currentLanguage)}
    </option>
  ));
}
```

### 권장 사항

1. **운영툴에 아이템 데이터가 이미 있는 경우**
   - 기존 데이터 재사용 (옵션 2)
   - 추가 작업 불필요

2. **운영툴에 아이템 데이터가 없는 경우**
   - CMS 파일에서 직접 생성 (옵션 3)
   - 한 번만 생성하면 계속 사용 가능

3. **간단하게 시작하려면**
   - ID만 표시 (옵션 1)
   - 나중에 필요하면 이름 추가

## 🔄 데이터 업데이트 프로세스

### 1. CMS 파일 변경 시

```bash
cd server/node/tools
node rewardLookupBuilder.js
```

### 2. 생성된 파일 확인

빌더 실행 후 다음 파일들이 생성됩니다:

```
server/node/tools/
├── reward-lookup.json              (1.7MB)
├── reward-type-list.json           (10KB)
├── reward-localization-kr.json     (2KB)
├── reward-localization-us.json     (2KB)
└── reward-localization-cn.json     (2KB)
```

### 3. 운영툴에 복사

```bash
# 운영툴 프로젝트의 public/api/ 디렉토리에 복사
cp reward-type-list.json /path/to/admin-tool/public/api/
cp reward-lookup.json /path/to/admin-tool/public/api/
cp reward-localization-*.json /path/to/admin-tool/public/api/
```

### 4. (선택) 아이템 이름 테이블 업데이트

옵션 3을 사용하는 경우에만 필요:

```bash
# 아이템 이름 생성 스크립트 실행
node generateItemNames.js
```

### 5. 운영툴 재배포

## 💡 핵심 포인트

### Q: REWARD_TYPE 목록은 어디서 가져오나요?

**A: `reward-type-list.json` 파일에서 가져옵니다!**

```javascript
const rewardTypeList = await fetch('/api/reward-type-list.json').then((r) => r.json());

// 드롭다운 채우기
rewardTypeList.forEach((type) => {
  dropdown.add(
    new Option(
      t(type.nameKey, type.name), // 로컬라이징된 이름
      type.value
    )
  );
});
```

### Q: 로컬라이징은 어떻게 하나요?

**A: `nameKey`와 `descriptionKey`를 사용합니다!**

```javascript
// REWARD_TYPE 이름 로컬라이징
const typeName = t(type.nameKey, type.name);
// nameKey: "REWARD_TYPE_USER_TITLE"
// 한국어: "칭호"
// 영어: "Title"

// 설명 로컬라이징
const description = t(type.descriptionKey, '');
// descriptionKey: "REWARD_TYPE_DESC_BATTLE_EXP"
// 한국어: "전투 경험치 (수치만큼 전투 경험치 증가)"
// 영어: "Battle experience points (increases by amount)"
```

### Q: 아이템 이름도 로컬라이징해야 하나요?

**A: 아이템 이름은 운영툴에서 별도로 처리해야 합니다!**

`reward-lookup.json`의 아이템 이름은 **한국어만** 포함되어 있습니다:

```javascript
// reward-lookup.json의 items 배열
{
  "id": 1400000,
  "name": "전설적인 도시의 큰 손" // 한국어만
}
```

**운영툴에서 처리 방법:**

#### 방법 1: 아이템 ID만 사용 (권장)

```javascript
// reward-lookup.json에서는 ID만 사용
const selectedItemId = 1400000;

// 운영툴의 언어별 아이템 테이블에서 이름 가져오기
const itemName = getItemNameByLanguage(selectedItemId, currentLanguage);
// kr: "전설적인 도시의 큰 손"
// us: "Legendary City Tycoon"
// cn: "传说中的城市大亨"
```

#### 방법 2: 언어별 아이템 이름 매핑 테이블 생성

운영툴에서 CMS 파일을 직접 읽어서 언어별 매핑 테이블을 만듭니다:

```javascript
// 한국어 (Item.json)
const itemNamesKr = {
  1400000: '전설적인 도시의 큰 손',
  1400001: '전설의 거상',
  // ...
};

// 중국어 (Item_BCCN.json)
const itemNamesCn = {
  1400000: '传说中的城市大亨',
  1400001: '传说中的巨商',
  // ...
};

// 영어 (한국어와 동일하거나 별도 번역)
const itemNamesUs = {
  1400000: 'Legendary City Tycoon',
  1400001: 'Legendary Merchant',
  // ...
};

// 사용
const itemName = {
  kr: itemNamesKr,
  us: itemNamesUs,
  cn: itemNamesCn,
}[currentLanguage][itemId];
```

#### 방법 3: 드롭다운에 ID만 표시하고 선택 후 번역

```javascript
// 드롭다운에는 ID만 표시
<select>
  <option value="1400000">[1400000]</option>
  <option value="1400001">[1400001]</option>
</select>

// 선택 후 해당 언어로 이름 표시
<div>
  선택된 아이템: {getItemNameByLanguage(selectedItemId, currentLanguage)}
</div>
```

**권장 사항:**

- 운영툴이 이미 게임 아이템 데이터를 가지고 있다면 그것을 재사용
- 없다면 CMS 파일에서 직접 읽어서 언어별 매핑 테이블 생성
- `reward-lookup.json`의 `name` 필드는 참고용으로만 사용

## 📁 파일 요약

### 필수 파일 (빌더가 생성)

| 파일                          | 용도                      | 크기   | 포함 내용                      |
| ----------------------------- | ------------------------- | ------ | ------------------------------ |
| `reward-type-list.json`       | REWARD_TYPE 드롭다운 생성 | ~10KB  | REWARD_TYPE 목록, 메타데이터   |
| `reward-lookup.json`          | 아이템 ID 목록 조회       | ~1.7MB | 아이템 ID + 한국어 이름        |
| `reward-localization-kr.json` | 한국어 번역               | ~2KB   | REWARD_TYPE 이름/설명 (한국어) |
| `reward-localization-us.json` | 영어 번역                 | ~2KB   | REWARD_TYPE 이름/설명 (영어)   |
| `reward-localization-cn.json` | 중국어 번역               | ~2KB   | REWARD_TYPE 이름/설명 (중국어) |

### 선택 파일 (운영툴에서 생성)

| 파일              | 용도               | 크기   | 생성 방법                |
| ----------------- | ------------------ | ------ | ------------------------ |
| `item-names.json` | 아이템 이름 다국어 | ~500KB | CMS 파일에서 생성 (선택) |

### 로드 전략

**최소 구성:**

- `reward-type-list.json` (필수)
- `reward-lookup.json` (필수)
- `reward-localization-{언어}.json` (필요한 언어만)

**완전 구성 (아이템 이름 다국어 지원):**

- 위 파일들 + `item-names.json` (운영툴에서 생성)

**참고:**

- `reward-lookup.json`의 아이템 이름은 **한국어만** 포함
- 다국어 아이템 이름이 필요하면 운영툴에서 별도 처리 필요
- 자세한 내용은 "아이템 이름 다국어 처리 가이드" 섹션 참고
