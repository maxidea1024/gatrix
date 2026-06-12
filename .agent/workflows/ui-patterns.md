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

// ✅ 반드시 useCallback으로 안정적 참조 생성 (FilterChipSelect는 React.memo)
const handleSortOpen = useCallback((e: React.MouseEvent<HTMLElement>) => setSortAnchor(e.currentTarget), []);
const handleSortClose = useCallback(() => setSortAnchor(null), []);
const handleSortSelect = useCallback((v: string) => setSort(v), []);

<FilterChipSelect
  label={t('argus.issues.sort')}
  value={sort}
  options={sortOptions}
  anchorEl={sortAnchor}
  onOpen={handleSortOpen}
  onClose={handleSortClose}
  onSelect={handleSortSelect}
/>
```

**❌ 인라인 콜백 금지 (FilterChipSelect는 React.memo이므로 memo가 무력화됨):**
```tsx
// ❌ 매 렌더마다 새 함수 참조 → React.memo 무력화
<FilterChipSelect
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

## Styling: Prefer Styled Components over Inline `sx`

컴포넌트의 스타일을 정의할 때, MUI `sx` prop을 인라인으로 사용하지 말고 **`styled()` API로 별도 `.styles.tsx` 파일**에 분리하세요.

**파일 규칙:**
- 스타일 파일은 컴포넌트와 동일한 디렉토리에 `ComponentName.styles.tsx` 이름으로 생성
- `@mui/material/styles`의 `styled`를 사용
- 컴포넌트 파일에서 named import로 가져다 사용

**Location 예시:**
```
components/
  IssueActionBar.tsx          ← 컴포넌트 로직
  IssueActionBar.styles.tsx   ← 스타일 정의
```

**✅ 올바른 패턴 (`.styles.tsx` 파일):**
```tsx
// IssueActionBar.styles.tsx
import { styled, alpha } from '@mui/material/styles';
import { Box, Chip } from '@mui/material';

/** Main container row for the action bar */
export const ActionBarRow = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  paddingTop: 8,
  paddingBottom: 8,
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
}));

/** Chip showing the issue level */
export const LevelChip = styled(Chip, {
  shouldForwardProp: (p) => p !== 'levelColor',
})<{ levelColor: string }>(({ levelColor }) => ({
  fontWeight: 700,
  fontSize: '0.65rem',
  height: 18,
  backgroundColor: alpha(levelColor, 0.12),
  color: levelColor,
}));
```

```tsx
// IssueActionBar.tsx — 컴포넌트에서 import
import { ActionBarRow, LevelChip } from './IssueActionBar.styles';

<ActionBarRow isDark={isDark}>
  <LevelChip levelColor={color} label="Error" />
</ActionBarRow>
```

**❌ 하지 마세요 (인라인 `sx` 남용):**
```tsx
// ❌ 매 렌더마다 새 객체 생성 → Emotion CSS-in-JS 직렬화 반복 → 성능 저하
<Box sx={{
  paddingTop: 8,
  paddingBottom: 8,
  display: 'flex',
  gap: 6,
  alignItems: 'center',
  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
}}>
  <Chip sx={{
    fontWeight: 700,
    fontSize: '0.65rem',
    height: 18,
    backgroundColor: alpha(levelColor, 0.12),
    color: levelColor,
  }} label="Error" />
</Box>
```

**왜 `styled()`가 더 좋은가:**

| | 인라인 `sx` | `styled()` |
|---|---|---|
| **성능** | 매 렌더마다 새 스타일 객체 생성 + Emotion 직렬화 | 스타일이 한 번만 생성되고 캐시됨 |
| **React.memo 호환** | sx 객체가 매번 새 참조 → memo 무력화 | styled 컴포넌트는 참조 안정적 |
| **코드 분리** | 로직과 스타일이 뒤섞여 가독성 저하 | 관심사 분리 (로직 vs 스타일) |
| **재사용** | 불가능 (같은 스타일을 복붙) | export/import로 재사용 |
| **TypeScript** | 타입 지원 제한적 | `shouldForwardProp` + 제네릭으로 custom prop 타입 안전 |

