import { api } from './api';

export type CouponType = 'SPECIAL' | 'NORMAL';
export type CouponStatus = 'ACTIVE' | 'DISABLED' | 'DELETED';

export interface CouponSetting {
  id: string;
  code?: string | null;
  type: CouponType;
  name: string;
  description?: string | null;
  tags?: any | null;
  maxTotalUses?: number | null;
  perUserLimit?: number;
  rewardTemplateId?: string | null;
  rewardData?: any | null;
  startsAt: string; // ISO from server wrapper
  expiresAt: string;
  status: CouponStatus;
}

export interface ListSettingsParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: CouponType;
  status?: CouponStatus;
}

export interface ListSettingsResponse {
  settings: CouponSetting[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCouponSettingInput extends Omit<CouponSetting, 'id'|'status'|'startsAt'|'expiresAt'> {
  startsAt: string; // ISO
  expiresAt: string; // ISO
  status?: CouponStatus;
  quantity?: number; // NORMAL only
  targetWorlds?: string[] | null;
  targetPlatforms?: string[] | null;
  targetChannels?: string[] | null;
  targetSubchannels?: string[] | null;
}

export interface UpdateCouponSettingInput extends Partial<CreateCouponSettingInput> {}

export interface UsageRecord {
  id: string;
  userId: string;
  userName: string;
  sequence: number;
  usedAt: string;
  userIp?: string | null;
  gameWorldId?: string | null;
  platform?: string | null;
  channel?: string | null;
  subchannel?: string | null;
}

export interface UsageListResponse {
  records: UsageRecord[];
  total: number;
  page: number;
  limit: number;
}

export const couponService = {
  async listSettings(params?: ListSettingsParams): Promise<ListSettingsResponse> {
    const res = await api.get('/admin/coupon-settings', { params });
    return res.data;
  },
  async getSetting(id: string): Promise<{ setting: any }> {
    const res = await api.get(`/admin/coupon-settings/${id}`);
    return res.data;
  },
  async createSetting(data: CreateCouponSettingInput): Promise<{ setting: any }> {
    const res = await api.post('/admin/coupon-settings', data);
    return res.data;
  },
  async updateSetting(id: string, data: UpdateCouponSettingInput): Promise<{ setting: any }> {
    const res = await api.patch(`/admin/coupon-settings/${id}`, data);
    return res.data;
  },
  async deleteSetting(id: string): Promise<void> {
    await api.delete(`/admin/coupon-settings/${id}`);
  },
  async getUsage(settingId: string, params?: { page?: number; limit?: number; search?: string; platform?: string; gameWorldId?: string; from?: string; to?: string; }): Promise<UsageListResponse> {
    const res = await api.get(`/admin/coupon-settings/${settingId}/usage`, { params });
    return res.data;
  }
};

