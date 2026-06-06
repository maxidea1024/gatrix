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

### ⚠️ DO NOT Wrap EmptyPlaceholder in Empty Containers (결과 래퍼(껍데기) 유지 금지)

데이터가 없어 `EmptyPlaceholder`를 보여줄 때, `<Paper>`, `TableHead`, 혹은 헤더 타이틀 등을 렌더링하고 그 안에 `EmptyPlaceholder`를 가두지(Wrap) 마세요. 대신 조건문을 최상위 래퍼 바깥으로 끌어올려, 컨테이너 자체를 렌더링하지 말고 `EmptyPlaceholder`가 해당 블록(카드, 섹션) 전체를 대체하게 하세요.

**❌ 하지 마세요 (불필요하게 겉껍데기가 감싸지는 상태):**
```tsx
// ❌ 카드 껍데기와 헤더를 그려두고 그 내부에 빈 상태를 가두는 형태
<Paper elevation={0} sx={{ border: '...' }}>
  <Typography variant="subtitle2">Top Crash Issues</Typography>
  {!data.length ? (
    <EmptyPlaceholder message="No Data" /> // ❌ 불필요한 테두리와 빈 카드가 남음
  ) : (
    <List>...</List>
  )}
</Paper>

// ❌ 테이블 헤더를 그려두고 그 내부에 빈 상태 표시
<Box sx={{ display: 'grid' }}>
  <Typography>Column 1</Typography>
  <Typography>Column 2</Typography>
</Box>
{data.length === 0 ? <EmptyPlaceholder /> : data.map(...)}
```

**✅ 올바른 패턴 (결과가 비어있을 때 딱 EmptyPlaceholder만 단독 노출):**
```tsx
// ✅ 데이터가 없으면 컨테이너(Paper) 자체를 렌더링하지 않음
{!data.length ? (
  <Box sx={{ mb: 2 }}>
    <EmptyPlaceholder message="No Data" minHeight={150} />
  </Box>
) : (
  <Paper elevation={0} sx={{ border: '...' }}>
    <Typography variant="subtitle2">Top Crash Issues</Typography>
    <List>...</List>
  </Paper>
)}
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

## Sort/Filter Dropdown: Always Use FilterChipSelect

정렬(Sort) 또는 필터(Status, Level 등) 옵션을 드롭다운 형태로 제공할 때, **반드시** `FilterChipSelect` 컴포넌트를 사용하세요. 인라인으로 `ActionChip` + `Menu`, `Button` + `Menu`, 또는 `Box` + `Popover` 조합을 직접 구현하지 마세요.

**Location:** `@/components/common/FilterChipSelect`

**Usage:**
```tsx
import FilterChipSelect from '@/components/common/FilterChipSelect';

const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);

const sortOptions = [
  { value: 'newest', label: t('common.newest') },
  { value: 'oldest', label: t('common.oldest') },
];

<FilterChipSelect
  label={t('argus.issues.sort')}
  value={sort}
  options={sortOptions}
  anchorEl={sortAnchor}
  onOpen={(e) => setSortAnchor(e.currentTarget)}
  onClose={() => setSortAnchor(null)}
  onSelect={(v) => setSort(v)}
/>
```

**Props:**
- `label` (required): 라벨 (예: "정렬", "상태")
- `value` (required): 현재 선택된 값
- `options` (required): `{ value: string; label: string; color?: string }[]`
- `anchorEl` / `onOpen` / `onClose` / `onSelect` (required): Popover 제어

**❌ 하지 마세요:**
```tsx
// ❌ ActionChip + Menu 조합
<ActionChip label={<Box>정렬: {label} <ExpandMoreIcon /></Box>} onClick={...} />
<Menu><MenuItem>...</MenuItem></Menu>

// ❌ Button + Menu 조합
<Button variant="outlined" startIcon={<SortIcon />}>{sortLabel}</Button>
<Menu><MenuItem>...</MenuItem></Menu>

