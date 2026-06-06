import { useState, useCallback } from 'react';

/**
 * localStorage와 동기화되는 상태 hook.
 * - 초기값은 localStorage에 저장된 값을 우선 사용하고, 없으면 `defaultValue`를 사용합니다.
 * - JSON 직렬화/역직렬화를 자동으로 처리합니다.
 * - localStorage 접근 실패 시 (private browsing 등) graceful fallback합니다.
 *
 * @example
 * const [collapsed, setCollapsed] = useLocalStorage('sidebar_collapsed', false);
 * const [pageSize, setPageSize] = useLocalStorage('page_size', 20);
 */
export function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? (JSON.parse(item) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const nextValue = value instanceof Function ? value(prev) : value;
        try {
          localStorage.setItem(key, JSON.stringify(nextValue));
        } catch {
          /* quota exceeded or private browsing */
        }
        return nextValue;
      });
    },
    [key]
  );

  return [storedValue, setValue];
}

export default useLocalStorage;
