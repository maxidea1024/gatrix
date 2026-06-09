import { useState, useCallback, useRef } from 'react';

export interface UseResizableSplitOptions {
  /** localStorage key to persist width */
  storageKey: string;
  /** Default width in px */
  defaultWidth?: number;
  /** Minimum width in px */
  minWidth?: number;
  /** Maximum width in px */
  maxWidth?: number;
  /**
   * If true, moving mouse left increases width (right-side panel).
   * If false, moving mouse right increases width (left-side panel).
   * @default false
   */
  invertDelta?: boolean;
}

export interface UseResizableSplitReturn {
  /** Current width of the resizable panel */
  splitWidth: number;
  /** Whether the user is currently dragging */
  isDragging: boolean;
  /** Attach this to the splitter handle's onMouseDown */
  handleMouseDown: (e: React.MouseEvent) => void;
}

/**
 * Reusable hook for resizable split panels.
 *
 * Performance: During drag, state updates are coalesced via requestAnimationFrame
 * so that at most one React re-render occurs per browser paint frame.
 * localStorage is only written on mouseup (not on every pixel move).
 */
export function useResizableSplit({
  storageKey,
  defaultWidth = 320,
  minWidth = 250,
  maxWidth = 600,
  invertDelta = false,
}: UseResizableSplitOptions): UseResizableSplitReturn {
  const [splitWidth, setSplitWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem(storageKey) || '', 10);
    return !isNaN(saved) && saved >= minWidth && saved <= maxWidth
      ? saved
      : defaultWidth;
  });
  const [isDragging, setIsDragging] = useState(false);

  // Ref to track the latest width during drag (for mouseup persist)
  const latestWidthRef = useRef(splitWidth);
  latestWidthRef.current = splitWidth;
  // rAF-based throttle: pending frame ID
  const rafRef = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      const startX = e.clientX;
      const startWidth = latestWidthRef.current;
      // Track the latest desired width across mousemove events
      let pendingWidth = startWidth;

      const onMouseMove = (ev: MouseEvent) => {
        const rawDelta = ev.clientX - startX;
        const delta = invertDelta ? -rawDelta : rawDelta;
        pendingWidth = Math.min(
          maxWidth,
          Math.max(minWidth, startWidth + delta)
        );

        // rAF throttle: coalesce multiple mousemove events into one state update per frame
        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            rafRef.current = 0;
            setSplitWidth(pendingWidth);
          });
        }
      };

      const onMouseUp = (ev: MouseEvent) => {
        // Cancel any pending rAF to prevent stale update
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
        setIsDragging(false);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        // Final precise width from the last mouse position
        const rawDelta = ev.clientX - startX;
        const delta = invertDelta ? -rawDelta : rawDelta;
        const finalWidth = Math.min(
          maxWidth,
          Math.max(minWidth, startWidth + delta)
        );
        setSplitWidth(finalWidth);

        // Persist to localStorage only once on drag end
        localStorage.setItem(storageKey, String(finalWidth));
      };

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [storageKey, minWidth, maxWidth, invertDelta]
  );

  return { splitWidth, isDragging, handleMouseDown };
}
