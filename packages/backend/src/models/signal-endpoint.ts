import db from '../config/knex';
import { generateULID } from '../utils/ulid';
import { createLogger } from '../config/logger';

const logger = createLogger('SignalEndpointModel');

// Types
export interface SignalEndpoint {
  id: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  createdBy: string;
  createdByName?: string;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  tokens: SignalEndpointToken[];
}

export interface SignalEndpointToken {
  id: string;
  signalEndpointId: string;
  name: string;
  createdBy: string;
  createdAt: Date;
}

export interface Signal {
  id: string;
  source: string;
  sourceId: string;
  payload: Record<string, unknown> | null;
  isProcessed: boolean;
  createdByTokenId: string | null;
  createdAt: Date;
}

export interface CreateSignalEndpointData {
  name: string;
  description?: string;
  projectId: string;
  createdBy: string;
}

export interface UpdateSignalEndpointData {
  name?: string;
  description?: string;
  isEnabled?: boolean;
  updatedBy: string;
}

export class SignalEndpointModel {
  private static readonly TABLE = 'g_signal_endpoints';
  private static readonly TOKENS_TABLE = 'g_signal_endpoint_tokens';
  private static readonly SIGNALS_TABLE = 'g_signals';

  // ─── Signal Endpoints CRUD ─────────────────────────

  static async create(data: CreateSignalEndpointData): Promise<SignalEndpoint> {
    try {
      const id = generateULID();
      await db(this.TABLE).insert({
        id,
        name: data.name,
        description: data.description || null,
        projectId: data.projectId,
        createdBy: data.createdBy,
      });

      const endpoint = await this.findById(id);
      if (!endpoint) {
        throw new Error('Failed to create signal endpoint');
      }

      return endpoint;
    } catch (error) {
      logger.error('Error creating signal endpoint:', error);
      throw error;
    }
  }

  static async findById(id: string): Promise<SignalEndpoint | null> {
    try {
      const row = await db(this.TABLE)
        .select([`${this.TABLE}.*`, 'creator.name as createdByName'])
        .leftJoin('g_users as creator', `${this.TABLE}.createdBy`, 'creator.id')
        .where(`${this.TABLE}.id`, id)
        .first();

      if (!row) return null;

      const tokens = await this.findTokens(id);
      return { ...row, tokens };
    } catch (error) {
      logger.error('Error finding signal endpoint by ID:', error);
      throw error;
    }
  }

  static async findByName(name: string): Promise<SignalEndpoint | null> {
    try {
      const row = await db(this.TABLE).where('name', name).first();
      if (!row) return null;

      const tokens = await this.findTokens(row.id);
      return { ...row, tokens };
    } catch (error) {
      logger.error('Error finding signal endpoint by name:', error);
      throw error;
    }
  }

  static async findAll(projectId?: string): Promise<SignalEndpoint[]> {
    try {
      let query = db(this.TABLE)
        .select([`${this.TABLE}.*`, 'creator.name as createdByName'])
        .leftJoin('g_users as creator', `${this.TABLE}.createdBy`, 'creator.id')
        .orderBy(`${this.TABLE}.createdAt`, 'desc');

      if (projectId) {
        query = query.where(`${this.TABLE}.projectId`, projectId);
      }

      const rows = await query;

      // Batch load tokens
      const endpointIds = rows.map((r: any) => r.id);
      const allTokens =
        endpointIds.length > 0
          ? await db(this.TOKENS_TABLE)
              .select(
                'id',
                'signalEndpointId',
                'tokenName',
                'createdBy',
                'createdAt'
              )
              .whereIn('signalEndpointId', endpointIds)
              .orderBy('createdAt', 'desc')
          : [];

      const tokensByEndpoint = allTokens.reduce((acc: any, t: any) => {
        if (!acc[t.signalEndpointId]) acc[t.signalEndpointId] = [];
        acc[t.signalEndpointId].push(t);
        return acc;
      }, {});

      return rows.map((row: any) => ({
        ...row,
        tokens: tokensByEndpoint[row.id] || [],
      }));
    } catch (error) {
      logger.error('Error finding all signal endpoints:', error);
      throw error;
    }
  }

  static async update(
    id: string,
    data: UpdateSignalEndpointData
  ): Promise<SignalEndpoint | null> {
    try {
      const updateData: any = {
        updatedBy: data.updatedBy,
        updatedAt: db.fn.now(),
      };
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;

      await db(this.TABLE).where('id', id).update(updateData);
      return this.findById(id);
    } catch (error) {
      logger.error('Error updating signal endpoint:', error);
      throw error;
    }
  }

  static async delete(id: string): Promise<boolean> {
    try {
      const result = await db(this.TABLE).where('id', id).del();
      return result > 0;
    } catch (error) {
      logger.error('Error deleting signal endpoint:', error);
      throw error;
    }
  }

