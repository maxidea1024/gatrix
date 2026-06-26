/**
 * Segment Filter Utility
 *
 * Shared helper for building ClickHouse WHERE conditions from segment filter
 * query parameters (country, platform, app_version).
 *
 * Supports both single-value and multi-value (comma-separated) filters:
 *   country=US        → country = 'US'
 *   country=US,KR,JP  → country IN ('US', 'KR', 'JP')
 */

// ── Types ──

export interface SegmentFilterQuery {
  country?: string;
  platform?: string;
  app_version?: string;
}

export interface SegmentFilterResult {
  /** SQL fragment to append after a WHERE clause (starts with 'AND' or empty) */
  segmentWhere: string;
  /** ClickHouse bind params for the segment conditions */
  segmentParams: Record<string, any>;
}

// ── Builder ──

/**
 * Build WHERE conditions + params for segment filtering.
 *
 * When a filter value contains commas, it is treated as a multi-select:
 *   `country=US,KR` → `country IN ({fc0:String}, {fc1:String})`
 *
 * Returns empty string / empty object when no filters are active,
 * so callers can just interpolate `${segmentWhere}` into their SQL.
 */
export function buildSegmentFilter(
  query: SegmentFilterQuery
): SegmentFilterResult {
  const conds: string[] = [];
  const params: Record<string, any> = {};

  // Country
  if (query.country) {
    const values = query.country.split(',').map(v => v.trim()).filter(Boolean);
    if (values.length === 1) {
      conds.push('country = {filterCountry:String}');
      params.filterCountry = values[0];
    } else if (values.length > 1) {
      const placeholders = values.map((_, i) => `{fc${i}:String}`).join(', ');
      conds.push(`country IN (${placeholders})`);
      values.forEach((v, i) => { params[`fc${i}`] = v; });
    }
  }

  // Platform
  if (query.platform) {
    const values = query.platform.split(',').map(v => v.trim()).filter(Boolean);
    if (values.length === 1) {
      conds.push('platform = {filterPlatform:String}');
      params.filterPlatform = values[0];
    } else if (values.length > 1) {
      const placeholders = values.map((_, i) => `{fp${i}:String}`).join(', ');
      conds.push(`platform IN (${placeholders})`);
      values.forEach((v, i) => { params[`fp${i}`] = v; });
    }
  }

  // App Version
  if (query.app_version) {
    const values = query.app_version.split(',').map(v => v.trim()).filter(Boolean);
    if (values.length === 1) {
      conds.push('app_version = {filterAppVersion:String}');
      params.filterAppVersion = values[0];
    } else if (values.length > 1) {
      const placeholders = values.map((_, i) => `{fv${i}:String}`).join(', ');
      conds.push(`app_version IN (${placeholders})`);
      values.forEach((v, i) => { params[`fv${i}`] = v; });
    }
  }

  return {
    segmentWhere: conds.length > 0 ? 'AND ' + conds.join(' AND ') : '',
    segmentParams: params,
  };
}

/**
 * For routes using optic.queryBatch (structured queries), convert segment
 * filters into an array of Condition objects compatible with OpticQuery.
 *
 * The optional `dataset` parameter maps filter field names to the correct
 * column for each dataset schema. Fields not present in the dataset are
 * silently omitted.
 *
 * Usage:
 *   const segConds = buildSegmentConditions({ country, platform }, 'errors');
 *   optic.queryBatch({ myQuery: { ...queryDef, conditions: [...(existing || []), ...segConds] } });
 */

// Column availability per dataset
const DATASET_COLUMNS: Record<string, { country?: string; platform?: string; app_version?: string }> = {
  activities:   { country: 'country',     platform: 'platform', app_version: 'app_version' },
  errors:       { country: 'geo_country', platform: 'platform' },
  transactions: {                         platform: 'platform' },
  sessions:     { },
  logs:         {                         platform: 'platform' },
};

export function buildSegmentConditions(
  query: SegmentFilterQuery,
  dataset?: string,
): Array<{ field: string; op: '=' | 'IN'; value: string | string[] }> {
  const conds: Array<{ field: string; op: '=' | 'IN'; value: string | string[] }> = [];
  const cols = dataset ? (DATASET_COLUMNS[dataset] || DATASET_COLUMNS.activities) : DATASET_COLUMNS.activities;

  if (query.country && cols.country) {
    const values = query.country.split(',').map(v => v.trim()).filter(Boolean);
    if (values.length === 1) {
      conds.push({ field: cols.country, op: '=', value: values[0] });
    } else if (values.length > 1) {
      conds.push({ field: cols.country, op: 'IN', value: values });
    }
  }

  if (query.platform && cols.platform) {
    const values = query.platform.split(',').map(v => v.trim()).filter(Boolean);
    if (values.length === 1) {
      conds.push({ field: cols.platform, op: '=', value: values[0] });
    } else if (values.length > 1) {
      conds.push({ field: cols.platform, op: 'IN', value: values });
    }
  }

  if (query.app_version && cols.app_version) {
    const values = query.app_version.split(',').map(v => v.trim()).filter(Boolean);
    if (values.length === 1) {
      conds.push({ field: cols.app_version, op: '=', value: values[0] });
    } else if (values.length > 1) {
      conds.push({ field: cols.app_version, op: 'IN', value: values });
    }
  }

  return conds;
}

