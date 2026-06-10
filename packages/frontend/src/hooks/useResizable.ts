import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocalStorage } from './useLocalStorage';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UseResizableOptions {
  /** Resize direction */
  direction: 'horizontal' | 'vertical';
  /** Minimum allowed size in px */
  minSize: number;
  /** Maximum allowed size in px */
  maxSize: number;
  /** localStorage key to persist the last size */
  storageKey: string;
  /** Default size in px if no stored value exists */
  defaultSize: number;
}

export interface UseResizableReturn {
  /** Current size in px */
  size: number;
  /** Set size programmatically */
  setSize: (size: number) => void;
  /** Props to spread on the resize handle element */
  handleProps: {
    onMouseDown: (e: React.MouseEvent) => void;
    style: React.CSSProperties;
    role: string;
    'aria-label': string;
    'aria-orientation': 'horizontal' | 'vertical';
  };
  /** Whether the user is currently dragging */
  isResizing: boolean;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Drag-based resize hook with localStorage persistence.
 *
 * Usage:
 * ```tsx
 * const { size, handleProps } = useResizable({
 *   direction: 'vertical',
 *   minSize: 200,
 *   maxSize: 600,
 *   storageKey: 'panel.height',
 *   defaultSize: 320,
 * });
 *
 * <Box sx={{ height: size }}>content</Box>
 * <div {...handleProps} />
 * ```
 */
export function useResizable(options: UseResizableOptions): UseResizableReturn {
  const { direction, minSize, maxSize, storageKey, defaultSize } = options;

  const [storedSize, setStoredSize] = useLocalStorage(storageKey, defaultSize);
  const [size, setSizeState] = useState(() =>
    Math.max(minSize, Math.min(maxSize, storedSize))
  );
  const [isResizing, setIsResizing] = useState(false);

  const startPosRef = useRef(0);
  const startSizeRef = useRef(0);

  const clamp = useCallback(
    (val: number) => Math.max(minSize, Math.min(maxSize, val)),
    [minSize, maxSize]
  );

  const setSize = useCallback(
    (newSize: number) => {
      const clamped = clamp(newSize);
      setSizeState(clamped);
      setStoredSize(clamped);
    },
    [clamp, setStoredSize]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsResizing(true);
      startPosRef.current = direction === 'horizontal' ? e.clientX : e.clientY;
      startSizeRef.current = size;
    },
    [direction, size]
  );

  useEffect(() => {
    if (!isResizing) return;

    const onMouseMove = (e: MouseEvent) => {
      const currentPos = direction === 'horizontal' ? e.clientX : e.clientY;
      const delta = currentPos - startPosRef.current;
      const newSize = clamp(startSizeRef.current + delta);
      setSizeState(newSize);
    };

    const onMouseUp = () => {
      setIsResizing(false);
      // Persist final size
      setSizeState((currentSize) => {
        setStoredSize(currentSize);
        return currentSize;
      });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor =
      direction === 'horizontal' ? 'col-resize' : 'row-resize';

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, direction, clamp, setStoredSize]);

  const handleProps = {
    onMouseDown,
    style: {
      cursor: direction === 'horizontal' ? 'col-resize' : 'row-resize',
      flexShrink: 0,
      ...(direction === 'horizontal'
        ? { width: 6, minHeight: '100%' }
        : { height: 6, minWidth: '100%' }),
    } as React.CSSProperties,
    role: 'separator',
    'aria-label': `Resize ${direction === 'horizontal' ? 'width' : 'height'}`,
    'aria-orientation': direction as 'horizontal' | 'vertical',
  };

  return { size, setSize, handleProps, isResizing };
}

export default useResizable;
