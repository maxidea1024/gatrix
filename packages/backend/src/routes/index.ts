import express from 'express';
import { authLimiter } from '../middleware/rate-limiter';
import { ApiAccessToken } from '../models/api-access-token';
import { createLogger } from '../config/logger';

const logger = createLogger('routes');

// Import organized route modules
import clientRoutes from './client';
import serverRoutes from './server';
import adminRoutes from './admin';
import { MonitoringAlertController } from '../controllers/monitoring-alert-controller';
import authRoutes from './auth';
import publicRoutes from './public';
// chatRoutes are handled directly in app.ts before body parsing
import userRoutes from './users';
import linkPreviewRoutes from './link-preview';
import mailRoutes from './mails';
import couponRoutes from './coupons';
import entityLockRoutes from '../controllers/entity-lock-controller';
import signalIngestionRoutes from './public/signals';

const router = express.Router();

// Unsecured token format: unsecured-{org}:{project}:{env}-{type}-api-token
const READY_UNSECURED_REGEX =
  /^unsecured-([^:]+):([^:]+):(.+)-(server|client|edge)-api-token$/;

// Legacy unsecured tokens — resolve to default/default/development
const READY_LEGACY_TOKENS: Record<
  string,
  { orgId: string; projectId: string; envId: string }
> = {
  'unsecured-client-api-token': {
    orgId: 'default',
    projectId: 'default',
    envId: 'development',
  },
  'unsecured-server-api-token': {
    orgId: 'default',
    projectId: 'default',
    envId: 'development',
  },
  'unsecured-edge-api-token': {
    orgId: 'default',
    projectId: 'default',
    envId: 'development',
  },
};

// Readiness check endpoint
router.get('/ready', async (req, res) => {
  const responseData: Record<string, any> = {
    status: 'ready',
    timestamp: new Date().toISOString(),
    service: 'gatrix-backend',
  };

  // If API token is provided, resolve and return environment info
  const token =
    (req.headers['x-api-token'] as string) || (req.query.token as string);
  if (token) {
    // 1. Try DB lookup for real tokens
    try {
      const tokenData = await ApiAccessToken.validateAndUse(token);
      if (tokenData?.environmentId) {
        responseData.environmentId = tokenData.environmentId;

        // Resolve orgId and projectId from environment hierarchy
        if (tokenData.projectId) {
          responseData.projectId = tokenData.projectId;
        }
        try {
          const { Environment } = await import('../models/environment');
          const env = await Environment.query()
            .findById(tokenData.environmentId)
            .withGraphFetched('project')
            .modifiers({
              selectProject: (builder: any) =>
                builder.select('id', 'orgId'),
            });
          if (env?.project?.orgId) {
            responseData.orgId = env.project.orgId;
          }
          if (!responseData.projectId && env?.projectId) {
            responseData.projectId = env.projectId;
          }
        } catch (envError) {
          logger.debug('Failed to resolve org/project in /ready endpoint', {
            error: envError,
          });
        }
      }
    } catch (error) {
      logger.debug('Failed to resolve token in /ready endpoint', { error });
    }

    // 2. Fallback: parse unsecured tokens if DB lookup didn't resolve
    if (!responseData.environmentId) {
      let orgName: string | undefined;
      let projectName: string | undefined;
      let envName: string | undefined;

      // Check new format: unsecured-{org}:{project}:{env}-{type}-api-token
      const unsecuredMatch = token.match(READY_UNSECURED_REGEX);
      if (unsecuredMatch) {
        [, orgName, projectName, envName] = unsecuredMatch;
      }

      // Check legacy format: unsecured-{type}-api-token
      const legacyEntry = READY_LEGACY_TOKENS[token];
      if (legacyEntry) {
        orgName = legacyEntry.orgId;
        projectName = legacyEntry.projectId;
        envName = legacyEntry.envId;
      }

      // Resolve environment by full path (orgName/projectName/envName)
      if (orgName && projectName && envName) {
        try {
          const { Environment } = await import('../models/environment');
          const env = await Environment.getByFullPath(
            orgName,
            projectName,
            envName
          );
          if (env) {
            responseData.environmentId = env.id;
            responseData.projectId = env.projectId;
            // Resolve orgId from project
            try {
              const envWithProject = await Environment.query()
                .findById(env.id)
                .withGraphFetched('project')
                .modifiers({
                  selectProject: (builder: any) =>
                    builder.select('id', 'orgId'),
                });
              if (envWithProject?.project?.orgId) {
                responseData.orgId = envWithProject.project.orgId;
              }
            } catch (_) {
              // orgId resolution failure is non-critical
            }
          }
        } catch (error) {
          logger.debug(
            'Failed to resolve unsecured token in /ready endpoint',
            { error }
          );
        }
      }
    }
  }

  res.json({
    success: true,
    data: responseData,
  });
});

// Public webhook endpoint for Grafana alert notifications
router.post(
  '/monitoring/alerts',
  MonitoringAlertController.receiveAlert as any
);

// Mount all route modules
router.use('/client', clientRoutes);
router.use('/server', serverRoutes);
router.use('/admin', adminRoutes);
router.use('/auth', authLimiter as any, authRoutes);
// chat routes are handled directly in app.ts before body parsing
router.use('/users', userRoutes);
router.use('/link-preview', linkPreviewRoutes);
router.use('/mails', mailRoutes);
router.use('/coupons', couponRoutes);
router.use('/public', publicRoutes);
router.use('/entity-locks', entityLockRoutes);
router.use('/signals', signalIngestionRoutes);

export default router;
