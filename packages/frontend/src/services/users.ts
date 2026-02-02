import { apiService } from "./api";
import { User, UserFilters, UserListResponse, Tag } from "@/types";

export class UserService {
  static async getUsers(
    page: number = 1,
    limit: number = 10,
    filters?: UserFilters,
  ): Promise<UserListResponse> {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("limit", limit.toString());

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.append(key, value.toString());
        }
      });
    }

    const response = await apiService.get<UserListResponse>(
      `/admin/users?${params.toString()}`,
    );

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || "Failed to fetch users");
  }

  static async getUserById(id: number): Promise<User> {
    const response = await apiService.get<{ user: User }>(`/admin/users/${id}`);

    if (response.success && response.data) {
      return response.data.user;
    }

    throw new Error(response.error?.message || "Failed to fetch user");
  }

  static async createUser(data: any): Promise<User> {
    const response = await apiService.post<{ user: User }>(
      "/admin/users",
      data,
    );

    if (response.success && response.data) {
      return response.data.user;
    }

    throw new Error(response.error?.message || "Failed to create user");
  }

  static async updateUser(id: number, data: Partial<User>): Promise<User> {
    const response = await apiService.put<{ user: User }>(
      `/admin/users/${id}`,
      data,
    );

    if (response.success && response.data) {
      return response.data.user;
    }

    throw new Error(response.error?.message || "Failed to update user");
  }

  static async deleteUser(id: number): Promise<void> {
    const response = await apiService.delete(`/admin/users/${id}`);

    if (!response.success) {
      throw new Error(response.error?.message || "Failed to delete user");
    }
  }

  static async approveUser(id: number): Promise<User> {
    const response = await apiService.post<{ user: User }>(
      `/admin/users/${id}/approve`,
    );

    if (response.success && response.data) {
      return response.data.user;
    }

    throw new Error(response.error?.message || "Failed to approve user");
  }

  static async rejectUser(id: number): Promise<void> {
    const response = await apiService.post(`/admin/users/${id}/reject`);

    if (!response.success) {
      throw new Error(response.error?.message || "Failed to reject user");
    }
  }

  static async suspendUser(id: number): Promise<User> {
    const response = await apiService.post<{ user: User }>(
      `/admin/users/${id}/suspend`,
    );

    if (response.success && response.data) {
      return response.data.user;
    }

    throw new Error(response.error?.message || "Failed to suspend user");
  }

  static async unsuspendUser(id: number): Promise<User> {
    const response = await apiService.post<{ user: User }>(
      `/admin/users/${id}/activate`,
    );

    if (response.success && response.data) {
      return response.data.user;
    }

    throw new Error(response.error?.message || "Failed to unsuspend user");
  }

  static async promoteToAdmin(id: number): Promise<User> {
    const response = await apiService.post<{ user: User }>(
      `/admin/users/${id}/promote`,
    );

    if (response.success && response.data) {
      return response.data.user;
    }

    throw new Error(
      response.error?.message || "Failed to promote user to admin",
    );
  }

  static async demoteFromAdmin(id: number): Promise<User> {
    const response = await apiService.post<{ user: User }>(
      `/admin/users/${id}/demote`,
    );

    if (response.success && response.data) {
      return response.data.user;
    }

    throw new Error(
      response.error?.message || "Failed to demote user from admin",
    );
  }

  static async getPendingUsers(): Promise<User[]> {
    const response = await apiService.get<{ users: User[] }>(
      "/admin/pending-users",
    );

    if (response.success && response.data) {
      return response.data.users;
    }

    throw new Error(response.error?.message || "Failed to fetch pending users");
  }

  static async getUserStats(): Promise<{
    total: number;
    active: number;
    pending: number;
    suspended: number;
    admins: number;
  }> {
    const response = await apiService.get<{ stats: any }>("/admin/stats/users");

    if (response.success && response.data) {
      return response.data.stats;
    }

    throw new Error(
      response.error?.message || "Failed to fetch user statistics",
    );
  }

  // 태그 관련 메서드들
  static async getUserTags(userId: number): Promise<Tag[]> {
    const response = await apiService.get<Tag[]>(`/admin/users/${userId}/tags`);

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error?.message || "Failed to fetch user tags");
  }

  static async setUserTags(userId: number, tagIds: number[]): Promise<void> {
    const response = await apiService.put(`/admin/users/${userId}/tags`, {
      tagIds,
    });

    if (!response.success) {
      throw new Error(response.error?.message || "Failed to set user tags");
    }
  }

  static async addUserTag(userId: number, tagId: number): Promise<void> {
    const response = await apiService.post(`/admin/users/${userId}/tags`, {
      tagId,
    });

    if (!response.success) {
      throw new Error(response.error?.message || "Failed to add user tag");
    }
  }

  static async removeUserTag(userId: number, tagId: number): Promise<void> {
    const response = await apiService.delete(
      `/admin/users/${userId}/tags/${tagId}`,
    );

    if (!response.success) {
      throw new Error(response.error?.message || "Failed to remove user tag");
    }
  }

  // 관리자가 사용자 이메일을 강제 인증 처리
  static async verifyUserEmail(userId: number): Promise<void> {
    const response = await apiService.post(
      `/admin/users/${userId}/verify-email`,
    );

    if (!response.success) {
      throw new Error(response.error?.message || "Failed to verify user email");
    }
  }

  // 사용자에게 이메일 인증 메일 재전송
  static async resendVerificationEmail(userId: number): Promise<void> {
    const response = await apiService.post(
      `/admin/users/${userId}/resend-verification`,
    );

    if (!response.success) {
      throw new Error(
        response.error?.message || "Failed to resend verification email",
      );
    }
  }

  // 사용자 언어 설정 업데이트
  static async updateLanguage(preferredLanguage: string): Promise<void> {
    const response = await apiService.put("/users/me/language", {
      preferredLanguage,
    });

    if (!response.success) {
      throw new Error(
        response.error?.message || "Failed to update language preference",
      );
    }
  }
}
