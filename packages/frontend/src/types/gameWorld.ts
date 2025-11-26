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
  forceDisconnect?: boolean; // Force disconnect existing players when maintenance starts
  gracePeriodMinutes?: number; // Grace period in minutes before disconnecting players
  customPayload?: Record<string, any> | null;
  infraSettings?: Record<string, any> | null; // Infrastructure settings for game server configuration (passed to SDK)
  infraSettingsRaw?: string | null; // Original JSON5 source for editing (preserves comments)
  worldServerAddress: string; // Required: URL or host:port format (e.g., https://world.example.com or world.example.com:8080)
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
  forceDisconnect?: boolean;
  gracePeriodMinutes?: number;
  customPayload?: Record<string, any> | null;
  infraSettings?: Record<string, any> | null;
  infraSettingsRaw?: string | null;
  worldServerAddress: string; // Required: ip:port format (e.g., 192.168.1.100:8080)
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
  forceDisconnect?: boolean;
  gracePeriodMinutes?: number;
  customPayload?: Record<string, any> | null;
  infraSettings?: Record<string, any> | null;
  infraSettingsRaw?: string | null;
  tagIds?: number[]; // normalized
}

export interface GameWorldListParams {
  search?: string;
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
