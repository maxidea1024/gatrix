/**
 * useArgusUrlState — Sync component state with URL query parameters.
 *
 * Provides a single source of truth: URL > localStorage fallback > hardcoded defaults.
 * Supports strings, arrays (comma-separated), and optional localStorage persistence.
 */
import { useCallback, useMemo, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';

type ParamType = 'string' | 'array';

export interface ParamDef {
  /** URL query key */
  key: string;
  /** Default value when absent from URL and localStorage */
  default: string;
  /** 'string' (default) or 'array' (comma-separated) */
  type?: ParamType;
  /** localStorage key for fallback (when URL param is absent) */
  storageKey?: string;
  /** If true, changing this param pushes history (enables back button). Default: false (replace). */
  pushHistory?: boolean;
}

export type UrlState<T extends Record<string, ParamDef>> = {
  [K in keyof T]: T[K]['type'] extends 'array' ? string[] : string;
};

/**
 * Usage:
 * ```ts
 * const PARAMS = {
 *   period: { key: 'period', default: '24h', storageKey: 'argus-perf-period' },
 *   view:   { key: 'view',   default: 'list', pushHistory: true },
 *   txn:    { key: 'txn',    default: '' },
 *   fields: { key: 'fields', default: 'level,count()', type: 'array' as const },
 * } as const;
 *
 * const [state, setState] = useArgusUrlState(PARAMS);
 * // state.period === '24h'
 * // state.fields === ['level', 'count()']
 * // setState({ period: '7d' })  — replaces URL
 * // setState({ view: 'detail' }) — pushes history
 * ```
 */
export function useArgusUrlState<T extends Record<string, ParamDef>>(
  paramDefs: T
): [
  UrlState<T>,
  (updates: Partial<Record<keyof T, string | string[]>>) => void,
] {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const defsRef = useRef(paramDefs);
  defsRef.current = paramDefs;

  // Derive current state from URL, with localStorage + default fallback
  const state = useMemo(() => {
    const result = {} as any;
    for (const [name, def] of Object.entries(defsRef.current)) {
      const urlValue = searchParams.get(def.key);

      if (urlValue !== null) {
        // URL has the value
        result[name] =
          def.type === 'array' ? urlValue.split(',').filter(Boolean) : urlValue;
      } else {
        // Fallback: localStorage > default
        let fallback = def.default;
        if (def.storageKey) {
          const stored = localStorage.getItem(def.storageKey);
          if (stored) fallback = stored;
        }
        result[name] =
          def.type === 'array' ? fallback.split(',').filter(Boolean) : fallback;
      }
    }
    return result as UrlState<T>;
  }, [searchParams]);

  // Update URL params
  const setState = useCallback(
    (updates: Partial<Record<keyof T, string | string[]>>) => {
      const defs = defsRef.current;
      let shouldPush = false;

      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);

          for (const [name, value] of Object.entries(updates)) {
            const def = defs[name];
            if (!def) continue;

            // Check if this update should push history
            if (def.pushHistory) shouldPush = true;

            // Serialize value
            const serialized = Array.isArray(value)
              ? value.join(',')
              : (value as string);

            // If value equals default and there's no storageKey reason to keep it, remove from URL
            if (serialized === def.default || serialized === '') {
              next.delete(def.key);
            } else {
              next.set(def.key, serialized);
            }

            // Persist to localStorage if configured
            if (def.storageKey && serialized) {
              localStorage.setItem(def.storageKey, serialized);
            }
          }

          return next;
        },
        { replace: !shouldPush, state: location.state }
      );
    },
    [setSearchParams, location.state]
  );

  return [state, setState];
}

export default useArgusUrlState;
