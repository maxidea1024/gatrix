import dayjs from "dayjs";

export type MaintenanceStatusType = "inactive" | "scheduled" | "active";

export interface MaintenanceDetail {
  type?: "regular" | "emergency";
  startsAt?: string | null;
  endsAt?: string | null;
  message?: string;
  localeMessages?: { ko?: string; en?: string; zh?: string };
  kickExistingPlayers?: boolean;
  kickDelayMinutes?: number;
}

/**
 * Compute maintenance status based on current time and maintenance detail
 * @param isMaintenance - Whether maintenance is enabled
 * @param detail - Maintenance detail with start/end times
 * @returns 'inactive' | 'scheduled' | 'active'
 */
export function computeMaintenanceStatus(
  isMaintenance: boolean,
  detail?: MaintenanceDetail | null,
): MaintenanceStatusType {
  if (!isMaintenance || !detail) {
    return "inactive";
  }

  const now = dayjs();
  const startsAt = detail.startsAt ? dayjs(detail.startsAt) : null;
  const endsAt = detail.endsAt ? dayjs(detail.endsAt) : null;

  // If start time is in the future, it's scheduled
  if (startsAt && now.isBefore(startsAt)) {
    return "scheduled";
  }

  // If end time is in the past, it's inactive
  if (endsAt && now.isAfter(endsAt)) {
    return "inactive";
  }

  // Otherwise, it's active
  return "active";
}

/**
 * Get status label and color for UI display
 */
export function getMaintenanceStatusDisplay(status: MaintenanceStatusType) {
  const statusConfig = {
    inactive: {
      label: "maintenance.statusInactive",
      color: "#10b981", // green
      bgColor: "rgba(16, 185, 129, 0.1)",
      icon: "✓",
    },
    scheduled: {
      label: "maintenance.statusScheduled",
      color: "#f59e0b", // amber
      bgColor: "rgba(245, 158, 11, 0.1)",
      icon: "⏱️",
    },
    active: {
      label: "maintenance.statusActive",
      color: "#ef4444", // red
      bgColor: "rgba(239, 68, 68, 0.1)",
      icon: "🔧",
    },
  };

  return statusConfig[status];
}
