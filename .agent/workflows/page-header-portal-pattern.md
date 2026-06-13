# PageHeader Portal Pattern — State Update Pitfall

## 배경

`PageHeader` 컴포넌트는 **Portal 패턴**을 사용합니다. 페이지 컴포넌트에서 `<PageHeader>` 를 렌더링하면, 실제 DOM은 생성되지 않고(`return null`), props가 `PageHeaderContext`에 주입되어 `MainLayout`의 `AppBar`에서 렌더링됩니다.

## 핵심 문제

`PageHeader.tsx`의 `useEffect`는 **성능 최적화**를 위해 props의 identity 변화가 아닌 **의미 있는 변화만** 추적합니다:

```tsx
useEffect(() => {
  setHeaderProps(propsRef.current);
}, [
  // ❌ identity가 아닌 존재 여부만 추적!
  !!props.actions,
  !!props.tabs,
  // ...
  props.titleUpdateTrigger,
  props.actionsUpdateTrigger,
]);
```

### ❌ `!!props.actions`의 함정

`actions` prop 내부의 버튼 상태(`disabled`, `onClick` 핸들러의 closure)가 변경되어도, `!!props.actions`는 항상 `true`이므로 **useEffect가 재실행되지 않습니다**. 이로 인해:

1. **버튼 disabled 상태가 stale** — `isDirty`가 `false`인데도 Save 버튼이 활성화된 채로 남음
2. **onClick 핸들러의 closure가 stale** — `currentQueryId`가 `null`인 시점의 핸들러가 유지되어, 기존 쿼리를 업데이트하지 않고 새 쿼리를 생성 (중복 생성 버그)

## 해결 방법

`actionsUpdateTrigger` prop을 사용하여 actions 내부 상태가 변경될 때 명시적으로 re-push를 트리거합니다:

```tsx
// PageHeaderContext.tsx — interface에 추가
export interface PageHeaderProps {
  // ...
  actionsUpdateTrigger?: any;
}

// PageHeader.tsx — useEffect deps에 추가
useEffect(() => {
  setHeaderProps(propsRef.current);
}, [
  // ... 기존 deps
  props.actionsUpdateTrigger,
]);

// 페이지 컴포넌트에서 사용
<PageHeader
  titleUpdateTrigger={queryName}
  actionsUpdateTrigger={`${isDirty}-${saving}-${currentQueryId}`}
  actions={
    <Button disabled={saving || !isDirty} onClick={handleSave}>
      Save
    </Button>
  }
/>
```

## 체크리스트

`PageHeader`에 `actions`를 전달하는 페이지를 작성하거나 수정할 때:

- [ ] `actions` 내부에서 사용하는 **모든 반응형 상태**를 `actionsUpdateTrigger`에 포함했는가?
- [ ] `title` 내부에서 사용하는 반응형 상태를 `titleUpdateTrigger`에 포함했는가?
- [ ] 특히 `disabled`, `onClick` 핸들러에서 참조하는 상태가 빠지지 않았는가?

## 영향 받는 파일

| 파일 | actionsUpdateTrigger에 포함해야 할 상태 |
|---|---|
| `ArgusLogsPage.tsx` | `isDirty`, `saving`, `currentQueryId` |
| `ArgusDiscoverPage.tsx` | `isDirty`, `saving`, `currentQueryId` |
| `ArgusTraceExplorerPage.tsx` | `isDirty`, `currentQueryId` |
| `ArgusMetricsExplorerPage.tsx` | `isDirty`, `currentQueryId` |
