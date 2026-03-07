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
  permissions: string[];
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
  scopeType?: string;
  scopeId?: string;
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
  scopeType: string;
  scopeId: string;
  assignedBy: string | null;
  roleName: string;
  roleDescription: string | null;
  roleScopeType?: string;
}

export interface PermissionReference {
  all: string[];
  categories: Record<string, { label: string; permissions: string[] }>;
}

export interface EffectivePermissions {
  own: string[];
  inherited: Array<{ permission: string; fromRoleId: string; fromRoleName: string }>;
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

  async getEffectivePermissions(roleId: string): Promise<EffectivePermissions> {
    const res = await api.get(`${BASE}/roles/${roleId}/effective-permissions`);
    return res.data;
  },

  async createRole(data: {
    roleName: string;
    description?: string;
    permissions?: string[];
  }): Promise<RoleWithDetails> {
    const res = await api.post(`${BASE}/roles`, data);
    return res.data;
  },

  async updateRole(
    id: string,
    data: {
      roleName?: string;
      description?: string;
      permissions?: string[];
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

  async addGroupMember(groupId: string, userId: string, isGroupAdmin?: boolean): Promise<void> {
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

  async getGroupEffectivePermissions(groupId: string): Promise<EffectivePermissions> {
    const res = await api.get(`${BASE}/groups/${groupId}/effective-permissions`);
    return res.data;
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

  // ─── Organisation Members ─────────────────────────

  async getOrgMembers(orgId: string): Promise<any[]> {
    const res = await api.get(`${BASE}/organisations/${orgId}/members`);
    return res.data;
  },

  async addOrgMember(
    orgId: string,
    userId: string,
    orgRole: 'admin' | 'user' = 'user'
  ): Promise<void> {
    await api.post(`${BASE}/organisations/${orgId}/members`, { userId, orgRole });
  },

  async removeOrgMember(orgId: string, userId: string): Promise<void> {
    await api.delete(`${BASE}/organisations/${orgId}/members/${userId}`);
  },

  async updateOrgMemberRole(
    orgId: string,
    userId: string,
    orgRole: 'admin' | 'user'
  ): Promise<void> {
    await api.put(`${BASE}/organisations/${orgId}/members/${userId}`, { orgRole });
  },

  // ─── Project Members ─────────────────────────

  async getProjectMembers(projectId: string): Promise<any[]> {
    const res = await api.get(`${BASE}/projects/${projectId}/members`);
    return res.data;
  },

  async addProjectMember(
    projectId: string,
    userId: string,
    projectRole: 'admin' | 'member' = 'member'
  ): Promise<void> {
    await api.post(`${BASE}/projects/${projectId}/members`, { userId, projectRole });
  },

  async removeProjectMember(projectId: string, userId: string): Promise<void> {
    await api.delete(`${BASE}/projects/${projectId}/members/${userId}`);
  },

  async updateProjectMemberRole(
    projectId: string,
    userId: string,
    projectRole: 'admin' | 'member'
  ): Promise<void> {
    await api.put(`${BASE}/projects/${projectId}/members/${userId}`, { projectRole });
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

  // ─── User Search ─────────────────────────

  async searchUsers(
    query: string,
    orgId?: string
  ): Promise<{ id: string; name: string; email: string }[]> {
    const params: Record<string, any> = { search: query, limit: 20 };
    if (orgId) params.orgId = orgId;
    const res = await api.get('/admin/users', { params });
    return (res.data?.users || []).map((u: any) => ({
      id: String(u.id),
      name: u.name,
      email: u.email,
    }));
  },

  // ─── Permission Reference ─────────────────────────

  async getPermissions(): Promise<PermissionReference> {
    const res = await api.get(`${BASE}/permissions`);
    return res.data;
  },

  // ─── Role Inheritance ─────────────────────────

  async getRoleInheritance(roleId: string): Promise<RoleInheritance[]> {
    const res = await api.get(`${BASE}/roles/${roleId}/inheritance`);
    return res.data;
  },

  async addRoleInheritance(roleId: string, parentRoleId: string): Promise<{ id: string }> {
    const res = await api.post(`${BASE}/roles/${roleId}/inheritance`, { parentRoleId });
    return res.data;
  },

  async removeRoleInheritance(roleId: string, inheritanceId: string): Promise<void> {
    await api.delete(`${BASE}/roles/${roleId}/inheritance/${inheritanceId}`);
  },
};

export interface RoleInheritance {
  id: string;
  parentRoleId: string;
  parentRoleName: string;
  createdAt: string;
}

export default rbacService;
