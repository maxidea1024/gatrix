import db from '../config/knex';
import { createLogger } from '../config/logger';
import { ulid } from 'ulid';

const logger = createLogger('Integration');

// Types
export interface Integration {
  id: string;
  provider: string;
  description: string | null;
  isEnabled: boolean;
  parameters: Record<string, any>;
  events: string[];
  environments: string[];
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
  // Joined fields
  createdByName?: string;
  updatedByName?: string;
  lastEvent?: {
    state: 'success' | 'failed' | 'successWithErrors';
    stateDetails: string | null;
    createdAt: Date;
  };
}

export interface CreateIntegrationData {
  provider: string;
  description?: string;
  isEnabled?: boolean;
  parameters: Record<string, any>;
  events: string[];
  environments?: string[];
  createdBy?: number;
}

export interface UpdateIntegrationData {
  provider?: string;
  description?: string;
  isEnabled?: boolean;
  parameters?: Record<string, any>;
  events?: string[];
  environments?: string[];
  updatedBy?: number;
}

export class IntegrationModel {
  private static readonly TABLE = 'g_integrations';

  /**
   * Create a new integration
   */
  static async create(data: CreateIntegrationData): Promise<Integration> {
    const id = ulid();

    try {
      await db(this.TABLE).insert({
        id,
        provider: data.provider,
        description: data.description || null,
        isEnabled: data.isEnabled ?? true,
        parameters: JSON.stringify(data.parameters || {}),
        events: JSON.stringify(data.events || []),
        environments: JSON.stringify(data.environments || []),
        createdBy: data.createdBy || null,
        updatedBy: data.createdBy || null,
      });

      const integration = await this.findById(id);
      if (!integration) {
        throw new Error('Failed to create integration');
      }

      logger.info(`Created integration ${id} with provider ${data.provider}`);
      return integration;
    } catch (error) {
      logger.error('Error creating integration:', error);
      throw error;
    }
  }

  /**
   * Find integration by ID
   */
  static async findById(id: string): Promise<Integration | null> {
    try {
      const row = await db(this.TABLE)
        .leftJoin('g_users as cu', 'g_integrations.createdBy', 'cu.id')
        .leftJoin('g_users as uu', 'g_integrations.updatedBy', 'uu.id')
        .select(['g_integrations.*', 'cu.name as createdByName', 'uu.name as updatedByName'])
        .where('g_integrations.id', id)
        .first();

      if (!row) {
        return null;
      }

      return this.rowToIntegration(row);
    } catch (error) {
      logger.error('Error finding integration by ID:', error);
      throw error;
    }
  }

  /**
   * Find all integrations
   */
  static async findAll(filters?: {
    isEnabled?: boolean;
    provider?: string;
  }): Promise<Integration[]> {
    try {
      let query = db(this.TABLE)
        .leftJoin('g_users as cu', 'g_integrations.createdBy', 'cu.id')
        .leftJoin('g_users as uu', 'g_integrations.updatedBy', 'uu.id')
        .select(['g_integrations.*', 'cu.name as createdByName', 'uu.name as updatedByName'])
        .orderBy('g_integrations.createdAt', 'desc');

      if (filters?.isEnabled !== undefined) {
        query = query.where('g_integrations.isEnabled', filters.isEnabled);
      }

      if (filters?.provider) {
        query = query.where('g_integrations.provider', filters.provider);
      }

      const rows = await query;
      const integrations = rows.map((row: any) => this.rowToIntegration(row));

      if (integrations.length > 0) {
        // Fetch last event status for each integration
        // We use a window function or subquery to get the latest event for each integration
        // Since we are using Knex, we can do this with a raw query or simple separate queries if N is small
        // For better performance with N integrations, we will fetch the latest logs in one go

        const integrationIds = integrations.map((i) => i.id);

        // This query finds the latest event ID for each integration
        // Note: ULIDs are k-sortable, so MAX(id) gives the latest event
        const latestEvents = await db('g_integration_events')
          .select('integrationId', 'state', 'stateDetails', 'createdAt')
          .whereIn('id', function () {
            this.select(db.raw('MAX(id)'))
              .from('g_integration_events')
              .whereIn('integrationId', integrationIds)
              .groupBy('integrationId');
          });

        // Map events to integrations
        const eventMap = new Map(latestEvents.map((e) => [e.integrationId, e]));

        integrations.forEach((integration) => {
          const event = eventMap.get(integration.id);
          if (event) {
            integration.lastEvent = {
              state: event.state,
              stateDetails: event.stateDetails,
              createdAt: event.createdAt,
            };
          }
        });
      }

      return integrations;
    } catch (error) {
      logger.error('Error finding all integrations:', error);
      throw error;
    }
  }

