import db from '../config/knex';
import { createLogger } from '../config/logger';
import { Organisation } from '../models/Organisation';
import { RoleBindingModel } from '../models/RoleBindingModel';
import { generateULID } from '../utils/ulid';

const logger = createLogger('UserOnboardingService');

// ==================== Types ====================

export interface AutoJoinRoleBinding {
  roleId: string;
  scopeType: 'org' | 'project';
  scopeId: string;
}

export interface AutoJoinMembership {
  orgId: string;
  projectIds: string[];
  roleBindings: AutoJoinRoleBinding[];
}

export interface AutoJoinConfig {
  memberships: AutoJoinMembership[];
}

// ==================== Service ====================

export class UserOnboardingService {
  /**
   * Apply auto-join configuration to a user.
   * Adds user to specified organisations, projects, and creates role bindings.
   * Skips duplicates silently.
   */
  static async applyAutoJoinConfig(
    userId: string,
    config: AutoJoinConfig,
    assignedBy: string
  ): Promise<void> {
    if (!config?.memberships?.length) {
      logger.debug('No memberships in autoJoinConfig, skipping');
      return;
    }

    for (const membership of config.memberships) {
      // 1. Add to organisation (default role)
      try {
        const existingOrgMember = await Organisation.getMember(membership.orgId, userId);
        if (!existingOrgMember) {
          await Organisation.addMember(membership.orgId, userId, assignedBy);
          logger.info('Added user to organisation', {
            userId,
            orgId: membership.orgId,
          });
        } else {
          logger.debug('User already a member of organisation, skipping', {
            userId,
            orgId: membership.orgId,
          });
        }
      } catch (error: any) {
        if (error.code === 'ER_DUP_ENTRY') {
          logger.debug('Duplicate org membership, skipping', {
            userId,
            orgId: membership.orgId,
          });
        } else {
          logger.error('Failed to add user to organisation', {
            userId,
            orgId: membership.orgId,
            error,
          });
          throw error;
        }
      }

      // 2. Add to projects (default role)
      if (membership.projectIds?.length) {
        for (const projectId of membership.projectIds) {
          try {
            const existingProjectMember = await db('g_project_members')
              .where('projectId', projectId)
              .where('userId', userId)
              .first();

            if (!existingProjectMember) {
              const id = generateULID();
              await db('g_project_members').insert({
                id,
                projectId,
                userId,
                projectRole: 'member',
                invitedBy: assignedBy,
              });
              logger.info('Added user to project', { userId, projectId });
            } else {
              logger.debug('User already a member of project, skipping', { userId, projectId });
            }
          } catch (error: any) {
            if (error.code === 'ER_DUP_ENTRY') {
              logger.debug('Duplicate project membership, skipping', { userId, projectId });
            } else {
              logger.error('Failed to add user to project', { userId, projectId, error });
              throw error;
            }
          }
        }
      }

      // 3. Create role bindings (actual permissions)
      if (membership.roleBindings?.length) {
        for (const binding of membership.roleBindings) {
          try {
            // Validate role scope — prevent auto-assigning system-scope roles
            const role = await db('g_roles').where('id', binding.roleId).first();
            if (!role) {
              logger.warn('Role not found in autoJoinConfig, skipping', {
                userId,
                roleId: binding.roleId,
              });
              continue;
            }
            const { getScopeLevel, SCOPE_LEVELS } = require('../utils/scopeHierarchy');
            if (getScopeLevel(role.scopeType) < SCOPE_LEVELS.org) {
              logger.error('AutoJoinConfig attempted to assign a system-scope role, skipping', {
                userId,
                roleId: binding.roleId,
                roleScopeType: role.scopeType,
              });
              continue;
            }

            await RoleBindingModel.create({
              userId,
              roleId: binding.roleId,
              scopeType: binding.scopeType,
              scopeId: binding.scopeId,
              assignedBy,
            });
            logger.info('Created role binding', {
              userId,
              roleId: binding.roleId,
              scopeType: binding.scopeType,
              scopeId: binding.scopeId,
            });
          } catch (error: any) {
            if (error.code === 'ER_DUP_ENTRY') {
              logger.debug('Duplicate role binding, skipping', {
                userId,
                roleId: binding.roleId,
                scopeType: binding.scopeType,
                scopeId: binding.scopeId,
              });
            } else {
              logger.error('Failed to create role binding', {
                userId,
                roleId: binding.roleId,
                error,
              });
              throw error;
            }
          }
        }
      }
    }

    logger.info('Auto-join config applied successfully', {
      userId,
      membershipCount: config.memberships.length,
    });
  }

  /**
   * Resolve autoJoinConfig IDs to display names for the invitation acceptance page.
   */
  static async resolveAutoJoinConfigNames(
    config: AutoJoinConfig
  ): Promise<{
    memberships: Array<{
      orgId: string;
      orgName: string;
      orgDisplayName: string;
      projects: Array<{
        projectId: string;
        projectName: string;
        projectDisplayName: string;
      }>;
    }>;
  } | null> {
    if (!config?.memberships?.length) return null;

    const resolved = [];

    for (const membership of config.memberships) {
      const org = await db('g_organisations')
        .where('id', membership.orgId)
        .select('orgName', 'displayName')
        .first();

      if (!org) continue;

      const projects = [];
      if (membership.projectIds?.length) {
        for (const projectId of membership.projectIds) {
          const project = await db('g_projects')
            .where('id', projectId)
            .select('projectName', 'displayName')
            .first();

          if (project) {
            projects.push({
              projectId,
              projectName: project.projectName,
              projectDisplayName: project.displayName,
            });
          }
        }
      }

      resolved.push({
        orgId: membership.orgId,
        orgName: org.orgName,
        orgDisplayName: org.displayName,
        projects,
      });
    }

    return { memberships: resolved };
  }
}
