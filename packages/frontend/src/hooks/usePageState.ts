import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export interface PageState {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  filters?: Record<string, any>;
}

export interface UsePageStateOptions {
  defaultState: PageState;
  storageKey: string;
}

export const usePageState = ({ defaultState, storageKey }: UsePageStateOptions) => {
  const [searchParams, setSearchParams] = useSearchParams();

  // URL params에서 초기 상태를 즉시 읽어서 설정 (렌더링 전에 실행)
  const [pageState, setPageState] = useState<PageState>(() => {
    try {
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || String(defaultState.limit));
      const sortBy = searchParams.get('sortBy') || defaultState.sortBy;
      const sortOrder = (searchParams.get('sortOrder') as 'ASC' | 'DESC') || defaultState.sortOrder;

      // filters는 나머지 모든 params
      const filters: Record<string, any> = {};
      searchParams.forEach((value, key) => {
        if (!['page', 'limit', 'sortBy', 'sortOrder'].includes(key)) {
          // 배열 처리: 같은 키가 여러 개 있으면 배열로
          const existing = filters[key];
          if (existing) {
            filters[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
          } else {
            filters[key] = value;
          }
        }
      });

      return {
        page,
        limit,
        sortBy,
        sortOrder,
        filters: Object.keys(filters).length > 0 ? filters : defaultState.filters,
      };
    } catch (error) {
      console.warn(`Failed to load page state from URL params`, error);
      return defaultState;
    }
  });

  // URL params에 상태 저장
  const savePageState = useCallback(
    (newState: Partial<PageState>) => {
      const updatedState = { ...pageState, ...newState };
      setPageState(updatedState);

      try {
        // URL params 생성
        const params = new URLSearchParams();

        // page, limit, sortBy, sortOrder 추가
        params.set('page', String(updatedState.page));
        params.set('limit', String(updatedState.limit));
        if (updatedState.sortBy) params.set('sortBy', updatedState.sortBy);
        if (updatedState.sortOrder) params.set('sortOrder', updatedState.sortOrder);

        // filters 추가
        if (updatedState.filters) {
          Object.entries(updatedState.filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              if (Array.isArray(value)) {
                // 배열은 같은 키로 여러 번 추가
                value.forEach((v) => {
                  if (v !== undefined && v !== null && v !== '') {
                    params.append(key, String(v));
                  }
                });
              } else {
                params.set(key, String(value));
              }
            }
          });
        }

        // Only set search params if there are any params, otherwise clear the URL
        if (params.toString()) {
          setSearchParams(params, { replace: true });
        } else {
          setSearchParams({}, { replace: true });
        }
      } catch (error) {
        console.warn(`Failed to save page state to URL params`, error);
      }
    },
    [pageState, setSearchParams]
  );

  // 개별 상태 업데이트 함수들
  const updatePage = useCallback(
    (page: number) => {
      savePageState({ page });
    },
    [savePageState]
  );

  const updateLimit = useCallback(
    (limit: number) => {
      savePageState({ limit, page: 1 }); // 페이지 크기 변경 시 첫 페이지로
    },
    [savePageState]
  );

  const updateSort = useCallback(
    (sortBy: string, sortOrder: 'ASC' | 'DESC') => {
      savePageState({ sortBy, sortOrder, page: 1 }); // 정렬 변경 시 첫 페이지로
    },
    [savePageState]
  );

  const updateFilters = useCallback(
    (filters: Record<string, any>) => {
      savePageState({ filters, page: 1 }); // 필터 변경 시 첫 페이지로
    },
    [savePageState]
  );

  const resetState = useCallback(() => {
    setPageState(defaultState);
    setSearchParams({}, { replace: true });
  }, [defaultState, setSearchParams]);

  return {
    pageState,
    updatePage,
    updateLimit,
    updateSort,
    updateFilters,
    savePageState,
    resetState,
  };
};
