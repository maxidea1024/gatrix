import type { Tag } from '@/services/tagService';

export interface GameWorld {
  id: number;
  worldId: string;
  name: string;
  isVisible: boolean;
  isMaintenance: boolean;
  displayOrder: number;
  description?: string;
  tags?: Tag[]; // normalized
  createdAt: string;
  updatedAt: string;
}

export interface CreateGameWorldData {
  worldId: string;
  name: string;
  isVisible?: boolean;
  isMaintenance?: boolean;
  displayOrder?: number;
  description?: string;
  tagIds?: number[]; // normalized
}

export interface UpdateGameWorldData {
  worldId?: string;
  name?: string;
  isVisible?: boolean;
  isMaintenance?: boolean;
  displayOrder?: number;
  description?: string;
  tagIds?: number[]; // normalized
}

export interface GameWorldListParams {
  search?: string;
  sortBy?: 'name' | 'worldId' | 'displayOrder' | 'createdAt' | 'updatedAt';
  sortOrder?: 'ASC' | 'DESC';
  isVisible?: boolean;
  isMaintenance?: boolean;
  tags?: string; // for filtering; comma-separated (server still supports LIKE on world.tags string if needed)
}

export interface GameWorldListResult {
  worlds: GameWorld[];
  total: number;
}
