/**
 * RBAC Admin Routes
 *
 * Routes for managing RBAC entities: organisations, projects, roles, groups,
 * user role assignments, admin API tokens, and environment keys.
 * All routes use the new RBAC middleware (requireOrgPermission, etc.)
 */

import express from 'express';
import { authenticate } from '../../middleware/auth';
import { requireOrgPermission, requireOrgAdmin } from '../../middleware/rbacMiddleware';
import { ORG_PERMISSIONS } from '../../types/permissions';
import { AuthenticatedRequest } from '../../types/auth';
import { Organisation } from '../../models/Organisation';
import { ProjectModel } from '../../models/ProjectModel';
import { RoleModel } from '../../models/RoleModel';
import { GroupModel } from '../../models/GroupModel';
import { AdminApiToken } from '../../models/AdminApiToken';
import { EnvironmentKey } from '../../models/EnvironmentKey';
import { permissionService } from '../../services/PermissionService';
import { generateULID } from '../../utils/ulid';
import { GatrixError } from '../../middleware/errorHandler';
import { createLogger } from '../../config/logger';

const logger = createLogger('rbac');
import db from '../../config/knex';

const router = express.Router();

// All RBAC routes require authentication
router.use(authenticate as any);

// ==================== Organisations ====================

// GET /api/admin/rbac/organisations
// Returns organisations the current user is a member of (no org context needed)
router.get('/organisations', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const orgs = await db('g_organisations as o')
      .join('g_organisation_members as om', 'o.id', 'om.orgId')
      .where('om.userId', userId)
      .select('o.*');

    res.json({ success: true, data: orgs });
  } catch (error) {
    logger.error('Error listing organisations:', error);
    res.status(500).json({ success: false, message: 'Failed to list organisations' });
  }
});

// GET /api/admin/rbac/organisations/:id
router.get('/organisations/:id', requireOrgAdmin as any, async (req: any, res) => {
  try {
    const org = await Organisation.findById(req.params.id);
    if (!org) {
      return res.status(404).json({ success: false, message: 'Organisation not found' });
    }
    const members = await Organisation.getMembers(org.id);
    res.json({ success: true, data: { ...org, members } });
  } catch (error) {
    logger.error('Error getting organisation:', error);
    res.status(500).json({ success: false, message: 'Failed to get organisation' });
  }
});

// PUT /api/admin/rbac/organisations/:id
router.put('/organisations/:id', requireOrgAdmin as any, async (req: any, res) => {
  try {
    const updated = await Organisation.update(req.params.id, {
      ...req.body,
      updatedBy: req.user.id,
    });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Organisation not found' });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error('Error updating organisation:', error);
    res.status(500).json({ success: false, message: 'Failed to update organisation' });
  }
});

// POST /api/admin/rbac/organisations
router.post('/organisations', requireOrgAdmin as any, async (req: any, res) => {
  try {
    const { orgName, displayName, description } = req.body;
    if (!orgName || !displayName) {
      return res
        .status(400)
        .json({ success: false, message: 'orgName and displayName are required' });
    }

    const existing = await Organisation.findByName(orgName);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Organisation name already exists' });
    }

    const org = await Organisation.create({
      orgName,
      displayName,
      description,
      createdBy: req.user.id,
    });

    // Add the creator as org admin member
    await Organisation.addMember(org.id, req.user.id, 'admin');

    res.status(201).json({ success: true, data: org });
  } catch (error) {
    logger.error('Error creating organisation:', error);
    res.status(500).json({ success: false, message: 'Failed to create organisation' });
  }
});

// ==================== Organisation Members ====================

// GET /api/admin/rbac/organisations/:id/members
router.get('/organisations/:id/members', async (req: any, res) => {
  try {
    const members = await Organisation.getMembers(req.params.id);
    res.json({ success: true, data: members });
  } catch (error) {
    logger.error('Error getting organisation members:', error);
    res.status(500).json({ success: false, message: 'Failed to get organisation members' });
  }
});

// POST /api/admin/rbac/organisations/:id/members
router.post('/organisations/:id/members', requireOrgAdmin as any, async (req: any, res) => {
  try {
    const { userId, orgRole } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'userId is required' });
    }

    // Check if user is already a member
    const existing = await Organisation.getMember(req.params.id, userId);
    if (existing) {
      return res.status(409).json({ success: false, message: 'User is already a member' });
    }

    await Organisation.addMember(req.params.id, userId, orgRole || 'user', req.user.id);
    res.status(201).json({ success: true, message: 'Member added successfully' });
  } catch (error) {
    logger.error('Error adding organisation member:', error);
    res.status(500).json({ success: false, message: 'Failed to add member' });
  }
});

// DELETE /api/admin/rbac/organisations/:id/members/:userId
router.delete(
  '/organisations/:id/members/:userId',
  requireOrgAdmin as any,
  async (req: any, res) => {
    try {
      // Prevent self-modification
      if (String(req.user.id) === String(req.params.userId)) {
        return res
          .status(403)
          .json({ success: false, message: 'Cannot remove yourself from organisation' });
      }
      const result = await Organisation.removeMember(req.params.id, req.params.userId);
      if (!result) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }
      res.json({ success: true, message: 'Member removed successfully' });
    } catch (error) {
      logger.error('Error removing organisation member:', error);
      res.status(500).json({ success: false, message: 'Failed to remove member' });
    }
  }
);

