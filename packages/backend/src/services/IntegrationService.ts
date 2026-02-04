/**
 * Integration Service
 *
 * Business logic for managing integrations (addons) and dispatching events.
 */

import { createLogger } from '../config/logger';
import {
  IntegrationModel,
  Integration,
  CreateIntegrationData,
  UpdateIntegrationData,
} from '../models/Integration';
import { IntegrationEventModel } from '../models/IntegrationEvent';
import { getAddons, getProviderDefinitions, AddonDefinition, ADDON_DEFINITIONS } from '../addons';
import {
  IntegrationSystemEvent,
  IntegrationEventType,
  INTEGRATION_EVENTS,
} from '../types/integrationEvents';
import { AuditLogModel } from '../models/AuditLog';

const logger = createLogger('IntegrationService');

// Singleton to hold addon instances
let addonInstances: ReturnType<typeof getAddons> | null = null;

/**
 * Get or create addon instances
 */
function getAddonInstances() {
  if (!addonInstances) {
    addonInstances = getAddons();
  }
  return addonInstances;
}

/**
 * Sensitive parameters that should be masked
 */
const SENSITIVE_PARAMS = new Set<string>();
Object.values(ADDON_DEFINITIONS).forEach((definition) => {
  definition.parameters.forEach((param) => {
    if (param.sensitive) {
      SENSITIVE_PARAMS.add(param.name);
    }
  });
});

const MASKED_VALUE = '*****';

export class IntegrationService {
  /**
   * Create a new integration
   */
  static async create(
    data: CreateIntegrationData,
    auditUser: { id: number; name: string }
  ): Promise<Integration> {
    // Validate provider
    if (!ADDON_DEFINITIONS[data.provider]) {
      throw new Error(`Unknown provider: ${data.provider}`);
    }

    // Validate required parameters
    this.validateParameters(data.provider, data.parameters);

    const integration = await IntegrationModel.create({
      ...data,
      createdBy: auditUser.id,
    });

    // Audit log
    await AuditLogModel.create({
      userId: auditUser.id,
      action: 'integration_created',
      resourceType: 'integration',
      resourceId: integration.id,
      newValues: {
        provider: integration.provider,
        description: integration.description,
        isEnabled: integration.isEnabled,
      },
    });

    logger.info(`User ${auditUser.name} created integration ${integration.id} (${data.provider})`);

    return this.filterSensitiveFields(integration);
  }

  /**
   * Update an integration
   */
  static async update(
    id: string,
    data: UpdateIntegrationData,
    auditUser: { id: number; name: string }
  ): Promise<Integration | null> {
    const existing = await IntegrationModel.findById(id);
    if (!existing) {
      return null;
    }

    // Handle masked values - preserve existing sensitive parameters
    if (data.parameters) {
      const existingParams = existing.parameters;
      Object.entries(data.parameters).forEach(([key, value]) => {
        if (value === MASKED_VALUE && existingParams[key]) {
          data.parameters![key] = existingParams[key];
        }
      });
    }

    // Validate parameters if provided
    if (data.parameters) {
      this.validateParameters(data.provider || existing.provider, data.parameters);
    }

    const updated = await IntegrationModel.update(id, {
      ...data,
      updatedBy: auditUser.id,
    });

    if (updated) {
      // Audit log
      await AuditLogModel.create({
        userId: auditUser.id,
        action: 'integration_updated',
        resourceType: 'integration',
        resourceId: id,
        oldValues: {
          description: existing.description,
          isEnabled: existing.isEnabled,
        },
        newValues: {
          description: updated.description,
          isEnabled: updated.isEnabled,
        },
      });

      logger.info(`User ${auditUser.name} updated integration ${id}`);
    }

    return updated ? this.filterSensitiveFields(updated) : null;
  }

  /**
   * Delete an integration
   */
  static async delete(id: string, auditUser: { id: number; name: string }): Promise<boolean> {
    const existing = await IntegrationModel.findById(id);
    if (!existing) {
      return false;
    }

    const success = await IntegrationModel.delete(id);

    if (success) {
      await AuditLogModel.create({
        userId: auditUser.id,
        action: 'integration_deleted',
        resourceType: 'integration',
        resourceId: id,
        oldValues: {
          provider: existing.provider,
          description: existing.description,
        },
      });

      logger.info(`User ${auditUser.name} deleted integration ${id} (${existing.provider})`);
    }

    return success;
  }

  /**
   * Get integration by ID
   */
  static async getById(id: string): Promise<Integration | null> {
    const integration = await IntegrationModel.findById(id);
    return integration ? this.filterSensitiveFields(integration) : null;
  }

  /**
   * Get all integrations
   */
  static async getAll(): Promise<Integration[]> {
    const integrations = await IntegrationModel.findAll();
    return integrations.map((i) => this.filterSensitiveFields(i));
  }

  /**
   * Get all provider definitions
   */
  static getProviders(): AddonDefinition[] {
    return getProviderDefinitions();
  }

