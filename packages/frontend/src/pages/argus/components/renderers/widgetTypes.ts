// ─── Argus Dashboard Widget Types ───
// Shared type definitions for the widget system
import { ARGUS_SEMANTIC, ARGUS_SERIES } from '../../argusThemeTokens';

// ── Widget Types ──
export type WidgetType =
  | 'time-series'
  | 'stat'
  | 'gauge'
  | 'bar-gauge'
  | 'pie'
  | 'horizontal-bar'
  | 'table'
  | 'top-list'
  | 'heatmap'
  | 'histogram'
  | 'scatter'
  | 'geo-map'
  | 'event-stream'
  | 'text'
  | 'treemap'
  | 'status-timeline';

// ── Legacy → New Type Migration ──
const LEGACY_TYPE_MAP: Record<string, WidgetType> = {
  line: 'time-series',
  bar: 'time-series',
  area: 'time-series',
  number: 'stat',
};

export function normalizeWidgetType(type: string): WidgetType {
  return LEGACY_TYPE_MAP[type] || (type as WidgetType);
}

/** Maps a legacy type string to a chart_style for time-series */
export function legacyTypeToChartStyle(
  type: string
): 'line' | 'bar' | 'area' | undefined {
  if (type === 'line') return 'line';
  if (type === 'bar') return 'bar';
  if (type === 'area') return 'area';
  return undefined;
}

// ── Widget Query ──
export interface WidgetQuery {
  fields: string[];
  conditions?: string;
  groupBy?: string[];
  orderBy?: string;
  limit?: number;
  offset?: number;
  period?: string;
  start?: string;
  end?: string;
  dataset?: 'errors' | 'transactions' | 'spans' | 'logs' | 'metrics';
  analytics_type?: 'insights' | 'funnels' | 'retention' | 'flows';
  analytics_config?: Record<string, any>;
}

// ── Value Mapping ──
export interface ValueMapping {
  type: 'value' | 'range' | 'regex' | 'special';
  match: string | number;
  match_to?: number; // for range type
  result: { text?: string; color?: string; icon?: string };
}

// ── Threshold ──
export interface Threshold {
  value: number;
  color: string;
  label?: string;
}

// ── Legend Options ──
export interface LegendOptions {
  show?: boolean;
  mode?: 'list' | 'table';
  position?: 'bottom' | 'right';
  values?: ('min' | 'max' | 'mean' | 'last' | 'total')[];
  sort_by?: 'name' | 'value';
  sort_desc?: boolean;
  limit?: number;
}

// ── Axis Options ──
export interface AxisOptions {
  y_scale?: 'linear' | 'log';
  y_min?: number | 'auto';
  y_max?: number | 'auto';
  y_label?: string;
  x_label?: string;
  y_right_enabled?: boolean;
  y_right_label?: string;
}

// ── Stat Widget Options ──
export interface StatOptions {
  orientation?: 'horizontal' | 'vertical';
  text_mode?: 'value' | 'value_and_name' | 'name';
  graph_mode?: 'area' | 'none';
  text_size?: number;
  show_change?: boolean;
  change_period?: string;
}

// ── Gauge Widget Options ──
export interface GaugeOptions {
  min?: number;
  max?: number;
  show_threshold_labels?: boolean;
  show_threshold_markers?: boolean;
}

// ── Column Config (for tables) ──
export interface ColumnConfig {
  key: string;
  display_name?: string;
  width?: number | 'auto';
  sortable?: boolean;
  visible?: boolean;
  align?: 'left' | 'center' | 'right';
  color_mode?: 'none' | 'value' | 'background';
  thresholds?: Threshold[];
}

// ── Geo Map Options ──
export interface GeoOptions {
  projection?: 'equalEarth' | 'mercator' | 'naturalEarth';
  initial_zoom?: number;
  center?: [number, number];
  country_field?: string;
  value_field?: string;
}

// ── VizOptions ──
export interface VizOptions {
  // Display format
  unit?: string;
  decimals?: number;
  no_value?: string;
  value_mappings?: ValueMapping[];

  // Colors
  color_scheme?: string;
  thresholds?: Threshold[];
  series_colors?: Record<string, string>;

  // Legend
  legend?: LegendOptions;

  // Axis
  axis?: AxisOptions;

  // time-series specific
  line_width?: number;
  fill_opacity?: number;
  point_size?: number;
  stack?: 'none' | 'normal' | 'percent';
  connect_nulls?: boolean;
  show_points?: 'auto' | 'always' | 'never';

  // stat specific
  stat?: StatOptions;

  // gauge specific
  gauge?: GaugeOptions;

  // table specific
  column_config?: ColumnConfig[];
  rows_per_page?: number;

  // geo-map specific
  geo?: GeoOptions;

  // text specific
  markdown_content?: string;
  font_size?: number;
}

