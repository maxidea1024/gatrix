export interface GameWorld {
  id: number;
  worldId: string;
  name: string;
  isVisible: boolean;
  isMaintenance: boolean;
  displayOrder: number;
  description?: string;
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
}

export interface UpdateGameWorldData {
  worldId?: string;
  name?: string;
  isVisible?: boolean;
  isMaintenance?: boolean;
  displayOrder?: number;
  description?: string;
}

export interface GameWorldListParams {
  search?: string;
  sortBy?: 'name' | 'worldId' | 'displayOrder' | 'createdAt' | 'updatedAt';
  sortOrder?: 'ASC' | 'DESC';
  isVisible?: boolean;
  isMaintenance?: boolean;
}

export interface GameWorldListResult {
  worlds: GameWorld[];
  total: number;
}
