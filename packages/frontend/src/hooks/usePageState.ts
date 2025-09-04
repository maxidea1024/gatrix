import { useState, useEffect, useCallback } from 'react';

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
  const [pageState, setPageState] = useState<PageState>(defaultState);

  // localStorage에서 상태 로드
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(storageKey);
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        // 기본값과 병합하여 누락된 필드 보완
        setPageState({
          ...defaultState,
          ...parsedState,
          // 페이지는 항상 1로 초기화 (새로고침 시 첫 페이지부터 시작)
          page: 1,
        });
      }
    } catch (error) {
      console.warn(`Failed to load page state from localStorage for key: ${storageKey}`, error);
      // 오류 발생 시 기본값 사용
      setPageState(defaultState);
    }
  }, [storageKey]); // defaultState 제거

  // localStorage에 상태 저장
  const savePageState = useCallback((newState: Partial<PageState>) => {
    const updatedState = { ...pageState, ...newState };
    setPageState(updatedState);
    
    try {
      localStorage.setItem(storageKey, JSON.stringify(updatedState));
    } catch (error) {
      console.warn(`Failed to save page state to localStorage for key: ${storageKey}`, error);
    }
  }, [pageState, storageKey]);

  // 개별 상태 업데이트 함수들
  const updatePage = useCallback((page: number) => {
    savePageState({ page });
  }, [savePageState]);

  const updateLimit = useCallback((limit: number) => {
    savePageState({ limit, page: 1 }); // 페이지 크기 변경 시 첫 페이지로
  }, [savePageState]);

  const updateSort = useCallback((sortBy: string, sortOrder: 'ASC' | 'DESC') => {
    savePageState({ sortBy, sortOrder, page: 1 }); // 정렬 변경 시 첫 페이지로
  }, [savePageState]);

  const updateFilters = useCallback((filters: Record<string, any>) => {
    savePageState({ filters, page: 1 }); // 필터 변경 시 첫 페이지로
  }, [savePageState]);

  const resetState = useCallback(() => {
    setPageState(defaultState);
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn(`Failed to remove page state from localStorage for key: ${storageKey}`, error);
    }
  }, [defaultState, storageKey]);

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