  static async toggleEnabled(
    id: string,
    updatedBy: string
  ): Promise<SignalEndpoint | null> {
    try {
      const endpoint = await db(this.TABLE)
        .select('isEnabled')
        .where('id', id)
        .first();
      if (!endpoint) return null;

      await db(this.TABLE).where('id', id).update({
        isEnabled: !endpoint.isEnabled,
        updatedBy,
        updatedAt: db.fn.now(),
      });

      return this.findById(id);
    } catch (error) {
      logger.error('Error toggling signal endpoint:', error);
      throw error;
    }
  }

  // ─── Endpoint Tokens ─────────────────────────

  static async findTokens(endpointId: string): Promise<SignalEndpointToken[]> {
    try {
      return db(this.TOKENS_TABLE)
        .select('id', 'signalEndpointId', 'tokenName', 'createdBy', 'createdAt')
        .where('signalEndpointId', endpointId)
        .orderBy('createdAt', 'desc');
    } catch (error) {
      logger.error('Error finding endpoint tokens:', error);
      throw error;
    }
  }

  static async createToken(
    endpointId: string,
    name: string,
    tokenHash: string,
    createdBy: string
  ): Promise<SignalEndpointToken> {
    try {
      const id = generateULID();
      await db(this.TOKENS_TABLE).insert({
        id,
        signalEndpointId: endpointId,
        tokenName: name,
        tokenHash,
        createdBy,
      });

      return db(this.TOKENS_TABLE)
        .select('id', 'signalEndpointId', 'tokenName', 'createdBy', 'createdAt')
        .where('id', id)
        .first();
    } catch (error) {
      logger.error('Error creating endpoint token:', error);
      throw error;
    }
  }

  static async deleteToken(tokenId: string): Promise<boolean> {
    try {
      const result = await db(this.TOKENS_TABLE).where('id', tokenId).del();
      return result > 0;
    } catch (error) {
      logger.error('Error deleting endpoint token:', error);
      throw error;
    }
  }

  static async verifyEndpointToken(
    tokenHash: string
  ): Promise<{ endpointId: string; tokenId: string } | null> {
    try {
      const token = await db(this.TOKENS_TABLE)
        .where('tokenHash', tokenHash)
        .first();

      if (!token) return null;

      // Check if endpoint is enabled
      const endpoint = await db(this.TABLE)
        .select('isEnabled')
        .where('id', token.signalEndpointId)
        .first();

      if (!endpoint || !endpoint.isEnabled) return null;

      return { endpointId: token.signalEndpointId, tokenId: token.id };
    } catch (error) {
      logger.error('Error verifying endpoint token:', error);
      throw error;
    }
  }

  // ─── Signals ─────────────────────────

  static async createSignal(
    source: string,
    sourceId: string,
    payload: Record<string, unknown> | null,
    createdByTokenId: string | null
  ): Promise<Signal> {
    try {
      const id = generateULID();
      await db(this.SIGNALS_TABLE).insert({
        id,
        source,
        sourceId,
        payload: payload ? JSON.stringify(payload) : null,
        createdByTokenId,
      });

      return db(this.SIGNALS_TABLE).where('id', id).first();
    } catch (error) {
      logger.error('Error creating signal:', error);
      throw error;
    }
  }

  static async findSignals(
    endpointId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ signals: Signal[]; total: number }> {
    try {
      const [countResult, signals] = await Promise.all([
        db(this.SIGNALS_TABLE)
          .where('source', 'signal-endpoint')
          .where('sourceId', endpointId)
          .count('id as total')
          .first(),
        db(this.SIGNALS_TABLE)
          .where('source', 'signal-endpoint')
          .where('sourceId', endpointId)
          .orderBy('createdAt', 'desc')
          .limit(limit)
          .offset(offset),
      ]);

      return {
        signals,
        total: countResult?.total ? Number(countResult.total) : 0,
      };
    } catch (error) {
      logger.error('Error finding signals:', error);
      throw error;
    }
  }

  static async findUnprocessedSignals(limit: number = 10): Promise<Signal[]> {
    try {
      return db(this.SIGNALS_TABLE)
        .where('isProcessed', false)
        .orderBy('createdAt', 'asc')
        .limit(limit);
    } catch (error) {
      logger.error('Error finding unprocessed signals:', error);
      throw error;
    }
  }

  static async markSignalProcessed(signalId: string): Promise<void> {
    try {
      await db(this.SIGNALS_TABLE)
        .where('id', signalId)
        .update({ isProcessed: true });
    } catch (error) {
      logger.error('Error marking signal as processed:', error);
      throw error;
    }
  }
}

export default SignalEndpointModel;