**`sx`가 허용되는 경우:**
- 단순한 레이아웃 유틸리티 (예: `sx={{ flex: 1 }}`, `sx={{ mt: 2 }}`)
- 일회성이고 1~2개 속성만 있는 간단한 스타일
- `styled()`로 분리할 가치가 없는 극히 단순한 경우

> **원칙:** `sx` 속성이 3개 이상이거나, 조건부 스타일(`isDark`, 동적 색상 등)이 포함되면 반드시 `.styles.tsx`로 분리하세요.

## Re-render Optimization: Memoization Rules for Interactive Pages

리사이즈, 드래그, 애니메이션 등 **고빈도 state 변경**이 발생하는 페이지에서는 반드시 아래 규칙을 따르세요.

**대상 페이지 예시:** 리사이저블 스플리터가 있는 페이지 (로그 탐색, 이슈 상세 등)

### 규칙 1: 자식 컴포넌트는 `React.memo`로 래핑

부모의 state가 변해도 props가 동일하면 리렌더링을 건너뛰도록 합니다.

```tsx
// ✅ memo 적용
const FacetSidebar = React.memo<FacetSidebarProps>(({ facets, onFilter }) => {
  // ...
});
export default FacetSidebar;  // 이미 memo 적용됨

// 또는 export 시점에:
export default React.memo(MyComponent);
```

### 규칙 2: 콜백 prop은 `useCallback` 또는 직접 참조

인라인 화살표 함수는 매 렌더마다 새 참조를 생성하여 자식의 `React.memo`를 무력화합니다.

```tsx
// ❌ memo가 있어도 매번 리렌더링됨
<FacetSidebar
  onFilter={(key, val, exclude) => toggleActiveFilter(key, val, exclude)}
  onToggleCollapse={() => setCollapsed(c => !c)}
/>

// ✅ 안정적 참조 → memo가 정상 작동
const handleToggle = useCallback(() => setCollapsed(c => !c), [setCollapsed]);
<FacetSidebar
  onFilter={toggleActiveFilter}  // 이미 useCallback으로 래핑된 함수
  onToggleCollapse={handleToggle}
/>
```

### 규칙 3: 드래그/리사이즈 전용 state를 자식에 전파하지 않기

`isDragging` 같은 고빈도 변경 prop을 자식에게 내리면, 해당 자식의 memo를 무력화합니다.

```tsx
// ❌ isDragging이 50ms마다 바뀌면서 차트의 memo를 무력화
<LogVolumeChart isDragging={isPanelDragging || isFacetDragging} />

// ✅ isDragging을 제거하면 차트는 data/period가 바뀔 때만 리렌더링
<LogVolumeChart data={volume} isDark={isDark} period={currentPeriod} />
```

> **원칙:** `React.memo`를 추가하는 것만으로는 부족합니다. memo가 동작하려면 **prop 참조의 안정성**이 보장되어야 합니다. memo + useCallback + 인라인 콜백 제거를 함께 적용하세요.

### 규칙 4: 리스트 아이템의 콜백 prop은 ID를 인자로 받는 패턴 사용

리스트 아이템(`items.map(...)`)에서 `React.memo` 컴포넌트에 콜백을 전달할 때, 각 아이템별 클로저를 만들지 마세요. 대신 콜백이 ID를 인자로 받도록 설계합니다.

```tsx
// ❌ 아이템마다 새 클로저 → N개의 새 함수 참조 → 모든 아이템 리렌더링
{items.map((item) => (
  <MemoizedItem
    key={item.id}
    onSelect={() => handleSelect(item.id)}      // ❌ 매번 새 함수
    onToggle={() => toggleItem(item.id)}          // ❌ 매번 새 함수
  />
))}

// ✅ 부모에서 안정적 useCallback + 자식이 자신의 ID를 전달
const handleSelect = useCallback((id: string) => { /* ... */ }, []);
const handleToggle = useCallback((id: string) => { /* ... */ }, []);

{items.map((item) => (
  <MemoizedItem
    key={item.id}
    onSelect={handleSelect}    // ✅ 안정적 참조
    onToggle={handleToggle}    // ✅ 안정적 참조
  />
))}

// 자식 컴포넌트 내부에서:
interface MemoizedItemProps {
  item: ItemType;
  onSelect: (id: string) => void;   // ID를 인자로 받음
  onToggle: (id: string) => void;
}
const MemoizedItem: React.FC<MemoizedItemProps> = ({ item, onSelect, onToggle }) => (
  <Box onClick={() => onSelect(item.id)}>  {/* 자식 내부에서 ID 전달 */}
    ...
  </Box>
);
export default React.memo(MemoizedItem);
```