// PUT /api/admin/rbac/organisations/:id/members/:userId
router.put('/organisations/:id/members/:userId', requireOrgAdmin as any, async (req: any, res) => {
  try {
    // Prevent self-modification
    if (String(req.user.id) === String(req.params.userId)) {
      return res
        .status(403)
        .json({ success: false, message: 'Cannot change your own organisation role' });
    }
    const { orgRole } = req.body;
    if (!orgRole || !['admin', 'user'].includes(orgRole)) {
      return res.status(400).json({
        success: false,
        message: 'orgRole must be "admin" or "user"',
      });
    }
    await Organisation.updateMemberRole(req.params.id, req.params.userId, orgRole);
    res.json({ success: true, message: 'Member role updated successfully' });
  } catch (error) {
    logger.error('Error updating organisation member role:', error);
    res.status(500).json({ success: false, message: 'Failed to update member role' });
  }
});

// ==================== My Access (RBAC-filtered tree) ====================

// GET /api/admin/rbac/my-access
// Returns the user's accessible orgs → projects → environments based on RBAC
router.get('/my-access', async (req: any, res) => {
  try {
    const userId = req.user.id;

    // Check org memberships — org admin sees all
    const orgMemberships = await permissionService.getUserOrganisations(userId);
    const isAnyOrgAdmin = orgMemberships.some((m) => m.orgRole === 'admin');

    let orgIds: string[];
    if (isAnyOrgAdmin) {
      const allOrgs = await db('g_organisations').where('isActive', true).select('id');
      orgIds = allOrgs.map((o: any) => o.id);
    } else {
      orgIds = orgMemberships.map((m) => m.orgId);
    }

    const result: Record<
      string,
      {
        projectIds: string[];
        environments: Record<string, string[]>;
      }
    > = {};

    for (const orgId of orgIds) {
      const projectIds = await permissionService.getAccessibleProjectIds(userId, orgId);

      const environments: Record<string, string[]> = {};
      for (const projectId of projectIds) {
        const envIds = await permissionService.getAccessibleEnvironmentIds(
          userId,
          orgId,
          projectId
        );
        environments[projectId] = envIds;
      }

      result[orgId] = { projectIds, environments };
    }

    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Error getting user access tree:', error);
    res.status(500).json({ success: false, message: 'Failed to get access tree' });
  }
});

// ==================== Projects ====================

// GET /api/admin/rbac/projects
// Returns projects from all orgs the current user is a member of, with org info
router.get('/projects', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Get projects from orgs the user is a member of
    const projects = await db('g_projects as p')
      .join('g_organisations as o', 'p.orgId', 'o.id')
      .join('g_organisation_members as om', 'o.id', 'om.orgId')
      .where('om.userId', userId)
      .select(
        'p.*',
        'o.orgName',
        'o.displayName as orgDisplayName',
        db.raw('(SELECT COUNT(*) FROM g_project_members WHERE projectId = p.id) as memberCount')
      );

    res.json({ success: true, data: projects });
  } catch (error) {
    logger.error('Error listing projects:', error);
    res.status(500).json({ success: false, message: 'Failed to list projects' });
  }
});

// POST /api/admin/rbac/projects
router.post(
  '/projects',
  requireOrgPermission(ORG_PERMISSIONS.PROJECTS_WRITE) as any,
  async (req: any, res) => {
    try {
      const { projectName, displayName, description, orgId } = req.body;
      if (!projectName || !displayName) {
        return res
          .status(400)
          .json({ success: false, message: 'projectName and displayName are required' });
      }

      // Use the provided orgId if specified, otherwise default to user's current org
      const targetOrgId = orgId || req.user.orgId;

      const existing = await ProjectModel.findByName(targetOrgId, projectName);
      if (existing) {
        return res.status(409).json({ success: false, message: 'Project name already exists' });
      }

      const project = await ProjectModel.create({
        orgId: targetOrgId,
        projectName,
        displayName,
        description,
        createdBy: req.user.id,
      });

      res.status(201).json({ success: true, data: project });
    } catch (error) {
      logger.error('Error creating project:', error);
      res.status(500).json({ success: false, message: 'Failed to create project' });
    }
  }
);

// PUT /api/admin/rbac/projects/:id
router.put(
  '/projects/:id',
  requireOrgPermission(ORG_PERMISSIONS.PROJECTS_WRITE) as any,
  async (req: any, res) => {
    try {
      const updated = await ProjectModel.update(req.params.id, {
        ...req.body,
        updatedBy: req.user.id,
      });
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Error updating project:', error);
      res.status(500).json({ success: false, message: 'Failed to update project' });
    }
  }
);

// DELETE /api/admin/rbac/projects/:id
router.delete(
  '/projects/:id',
  requireOrgPermission(ORG_PERMISSIONS.PROJECTS_WRITE) as any,
  async (req: any, res) => {
    try {
      const deleted = await ProjectModel.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Project not found' });
      }
      res.json({ success: true, message: 'Project deleted' });
    } catch (error) {
      logger.error('Error deleting project:', error);
      res.status(500).json({ success: false, message: 'Failed to delete project' });
    }
  }
);

// ==================== Project Members ====================

