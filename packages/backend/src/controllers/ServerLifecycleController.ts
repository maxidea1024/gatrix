import { Request, Response } from 'express';
import ServerLifecycleEvent from '../models/ServerLifecycleEvent';
import logger from '../config/logger';

class ServerLifecycleController {
    /**
     * Get server lifecycle events with pagination and filters
     * GET /api/v1/admin/server-lifecycle/events
     */
    async getEvents(req: Request, res: Response) {
        try {
            const {
                page = 1,
                limit = 20,
                serviceType,
                instanceId,
                environmentId,
                eventType,
                serviceGroup,
                hostname,
                externalAddress,
                internalAddress,
                cloudProvider,
                cloudRegion,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = req.query;

            // Validate sortBy to prevent SQL injection
            const allowedSortColumns = ['createdAt', 'eventType', 'serviceType', 'serviceGroup', 'hostname', 'cloudRegion', 'appVersion', 'uptimeSeconds'];
            const safeSortBy = allowedSortColumns.includes(sortBy as string) ? sortBy as string : 'createdAt';
            const safeSortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

            // Join with environments to get environment name
            const query = ServerLifecycleEvent.query()
                .select(
                    'g_server_lifecycle_events.*',
                    'g_environments.environmentName as environmentName'
                )
                .leftJoin('g_environments', 'g_server_lifecycle_events.environmentId', 'g_environments.id')
                .orderBy(`g_server_lifecycle_events.${safeSortBy}`, safeSortOrder);

            if (serviceType) {
                query.where('g_server_lifecycle_events.serviceType', serviceType as string);
            }
            if (instanceId) {
                query.where('g_server_lifecycle_events.instanceId', instanceId as string);
            }
            if (environmentId) {
                query.where('g_server_lifecycle_events.environmentId', environmentId as string);
            }
            if (eventType) {
                query.where('g_server_lifecycle_events.eventType', eventType as string);
            }
            if (serviceGroup) {
                query.where('g_server_lifecycle_events.serviceGroup', 'like', `%${serviceGroup}%`);
            }
            if (hostname) {
                query.where('g_server_lifecycle_events.hostname', 'like', `%${hostname}%`);
            }
            if (externalAddress) {
                query.where('g_server_lifecycle_events.externalAddress', 'like', `%${externalAddress}%`);
            }
            if (internalAddress) {
                query.where('g_server_lifecycle_events.internalAddress', 'like', `%${internalAddress}%`);
            }
            if (cloudProvider) {
                query.where('g_server_lifecycle_events.cloudProvider', 'like', `%${cloudProvider}%`);
            }
            if (cloudRegion) {
                query.where('g_server_lifecycle_events.cloudRegion', 'like', `%${cloudRegion}%`);
            }

            const events = await query.page(Number(page) - 1, Number(limit));

            res.json({
                success: true,
                data: events.results,
                total: events.total,
                page: Number(page),
                limit: Number(limit),
            });
        } catch (error: any) {
            logger.error('Failed to get server lifecycle events:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to get server lifecycle events',
            });
        }
    }

    /**
     * Get recent events summary for dashboard
     * GET /api/v1/admin/server-lifecycle/summary
     */
    async getRecentSummary(req: Request, res: Response) {
        try {
            const limit = req.query.limit ? Number(req.query.limit) : 10;

            const recentEvents = await ServerLifecycleEvent.query()
                .orderBy('createdAt', 'desc')
                .limit(limit);

            res.json({
                success: true,
                data: recentEvents,
            });
        } catch (error: any) {
            logger.error('Failed to get server lifecycle summary:', error);
            res.status(500).json({
                success: false,
                error: error.message || 'Failed to get server lifecycle summary',
            });
        }
    }
}

export default new ServerLifecycleController();
