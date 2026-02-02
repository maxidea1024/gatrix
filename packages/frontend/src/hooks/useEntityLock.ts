/**
 * useEntityLock Hook
 *
 * Provides soft-lock functionality for entity editing.
 * Automatically handles:
 * - Lock acquisition when editing starts
 * - Lock release when editing ends
 * - Heartbeat to extend lock while editing
 * - Warning display for conflicts
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";
import entityLockService, {
  LockInfo,
  PendingCR,
} from "@/services/entityLockService";
import { useEnvironment } from "@/contexts/EnvironmentContext";

interface UseEntityLockOptions {
  /** Table name (e.g., 'g_service_notices') */
  table: string;
  /** Entity ID being edited (null for create mode) */
  entityId: string | number | null;
  /** Whether editing is active */
  isEditing: boolean;
  /** Callback when lock is lost (optional) */
  onLockLost?: () => void;
}

interface UseEntityLockResult {
  /** Whether lock is held by current user */
  hasLock: boolean;
  /** Lock info if locked by another user */
  lockedBy: LockInfo | null;
  /** Pending CR info if exists */
  pendingCR: PendingCR | null;
  /** Whether loading lock status */
  loading: boolean;
  /** Force acquire lock from another user */
  forceTakeover: () => Promise<boolean>;
  /** Release the lock manually */
  releaseLock: () => Promise<void>;
}

