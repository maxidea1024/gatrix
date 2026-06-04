import { useState, useCallback, useEffect } from 'react';

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
 * Persists the width to localStorage and handles mouse drag events.
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
    return !isNaN(saved) && saved >= minWidth && saved <= maxWidth ? saved : defaultWidth;
  });
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = splitWidth;

    const onMouseMove = (ev: MouseEvent) => {
      const rawDelta = ev.clientX - startX;
      const delta = invertDelta ? -rawDelta : rawDelta;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));
      setSplitWidth(newWidth);
    };
    const onMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [splitWidth, minWidth, maxWidth, invertDelta]);

  useEffect(() => {
    localStorage.setItem(storageKey, String(splitWidth));
  }, [storageKey, splitWidth]);

  return { splitWidth, isDragging, handleMouseDown };
}
