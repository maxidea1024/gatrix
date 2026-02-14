/**
 * Signal Ingestion Routes (Public)
 *
 * Public API endpoint for external systems to send signals.
 * Authentication is done via signal endpoint tokens (Bearer token).
 */

import { Router, Request, Response } from 'express';
import { SignalEndpointModel } from '../../models/SignalEndpoint';
import { createLogger } from '../../config/logger';
import crypto from 'crypto';

const router = Router();
const logger = createLogger('SignalIngestionRoutes');

/**
 * POST /api/v1/signals/:endpointName
 * Receive a signal from an external system
 *
 * Authentication: Bearer token (signal endpoint token)
 * Body: JSON payload (free-form)
 */
router.post('/:endpointName', async (req: Request, res: Response) => {
    try {
        const { endpointName } = req.params;

        // Extract Bearer token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid authorization token' });
        }

        const plainToken = authHeader.substring(7);

        // Hash the token and look it up
        const tokenHash = crypto.createHash('sha256').update(plainToken).digest('hex');
        const tokenInfo = await SignalEndpointModel.verifyEndpointToken(tokenHash);

        if (!tokenInfo) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }

        // Verify the endpoint name matches
        const endpoint = await SignalEndpointModel.findById(tokenInfo.endpointId);
        if (!endpoint || endpoint.name !== endpointName) {
            return res.status(404).json({ error: 'Signal endpoint not found' });
        }

        if (!endpoint.isEnabled) {
            return res.status(403).json({ error: 'Signal endpoint is disabled' });
        }

        // Create the signal
        const signal = await SignalEndpointModel.createSignal(
            'signal-endpoint',
            tokenInfo.endpointId,
            req.body || null,
            tokenInfo.tokenId
        );

        logger.info(`Signal received on endpoint "${endpointName}" (ID: ${signal.id})`);

        res.status(202).json({
            success: true,
            data: { signalId: signal.id },
        });
    } catch (error) {
        logger.error('Error receiving signal:', error);
        res.status(500).json({ error: 'Failed to process signal' });
    }
});

export default router;
