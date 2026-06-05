import { useState, useCallback, useRef, useEffect } from 'react';

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
  /**
   * Ref to attach to the element whose width should be resized.
   * During drag, width is set via DOM style (no React re-render).
   */
  panelRef: React.RefObject<HTMLElement>;
}

/**
 * Reusable hook for resizable split panels.
 *
 * Performance: During drag, the width is applied directly via DOM style on the
 * panelRef element. This completely avoids React re-renders while dragging.
 * React state (splitWidth) is only updated once on mouseup.
 * localStorage is also only written on mouseup.
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

  const panelRef = useRef<HTMLElement>(null);
  // Track latest width for mouseup persist
  const latestWidthRef = useRef(splitWidth);
  latestWidthRef.current = splitWidth;

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const startX = e.clientX;
    const startWidth = latestWidthRef.current;

    const onMouseMove = (ev: MouseEvent) => {
      const rawDelta = ev.clientX - startX;
      const delta = invertDelta ? -rawDelta : rawDelta;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));

      // Update DOM directly — no React re-render
      latestWidthRef.current = newWidth;
      if (panelRef.current) {
        panelRef.current.style.width = `${newWidth}px`;
      }
    };

    const onMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Single React state update + localStorage persist
      const finalWidth = latestWidthRef.current;
      setSplitWidth(finalWidth);
      localStorage.setItem(storageKey, String(finalWidth));
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [storageKey, minWidth, maxWidth, invertDelta]);

  return { splitWidth, isDragging, handleMouseDown, panelRef };
}
