/**
 * ArgusRealtimeService — SSE-based real-time issue stream.
 *
 * Connects to the Argus backend SSE endpoint and emits events for:
 * - New issues
 * - Issue status changes
 * - New events on existing issues
 * - Issue assignment changes
 *
 * Pattern follows spreadsheetCollabService.ts
 */

export type ArgusRealtimeEventType =
  | 'issue:created'
  | 'issue:updated'
  | 'issue:resolved'
  | 'issue:deleted'
  | 'event:created'
  | 'stats:updated'
  | 'connected'
  | 'heartbeat';

export interface ArgusRealtimeEvent {
  type: ArgusRealtimeEventType;
  data: any;
  timestamp: string;
}

type ArgusRealtimeHandler = (event: ArgusRealtimeEvent) => void;

class ArgusRealtimeService {
  private eventSource: EventSource | null = null;
  private handlers: Map<ArgusRealtimeEventType, ArgusRealtimeHandler[]> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private projectId: string | null = null;
  private _isConnected = false;

  get isConnected(): boolean {
    return this._isConnected;
  }

  /**
   * Connect to the Argus SSE stream for a project.
   */
  connect(projectId: string): void {
    this.disconnect();
    this.projectId = projectId;

    const token = localStorage.getItem('accessToken');
    const url = `/api/v1/argus/${projectId}/stream?token=${encodeURIComponent(token || '')}`;

    try {
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this._isConnected = true;
        this.emit('connected', {
          type: 'connected',
          data: { projectId },
          timestamp: new Date().toISOString(),
        });
      };

      this.eventSource.onmessage = (event) => {
        try {
          const parsed: ArgusRealtimeEvent = JSON.parse(event.data);
          this.emit(parsed.type, parsed);
        } catch {
          // Ignore parse errors (e.g., ping/heartbeat text)
        }
      };

      // Listen for named event types
      const eventTypes: ArgusRealtimeEventType[] = [
        'issue:created', 'issue:updated', 'issue:resolved',
        'issue:deleted', 'event:created', 'stats:updated',
      ];
      for (const eventType of eventTypes) {
        this.eventSource.addEventListener(eventType, (event: any) => {
          try {
            const parsed: ArgusRealtimeEvent = {
              type: eventType,
              data: JSON.parse(event.data),
              timestamp: new Date().toISOString(),
            };
            this.emit(eventType, parsed);
          } catch {
            // Ignore parse errors
          }
        });
      }

      this.eventSource.onerror = () => {
        this._isConnected = false;
        console.warn('[Argus Realtime] SSE connection error — will auto-reconnect');
        // EventSource auto-reconnects, but if it closes permanently, schedule manual reconnect
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          this.scheduleReconnect();
        }
      };
    } catch (e) {
      console.error('[Argus Realtime] Failed to create EventSource:', e);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from the SSE stream.
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this._isConnected = false;
    this.projectId = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  /**
   * Schedule a reconnection attempt after a delay.
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.projectId) {
        console.log('[Argus Realtime] Attempting reconnection...');
        this.connect(this.projectId);
      }
    }, 5000);
  }

  // ==================== Event Subscription ====================

  on(type: ArgusRealtimeEventType, handler: ArgusRealtimeHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  off(type: ArgusRealtimeEventType, handler: ArgusRealtimeHandler): void {
    const list = this.handlers.get(type);
    if (list) {
      const idx = list.indexOf(handler);
      if (idx > -1) list.splice(idx, 1);
    }
  }

  removeAllListeners(): void {
    this.handlers.clear();
  }

  private emit(type: ArgusRealtimeEventType, event: ArgusRealtimeEvent): void {
    const list = this.handlers.get(type);
    if (list) {
      list.forEach((handler) => {
        try {
          handler(event);
        } catch (e) {
          console.error('[Argus Realtime] Event handler error:', e);
        }
      });
    }
  }
}

// Singleton
export const argusRealtimeService = new ArgusRealtimeService();
export default argusRealtimeService;
