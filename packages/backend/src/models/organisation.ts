import db from '../config/knex';
import { generateULID } from '../utils/ulid';
import { createLogger } from '../config/logger';

const logger = createLogger('Organisation');

// ==================== Types ====================

export interface OrganisationRecord {
  id: string;
  orgName: string;
  displayName: string;
  description: string | null;
  isActive: boolean;
  isInternal: boolean;
  isVisible: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateOrgData {
  orgName: string;
  displayName: string;
  description?: string;
  createdBy: string;
  isInternal?: boolean;
  isVisible?: boolean;
}

export interface UpdateOrgData {
  displayName?: string;
  description?: string;
  isActive?: boolean;
  isVisible?: boolean;
  updatedBy: string;
}

// ==================== Model ====================

export class Organisation {
  private static readonly TABLE = 'g_organisations';
  private static readonly MEMBERS_TABLE = 'g_organisation_members';

  // ─── CRUD ─────────────────────────

  static async create(data: CreateOrgData): Promise<OrganisationRecord> {
    const id = generateULID();
    await db(this.TABLE).insert({
      id,
      orgName: data.orgName,
      displayName: data.displayName,
      description: data.description || null,
      isInternal: data.isInternal || false,
      isVisible: data.isVisible !== undefined ? data.isVisible : true,
      createdBy: data.createdBy,
    });

    const org = await this.findById(id);
    if (!org) throw new Error('Failed to create organisation');
    return org;
  }

  static async findById(id: string): Promise<OrganisationRecord | null> {
    const row = await db(this.TABLE).where('id', id).first();
    return row || null;
  }

  static async findByName(orgName: string): Promise<OrganisationRecord | null> {
    const row = await db(this.TABLE).where('orgName', orgName).first();
    return row || null;
  }

  static async findAll(): Promise<OrganisationRecord[]> {
    return db(this.TABLE).where('isInternal', false).orderBy('createdAt', 'desc');
  }

  static async update(id: string, data: UpdateOrgData): Promise<OrganisationRecord | null> {
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

  // ─── Members ─────────────────────────

  static async addMember(orgId: string, userId: string, invitedBy?: string): Promise<void> {
    const id = generateULID();
    await db(this.MEMBERS_TABLE).insert({
      id,
      orgId,
      userId,
      invitedBy: invitedBy || null,
    });
  }

  static async removeMember(orgId: string, userId: string): Promise<boolean> {
    const result = await db(this.MEMBERS_TABLE).where('orgId', orgId).where('userId', userId).del();
    return result > 0;
  }

  static async getMember(
    orgId: string,
    userId: string
  ): Promise<{ orgId: string; userId: string } | null> {
    const row = await db(this.MEMBERS_TABLE).where('orgId', orgId).where('userId', userId).first();
    return row || null;
  }

  static async getMembers(orgId: string): Promise<any[]> {
    return db(this.MEMBERS_TABLE)
      .select([`${this.MEMBERS_TABLE}.*`, 'u.name', 'u.email', 'u.status'])
      .join('g_users as u', `${this.MEMBERS_TABLE}.userId`, 'u.id')
      .where(`${this.MEMBERS_TABLE}.orgId`, orgId)
      .orderBy(`${this.MEMBERS_TABLE}.joinedAt`, 'desc');
  }
}

export default Organisation;