// GET /api/admin/rbac/projects/:id/members
router.get('/projects/:id/members', async (req: any, res) => {
  try {
    const members = await db('g_project_members as pm')
      .join('g_users as u', 'pm.userId', 'u.id')
      .where('pm.projectId', req.params.id)
      .select('pm.id', 'pm.projectId', 'pm.userId', 'pm.projectRole', 'pm.joinedAt', 'u.name', 'u.email');
    res.json({ success: true, data: members });
  } catch (error) {
    logger.error('Error getting project members:', error);
    res.status(500).json({ success: false, message: 'Failed to get project members' });
  }
});

// POST /api/admin/rbac/projects/:id/members
router.post(
  '/projects/:id/members',
  requireOrgPermission(ORG_PERMISSIONS.PROJECTS_WRITE) as any,
  async (req: any, res) => {
    try {
      const { userId, projectRole } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, message: 'userId is required' });
      }

      // Check if user is already a member
      const existing = await db('g_project_members')
        .where({ projectId: req.params.id, userId })
        .first();
      if (existing) {
        return res.status(409).json({ success: false, message: 'User is already a member' });
      }

      const id = generateULID();
      await db('g_project_members').insert({
        id,
        projectId: req.params.id,
        userId,
        projectRole: projectRole || 'member',
        invitedBy: req.user.id,
      });
      await permissionService.invalidateUserCache(userId);
      res.status(201).json({ success: true, message: 'Member added successfully' });
    } catch (error) {
      logger.error('Error adding project member:', error);
      res.status(500).json({ success: false, message: 'Failed to add member' });
    }
  }
);

// PUT /api/admin/rbac/projects/:id/members/:userId
router.put(
  '/projects/:id/members/:userId',
  requireOrgPermission(ORG_PERMISSIONS.PROJECTS_WRITE) as any,
  async (req: any, res) => {
    try {
      const { projectRole } = req.body;
      if (!projectRole || !['admin', 'member'].includes(projectRole)) {
        return res.status(400).json({
          success: false,
          message: 'projectRole must be "admin" or "member"',
        });
      }
      const result = await db('g_project_members')
        .where({ projectId: req.params.id, userId: req.params.userId })
        .update({ projectRole });
      if (result === 0) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }
      await permissionService.invalidateUserCache(req.params.userId);
      res.json({ success: true, message: 'Member role updated successfully' });
    } catch (error) {
      logger.error('Error updating project member role:', error);
      res.status(500).json({ success: false, message: 'Failed to update member role' });
    }
  }
);

// DELETE /api/admin/rbac/projects/:id/members/:userId
router.delete(
  '/projects/:id/members/:userId',
  requireOrgPermission(ORG_PERMISSIONS.PROJECTS_WRITE) as any,
  async (req: any, res) => {
    try {
      const result = await db('g_project_members')
        .where({ projectId: req.params.id, userId: req.params.userId })
        .del();
      if (result === 0) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }
      await permissionService.invalidateUserCache(req.params.userId);
      res.json({ success: true, message: 'Member removed successfully' });
    } catch (error) {
      logger.error('Error removing project member:', error);
      res.status(500).json({ success: false, message: 'Failed to remove member' });
    }
  }
);

// ==================== Roles ====================

// GET /api/admin/rbac/roles
router.get(
  '/roles',
  requireOrgPermission(ORG_PERMISSIONS.ROLES_WRITE) as any,
  async (req: any, res) => {
    try {
      const roles = await db('g_roles')
        .select(
          'g_roles.*',
          db.raw(
            '(SELECT COUNT(*) FROM g_role_permissions WHERE roleId = g_roles.id) as permissionCount'
          ),
          db.raw('(SELECT COUNT(DISTINCT userId) FROM g_role_bindings WHERE roleId = g_roles.id AND userId IS NOT NULL) as userCount'),
          db.raw('(SELECT COUNT(DISTINCT groupId) FROM g_role_bindings WHERE roleId = g_roles.id AND groupId IS NOT NULL) as groupCount')
        )
        .where('g_roles.orgId', req.user.orgId)
        .orderBy('g_roles.roleName', 'asc');
      res.json({ success: true, data: roles });
    } catch (error) {
      logger.error('Error listing roles:', error);
      res.status(500).json({ success: false, message: 'Failed to list roles' });
    }
  }
);

// GET /api/admin/rbac/roles/:id/effective-permissions
// Returns the role's own + inherited (from parent roles) permissions
router.get(
  '/roles/:id/effective-permissions',
  requireOrgPermission(ORG_PERMISSIONS.ROLES_WRITE) as any,
  async (req: any, res) => {
    try {
      const roleId = req.params.id;

      // Get own permissions
      const ownPerms = await db('g_role_permissions')
        .where('roleId', roleId)
        .select('permission');
      const ownPermSet = new Set(ownPerms.map((p: any) => p.permission));

      // Get inherited permissions via parent roles (recursively)
      const inheritedPerms: Array<{ permission: string; fromRoleId: string; fromRoleName: string }> = [];

      // Recursive parent resolution
      const resolveParents = async (rIds: string[], depth: number = 0): Promise<void> => {
        if (depth >= 5 || rIds.length === 0) return;
        const parents = await db('g_role_inheritance as ri')
          .join('g_roles as r', 'ri.parentRoleId', 'r.id')
          .whereIn('ri.roleId', rIds)
          .select('ri.parentRoleId', 'r.roleName');

        const nextIds: string[] = [];
        for (const parent of parents) {
          const parentPerms = await db('g_role_permissions')
            .where('roleId', parent.parentRoleId)
            .select('permission');
          for (const pp of parentPerms) {
            if (!ownPermSet.has(pp.permission) && !inheritedPerms.some((ip) => ip.permission === pp.permission)) {
              inheritedPerms.push({
                permission: pp.permission,
                fromRoleId: parent.parentRoleId,
                fromRoleName: parent.roleName,
              });
            }
          }
          nextIds.push(parent.parentRoleId);
        }
        await resolveParents(nextIds, depth + 1);
      };

      await resolveParents([roleId]);

      res.json({
        success: true,
        data: {
          own: Array.from(ownPermSet),
          inherited: inheritedPerms,
        },
      });
    } catch (error) {
      logger.error('Error getting effective permissions:', error);
      res.status(500).json({ success: false, message: 'Failed to get effective permissions' });
    }
  }
);

