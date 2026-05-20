import { createLogger } from '../config/logger';
import { SSENotificationService } from './sse-notification-service';

const logger = createLogger('SpreadsheetCollabService');

// ==================== Types ====================

export interface LockInfo {
  userId: string;
  userName: string;
  lockedAt: Date;
  expiresAt: Date;
}

export interface ViewerInfo {
  userId: string;
  userName: string;
  clientId: string;
  connectedAt: Date;
}

// ==================== Service ====================

const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes
const LOCK_CHECK_INTERVAL_MS = 60 * 1000; // Check every 1 minute

export class SpreadsheetCollabService {
  private static instance: SpreadsheetCollabService;

  /** spreadsheetId → LockInfo */
  private locks: Map<string, LockInfo> = new Map();

  /** spreadsheetId → Map<clientId, ViewerInfo> */
  private presence: Map<string, Map<string, ViewerInfo>> = new Map();

  private expirationTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.startLockExpirationCheck();
  }

  static getInstance(): SpreadsheetCollabService {
    if (!SpreadsheetCollabService.instance) {
      SpreadsheetCollabService.instance = new SpreadsheetCollabService();
    }
    return SpreadsheetCollabService.instance;
  }

  // ==================== Lock Management ====================

  /**
   * Try to acquire an exclusive edit lock on a spreadsheet.
   */
  acquireLock(
    spreadsheetId: string,
    userId: string,
    userName: string
  ): { success: boolean; lock: LockInfo | null } {
    const existing = this.locks.get(spreadsheetId);

    // Already locked by same user — extend TTL
    if (existing && existing.userId === userId) {
      existing.expiresAt = new Date(Date.now() + LOCK_TTL_MS);
      logger.info(
        `Lock extended for spreadsheet ${spreadsheetId} by ${userId}`
      );
      return { success: true, lock: existing };
    }

    // Locked by another user — check if expired
    if (existing) {
      if (existing.expiresAt > new Date()) {
        logger.info(
          `Lock denied for spreadsheet ${spreadsheetId}: locked by ${existing.userId}`
        );
        return { success: false, lock: existing };
      }
      // Expired — remove and allow
      this.locks.delete(spreadsheetId);
      logger.info(
        `Expired lock removed for spreadsheet ${spreadsheetId} (was held by ${existing.userId})`
      );
    }

    // Acquire new lock
    const lock: LockInfo = {
      userId,
      userName,
      lockedAt: new Date(),
      expiresAt: new Date(Date.now() + LOCK_TTL_MS),
    };
    this.locks.set(spreadsheetId, lock);
    logger.info(`Lock acquired for spreadsheet ${spreadsheetId} by ${userId}`);

    // Broadcast to other viewers
    this.broadcastToSheet(spreadsheetId, 'lock_acquired', {
      userId,
      userName,
    });

    return { success: true, lock };
  }

  /**
   * Release an edit lock.
   */
  releaseLock(spreadsheetId: string, userId: string): boolean {
    const existing = this.locks.get(spreadsheetId);
    if (!existing || existing.userId !== userId) {
      return false;
    }

    this.locks.delete(spreadsheetId);
    logger.info(`Lock released for spreadsheet ${spreadsheetId} by ${userId}`);

    // Broadcast to all viewers
    this.broadcastToSheet(spreadsheetId, 'lock_released', {
      userId,
      userName: existing.userName,
    });

    return true;
  }

  /**
   * Extend lock TTL (heartbeat).
   */
  heartbeat(spreadsheetId: string, userId: string): boolean {
    const existing = this.locks.get(spreadsheetId);
    if (!existing || existing.userId !== userId) {
      return false;
    }

    existing.expiresAt = new Date(Date.now() + LOCK_TTL_MS);
    return true;
  }

  /**
   * Get current lock info for a spreadsheet.
   */
  getLockInfo(spreadsheetId: string): LockInfo | null {
    const lock = this.locks.get(spreadsheetId);
    if (!lock) return null;

    // Check if expired
    if (lock.expiresAt <= new Date()) {
      this.locks.delete(spreadsheetId);
      return null;
    }

    return lock;
  }

  // ==================== Presence Management ====================

  /**
   * Register a viewer for a spreadsheet.
   */
  addViewer(
    spreadsheetId: string,
    clientId: string,
    userId: string,
    userName: string
  ): void {
    if (!this.presence.has(spreadsheetId)) {
      this.presence.set(spreadsheetId, new Map());
    }

    const viewers = this.presence.get(spreadsheetId)!;
    viewers.set(clientId, {
      userId,
      userName,
      clientId,
      connectedAt: new Date(),
    });

    logger.info(
      `Viewer ${userId} (${userName}) joined spreadsheet ${spreadsheetId}`
    );

    // Broadcast updated presence list
    this.broadcastPresence(spreadsheetId);
  }

  /**
   * Remove a viewer from a spreadsheet.
   */
  removeViewer(spreadsheetId: string, clientId: string): void {
    const viewers = this.presence.get(spreadsheetId);
    if (!viewers) return;

    const viewer = viewers.get(clientId);
    if (!viewer) return;

    viewers.delete(clientId);
    logger.info(`Viewer ${viewer.userId} left spreadsheet ${spreadsheetId}`);

    // Release lock if this viewer held it
    const lock = this.locks.get(spreadsheetId);
    if (lock && lock.userId === viewer.userId) {
      // Check if user has other connections to this sheet
      const hasOtherConnections = Array.from(viewers.values()).some(
        (v) => v.userId === viewer.userId
      );
      if (!hasOtherConnections) {
        this.releaseLock(spreadsheetId, viewer.userId);
      }
    }

    // Clean up empty presence maps
    if (viewers.size === 0) {
      this.presence.delete(spreadsheetId);
    } else {
      // Broadcast updated presence list
      this.broadcastPresence(spreadsheetId);
    }
  }

  /**
   * Get all current viewers for a spreadsheet (deduplicated by userId).
   */
  getViewers(
    spreadsheetId: string
  ): Array<{ userId: string; userName: string }> {
    const viewers = this.presence.get(spreadsheetId);
    if (!viewers) return [];

    // Deduplicate by userId (a user can have multiple tabs)
    const unique = new Map<string, { userId: string; userName: string }>();
    for (const viewer of viewers.values()) {
      if (!unique.has(viewer.userId)) {
        unique.set(viewer.userId, {
          userId: viewer.userId,
          userName: viewer.userName,
        });
      }
    }

    return Array.from(unique.values());
  }

  // ==================== Version Notification ====================

  /**
   * Notify all viewers that a new version was saved.
   */
  notifyVersionUpdated(
    spreadsheetId: string,
    version: number,
    savedBy: { userId: string; userName: string }
  ): void {
    this.broadcastToSheet(
      spreadsheetId,
      'version_updated',
      { version, savedBy },
      savedBy.userId // exclude the saver
    );
  }

  // ==================== Broadcast Helpers ====================

  private broadcastPresence(spreadsheetId: string): void {
    const viewers = this.getViewers(spreadsheetId);
    const lock = this.getLockInfo(spreadsheetId);

    this.broadcastToSheet(spreadsheetId, 'presence_update', {
      viewers,
      lock: lock ? { userId: lock.userId, userName: lock.userName } : null,
    });
  }

  private broadcastToSheet(
    spreadsheetId: string,
    type: string,
    data: any,
    excludeUserId?: string
  ): void {
    const sseService = SSENotificationService.getInstance();
    const channel = `spreadsheet:${spreadsheetId}`;

    sseService.sendToChannels([channel], {
      type,
      data,
      timestamp: new Date(),
      excludeUsers: excludeUserId ? [excludeUserId] : undefined,
    });
  }

  // ==================== Lock Expiration ====================

  private startLockExpirationCheck(): void {
    this.expirationTimer = setInterval(() => {
      const now = new Date();
      for (const [spreadsheetId, lock] of this.locks.entries()) {
        if (lock.expiresAt <= now) {
          this.locks.delete(spreadsheetId);
          logger.warn(
            `Lock expired for spreadsheet ${spreadsheetId} (was held by ${lock.userId})`
          );

          // Broadcast lock expiration
          this.broadcastToSheet(spreadsheetId, 'lock_expired', {
            userId: lock.userId,
            userName: lock.userName,
          });
        }
      }
    }, LOCK_CHECK_INTERVAL_MS);
  }

  /**
   * Shutdown — clear timers.
   */
  shutdown(): void {
    if (this.expirationTimer) {
      clearInterval(this.expirationTimer);
      this.expirationTimer = null;
    }
    this.locks.clear();
    this.presence.clear();
    logger.info('SpreadsheetCollabService shutdown complete');
  }
}

export default SpreadsheetCollabService;
