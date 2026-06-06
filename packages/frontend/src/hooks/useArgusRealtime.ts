/**
 * useArgusRealtime — Hook for connecting to the Argus real-time SSE stream.
 *
 * Usage:
 *   const { isConnected, newIssueCount } = useArgusRealtime(projectId, {
 *     onIssueCreated: (data) => { ... },
 *     onIssueUpdated: (data) => { ... },
 *   });
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import argusRealtimeService, {
  ArgusRealtimeEvent,
  ArgusRealtimeEventType,
} from '@/services/argusRealtimeService';

interface UseArgusRealtimeOptions {
  onIssueCreated?: (data: any) => void;
  onIssueUpdated?: (data: any) => void;
  onIssueResolved?: (data: any) => void;
  onEventCreated?: (data: any) => void;
  enabled?: boolean;
}

interface UseArgusRealtimeReturn {
  isConnected: boolean;
  newIssueCount: number;
  resetNewIssueCount: () => void;
}

export function useArgusRealtime(
  projectId: string | undefined,
  options: UseArgusRealtimeOptions = {}
): UseArgusRealtimeReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [newIssueCount, setNewIssueCount] = useState(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const enabled = options.enabled !== false;

  useEffect(() => {
    if (!projectId || !enabled) return;

    // Connect (Temporarily disabled to prevent 404 loops since backend SSE stream is not implemented)
    // argusRealtimeService.connect(projectId);

    const handleConnected = () => setIsConnected(true);
    const handleIssueCreated = (event: ArgusRealtimeEvent) => {
      setNewIssueCount((prev) => prev + 1);
      optionsRef.current.onIssueCreated?.(event.data);
    };
    const handleIssueUpdated = (event: ArgusRealtimeEvent) => {
      optionsRef.current.onIssueUpdated?.(event.data);
    };
    const handleIssueResolved = (event: ArgusRealtimeEvent) => {
      optionsRef.current.onIssueResolved?.(event.data);
    };
    const handleEventCreated = (event: ArgusRealtimeEvent) => {
      optionsRef.current.onEventCreated?.(event.data);
    };

    argusRealtimeService.on('connected', handleConnected);
    argusRealtimeService.on('issue:created', handleIssueCreated);
    argusRealtimeService.on('issue:updated', handleIssueUpdated);
    argusRealtimeService.on('issue:resolved', handleIssueResolved);
    argusRealtimeService.on('event:created', handleEventCreated);

    return () => {
      argusRealtimeService.off('connected', handleConnected);
      argusRealtimeService.off('issue:created', handleIssueCreated);
      argusRealtimeService.off('issue:updated', handleIssueUpdated);
      argusRealtimeService.off('issue:resolved', handleIssueResolved);
      argusRealtimeService.off('event:created', handleEventCreated);
      // argusRealtimeService.disconnect();
      setIsConnected(false);
    };
  }, [projectId, enabled]);

  const resetNewIssueCount = useCallback(() => {
    setNewIssueCount(0);
  }, []);

  return { isConnected, newIssueCount, resetNewIssueCount };
}