// GET /api/admin/rbac/roles/:id
router.get(
  '/roles/:id',
  requireOrgPermission(ORG_PERMISSIONS.ROLES_WRITE) as any,
  async (req: any, res) => {
    try {
      const role = await RoleModel.getWithDetails(req.params.id);
      if (!role) {
        return res.status(404).json({ success: false, message: 'Role not found' });
      }
      res.json({ success: true, data: role });
    } catch (error) {
      logger.error('Error getting role:', error);
      res.status(500).json({ success: false, message: 'Failed to get role' });
    }
  }
);

// POST /api/admin/rbac/roles
router.post(
  '/roles',
  requireOrgPermission(ORG_PERMISSIONS.ROLES_WRITE) as any,
  async (req: any, res) => {
    try {
      const { roleName, description, permissions } = req.body;
      if (!roleName) {
        return res.status(400).json({ success: false, message: 'roleName is required' });
      }

      const existing = await RoleModel.findByName(req.user.orgId, roleName);
      if (existing) {
        return res.status(409).json({ success: false, message: 'Role name already exists' });
      }

      const role = await RoleModel.create({
        orgId: req.user.orgId,
        roleName,
        description,
        createdBy: req.user.id,
      });

      // Set permissions if provided
      if (permissions) {
        await RoleModel.setPermissions(role.id, permissions);
      }

      const result = await RoleModel.getWithDetails(role.id);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      logger.error('Error creating role:', error);
      res.status(500).json({ success: false, message: 'Failed to create role' });
    }
  }
);

// PUT /api/admin/rbac/roles/:id
router.put(
  '/roles/:id',
  requireOrgPermission(ORG_PERMISSIONS.ROLES_WRITE) as any,
  async (req: any, res) => {
    try {
      const { roleName, description, permissions } = req.body;

      await RoleModel.update(req.params.id, {
        roleName,
        description,
        updatedBy: req.user.id,
      });

      if (permissions) {
        await RoleModel.setPermissions(req.params.id, permissions);
      }

      const result = await RoleModel.getWithDetails(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error updating role:', error);
      res.status(500).json({ success: false, message: 'Failed to update role' });
    }
  }
);

// DELETE /api/admin/rbac/roles/:id
router.delete(
  '/roles/:id',
  requireOrgPermission(ORG_PERMISSIONS.ROLES_WRITE) as any,
  async (req: any, res) => {
    try {
      const deleted = await RoleModel.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Role not found' });
      }
      res.json({ success: true, message: 'Role deleted' });
    } catch (error) {
      logger.error('Error deleting role:', error);
      res.status(500).json({ success: false, message: 'Failed to delete role' });
    }
  }
);

// ==================== Groups ====================

// GET /api/admin/rbac/groups
router.get(
  '/groups',
  requireOrgPermission(ORG_PERMISSIONS.GROUPS_WRITE) as any,
  async (req: any, res) => {
    try {
      const groups = await GroupModel.findByOrgIdWithCounts(req.user.orgId);
      res.json({ success: true, data: groups });
    } catch (error) {
      logger.error('Error listing groups:', error);
      res.status(500).json({ success: false, message: 'Failed to list groups' });
    }
  }
);

// GET /api/admin/rbac/groups/:id
router.get(
  '/groups/:id',
  requireOrgPermission(ORG_PERMISSIONS.GROUPS_WRITE) as any,
  async (req: any, res) => {
    try {
      const group = await GroupModel.findById(req.params.id);
      if (!group) {
        return res.status(404).json({ success: false, message: 'Group not found' });
      }
      const [members, roles] = await Promise.all([
        GroupModel.getMembers(group.id),
        GroupModel.getRoles(group.id),
      ]);
      res.json({ success: true, data: { ...group, members, roles } });
    } catch (error) {
      logger.error('Error getting group:', error);
      res.status(500).json({ success: false, message: 'Failed to get group' });
    }
  }
);

// POST /api/admin/rbac/groups
router.post(
  '/groups',
  requireOrgPermission(ORG_PERMISSIONS.GROUPS_WRITE) as any,
  async (req: any, res) => {
    try {
      const { groupName, description, addNewUsersByDefault } = req.body;
      if (!groupName) {
        return res.status(400).json({ success: false, message: 'groupName is required' });
      }

      const existing = await GroupModel.findByName(req.user.orgId, groupName);
      if (existing) {
        return res.status(409).json({ success: false, message: 'Group name already exists' });
      }

      const group = await GroupModel.create({
        orgId: req.user.orgId,
        groupName,
        description,
        addNewUsersByDefault,
        createdBy: req.user.id,
      });
      res.status(201).json({ success: true, data: group });
    } catch (error) {
      logger.error('Error creating group:', error);
      res.status(500).json({ success: false, message: 'Failed to create group' });
    }
  }
);