  /**
   * Toggle integration enabled status
   */
  static async toggle(
    id: string,
    auditUser: { id: number; name: string }
  ): Promise<Integration | null> {
    const existing = await IntegrationModel.findById(id);
    if (!existing) {
      return null;
    }

    const updated = await IntegrationModel.toggleEnabled(id, auditUser.id);

    if (updated) {
      await AuditLogModel.create({
        userId: auditUser.id,
        action: 'integration_updated',
        resourceType: 'integration',
        resourceId: id,
        oldValues: { isEnabled: existing.isEnabled },
        newValues: { isEnabled: updated.isEnabled },
      });

      logger.info(
        `User ${auditUser.name} toggled integration ${id} to ${updated.isEnabled ? 'enabled' : 'disabled'}`
      );
    }

    return updated ? this.filterSensitiveFields(updated) : null;
  }

  /**
   * Handle a system event - dispatch to all matching integrations
   */
  static async handleEvent(event: IntegrationSystemEvent): Promise<void> {
    try {
      const integrations = await IntegrationModel.findEnabledByEvent(event.type, event.environment);

      if (integrations.length === 0) {
        logger.debug(`No integrations configured for event ${event.type}`);
        return;
      }

      logger.info(`Dispatching event ${event.type} to ${integrations.length} integration(s)`);

      const addons = getAddonInstances();

      const tasks = integrations.map(async (integration) => {
        const addon = addons[integration.provider];
        if (!addon) {
          logger.warn(`Unknown addon provider: ${integration.provider}`);
          return;
        }

        try {
          await addon.handleEvent(event, integration.parameters, integration.id);
        } catch (error) {
          logger.error(`Error handling event for integration ${integration.id}:`, error);
        }
      });

      await Promise.allSettled(tasks);
    } catch (error) {
      logger.error('Error dispatching event to integrations:', error);
    }
  }

  /**
   * Get integration event logs
   */
  static async getIntegrationEvents(integrationId: string, page: number = 1, limit: number = 20) {
    return IntegrationEventModel.findByIntegrationId(integrationId, page, limit);
  }

  /**
   * Send a test message to an integration
   */
  static async sendTestMessage(
    integrationId: string,
    auditUser: { id: number; name: string }
  ): Promise<void> {
    const integration = await IntegrationModel.findById(integrationId);
    if (!integration) {
      throw new Error('Integration not found');
    }

    const addons = getAddonInstances();
    const addon = addons[integration.provider];
    if (!addon) {
      throw new Error(`Unknown addon provider: ${integration.provider}`);
    }

    // Create a test event
    const testEvent: IntegrationSystemEvent = {
      type: INTEGRATION_EVENTS.INTEGRATION_TEST,
      environment: 'test',
      createdAt: new Date(),
      createdBy: auditUser.name,
      data: {
        message: 'This is a test message from Gatrix',
        integrationId: integration.id,
        provider: integration.provider,
      },
    };

    await addon.handleEvent(testEvent, integration.parameters, integration.id);

    // Check the event log to see if it failed
    // Wait a bit for the event to be registered
    await new Promise((resolve) => setTimeout(resolve, 100));

    const result = await IntegrationEventModel.findByIntegrationId(integrationId, 1, 1);
    if (result.events.length > 0) {
      const lastEvent = result.events[0];
      if (lastEvent.eventType === 'integration_test' && lastEvent.state === 'failed') {
        throw new Error(lastEvent.stateDetails || 'Test message failed');
      }
    }

    logger.info(`Test message sent for integration ${integrationId} by ${auditUser.name}`);
  }

  /**
   * Validate provider parameters
   */
  private static validateParameters(provider: string, parameters: Record<string, any>): void {
    const definition = ADDON_DEFINITIONS[provider];
    if (!definition) {
      throw new Error(`Unknown provider: ${provider}`);
    }

    const requiredParams = definition.parameters.filter((p) => p.required);
    const missingParams: string[] = [];

    for (const param of requiredParams) {
      const value = parameters[param.name];
      if (value === undefined || value === null || value === '') {
        // Skip check if value is masked (update scenario)
        if (value !== MASKED_VALUE) {
          missingParams.push(param.displayName);
        }
      }
    }

    if (missingParams.length > 0) {
      throw new Error(`Missing required parameters: ${missingParams.join(', ')}`);
    }
  }

  /**
   * Filter sensitive fields from integration
   */
  private static filterSensitiveFields(integration: Integration): Integration {
    const filtered = { ...integration };
    const maskedParams: Record<string, any> = {};

    Object.entries(integration.parameters).forEach(([key, value]) => {
      if (SENSITIVE_PARAMS.has(key) && value) {
        maskedParams[key] = MASKED_VALUE;
      } else {
        maskedParams[key] = value;
      }
    });

    filtered.parameters = maskedParams;
    return filtered;
  }
}

export default IntegrationService;
