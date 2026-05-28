import { HotTimeBuffItem } from '@/services/planningDataService';
import { HotTimeBuffOverride } from '@/services/operationEventService';

// --------------- Types ---------------

export interface RowData {
  cmsId: number;
  cmsItem: HotTimeBuffItem;
  savedOverride?: HotTimeBuffOverride;
  localOverride?: HotTimeBuffOverride;
  isDirty: boolean;
}

export interface ColumnConfig {
  id: string;
  label: string;
  visible: boolean;
  width?: string | number;
}

// --------------- Constants ---------------

export const ROWS_PER_PAGE_OPTIONS = [10, 15, 20, 50, 100];

export const DEFAULT_COLUMNS: ColumnConfig[] = [
  { id: 'edit', label: '✎', visible: true, width: 36 },
  { id: 'cmsId', label: 'ID', visible: true, width: 70 },
  { id: 'world', label: 'hotTimeBuffEvent.colWorld', visible: true, width: 90 },
  { id: 'name', label: 'hotTimeBuffEvent.colName', visible: true, width: 240 },
  {
    id: 'enabled',
    label: 'hotTimeBuffEvent.colEnabled',
    visible: true,
    width: 70,
  },
  {
    id: 'liveStatus',
    label: 'hotTimeBuffEvent.colLiveStatus',
    visible: true,
    width: 80,
  },
  {
    id: 'startDate',
    label: 'hotTimeBuffEvent.colStartDate',
    visible: true,
    width: 120,
  },
  {
    id: 'endDate',
    label: 'hotTimeBuffEvent.colEndDate',
    visible: true,
    width: 120,
  },
  { id: 'hours', label: 'hotTimeBuffEvent.colHours', visible: true, width: 80 },
  { id: 'level', label: 'hotTimeBuffEvent.colLevel', visible: true, width: 70 },
  {
    id: 'dayOfWeek',
    label: 'hotTimeBuffEvent.colDayOfWeek',
    visible: true,
    width: 100,
  },
  {
    id: 'worldBuffs',
    label: 'hotTimeBuffEvent.colWorldBuffs',
    visible: true,
    width: 120,
  },
  {
    id: 'status',
    label: 'hotTimeBuffEvent.colStatus',
    visible: true,
    width: 90,
  },
];

export const DAY_BITS = [
  { bit: 0, key: 'daySun' },
  { bit: 1, key: 'dayMon' },
  { bit: 2, key: 'dayTue' },
  { bit: 3, key: 'dayWed' },
  { bit: 4, key: 'dayThu' },
  { bit: 5, key: 'dayFri' },
  { bit: 6, key: 'daySat' },
];

// localStorage keys
export const COLUMN_STORAGE_KEY = 'hotTimeBuffEventColumns';
export const DATE_RANGE_FILTER_KEY = 'hotTimeBuffEventDateRangeFilter';
export const DAY_FILTER_KEY = 'hotTimeBuffEventDayOfWeekFilter';
export const VIEW_MODE_KEY = 'hotTimeBuffEventViewMode';
export const ROWS_PER_PAGE_KEY = 'hotTimeBuffEventRowsPerPage';
