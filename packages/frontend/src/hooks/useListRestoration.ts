import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Hook to save and restore scroll position and state for list pages.
 * @param state Any state object you want to persist (e.g. { search, page, viewMode })
 * @param onRestore Callback triggered when returning to the page to restore state
 * @param containerId The DOM id of the scrolling container (default: 'main-scroll-container')
 * @param dependencies Dependencies array that indicates when the list is fully rendered (e.g. [loading, items])
 */
export function useListRestoration<T>(
  state: T,
  onRestore: (savedState: T) => void,
  dependencies: any[],
  containerId: string = 'main-scroll-container'
) {
  const location = useLocation();
  const stateKey = `list-state-${location.pathname}`;
  const scrollKey = `list-scroll-${location.pathname}`;
  const isRestored = useRef(false);
  const pendingScroll = useRef<number | null>(null);

  // 1. On mount: Try to restore state
  useEffect(() => {
    try {
      const savedState = sessionStorage.getItem(stateKey);
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        onRestore(parsedState);
      }
      
      const savedScroll = sessionStorage.getItem(scrollKey);
      if (savedScroll) {
        pendingScroll.current = parseInt(savedScroll, 10);
      }
    } catch (e) {
      console.error('Failed to restore list state:', e);
    }
    // We only want this to run once on mount per path
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // 2. On list rendered (dependencies changed): Restore scroll position
  useEffect(() => {
    if (pendingScroll.current !== null) {
      // Use setTimeout to ensure DOM has fully painted the new items
      const timeoutId = setTimeout(() => {
        const container = document.getElementById(containerId);
        if (container) {
          container.scrollTo(0, pendingScroll.current as number);
          isRestored.current = true;
          pendingScroll.current = null;
        }
      }, 50); // slight delay to allow layout
      return () => clearTimeout(timeoutId);
    }
  }, [...dependencies, containerId]);

  // 3. On unmount or path change: Save current state and scroll
  useEffect(() => {
    const handleSave = () => {
      const container = document.getElementById(containerId);
      if (container) {
        sessionStorage.setItem(scrollKey, container.scrollTop.toString());
      }
      sessionStorage.setItem(stateKey, JSON.stringify(state));
    };

    // Save when component unmounts (navigating away)
    return () => {
      handleSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, state, containerId]);
}
