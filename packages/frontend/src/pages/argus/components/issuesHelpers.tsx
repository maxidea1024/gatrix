import { ArgusIssue } from '@/services/argusService';

// ─── Constants ───

export const PAGE_SIZE_STORAGE_KEY = 'argusIssues.pageSize';
export const DEFAULT_PAGE_SIZE = 25;
export const VALID_PAGE_SIZES = [5, 10, 15, 20, 25, 50, 100];

export const QUERY_BUILDER_FIELDS = [
  'level',
  'status',
  'platform',
  'priority',
  'assigned_to',
  'browser',
  'os',
  'device',
  'environment',
  'release',
  'times_seen',
  'user_count',
];

/** URL param keys that, when present, signal a deep-link / cross-page intent. */
export const DEEP_LINK_KEYS = [
  'page',
  'search',
  'status',
  'level',
  'sort',
  'view',
  'substatus',
  'assigned_to',
];

// ─── Types ───

export type ActiveFilter = {
  key: string;
  value: string;
  exclude: boolean;
  enabled: boolean;
};

// ─── Filter option builders ───

export const getStatusOptions = (t: any) => [
  { value: '', label: t('common.all') },
  {
    value: 'unresolved',
    label: t('argus.issues.unresolved'),
    color: '#f44336',
  },
  { value: 'resolved', label: t('argus.issues.resolved'), color: '#4caf50' },
  { value: 'ignored', label: t('argus.issues.ignored'), color: '#9e9e9e' },
];

export const getLevelOptions = (t: any) => [
  { value: '', label: t('common.all') },
  { value: 'fatal', label: t('argus.issues.fatal'), color: '#f44336' },
  { value: 'error', label: t('argus.issues.error'), color: '#ff5722' },
  { value: 'warning', label: t('argus.issues.warning'), color: '#ff9800' },
  { value: 'info', label: t('argus.issues.info'), color: '#2196f3' },
];

export const getSortOptions = (t: any) => [
  { value: 'last_seen', label: t('argus.issues.lastSeen') },
  { value: 'first_seen', label: t('argus.issues.firstSeen') },
  { value: 'event_count', label: t('argus.issues.events') },
  { value: 'user_count', label: t('argus.issues.users') },
  { value: 'trends', label: t('argus.issues.sortTrends', 'Trends') },
];

// ─── Facet data builder ───

export interface FacetCounts {
  level: { value: string; count: number }[];
  status: { value: string; count: number }[];
  platform: { value: string; count: number }[];
  assigned_to: { value: string; count: number }[];
  priority: { value: string; count: number }[];
}

export const EMPTY_FACET_COUNTS: FacetCounts = {
  level: [],
  status: [],
  platform: [],
  assigned_to: [],
  priority: [],
};

export function buildFacetCounts(issues: ArgusIssue[]): FacetCounts {
  const countByField = (field: keyof ArgusIssue) => {
    const counts = new Map<string, number>();
    issues.forEach((issue) => {
      const val = issue[field];
      if (val != null && val !== '') {
        const key = String(val);
        counts.set(key, (counts.get(key) || 0) + 1);
      }
    });
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count);
  };

  return {
    level: countByField('level'),
    status: countByField('status'),
    platform: countByField('platform'),
    assigned_to: countByField('assigned_to'),
    priority: countByField('priority'),
  };
}
