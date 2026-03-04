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

