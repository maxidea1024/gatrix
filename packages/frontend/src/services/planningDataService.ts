import api from "./api";

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
  nameKr?: string; // Korean name (original)
  nameEn?: string; // English name
  nameCn?: string; // Chinese name (from loctab)
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
   * Helper function to get current language code
   * Gets language from localStorage (set by i18next)
   */
  private getCurrentLanguage(): "kr" | "en" | "zh" {
    try {
      const lang = localStorage.getItem("i18nextLng") || "ko";
      // Map language codes to API format
      const langMap: Record<string, "kr" | "en" | "zh"> = {
        en: "en",
        ko: "kr", // Changed from 'ko' to 'kr'
        zh: "zh",
      };
      return langMap[lang] || "kr"; // Changed default from 'ko' to 'kr'
    } catch {
      return "kr"; // Changed default from 'ko' to 'kr'
    }
  }

  /**
   * Get reward lookup data
   */
  async getRewardLookup(): Promise<RewardLookupData> {
    const lang = this.getCurrentLanguage();
    const response = await api.get("/admin/planning-data/reward-lookup", {
      params: { lang },
    });
    return response.data;
  }

  /**
   * Get reward type list
   */
  async getRewardTypeList(): Promise<RewardTypeInfo[]> {
    const response = await api.get("/admin/planning-data/reward-types");
    return response.data;
  }

  /**
   * Get items for a specific reward type
   * @param rewardType - Reward type number
   * @param language - Language code (kr, en, zh)
   */
  async getRewardTypeItems(
    rewardType: number,
    language?: "kr" | "en" | "zh",
  ): Promise<RewardItem[]> {
    const lang = language || this.getCurrentLanguage();
    const response = await api.get(
      `/admin/planning-data/reward-types/${rewardType}/items`,
      { params: { lang } },
    );
    return response.data;
  }

  /**
   * Rebuild reward lookup data
   */
  async rebuildRewardLookup(): Promise<{
    success: boolean;
    message: string;
    stats?: any;
  }> {
    const response = await api.post("/admin/planning-data/rebuild");
    return response.data;
  }

  /**
   * Get UI list data (nations, towns, villages, etc.)
   */
  async getUIListData(): Promise<UIListData> {
    const lang = this.getCurrentLanguage();
    const response = await api.get("/admin/planning-data/ui-list", {
      params: { lang },
    });
    return response.data;
  }

  /**
   * Get items for a specific UI list category
   * @param category - Category name (nations, towns, villages, ships, mates, etc.)
   */
  async getUIListItems(category: string): Promise<any[]> {
    const lang = this.getCurrentLanguage();
    const response = await api.get(
      `/admin/planning-data/ui-list/${category}/items`,
      { params: { lang } },
    );
    return response.data;
  }

  /**
   * Get planning data statistics
   */
  async getStats(): Promise<PlanningDataStats> {
    const response = await api.get("/admin/planning-data/stats");
    return response.data;
  }

  /**
   * Get HotTimeBuff lookup data
   */
  async getHotTimeBuffLookup(): Promise<HotTimeBuffLookup> {
    const lang = this.getCurrentLanguage();
    const response = await api.get("/admin/planning-data/hottimebuff", {
      params: { lang },
    });
    // api.get() returns { success, data: { totalCount, items }, message }
    // We need to return just the data part
    return response.data as HotTimeBuffLookup;
  }

  /**
   * Build HotTimeBuff lookup data
   */
  async buildHotTimeBuffLookup(): Promise<{
    success: boolean;
    message: string;
    itemCount: number;
  }> {
    const response = await api.post("/admin/planning-data/hottimebuff/build");
    return response.data;
  }

  /**
   * Get EventPage lookup data
   */
  async getEventPageLookup(): Promise<any> {
    const lang = this.getCurrentLanguage();
    const response = await api.get("/admin/planning-data/eventpage", {
      params: { lang },
    });
    // api.get() returns { success, data: { totalCount, items }, message }
    // We need to return just the data part
    return response.data;
  }

  /**
   * Build EventPage lookup data
   */
  async buildEventPageLookup(): Promise<{
    success: boolean;
    message: string;
    itemCount: number;
  }> {
    const response = await api.post("/admin/planning-data/eventpage/build");
    return response.data;
  }

  /**
   * Get LiveEvent lookup data
   */
  async getLiveEventLookup(): Promise<any> {
    const lang = this.getCurrentLanguage();
    const response = await api.get("/admin/planning-data/liveevent", {
      params: { lang },
    });
    // api.get() returns { success, data: { totalCount, items }, message }
    // We need to return just the data part
    return response.data;
  }

  /**
   * Build LiveEvent lookup data
   */
  async buildLiveEventLookup(): Promise<{
    success: boolean;
    message: string;
    itemCount: number;
  }> {
    const response = await api.post("/admin/planning-data/liveevent/build");
    return response.data;
  }

  /**
   * Get MateRecruitingGroup lookup data
   */
  async getMateRecruitingGroupLookup(): Promise<any> {
    const lang = this.getCurrentLanguage();
    const response = await api.get("/admin/planning-data/materecruiting", {
      params: { lang },
    });
    return response.data;
  }

  /**
   * Build MateRecruitingGroup lookup data
   */
  async buildMateRecruitingGroupLookup(): Promise<{
    success: boolean;
    message: string;
    itemCount: number;
  }> {
    const response = await api.post(
      "/admin/planning-data/materecruiting/build",
    );
    return response.data;
  }

  /**
   * Get OceanNpcAreaSpawner lookup data
   */
  async getOceanNpcAreaSpawnerLookup(): Promise<any> {
    const lang = this.getCurrentLanguage();
    const response = await api.get("/admin/planning-data/oceannpcarea", {
      params: { lang },
    });
    return response.data;
  }

  /**
   * Build OceanNpcAreaSpawner lookup data
   */
  async buildOceanNpcAreaSpawnerLookup(): Promise<{
    success: boolean;
    message: string;
    itemCount: number;
  }> {
    const response = await api.post("/admin/planning-data/oceannpcarea/build");
    return response.data;
  }

  /**
   * Upload planning data files (drag & drop)
   * @param files - Files to upload
   * @param comment - Optional upload comment
   * @param forceUpload - Force upload even if data hasn't changed
   */
  async uploadPlanningData(
    files: File[],
    comment?: string,
    forceUpload?: boolean,
  ): Promise<{
    success: boolean;
    message: string;
    filesUploaded: string[];
    stats: any;
    uploadRecord?: UploadRecord;
  }> {
    const formData = new FormData();

    // Add each file to FormData
    files.forEach((file) => {
      formData.append("files", file, file.name);
    });

    // Add optional comment
    if (comment) {
      formData.append("comment", comment);
    }

    // Add force upload flag
    if (forceUpload) {
      formData.append("forceUpload", "true");
    }

    const response = await api.post("/admin/planning-data/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  }

  /**
   * Preview diff before uploading
   * Compares uploaded files with cached data without saving
   */
  async previewDiff(
    files: File[],
    onProgress?: (progress: number) => void,
  ): Promise<PreviewDiffResult> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    const response = await api.post(
      "/admin/planning-data/preview-diff",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const progress = Math.round(
              (progressEvent.loaded / progressEvent.total) * 100,
            );
            onProgress(progress);
          }
        },
      },
    );

    return response.data;
  }

  /**
   * Get upload history
   */
  async getUploadHistory(limit: number = 20): Promise<UploadRecord[]> {
    const response = await api.get("/admin/planning-data/history", {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Get latest upload record
   */
  async getLatestUpload(): Promise<UploadRecord | null> {
    const response = await api.get("/admin/planning-data/latest");
    return response.data;
  }

  /**
   * Reset all upload history
   */
  async resetUploadHistory(): Promise<{ deletedCount: number }> {
    const response = await api.delete("/admin/planning-data/history");
    return response.data;
  }
}

export interface PreviewDiffResult {
  changedFiles: string[];
  fileDiffs: Record<
    string,
    {
      added: Array<{ path: string; value: any }>;
      removed: Array<{ path: string; value: any }>;
      modified: Array<{ path: string; before: any; after: any }>;
    }
  >;
  summary: {
    totalAdded: number;
    totalRemoved: number;
    totalModified: number;
  };
}

export interface UploadRecord {
  id: number;
  uploadHash: string;
  filesUploaded: string[];
  filesCount: number;
  totalSize: number;
  uploaderName: string | null;
  uploadSource: "web" | "cli";
  uploadComment: string | null;
  changedFiles: string[];
  fileDiffs?: Record<
    string,
    {
      added: Array<{ path: string; value: any }>;
      removed: Array<{ path: string; value: any }>;
      modified: Array<{ path: string; before: any; after: any }>;
    }
  >;
  uploadedAt: string;
}

export default new PlanningDataService();
