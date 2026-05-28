import { HotTimeBuffOverride } from '@/services/operationEventService';
import { DAY_BITS } from './types';

/** Format bitFlagDayOfWeek into comma-separated day names */
export function formatDayOfWeek(
  bitFlag: number,
  t: (k: string) => string
): string {
  if (bitFlag === 127) return t('hotTimeBuffEvent.dayAll');
  return DAY_BITS.filter((d) => bitFlag & (1 << d.bit))
    .map((d) => t(`hotTimeBuffEvent.${d.key}`))
    .join(', ');
}

/** Format ISO date string to YYYY-MM-DD */
export function formatDateShort(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  return dateStr.length > 10 ? dateStr.substring(0, 10) : dateStr;
}

/** Normalize worldIds: null and [] are both "global" */
export function normalizeWorldIds(
  ids: string[] | null | undefined
): string | null {
  if (!ids || ids.length === 0) return null;
  return JSON.stringify([...ids].sort());
}

/** Deep compare two overrides to detect changes */
export function isOverrideDirty(
  saved: HotTimeBuffOverride | undefined,
  local: HotTimeBuffOverride | undefined
): boolean {
  if (!saved && !local) return false;
  if (!local) return false; // no draft = not dirty
  if (!saved) {
    // No saved override — dirty only if local has non-default fields set
    return (
      local.enabled === false ||
      (Array.isArray(local.worldIds) && local.worldIds.length > 0) ||
      local.startDateOverride != null ||
      local.endDateOverride != null ||
      local.startHourOverride != null ||
      local.endHourOverride != null ||
      local.minLvOverride != null ||
      local.maxLvOverride != null ||
      local.bitFlagDayOfWeekOverride != null ||
      local.worldBuffIdOverride != null
    );
  }
  return (
    saved.enabled !== local.enabled ||
    saved.startDateOverride !== local.startDateOverride ||
    saved.endDateOverride !== local.endDateOverride ||
    saved.startHourOverride !== local.startHourOverride ||
    saved.endHourOverride !== local.endHourOverride ||
    saved.minLvOverride !== local.minLvOverride ||
    saved.maxLvOverride !== local.maxLvOverride ||
    saved.bitFlagDayOfWeekOverride !== local.bitFlagDayOfWeekOverride ||
    normalizeWorldIds(saved.worldIds) !== normalizeWorldIds(local.worldIds) ||
    JSON.stringify(saved.worldBuffIdOverride) !==
      JSON.stringify(local.worldBuffIdOverride)
  );
}
