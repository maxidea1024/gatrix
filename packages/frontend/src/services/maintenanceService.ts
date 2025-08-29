import { apiService } from './api';

export type MaintenanceType = 'regular' | 'emergency';

export interface MaintenanceDetail {
  type: MaintenanceType;
  endsAt: string | null; // ISO
  message?: string; // default message
  messages?: { ko?: string; en?: string; zh?: string }; // per-language overrides
  updatedAt?: string;
}

export const maintenanceService = {
  async getStatus(): Promise<{ isUnderMaintenance: boolean; detail: MaintenanceDetail | null }> {
    const res = await apiService.get<{ isUnderMaintenance: boolean; detail: MaintenanceDetail | null }>(`/isUnderMaintenance`);
    return res.data as any;
  },
  async setStatus(payload: { isMaintenance: boolean; type?: MaintenanceType; endsAt?: string | null; message?: string; messages?: MaintenanceDetail['messages'] }) {
    return apiService.post(`/maintenance`, payload);
  },
  async getTemplates(): Promise<{ templates: Array<{ message?: string; messages?: MaintenanceDetail['messages'] }> }> {
    const res = await apiService.get<{ templates: Array<{ message?: string; messages?: MaintenanceDetail['messages'] }> }>(`/maintenance/templates`);
    return res.data as any;
  },
  async saveTemplates(templates: Array<{ message?: string; messages?: MaintenanceDetail['messages'] }>) {
    return apiService.post(`/maintenance/templates`, { templates });
  }
};

