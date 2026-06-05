---
description: UI component patterns and conventions to follow
---

# UI Component Patterns

## Empty State: Use EmptyPagePlaceholder for Page-Level Empty States

When displaying an empty state for the main content area of a page (no data, no items, etc.), **ALWAYS** use the `EmptyPagePlaceholder` component. Do NOT wrap it in `<Paper>`.

**Location:** `@/components/common/EmptyPagePlaceholder`

**Usage:**
```tsx
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';

// Basic usage
<EmptyPagePlaceholder message={t('some.emptyMessage')} />

// With subtitle
<EmptyPagePlaceholder
  message={t('some.emptyMessage')}
  subtitle={t('some.emptyDescription')}
/>

// With add button
<EmptyPagePlaceholder
  message={t('some.emptyMessage')}
  onAddClick={handleAdd}
  addButtonLabel={t('some.addButton')}
/>

// With custom icon
<EmptyPagePlaceholder
  icon={<SomeIcon sx={{ fontSize: 48 }} />}
  message={t('some.emptyMessage')}
/>
```

**Props:**
- `message` (required): Main text
- `subtitle` (optional): Sub text
- `icon` (optional): Custom icon (defaults to InboxIcon)
- `onAddClick` (optional): Shows an add button
- `addButtonLabel` (optional): Label for the add button
- `showAddButton` (optional): Whether to show the add button (default: true if onAddClick provided)
- `minHeight` (optional): Minimum height of the container

**DO NOT** manually create empty states with `<Paper>`, `<Box>`, or `<Typography>` - always use `EmptyPagePlaceholder`.

## Section-Level Empty State: Use EmptyPlaceholder

When displaying an empty state for a **section or panel** within a page (e.g., a card, a list inside a tab, a sidebar panel), **ALWAYS** use the `EmptyPlaceholder` component. This is distinct from `EmptyPagePlaceholder` which is for full-page empty states.

**Location:** `@/components/common/EmptyPlaceholder`

**When to use:**
- 데이터가 없는 카드/패널 (예: "커밋 데이터 없음", "배포 데이터 없음")
- 검색 결과 0건인 리스트 섹션
- 탭 내부에서 항목이 없는 경우
- 테이블에서 행이 없는 경우

**Usage:**
```tsx
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';

// Basic usage
<EmptyPlaceholder
  message={t('some.noData', 'No data available')}
/>

// With description
<EmptyPlaceholder
  message={t('some.noData', 'No commit data')}
  description={t('some.noDataHint', 'Associate commits to see author breakdown')}
/>

// With add button
<EmptyPlaceholder
  message={t('some.noItems', 'No items yet')}
  onAddClick={handleAdd}
  addButtonLabel={t('some.addItem', 'Add Item')}
/>

// With custom children
<EmptyPlaceholder message={t('some.noData')}>
  <Button onClick={handleAction}>Custom Action</Button>
</EmptyPlaceholder>
```

**Props:**
- `message` (required): Main message text
- `description` (optional): Sub-text below the message
- `onAddClick` (optional): Shows an add button
- `addButtonLabel` (optional): Label for the add button
- `addButtonVariant` (optional): Button variant (default: 'contained')
- `children` (optional): Custom content instead of the default add button
- `minHeight` (optional): Minimum height
- `sx` (optional): Additional styles

**❌ 하지 마세요:**
```tsx
// ❌ 인라인으로 빈 상태를 직접 만들지 마세요
<Box sx={{ py: 2, textAlign: 'center' }}>
  <SomeIcon sx={{ fontSize: 28, color: 'text.disabled' }} />
  <Typography color="text.disabled">데이터가 없습니다</Typography>
</Box>
```

**✅ EmptyPlaceholder를 사용하세요:**
```tsx
<EmptyPlaceholder
  message={t('some.noData', '데이터가 없습니다')}
  description={t('some.noDataHint', '설명 텍스트')}
/>
```

> **요약:** 페이지 전체가 비었을 때 → `EmptyPagePlaceholder`, 페이지 내부 섹션/카드가 비었을 때 → `EmptyPlaceholder`

## Date Range Selection: Always Use DateRangeSelector

When implementing date/time range selection, **ALWAYS** use the `DateRangeSelector` component. Do NOT create ad-hoc `ToggleButton`, `Select`, or `ButtonGroup` alternatives.

**Location:** `@/components/common/DateRangeSelector`

**Usage:**
```tsx
import DateRangeSelector, {
  DateRangeValue,
  dateRangeToDatePair,
  PRESETS_LOG,           // 1h–90d (logs, audit, crashes)
  PRESETS_FLAG_METRICS,  // 24h–365d (feature flag metrics)
} from '@/components/common/DateRangeSelector';

// State
const [dateRange, setDateRange] = useState<DateRangeValue>({ type: 'preset', preset: '24h' });

// Component
<DateRangeSelector
  value={dateRange}
  onChange={setDateRange}
  presets={PRESETS_LOG}   // or PRESETS_FLAG_METRICS, or custom
  compact                 // optional: narrow trigger button
/>

// Converting to API params
const { start, end } = dateRangeToDatePair(dateRange);
params.dateFrom = start.toISOString();
params.dateTo = end.toISOString();
```

**Key types:**
- `DateRangeValue`: `{ type: 'preset' | 'custom', preset?: string, start?: Date, end?: Date }`
- `dateRangeToDatePair(value)`: Converts any `DateRangeValue` to `{ start: Date, end: Date }`
- `dateRangeToApiParams(value)`: Returns `{ period, start?, end? }` for API query params

