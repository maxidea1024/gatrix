/**
 * useArgusIssueStore — Zustand store for Argus Issue List page state.
 *
 * This store persists filter, search, pagination, and view state across
 * route transitions.  When the user navigates away (e.g. to issue detail)
 * and returns via breadcrumb, the store retains its values so the list is
 * automatically restored to its previous state.
 *
 * GNB (sidebar) navigation calls `resetStore()` to return to the clean,
 * first-page default state.
 */
import { create } from 'zustand';

// ─── Default Values ────────────────────────────────────────────────
const DEFAULTS = {
  currentPage: 1,
  search: '',
  status: '',
  level: '',
  sort: 'last_seen',
  activeViewId: 'unresolved',
  substatus: '',
  assignedTo: '',
  period: '14d',
  customStart: '',
  customEnd: '',
} as const;

// ─── Types ─────────────────────────────────────────────────────────
interface ArgusIssueListState {
  // State
  currentPage: number;
  search: string;
  status: string;
  level: string;
  sort: string;
  activeViewId: string;
  substatus: string;
  assignedTo: string;
  period: string;
  customStart: string;
  customEnd: string;

  // Actions
  setCurrentPage: (page: number) => void;
  setSearch: (search: string) => void;
  setStatus: (status: string) => void;
  setLevel: (level: string) => void;
  setSort: (sort: string) => void;
  setActiveViewId: (viewId: string) => void;
  setSubstatus: (substatus: string) => void;
  setAssignedTo: (assignedTo: string) => void;
  setPeriod: (period: string) => void;
  setCustomDateRange: (start: string, end: string) => void;

  /** Bulk-hydrate state from URL params (deep-link support). */
  hydrateFromParams: (
    params: Partial<
      Omit<
        ArgusIssueListState,
        | 'hydrateFromParams'
        | 'resetStore'
        | 'setCurrentPage'
        | 'setSearch'
        | 'setStatus'
        | 'setLevel'
        | 'setSort'
        | 'setActiveViewId'
        | 'setSubstatus'
        | 'setAssignedTo'
      >
    >
  ) => void;

  /** Reset all state to defaults (called by GNB navigation). */
  resetStore: () => void;
}

// ─── Store ─────────────────────────────────────────────────────────
export const useArgusIssueStore = create<ArgusIssueListState>((set) => ({
  // Initial state
  ...DEFAULTS,

  // Individual setters
  setCurrentPage: (currentPage) => set({ currentPage }),
  setSearch: (search) => set({ search }),
  setStatus: (status) => set({ status }),
  setLevel: (level) => set({ level }),
  setSort: (sort) => set({ sort }),
  setActiveViewId: (activeViewId) => set({ activeViewId }),
  setSubstatus: (substatus) => set({ substatus }),
  setAssignedTo: (assignedTo) => set({ assignedTo }),
  setPeriod: (period) => set({ period, customStart: '', customEnd: '' }),
  setCustomDateRange: (start, end) =>
    set({ period: 'custom', customStart: start, customEnd: end }),

  // Bulk hydration from URL query params
  hydrateFromParams: (params) => set((state) => ({ ...state, ...params })),

  // Full reset to defaults
  resetStore: () => set({ ...DEFAULTS }),
}));

export { DEFAULTS as ARGUS_ISSUE_DEFAULTS };
export type { ArgusIssueListState };
