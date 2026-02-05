/**
 * Debug Addon
 *
 * Internal addon for debugging and testing events.
 * Simply logs the event details and simulates success/failure.
 */

import Addon from './Addon';
import { debugDefinition } from './definitions';
import { IntegrationSystemEvent } from '../types/integrationEvents';
import { createLogger } from '../config/logger';

export class DebugAddon extends Addon {
    private debugLogger;

    constructor() {
        super(debugDefinition);
        // Use a separate logger to ensure debug output is distinct
        this.debugLogger = createLogger('DebugAddon');
    }

    async handleEvent(
        event: IntegrationSystemEvent,
        parameters: Record<string, any>,
        integrationId: string
    ): Promise<void> {
        const { logLevel = 'info', simulateAttribute } = parameters;

        // Simulate custom attribute logging if provided
        if (simulateAttribute) {
            this.debugLogger.info(`[Debug] Custom Attribute: ${simulateAttribute}`, {
                integrationId,
                eventId: event.id,
            });
        }

        // Log the full event payload
        const logData = {
            integrationId,
            eventType: event.type,
            eventData: event.data,
            environment: event.environment,
            createdAt: event.createdAt,
            parameters: { ...parameters, sensitive: '***' }, // conceal sensitive if any
        };

        // Log with requested level
        switch (logLevel) {
            case 'error':
                this.debugLogger.error(`[Debug] Event Received: ${event.type}`, logData);
                break;
            case 'warn':
                this.debugLogger.warn(`[Debug] Event Received: ${event.type}`, logData);
                break;
            case 'debug':
                this.debugLogger.debug(`[Debug] Event Received: ${event.type}`, logData);
                break;
            case 'info':
            default:
                this.debugLogger.info(`[Debug] Event Received: ${event.type}`, logData);
                break;
        }

        // Always succeed
        await this.registerEvent(integrationId, event, 'success', 'Logged to debug console', {
            logLevel,
            loggedAt: new Date().toISOString(),
        });
    }
}

export default DebugAddon;