// ── Data Transform ──
export interface DataTransform {
  type: 'filter' | 'rename' | 'calculate' | 'sort' | 'limit' | 'group-by';
  config: Record<string, any>;
}

// ── Field Override ──
export interface FieldOverride {
  matcher: { type: 'byName' | 'byRegex' | 'byType'; value: string };
  properties: {
    color?: string;
    visible?: boolean;
    y_axis?: 'left' | 'right';
    line_width?: number;
    fill_opacity?: number;
    point_size?: number;
    thresholds?: Threshold[];
    display_name?: string;
  };
}

// ── Widget Config ──
export interface WidgetConfig {
  id: string;
  title: string;
  description?: string;
  category?:
    | 'discover'
    | 'insights'
    | 'funnels'
    | 'retention'
    | 'flows'
    | 'text';
  type: WidgetType | string; // string for legacy compatibility
  chart_style?: 'line' | 'bar' | 'area' | 'stacked-bar' | 'stacked-area';
  query: WidgetQuery;
  layout: { x: number; y: number; w: number; h: number };
  viz_options?: VizOptions;
  data_transforms?: DataTransform[];
  field_overrides?: FieldOverride[];
}

// ── Dashboard Data ──
export interface DashboardData {
  id?: number;
  title: string;
  description: string;
  widgets_config: WidgetConfig[];
  created_by?: string;
  owner_user_id?: string;
  visibility?: 'personal' | 'team' | 'project';
  shared_with?: string[];
  is_favorite?: number;
  is_locked?: boolean;
  created_at?: string;
  updated_at?: string;
}

// ── Preset Summary ──
export interface PresetSummary {
  id: string;
  title: string;
  description: string;
  widgetCount: number;
}

// ── Widget Type Catalog ──
export interface WidgetTypeCatalogItem {
  value: WidgetType;
  labelKey: string;
  defaultLabel: string;
  icon: string; // MUI icon name
  descriptionKey: string;
  defaultDescription: string;
}

export interface WidgetTypeCatalogGroup {
  groupKey: string;
  defaultGroupLabel: string;
  items: WidgetTypeCatalogItem[];
}

// ── Default color palette for charts ──
export const CHART_COLORS = [
  '#7c4dff',
  '#448aff',
  '#00bcd4',
  ARGUS_SEMANTIC.positive,
  ARGUS_SEMANTIC.warning,
  ARGUS_SEMANTIC.negative,
  '#e91e63',
  ARGUS_SERIES[4],
  '#3f51b5',
  '#009688',
  '#ff5722',
  '#795548',
] as const;

// ── Unit Format Helpers ──
export function formatValue(
  value: number | string | null | undefined,
  vizOptions?: VizOptions
): string {
  if (value == null || value === '') {
    return vizOptions?.no_value ?? 'N/A';
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return String(value);
  if (!isFinite(num)) return vizOptions?.no_value ?? 'N/A';

  const decimals = vizOptions?.decimals;
  const unit = vizOptions?.unit;

  let formatted: string;

  // Apply unit formatting
  switch (unit) {
    case 'percent':
      formatted = `${num.toFixed(decimals ?? 1)}%`;
      break;
    case 'ms':
      if (num >= 1000) formatted = `${(num / 1000).toFixed(decimals ?? 2)}s`;
      else formatted = `${num.toFixed(decimals ?? 0)}ms`;
      break;
    case 'bytes':
      if (num >= 1073741824)
        formatted = `${(num / 1073741824).toFixed(decimals ?? 2)} GB`;
      else if (num >= 1048576)
        formatted = `${(num / 1048576).toFixed(decimals ?? 2)} MB`;
      else if (num >= 1024)
        formatted = `${(num / 1024).toFixed(decimals ?? 2)} KB`;
      else formatted = `${num.toFixed(decimals ?? 0)} B`;
      break;
    case 'short':
      if (Math.abs(num) >= 1_000_000_000)
        formatted = `${(num / 1_000_000_000).toFixed(decimals ?? 1)}B`;
      else if (Math.abs(num) >= 1_000_000)
        formatted = `${(num / 1_000_000).toFixed(decimals ?? 1)}M`;
      else if (Math.abs(num) >= 1_000)
        formatted = `${(num / 1_000).toFixed(decimals ?? 1)}K`;
      else formatted = num.toFixed(decimals ?? 0);
      break;
    case 'none':
    default:
      formatted =
        decimals != null ? num.toFixed(decimals) : num.toLocaleString();
      break;
  }

  return formatted;
}

/** Get color for a value based on thresholds (last threshold <= value wins) */
export function getThresholdColor(
  value: number,
  thresholds?: Threshold[],
  defaultColor: string = ARGUS_SEMANTIC.positive
): string {
  if (!thresholds || thresholds.length === 0) return defaultColor;
  const sorted = [...thresholds].sort((a, b) => a.value - b.value);
  let color = defaultColor;
  for (const t of sorted) {
    if (value >= t.value) color = t.color;
  }
  return color;
}
