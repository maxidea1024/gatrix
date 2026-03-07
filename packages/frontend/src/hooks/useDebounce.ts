import { useState, useEffect } from 'react';

/**
 * Debouncing 훅
 * @param value Debouncing할 값
 * @param delay 지연 시간 (밀리초)
 * @returns Debouncing된 값
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debouncing된 Callback 훅
 * @param callback 실행할 Callback 함수
 * @param delay 지연 시간 (밀리초)
 * @param deps 의존성 배열
 * @returns Debouncing된 Callback 함수
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): T {
  const [debouncedCallback, setDebouncedCallback] = useState<T>(() => callback);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCallback(() => callback);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [callback, delay, ...deps]);

  return debouncedCallback;
}
