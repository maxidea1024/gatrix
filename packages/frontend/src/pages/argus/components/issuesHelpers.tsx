import { ArgusIssue } from '@/services/argusService';
import { ARGUS_SEMANTIC } from '../argusThemeTokens';

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
  'queryId',
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
    color: ARGUS_SEMANTIC.negative,
  },
  { value: 'resolved', label: t('argus.issues.resolved'), color: ARGUS_SEMANTIC.positive },
  { value: 'ignored', label: t('argus.issues.ignored'), color: '#9e9e9e' },
];

export const getLevelOptions = (t: any) => [
  { value: '', label: t('common.all') },
  { value: 'fatal', label: t('argus.issues.fatal'), color: ARGUS_SEMANTIC.negative },
  { value: 'error', label: t('argus.issues.error'), color: '#ff5722' },
  { value: 'warning', label: t('argus.issues.warning'), color: ARGUS_SEMANTIC.warning },
  { value: 'info', label: t('argus.issues.info'), color: ARGUS_SEMANTIC.info },
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
  // ClickHouse-based event facets (populated separately from /issues/facets)
  release: { value: string; count: number }[];
  environment: { value: string; count: number }[];
  browser_name: { value: string; count: number }[];
  os_name: { value: string; count: number }[];
}

export const EMPTY_FACET_COUNTS: FacetCounts = {
  level: [],
  status: [],
  platform: [],
  assigned_to: [],
  priority: [],
  release: [],
  environment: [],
  browser_name: [],
  os_name: [],
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
    // ClickHouse event-level facets — populated separately by the caller
    release: [],
    environment: [],
    browser_name: [],
    os_name: [],
  };
}
