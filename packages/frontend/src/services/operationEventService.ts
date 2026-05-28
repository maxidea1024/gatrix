import api from './api';

export interface HotTimeBuffOverride {
  id?: string;
  environmentId?: string;
  worldIds?: string[] | null; // null or [] = global (all worlds)
  cmsId: number;
  enabled: boolean;
  startDateOverride?: string | null;
  endDateOverride?: string | null;
  startHourOverride?: number | null;
  endHourOverride?: number | null;
  minLvOverride?: number | null;
  maxLvOverride?: number | null;
  bitFlagDayOfWeekOverride?: number | null;
  worldBuffIdOverride?: number[] | null;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

class OperationEventService {
  /**
   * Fetch all HotTimeBuff overrides for the current environment.
   * @returns Record<cmsId, HotTimeBuffOverride>
   */
  async getHottimeOverrides(
    projectApiPath: string
  ): Promise<Record<string, HotTimeBuffOverride>> {
    const response = await api.get(
      `${projectApiPath}/operation-events/hottime-overrides`
    );
    return response.data;
  }

  /**
   * Batch apply changed overrides (triggered by the "Apply" button).
   */
  async applyHottimeOverrides(
    projectApiPath: string,
    overrides: HotTimeBuffOverride[]
  ): Promise<Record<string, HotTimeBuffOverride>> {
    const response = await api.put(
      `${projectApiPath}/operation-events/hottime-overrides`,
      { overrides }
    );
    return response.data;
  }

  /**
   * Delete an individual override (restore to CMS defaults).
   */
  async deleteHottimeOverride(
    projectApiPath: string,
    cmsId: number
  ): Promise<void> {
    await api.delete(
      `${projectApiPath}/operation-events/hottime-overrides/${cmsId}`
    );
  }
}

const operationEventService = new OperationEventService();
export default operationEventService;