> **핵심:** 부모 → 자식으로 전달하는 콜백은 **하나의 안정적 함수**로, 자식이 자신의 ID를 인자로 넘기는 구조를 사용합니다. 이렇게 하면 25개 아이템이 있어도 콜백 참조는 변하지 않아 `React.memo`가 정상 작동합니다.

## State Update + Fetch: 절대로 setTimeout으로 fetch하지 마세요

`setState` 직후에 `setTimeout(() => fetch(), N)`으로 데이터를 재조회하면 **stale closure race condition**이 발생합니다.

### 왜 문제인가

`useCallback`으로 생성된 `fetchData` 함수는 deps에 포함된 state를 **클로저로 캡처**합니다. `setState`를 호출해도 React 배치가 처리되기 전까지 이전 클로저가 유지됩니다.

```tsx
// ❌ Race condition 발생
const handleSearch = useCallback((val: string) => {
  setSearch(val);                    // ① React 배치 (아직 미처리)
  setTimeout(() => fetchLogs(), 10); // ② stale closure — 이전 search=""로 호출
}, [fetchLogs]);                     // fetchLogs는 이전 search를 캡처

// 실행 순서:
// 1. setTimeout 10ms 후: fetchLogs(search="") 실행 → 필터 없이 조회 ❌
// 2. React 배치 처리: search 업데이트 → fetchLogs 재생성 → useEffect 실행 → 올바른 조회 ✅
// 3. 두 요청이 경쟁 — stale 응답이 나중에 도착하면 올바른 결과를 덮어씌움 ❌
```

### 올바른 패턴

이 프로젝트에서는 `fetch` 함수가 state를 deps로 가지고 있고, `useEffect`가 fetch 함수 변경을 감지하여 자동으로 재실행합니다. 따라서 **state만 업데이트하면 자동으로 fetch가 트리거**됩니다.

```tsx
// ✅ 올바른 패턴 — state 업데이트만 하면 자동으로 fetch 체인이 동작
const handleSearch = useCallback((val: string) => {
  setSearch(val);
  setUrlState({ q: val });
  // 명시적 fetch 불필요:
  // setSearch → fetchLogs 재생성 (deps: [search])
  //           → fetchAll 재생성 (deps: [fetchLogs])
  //           → useEffect([fetchAll]) 실행
}, [setUrlState]);
```

### 자동 fetch 체인 구조

```
setState(newValue)
  → useCallback fetchData deps 변경 → fetchData 새 클로저 생성
    → useCallback fetchAll deps 변경 → fetchAll 새 클로저 생성
      → useEffect([fetchAll]) 트리거 → 올바른 state로 fetch 실행
```

> **핵심:** `setTimeout`, `requestAnimationFrame`, `queueMicrotask` 등으로 fetch를 지연 호출하지 마세요. React의 state → deps → effect 체인을 신뢰하세요. 이 체인이 없는 경우에도 setTimeout 대신 `useEffect`로 state 변경에 반응하도록 설계하세요.

## Number Formatting: 숫자 표시 규칙

모든 UI에서 숫자를 표시할 때, **용도에 따라 정해진 포맷 함수를 반드시 사용**하세요. Raw 숫자를 그대로 출력하거나 `.toFixed()`만 사용하는 것은 금지입니다.

### 규칙 1: 카운터/건수 → `formatCompactNumber`

이벤트 수, 사용자 수, 트랜잭션 수, 스팬 수 등 **엔티티 개수**를 표시할 때는 반드시 `formatCompactNumber`를 사용합니다.

**Location:** `@/utils/numberFormat`

```tsx
import { formatCompactNumber } from '@/utils/numberFormat';

// ✅ 올바른 사용
<Typography>{formatCompactNumber(600000)}</Typography>   // → "600K"
<Typography>{formatCompactNumber(39999)}</Typography>    // → "40.0K"
<Typography>{formatCompactNumber(1234567)}</Typography>  // → "1.23M"
<Typography>{formatCompactNumber(500)}</Typography>      // → "500" (1000 미만은 그대로)
```

