---
description: 툴팁 사용 시 SafeTooltip을 사용하는 규칙
---

# SafeTooltip 사용 규칙

MUI의 기본 `Tooltip` 컴포넌트 대신 **`SafeTooltip`** (`@/components/common/SafeTooltip`)을 사용합니다.

## 이유

MUI `Tooltip`은 `Select`, `Menu`, `Popover` 같은 포탈 기반 컴포넌트와 함께 쓸 때 `mouseleave` 이벤트가 정상 전달되지 않아 **툴팁이 사라지지 않는 문제**가 있습니다.

`SafeTooltip`은 hover 감지를 수동으로 처리하고, **클릭 시 자동으로 닫히므로** 이 문제를 해결합니다.

## 사용법

```tsx
import SafeTooltip from '@/components/common/SafeTooltip';

// MUI Tooltip과 동일한 API (drop-in replacement)
<SafeTooltip title="설명 텍스트" placement="top">
  <FormControl>
    <Select ... />
  </FormControl>
</SafeTooltip>
```

## 적용 대상

- `Select`, `Menu`, `Popover` 등 포탈을 여는 컴포넌트를 감싸는 Tooltip
- 클릭 가능한 인터랙티브 요소를 감싸는 Tooltip

## 예외

- 드롭다운 MenuItem 내부의 작은 아이콘 Tooltip (포탈 문제 없음) → MUI `Tooltip` 사용 가능
- 단순 텍스트/아이콘에 대한 Tooltip → MUI `Tooltip` 사용 가능
