/**
 * useGlobalAnalyticsFilter — Shared Zustand store for global analytics filters.
 *
 * These filters apply to ALL analytics pages (Insights, Funnels, Retention, Flows).
 * They persist to localStorage across page refreshes.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface GlobalFilter {
  property: string; // 'platform' | 'country' | 'os' | 'app_version' | custom prop
  operator: string; // 'is' | 'is_not' | 'contains' | 'not_contains'
  value: string;
}

interface GlobalAnalyticsFilterState {
  filters: GlobalFilter[];
  setFilters: (v: GlobalFilter[]) => void;
  addFilter: (f: GlobalFilter) => void;
  updateFilter: (idx: number, f: GlobalFilter) => void;
  removeFilter: (idx: number) => void;
  clearFilters: () => void;
}

export const useGlobalAnalyticsFilter = create<GlobalAnalyticsFilterState>()(
  persist(
    (set, get) => ({
      filters: [],
      setFilters: (filters) => set({ filters }),
      addFilter: (f) => set({ filters: [...get().filters, f] }),
      updateFilter: (idx, f) =>
        set({
          filters: get().filters.map((existing, i) =>
            i === idx ? f : existing
          ),
        }),
      removeFilter: (idx) =>
        set({ filters: get().filters.filter((_, i) => i !== idx) }),
      clearFilters: () => set({ filters: [] }),
    }),
    {
      name: 'argus-global-analytics-filters',
      partialize: (state) => ({ filters: state.filters }),
    }
  )
);
