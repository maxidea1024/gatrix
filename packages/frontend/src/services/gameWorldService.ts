import { api } from './api';
import axios from 'axios';
import {
  GameWorld,
  CreateGameWorldData,
  UpdateGameWorldData,
  GameWorldListParams,
  GameWorldListResult
} from '../types/gameWorld';

// Extended response type to indicate if change request was created
export interface GameWorldMutationResult {
  world?: GameWorld;
  isChangeRequest: boolean;
  changeRequestId?: string;
}

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
  async createGameWorld(data: CreateGameWorldData): Promise<GameWorldMutationResult> {
    // Ensure boolean fields are actually boolean, not numbers
    const sanitizedData = {
      ...data,
      ...(data.isVisible !== undefined && { isVisible: Boolean(data.isVisible) }),
      ...(data.isMaintenance !== undefined && { isMaintenance: Boolean(data.isMaintenance) }),
      ...(data.supportsMultiLanguage !== undefined && { supportsMultiLanguage: Boolean(data.supportsMultiLanguage) }),
    };
    const response: any = await api.post('/admin/game-worlds', sanitizedData);

    // Check if this is a change request response
    // api.post returns response.data, so we check for changeRequestId in data property
    const responseData = response.data || response;
    if (responseData?.changeRequestId) {
      return {
        world: undefined,
        isChangeRequest: true,
        changeRequestId: responseData.changeRequestId,
      };
    }

    return {
      world: responseData?.world || responseData?.data?.world,
      isChangeRequest: false,
    };
  },

  // Update game world
  async updateGameWorld(id: number, data: UpdateGameWorldData): Promise<GameWorldMutationResult> {
    // Ensure boolean fields are actually boolean, not numbers
    const sanitizedData = {
      ...data,
      ...(data.isVisible !== undefined && { isVisible: Boolean(data.isVisible) }),
      ...(data.isMaintenance !== undefined && { isMaintenance: Boolean(data.isMaintenance) }),
      ...(data.supportsMultiLanguage !== undefined && { supportsMultiLanguage: Boolean(data.supportsMultiLanguage) }),
    };
    const response: any = await api.put(`/admin/game-worlds/${id}`, sanitizedData);

    // Check if this is a change request response
    // api.put returns response.data, so we check for changeRequestId in data property
    const responseData = response.data || response;
    if (responseData?.changeRequestId) {
      return {
        world: undefined,
        isChangeRequest: true,
        changeRequestId: responseData.changeRequestId,
      };
    }

    return {
      world: responseData?.world || responseData?.data?.world,
      isChangeRequest: false,
    };
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

  // Update maintenance status with details
  async updateMaintenance(id: number, data: {
    isMaintenance: boolean;
    maintenanceStartDate?: string;
    maintenanceEndDate?: string;
    maintenanceMessage?: string;
    maintenanceMessageTemplateId?: number | null;
    supportsMultiLanguage?: boolean;
    maintenanceLocales?: Array<{ lang: 'ko' | 'en' | 'zh'; message: string }>;
    forceDisconnect?: boolean;
    gracePeriodMinutes?: number;
  }): Promise<GameWorld> {
    // Ensure boolean fields are actually boolean
    const sanitizedData = {
      ...data,
      isMaintenance: Boolean(data.isMaintenance),
      ...(data.supportsMultiLanguage !== undefined && { supportsMultiLanguage: Boolean(data.supportsMultiLanguage) }),
      ...(data.forceDisconnect !== undefined && { forceDisconnect: Boolean(data.forceDisconnect) }),
    };
    const response = await api.patch(`/admin/game-worlds/${id}/maintenance`, sanitizedData);
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