export function useEntityLock({
  table,
  entityId,
  isEditing,
  onLockLost,
}: UseEntityLockOptions): UseEntityLockResult {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { currentEnvironment } = useEnvironment();

  const [hasLock, setHasLock] = useState(false);
  const [lockedBy, setLockedBy] = useState<LockInfo | null>(null);
  const [pendingCR, setPendingCR] = useState<PendingCR | null>(null);
  const [loading, setLoading] = useState(false);

  // Use refs to track state without causing re-renders
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockAcquiredRef = useRef(false);
  const isAcquiringRef = useRef(false);
  const hasRunRef = useRef(false); // Track if effect has already run for this edit session

  // Store callbacks in refs to avoid dependency issues
  const onLockLostRef = useRef(onLockLost);
  onLockLostRef.current = onLockLost;

  // Store environment values in refs for stable access
  const environmentRef = useRef(currentEnvironment?.environment || "");
  const softLockEnabledRef = useRef(
    currentEnvironment?.enableSoftLock ?? false,
  );
  const hardLockEnabledRef = useRef(
    currentEnvironment?.enableHardLock ?? false,
  );

  // Update refs when environment changes
  useEffect(() => {
    environmentRef.current = currentEnvironment?.environment || "";
    softLockEnabledRef.current = currentEnvironment?.enableSoftLock ?? false;
    hardLockEnabledRef.current = currentEnvironment?.enableHardLock ?? false;
  }, [currentEnvironment]);

  // Release lock (exposed for manual use)
  const releaseLock = useCallback(async () => {
    const environment = environmentRef.current;
    if (!entityId || !environment || !table || !lockAcquiredRef.current) return;

    try {
      await entityLockService.releaseLock(table, entityId, environment);
      setHasLock(false);
      lockAcquiredRef.current = false;
    } catch (error) {
      console.error("[useEntityLock] Failed to release lock:", error);
    }
  }, [entityId, table]);

  // Force takeover
  const forceTakeover = useCallback(async () => {
    const environment = environmentRef.current;
    if (!entityId || !environment || !table) return false;

    try {
      const success = await entityLockService.forceAcquireLock(
        table,
        entityId,
        environment,
      );
      if (success) {
        setHasLock(true);
        setLockedBy(null);
        lockAcquiredRef.current = true;
        enqueueSnackbar(t("entityLock.lockTakenOver"), { variant: "success" });
        return true;
      }
      return false;
    } catch (error) {
      console.error("[useEntityLock] Failed to force takeover:", error);
      return false;
    }
  }, [entityId, table, t, enqueueSnackbar]);

  // Reset state and release lock when editing stops
  useEffect(() => {
    if (!isEditing) {
      // Release lock if we had acquired it
      if (
        lockAcquiredRef.current &&
        entityId &&
        environmentRef.current &&
        table
      ) {
        console.log("[useEntityLock] Releasing lock on edit stop");
        entityLockService.releaseLock(table, entityId, environmentRef.current);
        lockAcquiredRef.current = false;
      }
      // Reset flags
      hasRunRef.current = false;
      isAcquiringRef.current = false;
      setHasLock(false);
      setLockedBy(null);
      setPendingCR(null);
      // Stop heartbeat
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    }
  }, [isEditing, entityId, table]);

  // Listen for lock release events via SSE - retry lock when blocked entity is released
  useEffect(() => {
    const handleLockReleased = async (event: CustomEvent) => {
      const {
        table: releasedTable,
        entityId: releasedEntityId,
        environment: releasedEnv,
      } = event.detail;

      // Check if this release is for the entity we're waiting on
      if (
        isEditing &&
        entityId &&
        String(entityId) === String(releasedEntityId) &&
        table === releasedTable &&
        environmentRef.current === releasedEnv &&
        lockedBy !== null && // We were blocked
        !lockAcquiredRef.current // We don't have the lock
      ) {
        console.log(
          "[useEntityLock] Lock released by other user, retrying acquisition...",
        );

        // Try to acquire the lock
        try {
          const result = await entityLockService.acquireLock(
            table,
            entityId,
            environmentRef.current,
          );
          if (result.success) {
            setHasLock(true);
            setLockedBy(null);
            lockAcquiredRef.current = true;
            enqueueSnackbar(t("entityLock.lockAcquired"), {
              variant: "success",
            });
          }
        } catch (error) {
          console.error(
            "[useEntityLock] Failed to acquire lock after release:",
            error,
          );
        }
      }
    };

    window.addEventListener(
      "entity-lock-released",
      handleLockReleased as EventListener,
    );
    return () => {
      window.removeEventListener(
        "entity-lock-released",
        handleLockReleased as EventListener,
      );
    };
  }, [isEditing, entityId, table, lockedBy, enqueueSnackbar, t]);

  // Listen for lock takeover events via SSE - update UI when our lock is taken
  useEffect(() => {
    const handleLockTakenOver = (event: CustomEvent) => {
      const {
        table: takenTable,
        entityId: takenEntityId,
        environment: takenEnv,
        newOwner,
      } = event.detail;

      // Check if this takeover is for our entity and we had the lock
      if (
        isEditing &&
        entityId &&
        String(entityId) === String(takenEntityId) &&
        table === takenTable &&
        environmentRef.current === takenEnv &&
        lockAcquiredRef.current // We had the lock
      ) {
        console.log("[useEntityLock] Lock taken over by:", newOwner);

        // Update state to reflect lock loss
        setHasLock(false);
        setLockedBy({
          userId: newOwner.userId,
          userName: newOwner.userName,
          userEmail: newOwner.userEmail,
          lockedAt: Date.now(),
          expiresAt: Date.now() + 5 * 60 * 1000, // Assume 5 min
        });
        lockAcquiredRef.current = false;

        // Stop heartbeat
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }

        // Show notification
        enqueueSnackbar(
          t("entityLock.lockTakenBy", {
            userName: newOwner.userName,
            userEmail: newOwner.userEmail,
          }),
          { variant: "warning" },
        );

        // Call callback
        onLockLostRef.current?.();
      }
    };

    window.addEventListener(
      "entity-lock-taken-over",
      handleLockTakenOver as EventListener,
    );
    return () => {
      window.removeEventListener(
        "entity-lock-taken-over",
        handleLockTakenOver as EventListener,
      );
    };
  }, [isEditing, entityId, table, enqueueSnackbar, t]);

  // Effect: Acquire lock when editing starts (runs once per edit session)
  useEffect(() => {
    // Only run if editing and have entityId
    if (!isEditing || !entityId) {
      return;
    }

    // Prevent running multiple times for same edit session
    if (
      hasRunRef.current ||
      lockAcquiredRef.current ||
      isAcquiringRef.current
    ) {
      return;
    }

    const environment = environmentRef.current;
    const softLockEnabled = softLockEnabledRef.current;
    const hardLockEnabled = hardLockEnabledRef.current;

    let isMounted = true;
    hasRunRef.current = true;
    isAcquiringRef.current = true;

    const handleLockAcquisition = async () => {
      // Soft lock handling
      if (softLockEnabled && environment) {
        setLoading(true);
        try {
          const result = await entityLockService.acquireLock(
            table,
            entityId,
            environment,
          );
          console.log("[useEntityLock] acquire result:", result);
          if (!isMounted) return;

          if (result.success) {
            setHasLock(true);
            setLockedBy(null);
            lockAcquiredRef.current = true;
          } else {
            console.log(
              "[useEntityLock] Lock failed, lockedBy:",
              result.lockedBy,
            );
            setHasLock(false);
            setLockedBy(result.lockedBy || null);
            // No toast here - the Alert in the form is sufficient
          }
        } catch (error) {
          console.error("[useEntityLock] Failed to acquire lock:", error);
          if (isMounted) {
            setHasLock(true); // Fail open
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
          isAcquiringRef.current = false;
        }
      } else {
        setHasLock(true);
        isAcquiringRef.current = false;
      }

      // Hard lock handling (check for pending CRs)
      if (hardLockEnabled && environment) {
        try {
          const result = await entityLockService.checkLock(
            table,
            entityId,
            environment,
          );
          if (!isMounted) return;

          if (result.pendingCR) {
            setPendingCR(result.pendingCR);
            enqueueSnackbar(
              t("entityLock.pendingCRDetail", {
                crTitle: result.pendingCR.crTitle,
                crId: result.pendingCR.crId,
              }),
              { variant: "info" },
            );
          }
        } catch (error) {
          console.error("[useEntityLock] Failed to check pending CR:", error);
        }
      }

      // Start heartbeat only if we acquired the lock
      if (lockAcquiredRef.current && softLockEnabled && environment) {
        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
        }
        heartbeatRef.current = setInterval(async () => {
          if (!lockAcquiredRef.current) return;
          const success = await entityLockService.extendLock(
            table,
            entityId,
            environmentRef.current,
          );
          if (!success) {
            console.warn("[useEntityLock] Lock extension failed");
            onLockLostRef.current?.();
          }
        }, 30000); // 30 second heartbeat
      }
    };

    handleLockAcquisition();

    return () => {
      isMounted = false;
      // Stop heartbeat on cleanup
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [isEditing, entityId, table, t, enqueueSnackbar]);

  // Effect: Release lock on unmount
  useEffect(() => {
    return () => {
      if (
        lockAcquiredRef.current &&
        entityId &&
        environmentRef.current &&
        table
      ) {
        // Fire and forget release
        entityLockService.releaseLock(table, entityId, environmentRef.current);
        lockAcquiredRef.current = false;
      }
      // Cleanup heartbeat
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [entityId, table]);

  return {
    hasLock,
    lockedBy,
    pendingCR,
    loading,
    forceTakeover,
    releaseLock,
  };
}

export default useEntityLock;
