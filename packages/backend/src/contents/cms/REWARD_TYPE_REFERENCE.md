# REWARD_TYPE 처리 방식 레퍼런스

이 문서는 `rewardAndPaymentChangeSpec.ts`의 실제 코드를 분석하여 각 REWARD_TYPE이 어떻게 처리되는지 정리한 것입니다.

## 📋 REWARD_TYPE 분류

### 1️⃣ 테이블 기반 타입 (hasTable: true)

이 타입들은 CMS 테이블에서 아이템을 선택해야 합니다.

| Type | 이름                      | 테이블                 | ID 필드 의미         | Amount 의미  | 처리 함수                   |
| ---- | ------------------------- | ---------------------- | -------------------- | ------------ | --------------------------- |
| 1    | POINT                     | Point.json             | Point ID             | 포인트 수량  | opAddPoint                  |
| 2    | ITEM                      | Item.json              | Item ID              | 아이템 개수  | opAddItem                   |
| 3    | DEPART_SUPPLY             | DepartSupply.json      | DepartSupply ID      | 적재량       | opLoadDepartSupply          |
| 4    | TRADE_GOODS               | TradeGoods.json        | TradeGoods ID        | 적재량       | opLoadTradeGoods            |
| 5    | MATE_EQUIP                | CEquip.json            | CEquip ID            | 장비 개수    | opAddMateEquip              |
| 6    | SHIP                      | Ship.json              | Ship ID              | 선박 개수    | opAddShip                   |
| 7    | MATE                      | Mate.json              | Mate ID              | 항해사 개수  | opAddMate                   |
| 8    | SHIP_BLUEPRINT            | ShipBlueprint.json     | ShipBlueprint ID     | (사용 안 함) | opUpgradeShipBlueprint      |
| 9    | SHIP_SLOT_ITEM            | ShipSlot.json          | ShipSlot ID          | 부품 개수    | opAddShipSlotItem           |
| 10   | QUEST_ITEM                | Item.json              | Item ID              | 아이템 개수  | opAddQuestItem              |
| 22   | TAX_FREE_PERMIT           | TaxFreePermit.json     | TaxFreePermit ID     | 면세증 개수  | opAddPalaceTaxFreePermit    |
| 25   | SHIELD_NON_PURCHASE_COUNT | Shield.json            | Shield ID            | 사용 횟수    | opAddShieldNonPurchaseCount |
| 26   | SHIELD_PURCHASE_COUNT     | Shield.json            | Shield ID            | 사용 횟수    | opAddShieldPurchaseCount    |
| 32   | SHIP_CAMOUFLAGE           | ShipCamouflage.json    | ShipCamouflage ID    | (사용 안 함) | opAddShipCamouflage         |
| 33   | USER_TITLE                | UserTitle.json         | UserTitle ID         | (사용 안 함) | opAddUserTitle              |
| 36   | PET                       | Pet.json               | Pet ID               | (사용 안 함) | opAddPet                    |
| 37   | SMUGGLE_GOODS             | SmuggleGoods.json      | SmuggleGoods ID      | 적재량       | opLoadSmuggleGoods          |
| 38   | REWERD_SEASON_ITEMS       | RewardSeasonItems.json | RewardSeasonItems ID | 아이템 개수  | (처리 코드 미확인)          |
| 100  | CAPTURED_SHIP             | Ship.json              | Ship ID              | (사용 안 함) | opAddShip (나포 모드)       |

### 2️⃣ 수치 입력 타입 (hasTable: false)

이 타입들은 ID 없이 amount만 사용합니다.

| Type | 이름                    | ID 필드    | Amount 의미        | 처리 함수                |
| ---- | ----------------------- | ---------- | ------------------ | ------------------------ |
| 11   | BATTLE_EXP              | 사용 안 함 | 전투 경험치 증가량 | opAddRewardExp           |
| 12   | TRADE_EXP               | 사용 안 함 | 교역 경험치 증가량 | opAddRewardExp           |
| 13   | ADVENTURE_EXP           | 사용 안 함 | 모험 경험치 증가량 | opAddRewardExp           |
| 14   | BATTLE_FAME             | 사용 안 함 | 전투 명성 증가량   | opAddFame                |
| 15   | TRADE_FAME              | 사용 안 함 | 교역 명성 증가량   | opAddFame                |
| 16   | ADVENTURE_FAME          | 사용 안 함 | 모험 명성 증가량   | opAddFame                |
| 17   | SAILOR                  | 사용 안 함 | 선원 수 증가량     | opAddSailor              |
| 19   | ENERGY                  | 사용 안 함 | 행동력 증가량      | opAddEnergy              |
| 27   | ARENA_TICKET            | 사용 안 함 | 모의전 입장권 개수 | opAddArenaTicket         |
| 28   | WESTERN_SHIP_BUILD_EXP  | 사용 안 함 | 서양 조선 경험치   | opAddUserShipBuildingExp |
| 29   | ORIENTAL_SHIP_BUILD_EXP | 사용 안 함 | 동양 조선 경험치   | opAddUserShipBuildingExp |
| 31   | CHOICE_BOX              | 사용 안 함 | (특수 처리)        | (특수 처리)              |
| 34   | FREE_SWEEP_TICKET       | 사용 안 함 | 무료 소탕권 개수   | opAddFreeSweepTicket     |
| 35   | BUY_SWEEP_TICKET        | 사용 안 함 | 유료 소탕권 개수   | opAddBuySweepTicket      |
| 101  | SOUND_PACK              | 사용 안 함 | (특수 처리)        | (처리 코드 미확인)       |

