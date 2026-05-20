import { useState, useRef, useCallback, useEffect } from 'react';

export type AutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

interface UseAutoSaveOptions {
  /** Debounce delay in ms (default: 2000) */
  delay?: number;
  /** Callback to perform the save */
  onSave: () => Promise<void>;
  /** Duration to show "saved" status before returning to idle (default: 2000) */
  savedDisplayDuration?: number;
}

interface UseAutoSaveReturn {
  /** Current save status */
  status: AutoSaveStatus;
  /** Mark content as changed — triggers debounced save */
  markDirty: () => void;
  /** Force an immediate save */
  saveNow: () => void;
  /** Last successful save timestamp */
  lastSavedAt: Date | null;
}

/**
 * Auto-save hook with debounce, status tracking, and error retry.
 */
export function useAutoSave({
  delay = 2000,
  onSave,
  savedDisplayDuration = 2000,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const executeSave = useCallback(async () => {
    setStatus('saving');
    try {
      await onSaveRef.current();
      setLastSavedAt(new Date());
      setStatus('saved');

      // Reset to idle after display duration
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => {
        setStatus('idle');
      }, savedDisplayDuration);
    } catch (err) {
      console.error('[useAutoSave] Save failed:', err);
      setStatus('error');
    }
  }, [savedDisplayDuration]);

  const markDirty = useCallback(() => {
    setStatus('pending');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      executeSave();
    }, delay);
  }, [delay, executeSave]);

  const saveNow = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    executeSave();
  }, [executeSave]);

  return { status, markDirty, saveNow, lastSavedAt };
}
