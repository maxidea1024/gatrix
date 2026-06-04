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

> **Note:** `EmptyPlaceholder` (`@/components/common/EmptyPlaceholder`) exists but is for table-row-level empty states. For page-level empty states, always prefer `EmptyPagePlaceholder`.

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