**Timezone:** All date calculations respect the user's configured timezone via `getStoredTimezone()` from `@/utils/dateFormat`.

**DO NOT** use the legacy `DateRangePicker` — it has been deleted.

## Search Input: Always Use SearchTextField

When implementing a search input field, **ALWAYS** use the `SearchTextField` component. Do NOT create custom search fields with `TextField` + `InputAdornment` + `SearchIcon`.

**Location:** `@/components/common/SearchTextField`

**Usage:**
```tsx
import SearchTextField from '@/components/common/SearchTextField';

<SearchTextField
  placeholder={t('some.searchPlaceholder')}
  value={searchTerm}
  onChange={(value) => setSearchTerm(value)}
/>

// With custom width
<SearchTextField
  placeholder={t('some.searchPlaceholder')}
  value={searchTerm}
  onChange={(value) => setSearchTerm(value)}
  sx={{ width: 300 }}
/>
```

**Props:**
- `value` (required): Current search value
- `onChange` (required): Callback with the new string value (not event)
- `onClear` (optional): Called when clear button is clicked
- `placeholder` (optional): Placeholder text
- All other `TextFieldProps` are forwarded

**Features:** Built-in search icon, clear button when value exists, rounded pill style, consistent focus/hover animations.

## Page Content Loading: Use PageContentLoader

When a page loads data asynchronously, wrap the content area with `PageContentLoader` to show a loading skeleton and prevent content flickering.

**Location:** `@/components/common/PageContentLoader`

**Usage:**
```tsx
import PageContentLoader from '@/components/common/PageContentLoader';

<PageContentLoader loading={loading}>
  {/* Content that should only show after loading */}
</PageContentLoader>
```

## Pagination: Always Use SimplePagination

When implementing pagination, always use the `SimplePagination` component.

## Clipboard: Always Use copyToClipboardWithNotification

When implementing clipboard copy functionality, always use `copyToClipboardWithNotification`.

## Text Search: Always Apply Debouncing

When implementing text search inputs (e.g., name search), always apply debouncing.

## Browser Dialogs: Never Use alert/prompt

Never use `window.alert()` or `window.prompt()`. Use MUI Dialog components instead.

## Font: Never Set fontFamily Inline

**절대로** 컴포넌트에서 인라인으로 `fontFamily`를 지정하지 마세요. 모든 폰트는 `global.css`와 `ThemeContext.tsx`에서 전역으로 관리됩니다.

**금지 패턴:**
```tsx
// ❌ 이렇게 하지 마세요
<Typography sx={{ fontFamily: 'monospace' }}>...</Typography>
<Box sx={{ fontFamily: '"D2Coding", monospace' }}>...</Box>
<span style={{ fontFamily: 'Consolas, monospace' }}>...</span>
```

**올바른 패턴:**
```tsx
// ✅ 전역 폰트가 자동 적용됩니다. fontFamily 지정 불필요.
<Typography>...</Typography>
<code>monospace가 필요한 텍스트</code>
```

- 기본 폰트(D2Coding + sans-serif fallback)는 `body`에서 전역 적용
- 고정폭이 필요한 경우 `<code>`, `<pre>`, `<kbd>`, `<samp>` 태그 사용
- 외부 라이브러리 스타일 오버라이드 등 **특수한 경우에만** 예외 허용

## Shared Components: No Inline Rendering

동일한 데이터 아이템(이슈, 피드백, 릴리즈 등)을 여러 페이지에서 렌더링할 때, **절대로** 인라인으로 직접 렌더링하지 마세요. 반드시 공용 컴포넌트를 사용하거나, 없으면 만들어서 사용하세요.

**이유:** 인라인 렌더링은 code bloating, 스타일 불일치, 유지보수 비용 증가를 초래합니다.

**기존 공용 아이템 컴포넌트:**

| 컴포넌트 | 위치 | 용도 |
|---------|------|------|
| `IssueListItem` | `@/components/argus/IssueListItem` | 이슈 목록 아이템 (full/compact 모드) |
| `FeedbackListItem` | `@/pages/argus/components/FeedbackListItem` | 피드백 목록 아이템 |
| `EmptyPlaceholder` | `@/components/common/EmptyPlaceholder` | 섹션 빈 상태 |
| `EmptyPagePlaceholder` | `@/components/common/EmptyPagePlaceholder` | 페이지 빈 상태 |

**❌ 하지 마세요:**
```tsx
// ❌ 이슈를 페이지마다 인라인으로 렌더링
topIssues.map(issue => (
  <Box onClick={...} sx={{ display: 'flex', ... }}>
    <Chip label={issue.level} />
    <Typography>{issue.title}</Typography>
    {/* ... 50줄 이상의 중복 렌더링 코드 */}
  </Box>
))
```

**✅ 공용 컴포넌트를 사용하세요:**
```tsx
// ✅ IssueListItem 사용
topIssues.map(issue => (
  <IssueListItem
    key={issue.id}
    issue={issue}
    onClick={() => navigate(`/argus/issues/${projectId}/${issue.id}`)}
    showSparkline
    showLastSeen
    compact  // 위젯/사이드바에서는 compact 모드 사용
  />
))
```

> **원칙:** 새로운 페이지에서 기존 데이터 타입의 리스트 아이템을 렌더링해야 할 때, 먼저 기존 공용 컴포넌트가 있는지 확인하고, 필요한 옵션(compact, showCheckbox 등)이 없으면 기존 컴포넌트에 prop을 추가하세요.
