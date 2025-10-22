import api from './api';

export interface RewardTypeInfo {
  value: number;
  name: string;
  nameKey: string;
  hasTable: boolean;
  tableFile: string | null;
  itemCount: number;
  descriptionKey: string | null;
}

export interface RewardItem {
  id: number;
  name: string;
}

export interface RewardLookupData {
  [rewardType: string]: {
    rewardType: number;
    rewardTypeName: string;
    tableFile: string | null;
    hasTable: boolean;
    description: string | null;
    idFieldName?: string;
    requiresAmount?: boolean;
    items: RewardItem[];
    itemCount: number;
  };
}

export interface PlanningDataStats {
  totalRewardTypes: number;
  rewardTypesWithTable: number;
  rewardTypesWithoutTable: number;
  totalItems: number;
  rewardTypes: Array<{
    value: number;
    name: string;
    hasTable: boolean;
    itemCount: number;
  }>;
}

class PlanningDataService {
  /**
   * Get reward lookup data
   */
  async getRewardLookup(): Promise<RewardLookupData> {
    const response = await api.get('/admin/planning-data/reward-lookup');
    return response.data;
  }

  /**
   * Get reward type list
   */
  async getRewardTypeList(): Promise<RewardTypeInfo[]> {
    const response = await api.get('/admin/planning-data/reward-types');
    return response.data;
  }

  /**
   * Get items for a specific reward type
   */
  async getRewardTypeItems(rewardType: number): Promise<RewardItem[]> {
    const response = await api.get(`/admin/planning-data/reward-types/${rewardType}/items`);
    return response.data;
  }

  /**
   * Rebuild reward lookup data
   */
  async rebuildRewardLookup(): Promise<{ success: boolean; message: string; stats?: any }> {
    const response = await api.post('/admin/planning-data/rebuild');
    return response.data;
  }

  /**
   * Get planning data statistics
   */
  async getStats(): Promise<PlanningDataStats> {
    const response = await api.get('/admin/planning-data/stats');
    return response.data;
  }
}

export default new PlanningDataService();

