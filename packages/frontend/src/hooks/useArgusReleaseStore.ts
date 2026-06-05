/**
 * useArgusReleaseStore — Zustand store for Argus Releases List page state.
 *
 * This store persists pagination, search, and sort state across
 * route transitions.  When the user navigates away (e.g. to release detail)
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
  searchTerm: '',
  sortBy: 'date' as 'date' | 'crash_free' | 'sessions' | 'errors',
} as const;

// ─── Types ─────────────────────────────────────────────────────────
interface ArgusReleaseListState {
  // State
  currentPage: number;
  searchTerm: string;
  sortBy: 'date' | 'crash_free' | 'sessions' | 'errors';

  // Actions
  setCurrentPage: (page: number) => void;
  setSearchTerm: (term: string) => void;
  setSortBy: (sort: 'date' | 'crash_free' | 'sessions' | 'errors') => void;

  /** Bulk-hydrate state from URL params (deep-link support). */
  hydrateFromParams: (params: Partial<Pick<ArgusReleaseListState, 'currentPage' | 'searchTerm' | 'sortBy'>>) => void;

  /** Reset all state to defaults (called by GNB navigation). */
  resetStore: () => void;
}

// ─── Store ─────────────────────────────────────────────────────────
export const useArgusReleaseStore = create<ArgusReleaseListState>((set) => ({
  // Initial state
  ...DEFAULTS,

  // Individual setters
  setCurrentPage: (currentPage) => set({ currentPage }),
  setSearchTerm: (searchTerm) => set({ searchTerm }),
  setSortBy: (sortBy) => set({ sortBy }),

  // Bulk hydration from URL query params
  hydrateFromParams: (params) => set((state) => ({ ...state, ...params })),

  // Full reset to defaults
  resetStore: () => set({ ...DEFAULTS }),
}));

export { DEFAULTS as ARGUS_RELEASE_DEFAULTS };
export type { ArgusReleaseListState };