### 3️⃣ 특수 타입 (ID 필요하지만 테이블 없음)

| Type | 이름                     | ID 필드 의미 | Amount 의미          | 처리 함수                  |
| ---- | ------------------------ | ------------ | -------------------- | -------------------------- |
| 18   | MATE_INTIMACY_OR_LOYALTY | Mate ID      | 친밀도/충성도 증가량 | opAddMateIntimacyOrLoyalty |

## 🎯 운영툴 UI 구현 가이드

### 패턴 1: 테이블 기반 타입

```javascript
// 예: USER_TITLE (33)
{
  type: 33,
  id: 1400000,  // UserTitle.json에서 선택한 칭호 ID
  quantity: 1   // 보통 1 (칭호는 1개만 지급)
}
```

**UI 구성:**

1. REWARD_TYPE 드롭다운
2. 아이템 선택 드롭다운 (검색 기능 권장)
3. 수량 입력 필드

### 패턴 2: 수치 입력 타입

```javascript
// 예: BATTLE_EXP (11)
{
  type: 11,
  id: 0,        // ID 사용 안 함
  quantity: 1000 // 전투 경험치 1000 증가
}
```

**UI 구성:**

1. REWARD_TYPE 드롭다운
2. 수치 입력 필드 (아이템 선택 없음)
3. 설명 텍스트 표시

### 패턴 3: 특수 타입 (MATE_INTIMACY_OR_LOYALTY)

```javascript
// 예: MATE_INTIMACY_OR_LOYALTY (18)
{
  type: 18,
  id: 200001,   // Mate.json에서 선택한 항해사 ID
  quantity: 100 // 친밀도/충성도 100 증가
}
```

**UI 구성:**

1. REWARD_TYPE 드롭다운
2. 항해사 선택 드롭다운 (Mate.json에서)
3. 증가량 입력 필드

## 📝 실제 코드 예제

### React 컴포넌트

```jsx
function RewardInput({ rewardType, onChange }) {
  const typeInfo = rewardLookupData[rewardType];

  if (!typeInfo) return null;

  if (typeInfo.hasTable) {
    // 패턴 1: 테이블 기반
    return (
      <>
        <Select
          options={typeInfo.items.map((item) => ({
            value: item.id,
            label: `[${item.id}] ${item.name}`,
          }))}
          onChange={(selected) => onChange({ id: selected.value })}
        />
        <Input
          type="number"
          label="수량"
          onChange={(e) => onChange({ quantity: parseInt(e.target.value) })}
        />
      </>
    );
  } else if (rewardType === 18) {
    // 패턴 3: MATE_INTIMACY_OR_LOYALTY
    const mateList = rewardLookupData[7].items; // MATE 테이블
    return (
      <>
        <Select
          options={mateList.map((mate) => ({
            value: mate.id,
            label: `[${mate.id}] ${mate.name}`,
          }))}
          onChange={(selected) => onChange({ id: selected.value })}
        />
        <Input
          type="number"
          label="친밀도/충성도 증가량"
          onChange={(e) => onChange({ quantity: parseInt(e.target.value) })}
        />
      </>
    );
  } else {
    // 패턴 2: 수치 입력
    return (
      <>
        <div className="info">{typeInfo.description}</div>
        <Input
          type="number"
          label="수치"
          onChange={(e) => onChange({ id: 0, quantity: parseInt(e.target.value) })}
        />
      </>
    );
  }
}
```

## 🔍 주의사항

### 1. SHIP_BLUEPRINT (8)

- amount는 사용하지 않음
- 단순히 도면을 업그레이드하는 용도

### 2. USER_TITLE (33), PET (36), SHIP_CAMOUFLAGE (32)

- amount는 보통 1
- 중복 지급 불가능한 아이템

### 3. DEPART_SUPPLY (3), TRADE_GOODS (4), SMUGGLE_GOODS (37)

- amount가 음수일 수 있음 (하역)
- 양수: 적재, 음수: 하역

### 4. MATE_INTIMACY_OR_LOYALTY (18)

- ID 필드에 Mate ID를 지정해야 함
- Mate.json 테이블을 참조하지만 hasTable은 false

### 5. CAPTURED_SHIP (100)

- Ship.json을 참조하지만 별도 처리
- 나포 선박 전용 로직

## 📊 데이터 형식 요약

### 최종 전송 데이터

```typescript
interface RewardData {
  type: number; // REWARD_TYPE 값
  id: number; // 아이템 ID (hasTable이 false면 0)
  quantity: number; // 수량 또는 증가량
}
```

### 예제

```json
[
  { "type": 1, "id": 100001, "quantity": 10000 },
  { "type": 33, "id": 1400000, "quantity": 1 },
  { "type": 11, "id": 0, "quantity": 1000 },
  { "type": 18, "id": 200001, "quantity": 100 }
]
```

## 🔗 참고 파일

- **보상 처리 로직**: `server/node/src/lobbyd/UserChangeTask/rewardAndPaymentChangeSpec.ts` (578-936줄)
- **처리 함수들**: `server/node/src/lobbyd/UserChangeTask/userChangeOperator.ts`
- **REWARD_TYPE 정의**: `server/node/src/cms/rewardDesc.ts`