// PUT /api/admin/rbac/groups/:id
router.put(
  '/groups/:id',
  requireOrgPermission(ORG_PERMISSIONS.GROUPS_WRITE) as any,
  async (req: any, res) => {
    try {
      const updated = await GroupModel.update(req.params.id, {
        ...req.body,
        updatedBy: req.user.id,
      });
      if (!updated) {
        return res.status(404).json({ success: false, message: 'Group not found' });
      }
      res.json({ success: true, data: updated });
    } catch (error) {
      logger.error('Error updating group:', error);
      res.status(500).json({ success: false, message: 'Failed to update group' });
    }
  }
);

// DELETE /api/admin/rbac/groups/:id
router.delete(
  '/groups/:id',
  requireOrgPermission(ORG_PERMISSIONS.GROUPS_WRITE) as any,
  async (req: any, res) => {
    try {
      const deleted = await GroupModel.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Group not found' });
      }
      res.json({ success: true, message: 'Group deleted' });
    } catch (error) {
      logger.error('Error deleting group:', error);
      res.status(500).json({ success: false, message: 'Failed to delete group' });
    }
  }
);

// POST /api/admin/rbac/groups/:id/members
router.post(
  '/groups/:id/members',
  requireOrgPermission(ORG_PERMISSIONS.GROUP_MEMBERSHIP_WRITE) as any,
  async (req: any, res) => {
    try {
      const { userId, isGroupAdmin } = req.body;
      if (!userId) {
        return res.status(400).json({ success: false, message: 'userId is required' });
      }
      await GroupModel.addMember(req.params.id, userId, isGroupAdmin, req.user.id);
      res.status(201).json({ success: true, message: 'Member added' });
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'User is already a member' });
      }
      logger.error('Error adding group member:', error);
      res.status(500).json({ success: false, message: 'Failed to add member' });
    }
  }
);

// DELETE /api/admin/rbac/groups/:id/members/:userId
router.delete(
  '/groups/:id/members/:userId',
  requireOrgPermission(ORG_PERMISSIONS.GROUP_MEMBERSHIP_WRITE) as any,
  async (req: any, res) => {
    try {
      const removed = await GroupModel.removeMember(req.params.id, req.params.userId);
      if (!removed) {
        return res.status(404).json({ success: false, message: 'Member not found' });
      }
      res.json({ success: true, message: 'Member removed' });
    } catch (error) {
      logger.error('Error removing group member:', error);
      res.status(500).json({ success: false, message: 'Failed to remove member' });
    }
  }
);

// POST /api/admin/rbac/groups/:id/roles
router.post(
  '/groups/:id/roles',
  requireOrgPermission(ORG_PERMISSIONS.GROUPS_WRITE) as any,
  async (req: any, res) => {
    try {
      const { roleId } = req.body;
      if (!roleId) {
        return res.status(400).json({ success: false, message: 'roleId is required' });
      }
      await GroupModel.addRole(req.params.id, roleId, req.user.orgId, req.user.id);
      res.status(201).json({ success: true, message: 'Role assigned to group' });
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Role already assigned' });
      }
      logger.error('Error adding group role:', error);
      res.status(500).json({ success: false, message: 'Failed to assign role' });
    }
  }
);

// DELETE /api/admin/rbac/groups/:id/roles/:roleId
router.delete(
  '/groups/:id/roles/:roleId',
  requireOrgPermission(ORG_PERMISSIONS.GROUPS_WRITE) as any,
  async (req: any, res) => {
    try {
      const removed = await GroupModel.removeRole(req.params.id, req.params.roleId);
      if (!removed) {
        return res.status(404).json({ success: false, message: 'Role not assigned to this group' });
      }
      res.json({ success: true, message: 'Role removed from group' });
    } catch (error) {
      logger.error('Error removing group role:', error);
      res.status(500).json({ success: false, message: 'Failed to remove role' });
    }
  }
);

// GET /api/admin/rbac/groups/:id/effective-permissions
router.get(
  '/groups/:id/effective-permissions',
  requireOrgPermission(ORG_PERMISSIONS.GROUPS_READ) as any,
  async (req: any, res) => {
    try {
      const groupId = req.params.id;
      const roles = await GroupModel.getRoles(groupId);

      const ownPermSet = new Set<string>();
      const permSources: Record<string, string> = {}; // permission -> source role name

      for (const role of roles) {
        // Get direct permissions of each role
        const rolePerms = await db('g_role_permissions')
          .where('roleId', role.roleId)
          .select('permission');
        for (const rp of rolePerms) {
          if (!ownPermSet.has(rp.permission)) {
            ownPermSet.add(rp.permission);
            permSources[rp.permission] = role.roleName;
          }
        }

        // Get inherited permissions via parent roles (recursively)
        const resolveParents = async (rIds: string[], depth: number = 0): Promise<void> => {
          if (depth >= 5 || rIds.length === 0) return;
          const parents = await db('g_role_inheritance as ri')
            .join('g_roles as r', 'ri.parentRoleId', 'r.id')
            .whereIn('ri.roleId', rIds)
            .select('ri.parentRoleId', 'r.roleName');

          const nextIds: string[] = [];
          for (const parent of parents) {
            const parentPerms = await db('g_role_permissions')
              .where('roleId', parent.parentRoleId)
              .select('permission');
            for (const pp of parentPerms) {
              if (!ownPermSet.has(pp.permission)) {
                ownPermSet.add(pp.permission);
                permSources[pp.permission] = `${role.roleName} ← ${parent.roleName}`;
              }
            }
            nextIds.push(parent.parentRoleId);
          }
          await resolveParents(nextIds, depth + 1);
        };

        await resolveParents([role.roleId]);
      }

      // Build response: all permissions with source info
      const allPerms = Array.from(ownPermSet).map((perm) => ({
        permission: perm,
        fromRoleName: permSources[perm] || '',
      }));

      res.json({
        success: true,
        data: {
          own: allPerms.map((p) => p.permission),
          inherited: [] as Array<{ permission: string; fromRoleId: string; fromRoleName: string }>,
          sources: allPerms,
        },
      });
    } catch (error) {
      logger.error('Error getting group effective permissions:', error);
      res.status(500).json({ success: false, message: 'Failed to get effective permissions' });
    }
  }
);

