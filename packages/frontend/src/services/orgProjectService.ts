import api from './api';

// ==================== Types ====================

export interface Organisation {
  id: string;
  orgName: string;
  displayName: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrgMember {
  id: string;
  userId: string;
  orgRole: 'admin' | 'user';
  joinedAt: string;
  name?: string;
  email?: string;
}

export interface OrganisationWithMembers extends Organisation {
  members: OrgMember[];
}

export interface Project {
  id: string;
  orgId: string;
  projectName: string;
  displayName: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== Service ====================

const BASE = '/admin/rbac';

export const orgProjectService = {
  // ─── Organisations ─────────────────────────

  async getOrganisations(): Promise<Organisation[]> {
    const res = await api.get(`${BASE}/organisations`);
    return res.data;
  },

  async getOrganisation(id: string): Promise<OrganisationWithMembers> {
    const res = await api.get(`${BASE}/organisations/${id}`);
    return res.data;
  },

  async updateOrganisation(
    id: string,
    data: { displayName?: string; description?: string }
  ): Promise<Organisation> {
    const res = await api.put(`${BASE}/organisations/${id}`, data);
    return res.data;
  },

  // ─── Projects ─────────────────────────

  async getProjects(): Promise<Project[]> {
    const res = await api.get(`${BASE}/projects`);
    return res.data;
  },

  async getProject(id: string): Promise<Project> {
    const res = await api.get(`${BASE}/projects/${id}`);
    return res.data;
  },

  async createProject(data: {
    projectName: string;
    displayName: string;
    description?: string;
  }): Promise<Project> {
    const res = await api.post(`${BASE}/projects`, data);
    return res.data;
  },

  async updateProject(
    id: string,
    data: {
      displayName?: string;
      description?: string;
    }
  ): Promise<Project> {
    const res = await api.put(`${BASE}/projects/${id}`, data);
    return res.data;
  },

  async deleteProject(id: string): Promise<void> {
    await api.delete(`${BASE}/projects/${id}`);
  },
};

export default orgProjectService;
