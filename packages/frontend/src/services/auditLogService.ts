import { apiService } from './api';
import { AuditLog } from '../types';
import { devLogger, prodLogger } from '../utils/logger';

export interface AuditLogFilters {
  user?: string; // email or name
  action?: string;
  resource_type?: string;
  start_date?: string;
  end_date?: string;
  ip_address?: string;
}

export interface AuditLogListResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditLogStats {
  action: string;
  count: number;
}

export class AuditLogService {
  private static readonly BASE_URL = '/audit-logs';

  /**
   * Get audit logs with pagination and filters
   */
  static async getAuditLogs(
    page: number = 1,
    limit: number = 10,
    filters: AuditLogFilters = {}
  ): Promise<AuditLogListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      _t: Date.now().toString(), // Cache busting
    });

    // Add filters to params
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value.toString());
      }
    });

    const response = await apiService.get<{ success: boolean; data: AuditLogListResponse }>(
      `${this.BASE_URL}?${params}`
    );

    // ApiService.request()가 이미 response.data를 반환하므로
    // response는 백엔드에서 보낸 { success: true, data: {...} } 구조
    if (response?.success && response?.data) {
      return response.data;
    }
    // 응답이 올바르지 않은 경우 기본값 반환
    return {
      logs: [],
      total: 0,
      page: page,
      limit: limit,
    };
  }

  /**
   * Get audit log statistics
   */
  static async getAuditStats(
    startDate?: string,
    endDate?: string
  ): Promise<AuditLogStats[]> {
    const params = new URLSearchParams();

    if (startDate) {
      params.append('start_date', startDate);
    }
    if (endDate) {
      params.append('end_date', endDate);
    }

    const response = await apiService.get<{ success: boolean; data: AuditLogStats[] }>(
      `${this.BASE_URL}/stats?${params}`
    );

    if (response.data?.success && response.data?.data) {
      return response.data.data;
    }

    return [];
  }

  /**
   * Get available actions for filtering
   */
  static getAvailableActions(): string[] {
    return [
      'user_login',
      'user_register',
      'user_update',
      'user_delete',
      'user_approve',
      'user_reject',
      'user_suspend',
      'user_unsuspend',
      'user_promote',
      'user_demote',
      'password_change',
      'profile_update',
      'whitelist_create',
      'whitelist_update',
      'whitelist_delete',
      'client_version_create',
      'client_version_update',
      'client_version_delete',
      'game_world_create',
      'game_world_update',
      'game_world_delete',
      'game_world_update_orders',
      'maintenance_start',
      'maintenance_stop',
      'maintenance_update',
      'scheduler_create',
      'scheduler_update',
      'scheduler_delete',
      'scheduler_execute',
      'tag_create',
      'tag_update',
      'tag_delete',
      'message_template_create',
      'message_template_update',
      'message_template_delete',
      'message_template_bulk_delete',
      'message_template_set_tags',
      'job_create',
      'job_update',
      'job_delete',
      'job_execute',
      'job_set_tags',
      'whitelist_bulk_create',
      'whitelist_bulk_delete',
      'whitelist_toggle_status',
    ];
  }

  /**
   * Get available resource types for filtering
   */
  static getAvailableResourceTypes(): string[] {
    return [
      'user',
      'whitelist',
      'client_version',
      'game_world',
      'maintenance',
      'scheduler',
      'tag',
      'message_template',
      'job',
    ];
  }

  /**
   * Format action name for display
   */
  static formatActionName(action: string): string {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Format resource type for display
   */
  static formatResourceType(resourceType: string): string {
    return resourceType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Get action color for display
   */
  static getActionColor(action: string): 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' {
    if (action.includes('create') || action.includes('register')) return 'success';
    if (action.includes('delete') || action.includes('reject')) return 'error';
    if (action.includes('update') || action.includes('change')) return 'warning';
    if (action.includes('login') || action.includes('approve')) return 'info';
    if (action.includes('suspend') || action.includes('demote')) return 'error';
    if (action.includes('unsuspend') || action.includes('promote')) return 'success';
    return 'primary';
  }
}
