import { apiService } from './api';

export type MaintenanceType = 'regular' | 'emergency';

export interface MaintenanceDetail {
  type: MaintenanceType;
  startsAt?: string | null; // ISO
  endsAt: string | null; // ISO
  message?: string; // default message
  messages?: { ko?: string; en?: string; zh?: string }; // per-language overrides (deprecated, use localeMessages)
  localeMessages?: { ko?: string; en?: string; zh?: string }; // per-language overrides
  kickExistingPlayers?: boolean;
  kickDelayMinutes?: number;
  updatedAt?: string;
  updatedBy?: {
    id: number;
    name: string;
    email: string;
  } | null;
}

export const maintenanceService = {
  async getStatus(): Promise<{ isUnderMaintenance: boolean; detail: MaintenanceDetail | null }> {
    // Add cache-busting to avoid browser caching stale maintenance status
    const res = await apiService.get<{ isUnderMaintenance: boolean; detail: MaintenanceDetail | null }>(
      `/admin/maintenance/isUnderMaintenance`,
      { headers: { 'Cache-Control': 'no-cache' } }
    );
    return res.data as any;
  },
  async setStatus(payload: { isMaintenance: boolean; type?: MaintenanceType; startsAt?: string | null; endsAt?: string | null; kickExistingPlayers?: boolean; kickDelayMinutes?: number; message?: string; messages?: MaintenanceDetail['messages'] }) {
    return apiService.post(`/admin/maintenance`, payload);
  },
  async getTemplates(): Promise<{ templates: Array<{ message?: string; messages?: MaintenanceDetail['messages'] }> }> {
    const res = await apiService.get<{ templates: Array<{ message?: string; messages?: MaintenanceDetail['messages'] }> }>(`/admin/maintenance/templates`);
    return res.data as any;
  },
  async saveTemplates(templates: Array<{ message?: string; messages?: MaintenanceDetail['messages'] }>) {
    return apiService.post(`/admin/maintenance/templates`, { templates });
  }
};

