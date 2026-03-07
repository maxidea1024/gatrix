import db from '../config/knex';
import { generateULID } from '../utils/ulid';
import { createLogger } from '../config/logger';

const logger = createLogger('ProjectModel');

// ==================== Types ====================

export interface ProjectRecord {
  id: string;
  orgId: string;
  projectName: string;
  displayName: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdBy: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectData {
  orgId: string;
  projectName: string;
  displayName: string;
  description?: string;
  createdBy: string;
}

export interface UpdateProjectData {
  displayName?: string;
  description?: string;
  isActive?: boolean;
  updatedBy: string;
}

// ==================== Model ====================

export class ProjectModel {
  private static readonly TABLE = 'g_projects';

  static async create(data: CreateProjectData): Promise<ProjectRecord> {
    const id = generateULID();
    await db(this.TABLE).insert({
      id,
      orgId: data.orgId,
      projectName: data.projectName,
      displayName: data.displayName,
      description: data.description || null,
      createdBy: data.createdBy,
    });

    const project = await this.findById(id);
    if (!project) throw new Error('Failed to create project');
    return project;
  }

  static async findById(id: string): Promise<ProjectRecord | null> {
    const row = await db(this.TABLE).where('id', id).first();
    return row || null;
  }

  static async findByOrgId(orgId: string): Promise<ProjectRecord[]> {
    return db(this.TABLE)
      .where('orgId', orgId)
      .where('isActive', true)
      .orderBy('createdAt', 'desc');
  }

  static async findAll(): Promise<ProjectRecord[]> {
    return db(this.TABLE).where('isActive', true).orderBy('createdAt', 'desc');
  }

  static async findByName(orgId: string, projectName: string): Promise<ProjectRecord | null> {
    const row = await db(this.TABLE)
      .where('orgId', orgId)
      .where('projectName', projectName)
      .first();
    return row || null;
  }

  static async findDefault(orgId: string): Promise<ProjectRecord | null> {
    const row = await db(this.TABLE).where('orgId', orgId).where('isDefault', true).first();
    return row || null;
  }

  static async update(id: string, data: UpdateProjectData): Promise<ProjectRecord | null> {
    const updateData: any = { updatedBy: data.updatedBy };
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    await db(this.TABLE).where('id', id).update(updateData);
    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    const result = await db(this.TABLE).where('id', id).del();
    return result > 0;
  }

  /**
   * Resolve orgId from projectId
   */
  static async getOrgId(projectId: string): Promise<string | null> {
    const row = await db(this.TABLE).select('orgId').where('id', projectId).first();
    return row?.orgId || null;
  }
}

export default ProjectModel;
