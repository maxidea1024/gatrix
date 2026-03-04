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
import logger from '../../config/logger';
import db from '../../config/knex';

const router = express.Router();

// All RBAC routes require authentication
router.use(authenticate as any);

// ==================== Organisations ====================

// GET /api/admin/rbac/organisations
router.get('/organisations', requireOrgAdmin as any, async (req: any, res) => {
  try {
    const orgs = await Organisation.findAll();
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

// ==================== Projects ====================

// GET /api/admin/rbac/projects
router.get('/projects', async (req: any, res) => {
  try {
    const orgId = req.user.orgId;
    const projects = await ProjectModel.findByOrgId(orgId);
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
      const { projectName, displayName, description } = req.body;
      if (!projectName || !displayName) {
        return res
          .status(400)
          .json({ success: false, message: 'projectName and displayName are required' });
      }

      const existing = await ProjectModel.findByName(req.user.orgId, projectName);
      if (existing) {
        return res.status(409).json({ success: false, message: 'Project name already exists' });
      }

      const project = await ProjectModel.create({
        orgId: req.user.orgId,
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
          db.raw('(SELECT COUNT(*) FROM g_role_org_permissions WHERE roleId = g_roles.id) + (SELECT COUNT(*) FROM g_role_project_permissions WHERE roleId = g_roles.id) + (SELECT COUNT(*) FROM g_role_environment_permissions WHERE roleId = g_roles.id) as permissionCount'),
          db.raw('(SELECT COUNT(*) FROM g_user_roles WHERE roleId = g_roles.id) as userCount'),
          db.raw('(SELECT COUNT(*) FROM g_group_roles WHERE roleId = g_roles.id) as groupCount')
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
      await GroupModel.addRole(req.params.id, roleId, req.user.id);
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

// ==================== User Roles ====================

// GET /api/admin/rbac/users/:id/roles
router.get(
  '/users/:id/roles',
  requireOrgPermission(ORG_PERMISSIONS.USERS_READ) as any,
  async (req: any, res) => {
    try {
      const userRoles = await db('g_user_roles')
        .select(['g_user_roles.*', 'r.roleName', 'r.description as roleDescription'])
        .join('g_roles as r', 'g_user_roles.roleId', 'r.id')
        .where('g_user_roles.userId', req.params.id)
        .orderBy('r.roleName', 'asc');
      res.json({ success: true, data: userRoles });
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
      await db('g_user_roles').insert({
        id,
        userId: req.params.id,
        roleId,
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
      const result = await db('g_user_roles')
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
      const [orgPerms, projectPerms, envPerms] = await Promise.all([
        db('g_role_org_permissions').whereIn('roleId', roleIds).select('permission').distinct(),
        db('g_role_project_permissions')
          .whereIn('roleId', roleIds)
          .select('projectId', 'permission', 'isAdmin')
          .distinct(),
        db('g_role_environment_permissions')
          .whereIn('roleId', roleIds)
          .select('environmentId', 'permission', 'isAdmin')
          .distinct(),
      ]);

      res.json({
        success: true,
        data: {
          isOrgAdmin: isAdmin,
          roleIds,
          permissions: {
            org: orgPerms.map((r: any) => r.permission),
            project: projectPerms,
            env: envPerms,
          },
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
    const { ALL_PERMISSIONS, PERMISSION_CATEGORIES } = await import('../../types/permissions');
    res.json({
      success: true,
      data: {
        all: ALL_PERMISSIONS,
        categories: PERMISSION_CATEGORIES,
      },
    });
  } catch (error) {
    logger.error('Error listing permissions:', error);
    res.status(500).json({ success: false, message: 'Failed to list permissions' });
  }
});

export default router;
