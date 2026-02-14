import db from '../config/knex';
import { createLogger } from '../config/logger';

const logger = createLogger('ActionSetModel');

// Types
export interface ActionSet {
  id: number;
  name: string;
  description: string | null;
  isEnabled: boolean;
  actorId: number | null;
  actorName?: string;
  source: string;
  sourceId: number | null;
  sourceName?: string;
  filters: Record<string, any> | null;
  actions: Action[];
  createdBy: number;
  createdByName?: string;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Action {
  id: number;
  actionSetId: number;
  sortOrder: number;
  actionType: string;
  executionParams: Record<string, any> | null;
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActionSetEvent {
  id: number;
  actionSetId: number;
  signalId: number;
  state: 'started' | 'success' | 'failed';
  eventSignal: Record<string, any>;
  eventActionSet: Record<string, any>;
  createdAt: Date;
}

export interface CreateActionSetData {
  name: string;
  description?: string;
  isEnabled?: boolean;
  actorId?: number;
  source?: string;
  sourceId?: number;
  filters?: Record<string, any>;
  actions: CreateActionData[];
  createdBy: number;
}

export interface CreateActionData {
  sortOrder: number;
  actionType: string;
  executionParams?: Record<string, any>;
}

export interface UpdateActionSetData {
  name?: string;
  description?: string;
  isEnabled?: boolean;
  actorId?: number;
  source?: string;
  sourceId?: number;
  filters?: Record<string, any>;
  actions?: CreateActionData[];
  updatedBy: number;
}

export class ActionSetModel {
  private static readonly TABLE = 'g_action_sets';
  private static readonly ACTIONS_TABLE = 'g_actions';
  private static readonly EVENTS_TABLE = 'g_action_set_events';

  // ─── Action Sets CRUD ─────────────────────────

  static async create(data: CreateActionSetData): Promise<ActionSet> {
    try {
      return await db
        .transaction(async (trx) => {
          const [insertId] = await trx(this.TABLE).insert({
            name: data.name,
            description: data.description || null,
            isEnabled: data.isEnabled !== undefined ? data.isEnabled : true,
            actorId: data.actorId || null,
            source: data.source || 'signal-endpoint',
            sourceId: data.sourceId || null,
            filters: data.filters ? JSON.stringify(data.filters) : null,
            createdBy: data.createdBy,
          });

          // Insert actions
          if (data.actions && data.actions.length > 0) {
            const actionsToInsert = data.actions.map((action) => ({
              actionSetId: insertId,
              sortOrder: action.sortOrder,
              actionType: action.actionType,
              executionParams: action.executionParams
                ? JSON.stringify(action.executionParams)
                : null,
              createdBy: data.createdBy,
            }));

            await trx(this.ACTIONS_TABLE).insert(actionsToInsert);
          }

          return insertId;
        })
        .then((insertId) => this.findById(insertId) as Promise<ActionSet>);
    } catch (error) {
      logger.error('Error creating action set:', error);
      throw error;
    }
  }

  static async findById(id: number): Promise<ActionSet | null> {
    try {
      const row = await db(this.TABLE)
        .select([
          `${this.TABLE}.*`,
          'creator.name as createdByName',
          'actor.name as actorName',
          'sep.name as sourceName',
        ])
        .leftJoin('g_users as creator', `${this.TABLE}.createdBy`, 'creator.id')
        .leftJoin('g_users as actor', `${this.TABLE}.actorId`, 'actor.id')
        .leftJoin('g_signal_endpoints as sep', `${this.TABLE}.sourceId`, 'sep.id')
        .where(`${this.TABLE}.id`, id)
        .first();

      if (!row) return null;

      const actions = await this.findActions(id);

      // Parse JSON fields if they are strings
      const filters = typeof row.filters === 'string' ? JSON.parse(row.filters) : row.filters;

      return { ...row, filters, actions };
    } catch (error) {
      logger.error('Error finding action set by ID:', error);
      throw error;
    }
  }

  static async findAll(): Promise<ActionSet[]> {
    try {
      const rows = await db(this.TABLE)
        .select([
          `${this.TABLE}.*`,
          'creator.name as createdByName',
          'actor.name as actorName',
          'sep.name as sourceName',
        ])
        .leftJoin('g_users as creator', `${this.TABLE}.createdBy`, 'creator.id')
        .leftJoin('g_users as actor', `${this.TABLE}.actorId`, 'actor.id')
        .leftJoin('g_signal_endpoints as sep', `${this.TABLE}.sourceId`, 'sep.id')
        .orderBy(`${this.TABLE}.createdAt`, 'desc');

      // Batch load actions
      const setIds = rows.map((r: any) => r.id);
      const allActions =
        setIds.length > 0
          ? await db(this.ACTIONS_TABLE).whereIn('actionSetId', setIds).orderBy('sortOrder', 'asc')
          : [];

      const actionsBySet = allActions.reduce((acc: any, a: any) => {
        if (!acc[a.actionSetId]) acc[a.actionSetId] = [];
        // Parse JSON fields
        acc[a.actionSetId].push({
          ...a,
          executionParams:
            typeof a.executionParams === 'string'
              ? JSON.parse(a.executionParams)
              : a.executionParams,
        });
        return acc;
      }, {});

      return rows.map((row: any) => ({
        ...row,
        filters: typeof row.filters === 'string' ? JSON.parse(row.filters) : row.filters,
        actions: actionsBySet[row.id] || [],
      }));
    } catch (error) {
      logger.error('Error finding all action sets:', error);
      throw error;
    }
  }

  static async update(id: number, data: UpdateActionSetData): Promise<ActionSet | null> {
    try {
      await db.transaction(async (trx) => {
        const updateData: any = { updatedBy: data.updatedBy, updatedAt: db.fn.now() };
        if (data.name !== undefined) updateData.name = data.name;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;
        if (data.actorId !== undefined) updateData.actorId = data.actorId;
        if (data.source !== undefined) updateData.source = data.source;
        if (data.sourceId !== undefined) updateData.sourceId = data.sourceId;
        if (data.filters !== undefined) {
          updateData.filters = data.filters ? JSON.stringify(data.filters) : null;
        }

        await trx(this.TABLE).where('id', id).update(updateData);

        // Replace actions if provided
        if (data.actions !== undefined) {
          await trx(this.ACTIONS_TABLE).where('actionSetId', id).del();

          if (data.actions.length > 0) {
            const actionsToInsert = data.actions.map((action) => ({
              actionSetId: id,
              sortOrder: action.sortOrder,
              actionType: action.actionType,
              executionParams: action.executionParams
                ? JSON.stringify(action.executionParams)
                : null,
              createdBy: data.updatedBy,
            }));

            await trx(this.ACTIONS_TABLE).insert(actionsToInsert);
          }
        }
      });

      return this.findById(id);
    } catch (error) {
      logger.error('Error updating action set:', error);
      throw error;
    }
  }

  static async delete(id: number): Promise<boolean> {
    try {
      const result = await db(this.TABLE).where('id', id).del();
      return result > 0;
    } catch (error) {
      logger.error('Error deleting action set:', error);
      throw error;
    }
  }

  static async toggleEnabled(id: number, updatedBy: number): Promise<ActionSet | null> {
    try {
      const set = await db(this.TABLE).select('isEnabled').where('id', id).first();
      if (!set) return null;

      await db(this.TABLE).where('id', id).update({
        isEnabled: !set.isEnabled,
        updatedBy,
        updatedAt: db.fn.now(),
      });

      return this.findById(id);
    } catch (error) {
      logger.error('Error toggling action set:', error);
      throw error;
    }
  }

  // ─── Actions ─────────────────────────

  static async findActions(actionSetId: number): Promise<Action[]> {
    try {
      const actions = await db(this.ACTIONS_TABLE)
        .where('actionSetId', actionSetId)
        .orderBy('sortOrder', 'asc');

      return actions.map((a: any) => ({
        ...a,
        executionParams:
          typeof a.executionParams === 'string' ? JSON.parse(a.executionParams) : a.executionParams,
      }));
    } catch (error) {
      logger.error('Error finding actions:', error);
      throw error;
    }
  }

  // ─── Matching ─────────────────────────

  /**
   * Find enabled action sets that match a given signal
   */
  static async findMatchingActionSets(source: string, sourceId: number): Promise<ActionSet[]> {
    try {
      const rows = await db(this.TABLE)
        .where('isEnabled', true)
        .where('source', source)
        .where(function () {
          this.where('sourceId', sourceId).orWhereNull('sourceId');
        })
        .whereNotNull('actorId');

      const results: ActionSet[] = [];
      for (const row of rows) {
        const actionSet = await this.findById(row.id);
        if (actionSet) results.push(actionSet);
      }

      return results;
    } catch (error) {
      logger.error('Error finding matching action sets:', error);
      throw error;
    }
  }

  // ─── Events (execution log) ─────────────────────────

  static async createEvent(
    actionSetId: number,
    signalId: number,
    state: 'started' | 'success' | 'failed',
    eventSignal: Record<string, any>,
    eventActionSet: Record<string, any>
  ): Promise<ActionSetEvent> {
    try {
      const [insertId] = await db(this.EVENTS_TABLE).insert({
        actionSetId,
        signalId,
        state,
        eventSignal: JSON.stringify(eventSignal),
        eventActionSet: JSON.stringify(eventActionSet),
      });

      return db(this.EVENTS_TABLE).where('id', insertId).first();
    } catch (error) {
      logger.error('Error creating action set event:', error);
      throw error;
    }
  }

  static async updateEventState(
    eventId: number,
    state: 'started' | 'success' | 'failed',
    eventActionSet?: Record<string, any>
  ): Promise<void> {
    try {
      const updateData: any = { state };
      if (eventActionSet) {
        updateData.eventActionSet = JSON.stringify(eventActionSet);
      }

      await db(this.EVENTS_TABLE).where('id', eventId).update(updateData);
    } catch (error) {
      logger.error('Error updating action set event state:', error);
      throw error;
    }
  }

  static async findEvents(
    actionSetId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ events: ActionSetEvent[]; total: number }> {
    try {
      const [countResult, events] = await Promise.all([
        db(this.EVENTS_TABLE).where('actionSetId', actionSetId).count('id as total').first(),
        db(this.EVENTS_TABLE)
          .where('actionSetId', actionSetId)
          .orderBy('createdAt', 'desc')
          .limit(limit)
          .offset(offset),
      ]);

      // Parse JSON fields
      const parsedEvents = events.map((e: any) => ({
        ...e,
        eventSignal: typeof e.eventSignal === 'string' ? JSON.parse(e.eventSignal) : e.eventSignal,
        eventActionSet:
          typeof e.eventActionSet === 'string' ? JSON.parse(e.eventActionSet) : e.eventActionSet,
      }));

      return {
        events: parsedEvents,
        total: countResult?.total ? Number(countResult.total) : 0,
      };
    } catch (error) {
      logger.error('Error finding action set events:', error);
      throw error;
    }
  }
}

export default ActionSetModel;
