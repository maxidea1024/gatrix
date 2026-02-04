import db from '../config/knex';
import { createLogger } from '../config/logger';
import { ulid } from 'ulid';

const logger = createLogger('IntegrationEvent');

// Types
export type IntegrationEventState = 'success' | 'failed' | 'successWithErrors';

export interface IntegrationEvent {
  id: string;
  integrationId: string;
  eventType: string;
  state: IntegrationEventState;
  stateDetails: string | null;
  eventData: Record<string, any> | null;
  details: Record<string, any> | null;
  createdAt: Date;
}

export interface CreateIntegrationEventData {
  integrationId: string;
  eventType: string;
  state: IntegrationEventState;
  stateDetails?: string;
  eventData?: Record<string, any>;
  details?: Record<string, any>;
}

export interface IntegrationEventWriteModel {
  integrationId: number | string;
  state: IntegrationEventState;
  stateDetails: string;
  event: Record<string, any>;
  details: Record<string, any>;
}

export class IntegrationEventModel {
  private static readonly TABLE = 'g_integration_events';

  /**
   * Create a new integration event log
   */
  static async create(data: CreateIntegrationEventData): Promise<IntegrationEvent> {
    const id = ulid();

    try {
      await db(this.TABLE).insert({
        id,
        integrationId: data.integrationId,
        eventType: data.eventType,
        state: data.state,
        stateDetails: data.stateDetails || null,
        eventData: data.eventData ? JSON.stringify(data.eventData) : null,
        details: data.details ? JSON.stringify(data.details) : null,
      });

      const event = await this.findById(id);
      if (!event) {
        throw new Error('Failed to create integration event');
      }

      logger.debug(`Created integration event ${id} for integration ${data.integrationId}`);
      return event;
    } catch (error) {
      logger.error('Error creating integration event:', error);
      throw error;
    }
  }

  /**
   * Find integration event by ID
   */
  static async findById(id: string): Promise<IntegrationEvent | null> {
    try {
      const row = await db(this.TABLE).where('id', id).first();

      if (!row) {
        return null;
      }

      return this.rowToEvent(row);
    } catch (error) {
      logger.error('Error finding integration event by ID:', error);
      throw error;
    }
  }

  /**
   * Find events by integration ID with pagination
   */
  static async findByIntegrationId(
    integrationId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ events: IntegrationEvent[]; total: number; page: number; limit: number }> {
    try {
      const offset = (page - 1) * limit;

      // Get total count
      const countResult = await db(this.TABLE)
        .where('integrationId', integrationId)
        .count('id as total')
        .first();
      const total = Number(countResult?.total || 0);

      // Get events
      const rows = await db(this.TABLE)
        .where('integrationId', integrationId)
        .orderBy('createdAt', 'desc')
        .limit(limit)
        .offset(offset);

      const events = rows.map((row: any) => this.rowToEvent(row));

      return { events, total, page, limit };
    } catch (error) {
      logger.error('Error finding integration events by integration ID:', error);
      throw error;
    }
  }

  /**
   * Find recent events for an integration
   */
  static async findRecentByIntegrationId(
    integrationId: string,
    limit: number = 10
  ): Promise<IntegrationEvent[]> {
    try {
      const rows = await db(this.TABLE)
        .where('integrationId', integrationId)
        .orderBy('createdAt', 'desc')
        .limit(limit);

      return rows.map((row: any) => this.rowToEvent(row));
    } catch (error) {
      logger.error('Error finding recent integration events:', error);
      throw error;
    }
  }

  /**
   * Get event state statistics for an integration
   */
  static async getStateStats(integrationId: string): Promise<{ state: string; count: number }[]> {
    try {
      const results = await db(this.TABLE)
        .where('integrationId', integrationId)
        .select('state')
        .count('id as count')
        .groupBy('state');

      return results.map((row: any) => ({
        state: row.state,
        count: Number(row.count),
      }));
    } catch (error) {
      logger.error('Error getting integration event state stats:', error);
      throw error;
    }
  }

  /**
   * Delete old events (cleanup)
   */
  static async deleteOldEvents(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await db(this.TABLE).where('createdAt', '<', cutoffDate).del();

      if (result > 0) {
        logger.info(`Deleted ${result} old integration events older than ${daysToKeep} days`);
      }

      return result;
    } catch (error) {
      logger.error('Error deleting old integration events:', error);
      throw error;
    }
  }

  /**
   * Delete all events for an integration
   */
  static async deleteByIntegrationId(integrationId: string): Promise<number> {
    try {
      const result = await db(this.TABLE).where('integrationId', integrationId).del();
      logger.info(`Deleted ${result} events for integration ${integrationId}`);
      return result;
    } catch (error) {
      logger.error('Error deleting integration events:', error);
      throw error;
    }
  }

  /**
   * Convert database row to IntegrationEvent object
   */
  private static rowToEvent(row: any): IntegrationEvent {
    return {
      id: row.id,
      integrationId: row.integrationId,
      eventType: row.eventType,
      state: row.state as IntegrationEventState,
      stateDetails: row.stateDetails,
      eventData: typeof row.eventData === 'string' ? JSON.parse(row.eventData) : row.eventData,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
      createdAt: row.createdAt,
    };
  }
}

export default IntegrationEventModel;
