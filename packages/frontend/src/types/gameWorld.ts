import type { Tag } from '@/services/tagService';

export interface GameWorldMaintenanceLocale {
  lang: 'ko' | 'en' | 'zh';
  message: string;
}

export interface GameWorld {
  id: number;
  worldId: string;
  name: string;
  isVisible: boolean;
  isMaintenance: boolean;
  displayOrder: number;
  description?: string;
  maintenanceStartDate?: string;
  maintenanceEndDate?: string;
  maintenanceMessage?: string;
  maintenanceMessageTemplateId?: number | null;
  supportsMultiLanguage?: boolean;
  maintenanceLocales?: GameWorldMaintenanceLocale[];
  customPayload?: Record<string, any> | null;
  tags?: Tag[]; // normalized
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  createdByEmail?: string;
  updatedByName?: string;
  updatedByEmail?: string;
}

export interface CreateGameWorldData {
  worldId: string;
  name: string;
  isVisible?: boolean;
  isMaintenance?: boolean;
  displayOrder?: number;
  description?: string;
  maintenanceStartDate?: string;
  maintenanceEndDate?: string;
  maintenanceMessage?: string;
  supportsMultiLanguage?: boolean;
  maintenanceLocales?: GameWorldMaintenanceLocale[];
  customPayload?: Record<string, any> | null;
  tagIds?: number[]; // normalized
}

export interface UpdateGameWorldData {
  worldId?: string;
  name?: string;
  isVisible?: boolean;
  isMaintenance?: boolean;
  displayOrder?: number;
  description?: string;
  maintenanceStartDate?: string;
  maintenanceEndDate?: string;
  maintenanceMessage?: string;
  supportsMultiLanguage?: boolean;
  maintenanceLocales?: GameWorldMaintenanceLocale[];
  customPayload?: Record<string, any> | null;
  tagIds?: number[]; // normalized
}

export interface GameWorldListParams {
  search?: string;
  sortBy?: 'name' | 'worldId' | 'displayOrder' | 'createdAt' | 'updatedAt';
  sortOrder?: 'ASC' | 'DESC';
  isVisible?: boolean;
  isMaintenance?: boolean;
  // Prefer tagIds for server-side filtering; keep tags for backward compatibility
  tagIds?: string; // comma-separated IDs, e.g., "1,2,3"
  tags?: string; // deprecated: comma-separated names or legacy filter
}

export interface GameWorldListResult {
  worlds: GameWorld[];
  total: number;
}