**⚠️ API 값이 문자열로 올 수 있음!** `typeof value === 'number'` 체크를 사용하는 경우, 반드시 `Number()`로 변환하세요:

```tsx
// ❌ API에서 "600000" (문자열)이 오면 typeof === 'number'가 false → raw 출력
value: es?.total_errors,

// ✅ Number()로 명시적 변환
value: es?.total_errors != null ? Number(es.total_errors) : undefined,
```

**적용 대상:**
- 대시보드 stat card의 값 (총에러, 영향받은 사용자, 트랜잭션 등)
- 테이블 셀의 이벤트/사용자 카운트
- 차트 tooltip의 건수
- 칩/배지의 건수
- **FacetSidebar**의 facet value 카운트 (`FacetSidebar.tsx`)
- **LogsAggregatePanel**의 Top Values 테이블 카운트

### 규칙 2: 지연시간(ms) → `Math.round().toLocaleString() + 'ms'`

P50, P95, P99, 평균 응답시간, 스팬 duration 등 **밀리초 단위 지연시간**을 표시할 때는 반드시 `toLocaleString()`으로 3자리 콤마를 적용합니다.

```tsx
// ❌ 콤마 없이 표시
<Typography>{value.toFixed(0)}ms</Typography>           // → "1000ms" ❌

// ✅ 콤마 포맷 적용
<Typography>{Math.round(value).toLocaleString()}ms</Typography>  // → "1,000ms" ✅

// ✅ API 문자열 값인 경우
<Typography>{Math.round(Number(detail.summary.p95)).toLocaleString()}ms</Typography>
```

**적용 대상:**
- 성능 요약 카드 (Avg P95, Avg Duration 등)
- 성능 테이블 행 (avg_duration, p50, p95 열)
- 스팬 목록의 duration
- Uptime 모니터의 avg response ms
- Cron check-in duration

**⚠️ 예외:** `formatDuration` 헬퍼 함수 내부에서 1000ms 미만일 때 `${Math.round(ms)}ms`로 표시하는 것은 OK (999 이하이므로 콤마 불필요).

### 규칙 3: 퍼센트(%) → 큰 값에 `toLocaleString()` 적용

변화율, delta 퍼센트 등 **100%를 초과할 수 있는 퍼센트 값**에는 `toLocaleString()`으로 콤마를 적용합니다.

```tsx
// ❌ 콤마 없이 표시
<Typography>{Math.abs(value).toFixed(0)}%</Typography>   // → "3299%" ❌

// ✅ 콤마 포맷 적용
<Typography>{Math.round(Math.abs(value)).toLocaleString()}%</Typography>  // → "3,299%" ✅

// ✅ 소수점이 필요한 경우
<Typography>{Number(delta.toFixed(1)).toLocaleString()}%</Typography>     // → "3,299.5%" ✅
```

**적용 대상:**
- `ChangeIndicator` 컴포넌트 (개요, 세션건강 페이지의 증감율)
- `DeltaBadge` 컴포넌트 (로그 패턴의 변화율)
- 패턴 상세의 Change 행

**⚠️ 예외:** crash_free_rate, error_rate 등 0~100% 범위의 비율은 콤마 불필요 (`99.5%`, `0.12%`).

### 요약 테이블

| 용도 | 포맷 | 예시 |
|------|------|------|
| 엔티티 개수 (에러, 사용자, 트랜잭션) | `formatCompactNumber(value)` | `600K`, `1.23M` |
| 지연시간 (ms) | `Math.round(v).toLocaleString() + 'ms'` | `1,000ms`, `12,345ms` |
| 큰 퍼센트 (변화율, delta) | `Math.round(v).toLocaleString() + '%'` | `3,299%`, `1,500%` |
| 작은 퍼센트 (비율) | `v.toFixed(1) + '%'` | `99.5%`, `0.12%` |

> **핵심:** 숫자가 1,000 이상이 될 수 있는 모든 곳에 콤마를 적용하세요. Raw 숫자 출력은 금지입니다.