// ==================== User Roles ====================

// GET /api/admin/rbac/users/:id/roles
router.get(
  '/users/:id/roles',
  requireOrgPermission(ORG_PERMISSIONS.USERS_READ) as any,
  async (req: any, res) => {
    try {
      const userBindings = await db('g_role_bindings')
        .select(['g_role_bindings.*', 'r.roleName', 'r.description as roleDescription'])
        .join('g_roles as r', 'g_role_bindings.roleId', 'r.id')
        .where('g_role_bindings.userId', req.params.id)
        .orderBy('r.roleName', 'asc');
      res.json({ success: true, data: userBindings });
    } catch (error) {
      logger.error('Error getting user roles:', error);
      res.status(500).json({ success: false, message: 'Failed to get user roles' });
    }
  }
);

// POST /api/admin/rbac/users/:id/roles
router.post(
  '/users/:id/roles',
  requireOrgPermission(ORG_PERMISSIONS.USERS_WRITE) as any,
  async (req: any, res) => {
    try {
      // Prevent self-modification
      if (String(req.user.id) === String(req.params.id)) {
        return res.status(403).json({ success: false, message: 'Cannot modify your own roles' });
      }
      const { roleId } = req.body;
      if (!roleId) {
        return res.status(400).json({ success: false, message: 'roleId is required' });
      }
      const id = generateULID();
      await db('g_role_bindings').insert({
        id,
        userId: req.params.id,
        groupId: null,
        roleId,
        scopeType: 'org',
        scopeId: req.user.orgId,
        assignedBy: req.user.id,
      });
      await permissionService.invalidateUserCache(req.params.id);
      res.status(201).json({ success: true, message: 'Role assigned to user' });
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Role already assigned' });
      }
      logger.error('Error assigning user role:', error);
      res.status(500).json({ success: false, message: 'Failed to assign role' });
    }
  }
);

// DELETE /api/admin/rbac/users/:id/roles/:roleId
router.delete(
  '/users/:id/roles/:roleId',
  requireOrgPermission(ORG_PERMISSIONS.USERS_WRITE) as any,
  async (req: any, res) => {
    try {
      // Prevent self-modification
      if (String(req.user.id) === String(req.params.id)) {
        return res.status(403).json({ success: false, message: 'Cannot modify your own roles' });
      }
      const result = await db('g_role_bindings')
        .where('userId', req.params.id)
        .where('roleId', req.params.roleId)
        .del();
      if (result === 0) {
        return res.status(404).json({ success: false, message: 'Role not assigned to this user' });
      }
      await permissionService.invalidateUserCache(req.params.id);
      res.json({ success: true, message: 'Role removed from user' });
    } catch (error) {
      logger.error('Error removing user role:', error);
      res.status(500).json({ success: false, message: 'Failed to remove role' });
    }
  }
);

// GET /api/admin/rbac/users/:id/permissions - effective permissions (debug helper)
router.get(
  '/users/:id/permissions',
  requireOrgPermission(ORG_PERMISSIONS.USERS_READ) as any,
  async (req: any, res) => {
    try {
      const userId = req.params.id;
      const orgId = req.user.orgId;
      const isAdmin = await permissionService.isOrgAdmin(userId, orgId);
      const roleIds = await permissionService.getAllRoleIds(userId);

      // Get all permissions from all roles
      const permissions = await db('g_role_permissions')
        .whereIn('roleId', roleIds)
        .select('permission')
        .distinct();

      // Get all bindings for this user
      const bindings = await db('g_role_bindings')
        .select(['g_role_bindings.*', 'r.roleName'])
        .join('g_roles as r', 'g_role_bindings.roleId', 'r.id')
        .where('g_role_bindings.userId', userId);

      res.json({
        success: true,
        data: {
          isOrgAdmin: isAdmin,
          roleIds,
          permissions: permissions.map((r: any) => r.permission),
          bindings,
        },
      });
    } catch (error) {
      logger.error('Error getting user permissions:', error);
      res.status(500).json({ success: false, message: 'Failed to get permissions' });
    }
  }
);

// ==================== Admin API Tokens ====================

