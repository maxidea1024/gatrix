import api from './api';

// ==================== Types ====================

export interface Role {
  id: string;
  orgId: string;
  roleName: string;
  description: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RolePermissions {
  org: string[];
  project: Array<{ projectId: string; permission: string; isAdmin: boolean }>;
  env: Array<{ environmentId: string; permission: string; isAdmin: boolean }>;
}

export interface RoleWithDetails extends Role {
  permissions: RolePermissions;
  userCount: number;
  groupCount: number;
}

export interface Group {
  id: string;
  orgId: string;
  groupName: string;
  description: string | null;
  addNewUsersByDefault: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GroupWithCounts extends Group {
  memberCount: number;
  roleCount: number;
}

export interface GroupMember {
  id: string;
  userId: string;
  isGroupAdmin: boolean;
  joinedAt: string;
  addedBy: string | null;
  // joined from g_users
  name?: string;
  email?: string;
}

export interface GroupRole {
  id: string;
  roleId: string;
  assignedAt: string;
  assignedBy: string | null;
  // joined from g_roles
  roleName?: string;
  description?: string;
}

export interface GroupDetail extends Group {
  members: GroupMember[];
  roles: GroupRole[];
}

export interface AdminApiToken {
  id: string;
  orgId: string;
  tokenName: string;
  tokenValue: string; // masked on list, plain on create
  description: string | null;
  roleId: string | null;
  roleName?: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserRole {
  id: string;
  userId: string;
  roleId: string;
  assignedBy: string | null;
  roleName: string;
  roleDescription: string | null;
}

export interface PermissionReference {
  all: string[];
  categories: Record<string, { label: string; permissions: string[] }>;
}

// ==================== Service ====================

const BASE = '/admin/rbac';

export const rbacService = {
  // ─── Roles ─────────────────────────

  async getRoles(): Promise<Role[]> {
    const res = await api.get(`${BASE}/roles`);
    return res.data;
  },

  async getRole(id: string): Promise<RoleWithDetails> {
    const res = await api.get(`${BASE}/roles/${id}`);
    return res.data;
  },

  async createRole(data: {
    roleName: string;
    description?: string;
    permissions?: RolePermissions;
  }): Promise<RoleWithDetails> {
    const res = await api.post(`${BASE}/roles`, data);
    return res.data;
  },

  async updateRole(
    id: string,
    data: {
      roleName?: string;
      description?: string;
      permissions?: RolePermissions;
    }
  ): Promise<RoleWithDetails> {
    const res = await api.put(`${BASE}/roles/${id}`, data);
    return res.data;
  },

  async deleteRole(id: string): Promise<void> {
    await api.delete(`${BASE}/roles/${id}`);
  },

  // ─── Groups ─────────────────────────

  async getGroups(): Promise<GroupWithCounts[]> {
    const res = await api.get(`${BASE}/groups`);
    return res.data;
  },

  async getGroup(id: string): Promise<GroupDetail> {
    const res = await api.get(`${BASE}/groups/${id}`);
    return res.data;
  },

  async createGroup(data: {
    groupName: string;
    description?: string;
    addNewUsersByDefault?: boolean;
  }): Promise<Group> {
    const res = await api.post(`${BASE}/groups`, data);
    return res.data;
  },

  async updateGroup(
    id: string,
    data: {
      groupName?: string;
      description?: string;
      addNewUsersByDefault?: boolean;
    }
  ): Promise<Group> {
    const res = await api.put(`${BASE}/groups/${id}`, data);
    return res.data;
  },

  async deleteGroup(id: string): Promise<void> {
    await api.delete(`${BASE}/groups/${id}`);
  },

  // ─── Group Members ─────────────────────────

  async addGroupMember(
    groupId: string,
    userId: string,
    isGroupAdmin?: boolean
  ): Promise<void> {
    await api.post(`${BASE}/groups/${groupId}/members`, {
      userId,
      isGroupAdmin: isGroupAdmin || false,
    });
  },

  async removeGroupMember(groupId: string, userId: string): Promise<void> {
    await api.delete(`${BASE}/groups/${groupId}/members/${userId}`);
  },

  // ─── Group Roles ─────────────────────────

  async addGroupRole(groupId: string, roleId: string): Promise<void> {
    await api.post(`${BASE}/groups/${groupId}/roles`, { roleId });
  },

  async removeGroupRole(groupId: string, roleId: string): Promise<void> {
    await api.delete(`${BASE}/groups/${groupId}/roles/${roleId}`);
  },

  // ─── User Roles ─────────────────────────

  async getUserRoles(userId: string): Promise<UserRole[]> {
    const res = await api.get(`${BASE}/users/${userId}/roles`);
    return res.data;
  },

  async assignUserRole(userId: string, roleId: string): Promise<void> {
    await api.post(`${BASE}/users/${userId}/roles`, { roleId });
  },

  async removeUserRole(userId: string, roleId: string): Promise<void> {
    await api.delete(`${BASE}/users/${userId}/roles/${roleId}`);
  },

  // ─── Admin API Tokens ─────────────────────────

  async getAdminTokens(): Promise<AdminApiToken[]> {
    const res = await api.get(`${BASE}/admin-tokens`);
    return res.data;
  },

  async createAdminToken(data: {
    tokenName: string;
    description?: string;
    roleId?: string;
    expiresAt?: string;
  }): Promise<AdminApiToken> {
    const res = await api.post(`${BASE}/admin-tokens`, data);
    return res.data;
  },

  async deleteAdminToken(id: string): Promise<void> {
    await api.delete(`${BASE}/admin-tokens/${id}`);
  },

  // ─── Permission Reference ─────────────────────────

  async getPermissions(): Promise<PermissionReference> {
    const res = await api.get(`${BASE}/permissions`);
    return res.data;
  },
};

export default rbacService;
