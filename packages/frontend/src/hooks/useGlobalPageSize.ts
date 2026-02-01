/**
 * Hook to manage global page size setting across all paginated pages
 * The page size is stored in localStorage and shared across all pages
 */
import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'globalPageSize';
const DEFAULT_PAGE_SIZE = 10;
const VALID_PAGE_SIZES = [5, 10, 20, 25, 50, 100];

export function useGlobalPageSize(): [number, (size: number) => void] {
    const [pageSize, setPageSizeState] = useState<number>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = parseInt(saved, 10);
            if (VALID_PAGE_SIZES.includes(parsed)) {
                return parsed;
            }
        }
        return DEFAULT_PAGE_SIZE;
    });

    const setPageSize = useCallback((size: number) => {
        if (VALID_PAGE_SIZES.includes(size)) {
            setPageSizeState(size);
            localStorage.setItem(STORAGE_KEY, String(size));
        }
    }, []);

    // Listen for storage changes from other tabs/windows
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY && e.newValue) {
                const parsed = parseInt(e.newValue, 10);
                if (VALID_PAGE_SIZES.includes(parsed)) {
                    setPageSizeState(parsed);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    return [pageSize, setPageSize];
}

export default useGlobalPageSize;