// ❌ 인라인 Box + Popover 조합
<Box onClick={...}><SortIcon /><Typography>최신순</Typography></Box>
<Popover>...</Popover>
```

> **원칙:** 모든 정렬/필터 드롭다운은 `FilterChipSelect`를 사용하여 일관된 `라벨: 값 ∨` 스타일을 유지하세요.

## List State Restoration: Use Zustand Store

목록 페이지(이슈 목록, 릴리스 목록 등)에서 상세 페이지로 이동한 뒤 **브레드크럼으로 복귀**할 때, 이전 검색/필터/페이징 상태가 유지되어야 합니다. 이를 위해 **Zustand 전역 스토어**를 사용합니다.

**기존 스토어:**

| 스토어 | 위치 | 대상 페이지 |
|--------|------|------------|
| `useArgusIssueStore` | `@/hooks/useArgusIssueStore` | ArgusIssuesPage |
| `useArgusReleaseStore` | `@/hooks/useArgusReleaseStore` | ArgusReleasesPage |

**아키텍처:**
- URL SearchParams 대신 **Zustand가 Single Source of Truth** (SSOT)
- 마운트 시 3단계 초기화:
  1. `location.state.fromSidebar` → `resetStore()` (사이드바 클릭 = 초기 상태)
  2. URL에 딥링크 파라미터 있음 → `resetStore()` + `hydrateFromParams()` (다른 페이지에서 이동)
  3. 둘 다 아님 → Zustand 기존 상태 자동 복원 (브레드크럼 복귀)

**새 목록 페이지에 적용할 때:**
```tsx
// 1. 스토어 생성 (hooks/useXxxStore.ts)
import { create } from 'zustand';

const DEFAULTS = { currentPage: 1, search: '', sort: 'date' } as const;

export const useXxxStore = create((set) => ({
  ...DEFAULTS,
  setCurrentPage: (currentPage) => set({ currentPage }),
  setSearch: (search) => set({ search }),
  hydrateFromParams: (params) => set((state) => ({ ...state, ...params })),
  resetStore: () => set({ ...DEFAULTS }),
}));

// 2. 페이지 컴포넌트에서 마운트 초기화
const hasInitialized = useRef(false);

useEffect(() => {
  if (hasInitialized.current) return;
  hasInitialized.current = true;

  if ((location.state as any)?.fromSidebar) {
    resetStore();
    navigate(location.pathname, { replace: true, state: {} });
    return;
  }

  const hasDeepLinkParams = DEEP_LINK_KEYS.some((k) => searchParams.has(k));
  if (hasDeepLinkParams) {
    resetStore();
    // ... hydration logic
    hydrateFromParams(hydration);
    navigate(location.pathname, { replace: true });
  }
}, []);
```

**핵심 규칙:**
- `setSearchParams`를 사용하지 않음 — 모든 상태 변경은 Zustand 액션으로
- 딥링크 하이드레이션 전 반드시 `resetStore()` 호출 (이전 상태 오염 방지)
- `navigate(pathname, { replace: true })` 로 URL 파라미터 strip

## Cross-Page Back Navigation: Use enableAutoBack

상세 페이지(이슈 상세, 릴리스 상세 등)에서 **이전 페이지로 돌아가기**가 필요할 때, `PageHeader`의 `enableAutoBack` prop을 사용합니다.

**위치:** `@/components/common/PageHeader`

**동작:**
- 앱 내 네비게이션으로 진입한 경우: ← 뒤로가기 버튼 표시 (`history.back()`)
- 사이드바에서 직접 진입한 경우: 버튼 숨김 (돌아갈 곳이 없으므로)
- 외부 링크/직접 URL 접속: 버튼 숨김

**사용법:**
```tsx
<PageHeader
  enableAutoBack
  title={...}
  subtitle={...}
/>
```

**설계 원칙:**
- **브레드크럼** = 정적 위치 표시 (현재 페이지가 어디인지: `Issues > 이슈제목`)
- **← 버튼** = 동적 뒤로가기 (실제 이전 페이지: 세션건강, 오버뷰 등)
- 두 가지를 **조합**하여 사용 (브레드크럼 + enableAutoBack)

**❌ 하지 마세요:**
```tsx
// ❌ enableAutoBack={false} 로 명시적 비활성화
<PageHeader enableAutoBack={false} ... />

