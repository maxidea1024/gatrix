import api from './api';

// ==================== Types ====================

export interface CollabViewer {
  userId: string;
  userName: string;
}

export interface CollabLockInfo {
  userId: string;
  userName: string;
}

export interface CollabState {
  viewers: CollabViewer[];
  lock: CollabLockInfo | null;
  version: number;
}

export type CollabEventType =
  | 'initial_state'
  | 'presence_update'
  | 'lock_acquired'
  | 'lock_released'
  | 'lock_expired'
  | 'version_updated';

export interface CollabEvent {
  type: CollabEventType;
  data: any;
  timestamp: string;
}

type CollabEventHandler = (event: CollabEvent) => void;

// ==================== Service ====================

class SpreadsheetCollabService {
  private eventSource: EventSource | null = null;
  private handlers: Map<CollabEventType, CollabEventHandler[]> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private spreadsheetId: string | null = null;

  /**
   * Connect to the SSE event stream for a spreadsheet.
   */
  connect(spreadsheetId: string): void {
    this.disconnect(); // Clean up any existing connection

    this.spreadsheetId = spreadsheetId;
    const token = localStorage.getItem('accessToken');
    // api is an ApiService instance (not raw axios), so we construct the base URL manually.
    // In dev, Vite proxy handles /api/v1; in prod, same-origin.
    const baseUrl = '/api/v1';

    // SSE requires a GET request — pass auth via query param
    const url = `${baseUrl}/admin/spreadsheets/${spreadsheetId}/events?token=${encodeURIComponent(token || '')}`;

    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      try {
        const parsed: CollabEvent = JSON.parse(event.data);
        this.emit(parsed.type, parsed);
      } catch (e) {
        // Ignore parse errors (e.g. ping events)
      }
    };

    this.eventSource.onerror = () => {
      // EventSource will auto-reconnect on transient errors
      console.warn('[Collab] SSE connection error — will auto-reconnect');
    };
  }

  /**
   * Disconnect from the SSE stream and clean up.
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.stopHeartbeat();
    this.spreadsheetId = null;
  }

  /**
   * Acquire edit lock.
   * Returns true if lock was granted, false if denied.
   */
  async acquireLock(spreadsheetId: string): Promise<{
    success: boolean;
    lockedBy?: CollabLockInfo;
  }> {
    try {
      const response = await api.post(
        `/admin/spreadsheets/${spreadsheetId}/lock`
      );
      if (response.success) {
        this.startHeartbeat(spreadsheetId);
        return { success: true };
      }
      return { success: false };
    } catch (error: any) {
      if (error.response?.status === 423) {
        return {
          success: false,
          lockedBy: error.response.data?.data?.lockedBy,
        };
      }
      throw error;
    }
  }

  /**
   * Release edit lock.
   */
  async releaseLock(spreadsheetId: string): Promise<void> {
    this.stopHeartbeat();
    try {
      await api.delete(`/admin/spreadsheets/${spreadsheetId}/lock`);
    } catch {
      // Ignore errors on release — server will auto-expire anyway
    }
  }

  /**
   * Start heartbeat to keep lock alive (30s interval).
   */
  private startHeartbeat(spreadsheetId: string): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(async () => {
      try {
        await api.post(`/admin/spreadsheets/${spreadsheetId}/heartbeat`);
      } catch {
        // If heartbeat fails, lock will expire naturally
        console.warn('[Collab] Heartbeat failed');
      }
    }, 30_000);
  }

  /**
   * Stop heartbeat timer.
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ==================== Event Subscription ====================

  on(type: CollabEventType, handler: CollabEventHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  off(type: CollabEventType, handler: CollabEventHandler): void {
    const list = this.handlers.get(type);
    if (list) {
      const idx = list.indexOf(handler);
      if (idx > -1) list.splice(idx, 1);
    }
  }

  removeAllListeners(): void {
    this.handlers.clear();
  }

  private emit(type: CollabEventType, event: CollabEvent): void {
    const list = this.handlers.get(type);
    if (list) {
      list.forEach((handler) => {
        try {
          handler(event);
        } catch (e) {
          console.error('[Collab] Event handler error:', e);
        }
      });
    }
  }
}

// Singleton
export const spreadsheetCollabService = new SpreadsheetCollabService();
export default spreadsheetCollabService;