  /**
   * Find enabled integrations for a specific event
   */
  static async findEnabledByEvent(eventType: string, environment?: string): Promise<Integration[]> {
    try {
      const integrations = await this.findAll({ isEnabled: true });

      // Filter by environment
      return integrations.filter((integration) => {
        // First check events (including legacy mapping)
        let eventMatch = false;
        if (integration.events.includes('*') || integration.events.includes(eventType)) {
          eventMatch = true;
        } else if (eventType.startsWith('feature_flag_')) {
          const legacyName = eventType.replace('feature_flag_', 'feature_');
          if (integration.events.includes(legacyName)) {
            logger.debug(
              `[IntegrationModel] Matched legacy event name '${legacyName}' for event '${eventType}'`
            );
            eventMatch = true;
          }
        }

        if (!eventMatch) return false;

        // Then check environment
        if (environment && integration.environments.length > 0) {
          if (
            !integration.environments.includes(environment) &&
            !integration.environments.includes('*')
          ) {
            return false;
          }
        }

        return true;
      });
    } catch (error) {
      logger.error('Error finding enabled integrations by event:', error);
      throw error;
    }
  }

  /**
   * Update an integration
   */
  static async update(id: string, data: UpdateIntegrationData): Promise<Integration | null> {
    try {
      const existing = await this.findById(id);
      if (!existing) {
        return null;
      }

      const updateData: Record<string, any> = {};

      if (data.provider !== undefined) updateData.provider = data.provider;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
      if (data.parameters !== undefined) updateData.parameters = JSON.stringify(data.parameters);
      if (data.events !== undefined) updateData.events = JSON.stringify(data.events);
      if (data.environments !== undefined)
        updateData.environments = JSON.stringify(data.environments);
      if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;

      await db(this.TABLE).where('id', id).update(updateData);

      logger.info(`Updated integration ${id}`);
      return this.findById(id);
    } catch (error) {
      logger.error('Error updating integration:', error);
      throw error;
    }
  }

  /**
   * Delete an integration
   */
  static async delete(id: string): Promise<boolean> {
    try {
      const result = await db(this.TABLE).where('id', id).del();
      if (result > 0) {
        logger.info(`Deleted integration ${id}`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Error deleting integration:', error);
      throw error;
    }
  }

  /**
   * Toggle integration enabled status
   */
  static async toggleEnabled(id: string, updatedBy?: number): Promise<Integration | null> {
    try {
      const existing = await this.findById(id);
      if (!existing) {
        return null;
      }

      await db(this.TABLE)
        .where('id', id)
        .update({
          isEnabled: !existing.isEnabled,
          updatedBy: updatedBy || null,
        });

      logger.info(`Toggled integration ${id} to ${!existing.isEnabled ? 'enabled' : 'disabled'}`);
      return this.findById(id);
    } catch (error) {
      logger.error('Error toggling integration:', error);
      throw error;
    }
  }

  /**
   * Check if integration exists
   */
  static async exists(id: string): Promise<boolean> {
    try {
      const result = await db(this.TABLE).where('id', id).select('id').first();
      return !!result;
    } catch (error) {
      logger.error('Error checking integration exists:', error);
      throw error;
    }
  }

  /**
   * Convert database row to Integration object
   */
  private static rowToIntegration(row: any): Integration {
    return {
      id: row.id,
      provider: row.provider,
      description: row.description,
      isEnabled: Boolean(row.isEnabled),
      parameters:
        typeof row.parameters === 'string' ? JSON.parse(row.parameters) : row.parameters || {},
      events: typeof row.events === 'string' ? JSON.parse(row.events) : row.events || [],
      environments:
        typeof row.environments === 'string'
          ? JSON.parse(row.environments)
          : row.environments || [],
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdByName: row.createdByName,
      updatedByName: row.updatedByName,
    };
  }
}

export default IntegrationModel;