// ❌ 동적 브레드크럼으로 이전 페이지를 표시하려는 시도
<ArgusBreadcrumbs paths={[
  { label: '세션건강', to: '/argus/sessions' },  // referrer에 따라 동적으로 변경
  { label: issue.title }
]} />
```

**✅ 올바른 패턴:**
```tsx
// ✅ 정적 브레드크럼 + enableAutoBack 조합
<PageHeader
  enableAutoBack
  title={
    <ArgusBreadcrumbs paths={[
      { label: 'Issues', to: '/argus/issues' },
      { label: issue.title }
    ]} size="title" />
  }
/>
```

## Timeline Lazy Loading: Use limit & offset with common.showMore

타임라인(활동 히스토리, 유저 피드백 댓글 등)을 렌더링할 때, 전체 항목을 한 번에 보여주거나 프론트엔드에서 일괄 로드하여 슬라이싱하는 대신, 백엔드에서 필요한 만큼만 가져오고 더 보기 클릭 시 추가 데이터를 점진적으로 호출해 누적하는 **Lazy Loading (더 보기)** 패턴을 사용합니다.

**설계:**
- API 서비스와 백엔드 라우터가 `limit`와 `offset` 파라미터를 지원해야 합니다.
- 프론트엔드에서는 `activities` 배열 상태와 `hasMore` (추가 데이터 존재 여부) 상태를 유지합니다.
- 리소스 ID가 바뀔 때 최초 `limit = 5, offset = 0`으로 데이터 및 `hasMore` 여부를 리셋합니다.
- 더 보기 클릭 시 현재 로드된 개수(`activities.length`)를 `offset`으로 전달하여 다음 5개를 비동기로 가져와 기존 배열 뒤에 병합(`[...prev, ...newData]`)합니다.
- 공용 번역 키 `common.showMore` (ko: `+{{count}}개 더 보기`, en: `Show {{count}} more`)를 활용해 다음 가져올 크기(예: 5)를 표기합니다.

**✅ 올바른 구현 패턴:**
```tsx
const [activities, setActivities] = useState<ArgusActivity[]>([]);
const [loading, setLoading] = useState(false);
const [loadingMore, setLoadingMore] = useState(false);
const [hasMore, setHasMore] = useState(true);

const fetchActivities = useCallback(async (silent = false, customLimit = 5) => {
  if (!silent) setLoading(true);
  try {
    const data = await argusService.getActivity(projectId, resourceId, customLimit, 0);
    setActivities(data);
    setHasMore(data.length === customLimit);
  } catch {
    setActivities([]);
  } finally {
    if (!silent) setLoading(false);
  }
}, [projectId, resourceId]);

useEffect(() => {
  fetchActivities(false, 5);
}, [resourceId, fetchActivities]);

const fetchMoreActivities = async () => {
  if (loadingMore) return;
  setLoadingMore(true);
  try {
    const offset = activities.length;
    const data = await argusService.getActivity(projectId, resourceId, 5, offset);
    if (data.length > 0) {
      setActivities(prev => [...prev, ...data]);
      if (data.length < 5) setHasMore(false);
    } else {
      setHasMore(false);
    }
  } catch {
    // error handling
  } finally {
    setLoadingMore(false);
  }
};

return (
  <Box>
    {activities.map((item, idx) => (
      <TimelineItem key={item.id} isLast={idx === activities.length - 1} ... />
    ))}
    
    {hasMore && (
      <Box sx={{ pt: 1, textAlign: 'center' }}>
        <Link
          component="button"
          variant="caption"
          onClick={fetchMoreActivities}
          disabled={loadingMore}
          sx={{
            fontSize: '0.7rem', cursor: 'pointer',
            color: 'primary.main',
            textDecoration: 'none',
            fontWeight: 600,
            opacity: loadingMore ? 0.5 : 1,
            display: 'inline-flex', alignItems: 'center', gap: 0.5,
            '&:hover': { textDecoration: 'underline' },
          }}
        >
          {loadingMore && <CircularProgress size={10} color="inherit" />}
          {t('common.showMore', { count: 5 })}
        </Link>
      </Box>
    )}
  </Box>
);
```
