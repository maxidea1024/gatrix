/**
 * Utility functions for maintenance status calculation
 */

/**
 * Calculate the actual maintenance status based on isMaintenance flag and time constraints
 *
 * Rules:
 * 1. If isMaintenance is false, return false
 * 2. If maintenanceStartDate is set and current time is before it, return false (not started yet)
 * 3. If maintenanceEndDate is set and current time is after it, return false (already ended)
 * 4. Otherwise, return true
 *
 * @param isMaintenance - The maintenance flag
 * @param maintenanceStartDate - Optional maintenance start date
 * @param maintenanceEndDate - Optional maintenance end date
 * @returns The actual maintenance status
 */
export function calculateMaintenanceStatus(
  isMaintenance: boolean,
  maintenanceStartDate?: Date | string | null,
  maintenanceEndDate?: Date | string | null
): boolean {
  // If maintenance is not enabled, return false
  if (!isMaintenance) {
    return false;
  }

  const now = new Date();

  // Check if maintenance has started
  if (maintenanceStartDate) {
    const startDate = new Date(maintenanceStartDate);
    if (now < startDate) {
      // Maintenance hasn't started yet
      return false;
    }
  }

  // Check if maintenance has ended
  if (maintenanceEndDate) {
    const endDate = new Date(maintenanceEndDate);
    if (now > endDate) {
      // Maintenance has already ended
      return false;
    }
  }

  // Maintenance is active
  return true;
}

/**
 * Apply maintenance status calculation to a single object
 *
 * @param obj - Object with maintenance fields
 * @returns Object with updated isMaintenance field
 */
export function applyMaintenanceStatusCalculation<
  T extends {
    isMaintenance?: boolean;
    maintenanceStartDate?: Date | string | null;
    maintenanceEndDate?: Date | string | null;
  },
>(obj: T): T {
  if (!obj) return obj;

  const actualStatus = calculateMaintenanceStatus(
    obj.isMaintenance ?? false,
    obj.maintenanceStartDate,
    obj.maintenanceEndDate
  );

  return {
    ...obj,
    isMaintenance: actualStatus,
  };
}

/**
 * Apply maintenance status calculation to an array of objects
 *
 * @param items - Array of objects with maintenance fields
 * @returns Array with updated isMaintenance fields
 */
export function applyMaintenanceStatusCalculationToArray<
  T extends {
    isMaintenance?: boolean;
    maintenanceStartDate?: Date | string | null;
    maintenanceEndDate?: Date | string | null;
  },
>(items: T[]): T[] {
  if (!Array.isArray(items)) return items;
  return items.map((item) => applyMaintenanceStatusCalculation(item));
}
