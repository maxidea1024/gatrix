import { apiService } from './api';
import { User, UserFilters, UserListResponse } from '@/types';

export class UserService {
  static async getUsers(
    page: number = 1,
    limit: number = 10,
    filters?: UserFilters
  ): Promise<UserListResponse> {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });
    }

    const response = await apiService.get<UserListResponse>(`/users?${params.toString()}`);
    
    if (response.success && response.data) {
      return response.data;
    }
    
    throw new Error(response.error?.message || 'Failed to fetch users');
  }

  static async getUserById(id: number): Promise<User> {
    const response = await apiService.get<{ user: User }>(`/users/${id}`);
    
    if (response.success && response.data) {
      return response.data.user;
    }
    
    throw new Error(response.error?.message || 'Failed to fetch user');
  }

  static async updateUser(id: number, data: Partial<User>): Promise<User> {
    const response = await apiService.put<{ user: User }>(`/users/${id}`, data);
    
    if (response.success && response.data) {
      return response.data.user;
    }
    
    throw new Error(response.error?.message || 'Failed to update user');
  }

  static async deleteUser(id: number): Promise<void> {
    const response = await apiService.delete(`/users/${id}`);
    
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to delete user');
    }
  }

  static async approveUser(id: number): Promise<User> {
    const response = await apiService.post<{ user: User }>(`/users/${id}/approve`);
    
    if (response.success && response.data) {
      return response.data.user;
    }
    
    throw new Error(response.error?.message || 'Failed to approve user');
  }

  static async rejectUser(id: number): Promise<void> {
    const response = await apiService.post(`/users/${id}/reject`);
    
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to reject user');
    }
  }

  static async suspendUser(id: number): Promise<User> {
    const response = await apiService.post<{ user: User }>(`/users/${id}/suspend`);
    
    if (response.success && response.data) {
      return response.data.user;
    }
    
    throw new Error(response.error?.message || 'Failed to suspend user');
  }

  static async unsuspendUser(id: number): Promise<User> {
    const response = await apiService.post<{ user: User }>(`/users/${id}/unsuspend`);
    
    if (response.success && response.data) {
      return response.data.user;
    }
    
    throw new Error(response.error?.message || 'Failed to unsuspend user');
  }

  static async promoteToAdmin(id: number): Promise<User> {
    const response = await apiService.post<{ user: User }>(`/users/${id}/promote`);
    
    if (response.success && response.data) {
      return response.data.user;
    }
    
    throw new Error(response.error?.message || 'Failed to promote user to admin');
  }

  static async demoteFromAdmin(id: number): Promise<User> {
    const response = await apiService.post<{ user: User }>(`/users/${id}/demote`);
    
    if (response.success && response.data) {
      return response.data.user;
    }
    
    throw new Error(response.error?.message || 'Failed to demote user from admin');
  }

  static async getPendingUsers(): Promise<User[]> {
    const response = await apiService.get<{ users: User[] }>('/users/pending');
    
    if (response.success && response.data) {
      return response.data.users;
    }
    
    throw new Error(response.error?.message || 'Failed to fetch pending users');
  }

  static async getUserStats(): Promise<{
    total: number;
    active: number;
    pending: number;
    suspended: number;
    admins: number;
  }> {
    const response = await apiService.get<{ stats: any }>('/users/stats');
    
    if (response.success && response.data) {
      return response.data.stats;
    }
    
    throw new Error(response.error?.message || 'Failed to fetch user statistics');
  }
}
