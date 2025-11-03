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
  nameKr?: string;  // Korean name (original)
  nameEn?: string;  // English name
  nameCn?: string;  // Chinese name (from loctab)
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

export interface UIListData {
  nations: Array<{ id: number; name: string }>;
  towns: Array<{ id: number; name: string; nationId?: number }>;
  villages: Array<{ id: number; name: string; townId?: number }>;
  [key: string]: any; // For other lists like ships, mates, etc.
}

export interface PlanningDataStats {
  totalRewardTypes: number;
  rewardTypesWithTable: number;
  rewardTypesWithoutTable: number;
  totalItems: number;
  filesExist?: {
    rewardLookup: boolean;
    rewardTypeList: boolean;
    localizationKr: boolean;
    localizationUs: boolean;
    localizationCn: boolean;
    uiListData: boolean;
  };
  uiListCounts?: Record<string, number>;
  rewardTypes: Array<{
    value: number;
    name: string;
    nameKey: string;
    hasTable: boolean;
    itemCount: number;
  }>;
}

export interface HotTimeBuffItem {
  id: number;
  name?: string; // Display name based on world buffs
  startDate: string; // ISO8601 format (UTC)
  endDate: string; // ISO8601 format (UTC)
  localBitflag: number;
  startHour: number; // UTC hour (0-23)
  endHour: number; // UTC hour (0-23)
  minLv: number;
  maxLv: number;
  bitFlagDayOfWeek: number;
  worldBuffId: number[];
  worldBuffNames?: string[];
}

export interface HotTimeBuffLookup {
  totalCount: number;
  items: HotTimeBuffItem[];
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
   * @param rewardType - Reward type number
   * @param language - Language code (kr, en, cn)
   */
  async getRewardTypeItems(rewardType: number, language?: 'kr' | 'en' | 'cn'): Promise<RewardItem[]> {
    const params = language ? { lang: language } : {};
    const response = await api.get(`/admin/planning-data/reward-types/${rewardType}/items`, { params });
    return response.data;
  }

  /**
   * Get reward type localization
   * @param language - Language code (kr, us, cn)
   */
  async getRewardLocalization(language: 'kr' | 'us' | 'cn'): Promise<Record<string, string>> {
    const response = await api.get(`/admin/planning-data/localization/${language}`);
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
   * Get localization data for a specific language
   */
  async getLocalization(language: 'kr' | 'us' | 'cn'): Promise<Record<string, string>> {
    const response = await api.get(`/admin/planning-data/localization/${language}`);
    return response.data;
  }

  /**
   * Get UI list data (nations, towns, villages, etc.)
   */
  async getUIListData(): Promise<UIListData> {
    const response = await api.get('/admin/planning-data/ui-list');
    return response.data;
  }

  /**
   * Get items for a specific UI list category
   * @param category - Category name (nations, towns, villages, ships, mates, etc.)
   * @param language - Language code (kr, en, cn)
   */
  async getUIListItems(category: string, language?: 'kr' | 'en' | 'cn'): Promise<any[]> {
    const params = language ? { lang: language } : {};
    const response = await api.get(`/admin/planning-data/ui-list/${category}/items`, { params });
    return response.data;
  }

  /**
   * Get planning data statistics
   */
  async getStats(): Promise<PlanningDataStats> {
    const response = await api.get('/admin/planning-data/stats');
    return response.data;
  }

  /**
   * Get HotTimeBuff lookup data
   */
  async getHotTimeBuffLookup(): Promise<HotTimeBuffLookup> {
    const response = await api.get('/admin/planning-data/hottimebuff');
    return response.data;
  }

  /**
   * Build HotTimeBuff lookup data
   */
  async buildHotTimeBuffLookup(): Promise<{ success: boolean; message: string; itemCount: number }> {
    const response = await api.post('/admin/planning-data/hottimebuff/build');
    return response.data;
  }

  /**
   * Get EventPage lookup data
   */
  async getEventPageLookup(): Promise<any> {
    const response = await api.get('/admin/planning-data/eventpage');
    return response.data;
  }

  /**
   * Build EventPage lookup data
   */
  async buildEventPageLookup(): Promise<{ success: boolean; message: string; itemCount: number }> {
    const response = await api.post('/admin/planning-data/eventpage/build');
    return response.data;
  }

  /**
   * Get LiveEvent lookup data
   */
  async getLiveEventLookup(): Promise<any> {
    const response = await api.get('/admin/planning-data/liveevent');
    return response.data;
  }

  /**
   * Build LiveEvent lookup data
   */
  async buildLiveEventLookup(): Promise<{ success: boolean; message: string; itemCount: number }> {
    const response = await api.post('/admin/planning-data/liveevent/build');
    return response.data;
  }

  /**
   * Get MateRecruitingGroup lookup data
   */
  async getMateRecruitingGroupLookup(): Promise<any> {
    const response = await api.get('/admin/planning-data/materecruiting');
    return response.data;
  }

  /**
   * Build MateRecruitingGroup lookup data
   */
  async buildMateRecruitingGroupLookup(): Promise<{ success: boolean; message: string; itemCount: number }> {
    const response = await api.post('/admin/planning-data/materecruiting/build');
    return response.data;
  }

  /**
   * Get OceanNpcAreaSpawner lookup data
   */
  async getOceanNpcAreaSpawnerLookup(): Promise<any> {
    const response = await api.get('/admin/planning-data/oceannpcarea');
    return response.data;
  }

  /**
   * Build OceanNpcAreaSpawner lookup data
   */
  async buildOceanNpcAreaSpawnerLookup(): Promise<{ success: boolean; message: string; itemCount: number }> {
    const response = await api.post('/admin/planning-data/oceannpcarea/build');
    return response.data;
  }

  /**
   * Upload planning data files (drag & drop)
   */
  async uploadPlanningData(files: File[]): Promise<{ success: boolean; message: string; filesUploaded: string[]; stats: any }> {
    const formData = new FormData();

    // Add each file to FormData
    files.forEach((file) => {
      formData.append('files', file, file.name);
    });

    const response = await api.post('/admin/planning-data/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  }
}

export default new PlanningDataService();