// GET /api/admin/rbac/admin-tokens
router.get(
  '/admin-tokens',
  requireOrgPermission(ORG_PERMISSIONS.ADMIN_TOKENS_WRITE) as any,
  async (req: any, res) => {
    try {
      const tokens = await AdminApiToken.findByOrgId(req.user.orgId);
      // Mask token values
      const masked = tokens.map((t) => ({
        ...t,
        tokenValue: AdminApiToken.maskTokenValue(t.tokenValue),
      }));
      res.json({ success: true, data: masked });
    } catch (error) {
      logger.error('Error listing admin tokens:', error);
      res.status(500).json({ success: false, message: 'Failed to list admin tokens' });
    }
  }
);

// POST /api/admin/rbac/admin-tokens
router.post(
  '/admin-tokens',
  requireOrgPermission(ORG_PERMISSIONS.ADMIN_TOKENS_WRITE) as any,
  async (req: any, res) => {
    try {
      const { tokenName, description, roleId, expiresAt } = req.body;
      if (!tokenName) {
        return res.status(400).json({ success: false, message: 'tokenName is required' });
      }

      const result = await AdminApiToken.create({
        orgId: req.user.orgId,
        tokenName,
        description,
        roleId,
        expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        createdBy: req.user.id,
      });

      // Return plain token only at creation time
      res.status(201).json({
        success: true,
        data: {
          ...result.token,
          tokenValue: result.plainToken,
        },
      });
    } catch (error) {
      logger.error('Error creating admin token:', error);
      res.status(500).json({ success: false, message: 'Failed to create admin token' });
    }
  }
);

// DELETE /api/admin/rbac/admin-tokens/:id
router.delete(
  '/admin-tokens/:id',
  requireOrgPermission(ORG_PERMISSIONS.ADMIN_TOKENS_WRITE) as any,
  async (req: any, res) => {
    try {
      const deleted = await AdminApiToken.delete(req.params.id);
      if (!deleted) {
        return res.status(404).json({ success: false, message: 'Admin token not found' });
      }
      res.json({ success: true, message: 'Admin token deleted' });
    } catch (error) {
      logger.error('Error deleting admin token:', error);
      res.status(500).json({ success: false, message: 'Failed to delete admin token' });
    }
  }
);

// ==================== Environment Keys ====================

// GET /api/admin/rbac/environment-keys/:environmentId
router.get('/environment-keys/:environmentId', async (req: any, res) => {
  try {
    const keys = await EnvironmentKey.findByEnvironment(req.params.environmentId);
    // Mask key values
    const masked = keys.map((k) => ({
      ...k,
      keyValue: `${k.keyValue.substring(0, 15)}...${k.keyValue.substring(k.keyValue.length - 4)}`,
    }));
    res.json({ success: true, data: masked });
  } catch (error) {
    logger.error('Error listing environment keys:', error);
    res.status(500).json({ success: false, message: 'Failed to list environment keys' });
  }
});

// POST /api/admin/rbac/environment-keys
router.post('/environment-keys', async (req: any, res) => {
  try {
    const { environmentId, keyType, keyName } = req.body;
    if (!environmentId || !keyType || !keyName) {
      return res.status(400).json({
        success: false,
        message: 'environment, keyType, and keyName are required',
      });
    }

    const result = await EnvironmentKey.create({
      environmentId,
      keyType,
      keyName,
      createdBy: req.user.id,
    });

    // Return plain key only at creation time
    res.status(201).json({
      success: true,
      data: {
        ...result.key,
        keyValue: result.plainKey,
      },
    });
  } catch (error) {
    logger.error('Error creating environment key:', error);
    res.status(500).json({ success: false, message: 'Failed to create environment key' });
  }
});

// PATCH /api/admin/rbac/environment-keys/:id/deactivate
router.patch('/environment-keys/:id/deactivate', async (req: any, res) => {
  try {
    const key = await EnvironmentKey.deactivate(req.params.id);
    if (!key) {
      return res.status(404).json({ success: false, message: 'Environment key not found' });
    }
    res.json({ success: true, data: key });
  } catch (error) {
    logger.error('Error deactivating environment key:', error);
    res.status(500).json({ success: false, message: 'Failed to deactivate environment key' });
  }
});

// PATCH /api/admin/rbac/environment-keys/:id/activate
router.patch('/environment-keys/:id/activate', async (req: any, res) => {
  try {
    const key = await EnvironmentKey.activate(req.params.id);
    if (!key) {
      return res.status(404).json({ success: false, message: 'Environment key not found' });
    }
    res.json({ success: true, data: key });
  } catch (error) {
    logger.error('Error activating environment key:', error);
    res.status(500).json({ success: false, message: 'Failed to activate environment key' });
  }
});

// DELETE /api/admin/rbac/environment-keys/:id
router.delete('/environment-keys/:id', async (req: any, res) => {
  try {
    const deleted = await EnvironmentKey.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Environment key not found' });
    }
    res.json({ success: true, message: 'Environment key deleted' });
  } catch (error) {
    logger.error('Error deleting environment key:', error);
    res.status(500).json({ success: false, message: 'Failed to delete environment key' });
  }
});

// ==================== Permission Reference ====================

