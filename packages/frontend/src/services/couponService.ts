import { api } from './api';

export type CouponType = 'SPECIAL' | 'NORMAL';
export type CouponStatus = 'ACTIVE' | 'DISABLED' | 'DELETED';
export type CodePattern = 'ALPHANUMERIC_8' | 'ALPHANUMERIC_16' | 'ALPHANUMERIC_16_HYPHEN';
export type UsageLimitType = 'USER' | 'CHARACTER';

export interface CouponSetting {
  id: string;
  code?: string | null;
  type: CouponType;
  name: string;
  description?: string | null;
  tags?: any | null;
  maxTotalUses?: number | null;
  perUserLimit?: number;
  usageLimitType?: UsageLimitType;
  rewardTemplateId?: string | null;
  rewardData?: any | null;
  rewardEmailTitle?: string | null;
  rewardEmailBody?: string | null;
  startsAt: string; // ISO from server wrapper
  expiresAt: string;
  status: CouponStatus;
  codePattern?: CodePattern;
  createdAt?: string;
  generationStatus?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  generatedCount?: number;
  totalCount?: number;
  issuedCount?: number; // Actual issued code count from g_coupons table
  usedCount?: number; // Number of times the coupon has been used
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
  characterId?: string | null;
  sequence: number;
  usedAt: string;
  userIp?: string | null;
  gameWorldId?: string | null;
  platform?: string | null;
  channel?: string | null;
  subchannel?: string | null;
  couponName?: string | null;
  couponCode?: string | null;
  couponStartsAt?: string | null;
  couponExpiresAt?: string | null;
}

export interface UsageListResponse {
  records: UsageRecord[];
  total: number;
  page: number;
  limit: number;
}

// Issued codes types
export interface IssuedCouponCode {
  id: string;
  settingId: string;
  code: string;
  status: 'ISSUED' | 'USED' | 'REVOKED';
  createdAt: string;
  usedAt: string | null;
}

export interface IssuedCodesResponse {
  codes: IssuedCouponCode[];
  total: number;
  page?: number;
  limit?: number;
}

export interface IssuedCodesStats {
  issued: number;
  used: number;
  unused: number;
}

// Generation status types
export interface GenerationStatus {
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  generatedCount: number;
  totalCount: number;
  progress: number;
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
  async getUsage(settingId?: string, params?: { page?: number; limit?: number; search?: string; platform?: string; channel?: string; subChannel?: string; gameWorldId?: string; characterId?: string; from?: string; to?: string; }): Promise<UsageListResponse> {
    const url = settingId ? `/admin/coupon-settings/${settingId}/usage` : '/admin/coupon-settings/usage';
    const res = await api.get(url, { params });
    return res.data;
  },
  async exportUsage(params?: { settingId?: string; couponCode?: string; platform?: string; channel?: string; subChannel?: string; gameWorldId?: string; characterId?: string; }): Promise<string> {
    const res = await api.get('/admin/coupon-settings/usage/export', { params, responseType: 'text' });
    return res.data;
  },
  async getIssuedCodesStats(settingId: string): Promise<IssuedCodesStats> {
    const res = await api.get(`/admin/coupon-settings/${settingId}/issued-codes-stats`);
    console.log('[couponService] getIssuedCodesStats response:', res);
    // API service already unwraps response.data, so res = { success: true, data: { issued, used, unused } }
    return res.data;
  },
  async getIssuedCodesForExport(settingId: string, params?: { offset?: number; limit?: number; search?: string }): Promise<IssuedCodesResponse> {
    const res = await api.get(`/admin/coupon-settings/${settingId}/issued-codes-export`, { params });
    console.log('[couponService] getIssuedCodesForExport response:', res);
    // API service already unwraps response.data, so res = { success: true, data: { codes, total, offset, limit, hasMore } }
    return res.data;
  },
  async getIssuedCodes(settingId: string, params?: { page?: number; limit?: number; search?: string }): Promise<IssuedCodesResponse> {
    const res = await api.get(`/admin/coupon-settings/${settingId}/issued-codes`, { params });
    console.log('[couponService] getIssuedCodes response:', res);
    // API service already unwraps response.data, so res = { success: true, data: { codes, total, page, limit } }
    return res.data;
  },
  async getGenerationStatus(settingId: string): Promise<GenerationStatus> {
    const res = await api.get(`/admin/coupon-settings/${settingId}/generation-status`);
    return res.data.data;
  }
};

