# Date and Time Formatting Utilities

This document explains the usage of utility functions for date and time formatting in the Gatrix project.

## Recommended Usage

**Use `formatDateTimeDetailed` for all UI time displays to maintain consistent formatting.**

```typescript
import { formatDateTimeDetailed } from '@/utils/dateFormat';
```

## Main Functions

### 1. formatDateTime(date)

Date/time formatting according to user settings

```typescript
formatDateTime('2024-01-15T10:30:00Z'); // "2024-01-15 19:30:00" (Asia/Seoul timezone)
formatDateTime(new Date()); // Current time in user-configured format
```

### 2. formatDate(date)

Date-only formatting (YYYY-MM-DD)

```typescript
formatDate('2024-01-15T10:30:00Z'); // "2024-01-15"
```

### 3. formatTime(date)

Time-only formatting (HH:mm:ss)

```typescript
formatTime('2024-01-15T10:30:00Z'); // "19:30:00" (Asia/Seoul timezone)
```

### 4. formatDateTimeDetailed(date) ⭐ Recommended

**Unified date/time formatting for UI display - use in all tables and lists**

```typescript
formatDateTimeDetailed('2024-01-15T10:30:00Z'); // "2024-01-15 19:30:00"
formatDateTimeDetailed(job.updated_at); // Use in tables
formatDateTimeDetailed(user.created_at); // Use in lists
```

### 5. formatWith(date, format)

Custom format output

```typescript
formatWith('2024-01-15T10:30:00Z', 'YYYY년 MM월 DD일'); // "2024년 01월 15일"
```

### 6. formatDuration(milliseconds)

Time intervals in human-readable format

```typescript
formatDuration(5000); // "5s"
formatDuration(65000); // "1m 5s"
formatDuration(3665000); // "1h 1m"
```

### 7. formatRelativeTime(date)

Relative time display

```typescript
formatRelativeTime(new Date(Date.now() - 30000)); // "Just now"
formatRelativeTime(new Date(Date.now() - 300000)); // "5 minutes ago"
```

### 8. Date Comparison Functions

```typescript
isToday('2024-01-15T10:30:00Z'); // boolean
isYesterday('2024-01-14T10:30:00Z'); // boolean
```

## User Settings

### Timezone Configuration

```typescript
import { getStoredTimezone, setStoredTimezone } from '@/utils/dateFormat';

// Get currently configured timezone
const timezone = getStoredTimezone(); // "Asia/Seoul"

// Change timezone
setStoredTimezone('America/New_York');
```

### Date Format Configuration

```typescript
import { getStoredDateTimeFormat, setStoredDateTimeFormat } from '@/utils/dateFormat';

// Get currently configured format
const format = getStoredDateTimeFormat(); // "YYYY-MM-DD HH:mm:ss"

// Change format
setStoredDateTimeFormat('YYYY/MM/DD HH:mm');
```

## Supported Format Examples

- `YYYY-MM-DD HH:mm:ss` (default)
- `YYYY/MM/DD HH:mm`
- `YYYY.MM.DD HH:mm:ss`
- `MM/DD/YYYY HH:mm`
- `DD/MM/YYYY HH:mm:ss`

## Migration Guide

### Updating Existing Code

```typescript
// Old (deprecated)
import { formatDateTime } from '@/utils/dateUtils';

// New approach (recommended)
import { formatDateTime } from '@/utils/dateFormat';
```

### Key Differences

1. **Timezone Support**: `dateFormat.ts` automatically applies user-configured timezone
2. **Consistent Format**: Uses user-configured date format consistently across the entire application
3. **Null Safety**: Safely returns '-' for null/undefined values
4. **Error Handling**: Safely returns '-' when parsing fails

## Settings Page

Users can change the following on the settings page (`/settings`):

- Timezone selection
- Date/time format selection
- Real-time preview

## Important Notes

1. **dateUtils.ts is deprecated**: Do not use in new code
2. **Server Time**: All server times are stored in UTC and converted to user timezone on the client
3. **Consistency**: Use the same formatting functions throughout the application to provide a consistent user experience
