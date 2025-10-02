import { api } from './api';
import { 
  GameWorld, 
  CreateGameWorldData, 
  UpdateGameWorldData, 
  GameWorldListParams,
  GameWorldListResult 
} from '../types/gameWorld';

export const gameWorldService = {
  // Get list of game worlds
  async getGameWorlds(params?: GameWorldListParams): Promise<GameWorldListResult> {
    try {
      const response = await api.get('/admin/game-worlds', { params });

      // 응답 구조 확인 - 두 가지 경우 모두 처리
      let data: any;
      if (response.data?.data) {
        // 표준 응답 구조: { success: true, data: { worlds: [], total: 0 } }
        data = response.data.data;
      } else if (response.data?.worlds !== undefined) {
        // 직접 응답 구조: { worlds: [], total: 0 }
        data = response.data;
      } else {
        console.error('Invalid response structure:', response.data);
        throw new Error('Invalid response structure');
      }

      return {
        worlds: (data.worlds || []),
        total: data.total || 0
      };
    } catch (error: any) {
      console.error('API Error:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get game world by ID
  async getGameWorldById(id: number): Promise<GameWorld> {
    const response = await api.get(`/admin/game-worlds/id/${id}`);
    return response.data?.data?.world || response.data?.world;
  },

  // Get game world by world ID
  async getGameWorldByWorldId(worldId: string): Promise<GameWorld> {
    const response = await api.get(`/admin/game-worlds/world/${worldId}`);
    return response.data?.data?.world || response.data?.world;
  },

  // Create new game world
  async createGameWorld(data: CreateGameWorldData): Promise<GameWorld> {
    const response = await api.post('/admin/game-worlds', data);
    return response.data?.data?.world || response.data?.world;
  },

  // Update game world
  async updateGameWorld(id: number, data: UpdateGameWorldData): Promise<GameWorld> {
    const response = await api.put(`/admin/game-worlds/${id}`, data);
    return response.data?.data?.world || response.data?.world;
  },

  // Delete game world
  async deleteGameWorld(id: number): Promise<void> {
    await api.delete(`/admin/game-worlds/${id}`);
  },

  // Toggle visibility
  async toggleVisibility(id: number): Promise<GameWorld> {
    const response = await api.patch(`/admin/game-worlds/${id}/toggle-visibility`);
    return response.data?.data?.world || response.data?.world;
  },

  // Toggle maintenance status
  async toggleMaintenance(id: number): Promise<GameWorld> {
    const response = await api.patch(`/admin/game-worlds/${id}/toggle-maintenance`);
    return response.data?.data?.world || response.data?.world;
  },

  // Update display orders
  async updateDisplayOrders(orderUpdates: { id: number; displayOrder: number }[]): Promise<void> {
    console.log('Sending updateDisplayOrders request:', { orderUpdates });
    const response = await api.patch('/admin/game-worlds/update-orders', { orderUpdates });
    console.log('updateDisplayOrders response:', response.data);
  },

  // Move world up
  async moveUp(id: number): Promise<boolean> {
    const response = await api.patch(`/admin/game-worlds/${id}/move-up`);
    return response.data?.data?.moved ?? response.data?.moved ?? false;
  },

  // Move world down
  async moveDown(id: number): Promise<boolean> {
    const response = await api.patch(`/admin/game-worlds/${id}/move-down`);
    return response.data?.data?.moved ?? response.data?.moved ?? false;
  }
};
