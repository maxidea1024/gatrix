---
description: UI component patterns and conventions to follow
---

# UI Component Patterns

## Empty State: Always Use EmptyPlaceholder

When displaying an empty state (no data, no items, etc.), **ALWAYS** use the `EmptyPlaceholder` component.

**Location:** `@/components/common/EmptyPlaceholder`

**Usage:**
```tsx
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';

// Basic usage
<EmptyPlaceholder message={t('some.emptyMessage')} />

// With description
<EmptyPlaceholder
  message={t('some.emptyMessage')}
  description={t('some.emptyDescription')}
/>

// With add button
<EmptyPlaceholder
  message={t('some.emptyMessage')}
  onAddClick={handleAdd}
  addButtonLabel={t('some.addButton')}
/>

// With custom children
<EmptyPlaceholder message={t('some.emptyMessage')}>
  <Button onClick={handleAction}>{t('some.action')}</Button>
</EmptyPlaceholder>
```

**Props:**
- `message` (required): Main text
- `description` (optional): Sub text
- `onAddClick` (optional): Shows an add button
- `addButtonLabel` (optional): Label for the add button
- `addButtonVariant` (optional): 'text' | 'contained' | 'outlined' (default: 'contained')
- `children` (optional): Custom content instead of the default add button

**IMPORTANT:** When `EmptyPlaceholder` is displayed and includes an action button (via `onAddClick`), **DO NOT** show a duplicate "Add" button in the page header or toolbar. The header button should only be visible when there is content (i.e., when `EmptyPlaceholder` is hidden).

**DO NOT** manually create empty states with `<Paper>`, `<Box>`, or `<Typography>` - always use `EmptyPlaceholder`.

## Pagination: Always Use SimplePagination

When implementing pagination, always use the `SimplePagination` component.

## Clipboard: Always Use copyToClipboardWithNotification

When implementing clipboard copy functionality, always use `copyToClipboardWithNotification`.

## Text Search: Always Apply Debouncing

When implementing text search inputs (e.g., name search), always apply debouncing.

## Browser Dialogs: Never Use alert/prompt

Never use `window.alert()` or `window.prompt()`. Use MUI Dialog components instead.