// GET /api/admin/rbac/permissions - list all available permissions (for role editor UI)
router.get('/permissions', async (req: any, res) => {
  try {
    const { ALL_PERMISSIONS, PERMISSION_CATEGORIES, RESOURCE_ACTIONS, PERMISSION_SEPARATOR } =
      await import('../../types/permissions');

    // Transform array categories into Record format for FE consumption
    // FE expects: Record<string, { label: string; scope: string; permissions: string[] }>
    const categories: Record<string, { label: string; scope: string; permissions: string[] }> = {};
    for (const cat of PERMISSION_CATEGORIES) {
      // Extract key from labelKey (e.g. 'permissions.category.workspace' -> 'workspace')
      const key = cat.labelKey.split('.').pop() || cat.labelKey;
      const permissions: string[] = [];
      for (const resource of cat.resources) {
        const actions = RESOURCE_ACTIONS[resource];
        if (actions) {
          for (const action of actions) {
            permissions.push(`${resource}${PERMISSION_SEPARATOR}${action}`);
          }
        }
      }
      categories[key] = {
        label: cat.labelKey,
        scope: cat.scope,
        permissions,
      };
    }

    res.json({
      success: true,
      data: {
        all: ALL_PERMISSIONS,
        categories,
      },
    });
  } catch (error) {
    logger.error('Error listing permissions:', error);
    res.status(500).json({ success: false, message: 'Failed to list permissions' });
  }
});

// ==================== Role Inheritance ====================

// GET /api/admin/rbac/roles/:roleId/inheritance - Get parent roles for a role
router.get('/roles/:roleId/inheritance', requireOrgAdmin as any, async (req: any, res) => {
  try {
    const { roleId } = req.params;

    const parents = await db('g_role_inheritance as ri')
      .join('g_roles as r', 'ri.parentRoleId', 'r.id')
      .where('ri.roleId', roleId)
      .select('ri.id', 'ri.parentRoleId', 'r.roleName as parentRoleName', 'ri.createdAt');

    res.json({ success: true, data: parents });
  } catch (error) {
    logger.error('Error getting role inheritance:', error);
    res.status(500).json({ success: false, message: 'Failed to get role inheritance' });
  }
});

// POST /api/admin/rbac/roles/:roleId/inheritance - Add parent role (with cycle detection)
router.post('/roles/:roleId/inheritance', requireOrgAdmin as any, async (req: any, res) => {
  try {
    const { roleId } = req.params;
    const { parentRoleId } = req.body;

    if (!parentRoleId) {
      return res.status(400).json({ success: false, message: 'parentRoleId is required' });
    }

    if (roleId === parentRoleId) {
      return res.status(400).json({ success: false, message: 'A role cannot inherit from itself' });
    }

    // Check both roles exist
    const [role, parentRole] = await Promise.all([
      db('g_roles').where('id', roleId).first(),
      db('g_roles').where('id', parentRoleId).first(),
    ]);

    if (!role) {
      return res.status(404).json({ success: false, message: 'Role not found' });
    }
    if (!parentRole) {
      return res.status(404).json({ success: false, message: 'Parent role not found' });
    }

    // Check for circular reference
    const wouldCycle = await permissionService.wouldCreateCycle(roleId, parentRoleId);
    if (wouldCycle) {
      return res.status(400).json({
        success: false,
        message: 'Adding this parent role would create a circular inheritance chain',
      });
    }

    // Check for duplicate
    const existing = await db('g_role_inheritance').where({ roleId, parentRoleId }).first();
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: 'Inheritance relationship already exists' });
    }

    const id = generateULID();
    await db('g_role_inheritance').insert({ id, roleId, parentRoleId });

    // Invalidate cache for affected users
    await permissionService.invalidateRoleCache(roleId);

    res.json({ success: true, data: { id, roleId, parentRoleId } });
  } catch (error) {
    logger.error('Error adding role inheritance:', error);
    res.status(500).json({ success: false, message: 'Failed to add role inheritance' });
  }
});

// DELETE /api/admin/rbac/roles/:roleId/inheritance/:inheritanceId - Remove parent role
router.delete(
  '/roles/:roleId/inheritance/:inheritanceId',
  requireOrgAdmin as any,
  async (req: any, res) => {
    try {
      const { roleId, inheritanceId } = req.params;

      const deleted = await db('g_role_inheritance').where({ id: inheritanceId, roleId }).del();

      if (!deleted) {
        return res
          .status(404)
          .json({ success: false, message: 'Inheritance relationship not found' });
      }

      // Invalidate cache for affected users
      await permissionService.invalidateRoleCache(roleId);

      res.json({ success: true, message: 'Inheritance removed' });
    } catch (error) {
      logger.error('Error removing role inheritance:', error);
      res.status(500).json({ success: false, message: 'Failed to remove role inheritance' });
    }
  }
);

// ==================== Permission Preview ====================

// GET /api/admin/rbac/users/:userId/effective-permissions - Get effective permissions with sources
router.get(
  '/users/:userId/effective-permissions',
  requireOrgAdmin as any,
  async (req: any, res) => {
    try {
      const { userId } = req.params;
      const orgId = req.user.orgId;

      if (!orgId) {
        return res.status(400).json({ success: false, message: 'Organisation context required' });
      }

      const effectivePermissions = await permissionService.getUserEffectivePermissions(
        userId,
        orgId
      );

      res.json({ success: true, data: effectivePermissions });
    } catch (error) {
      logger.error('Error getting effective permissions:', error);
      res.status(500).json({ success: false, message: 'Failed to get effective permissions' });
    }
  }
);

export default router;
