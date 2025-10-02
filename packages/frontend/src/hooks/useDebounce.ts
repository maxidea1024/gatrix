import { useState, useEffect } from 'react';

/**
 * 디바운싱 훅
 * @param value 디바운싱할 값
 * @param delay 지연 시간 (밀리초)
 * @returns 디바운싱된 값
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
 * 디바운싱된 콜백 훅
 * @param callback 실행할 콜백 함수
 * @param delay 지연 시간 (밀리초)
 * @param deps 의존성 배열
 * @returns 디바운싱된 콜백 함수
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
