import db from '../config/knex';
import { createLogger } from '../config/logger';

const logger = createLogger('SignalEndpointModel');

// Types
export interface SignalEndpoint {
  id: number;
  name: string;
  description: string | null;
  isEnabled: boolean;
  createdBy: number;
  createdByName?: string;
  updatedBy: number | null;
  createdAt: Date;
  updatedAt: Date;
  tokens: SignalEndpointToken[];
}

export interface SignalEndpointToken {
  id: number;
  signalEndpointId: number;
  name: string;
  createdBy: number;
  createdAt: Date;
}

export interface Signal {
  id: number;
  source: string;
  sourceId: number;
  payload: Record<string, unknown> | null;
  isProcessed: boolean;
  createdByTokenId: number | null;
  createdAt: Date;
}

export interface CreateSignalEndpointData {
  name: string;
  description?: string;
  createdBy: number;
}

export interface UpdateSignalEndpointData {
  name?: string;
  description?: string;
  isEnabled?: boolean;
  updatedBy: number;
}

export class SignalEndpointModel {
  private static readonly TABLE = 'g_signal_endpoints';
  private static readonly TOKENS_TABLE = 'g_signal_endpoint_tokens';
  private static readonly SIGNALS_TABLE = 'g_signals';

  // ─── Signal Endpoints CRUD ─────────────────────────

  static async create(data: CreateSignalEndpointData): Promise<SignalEndpoint> {
    try {
      const [insertId] = await db(this.TABLE).insert({
        name: data.name,
        description: data.description || null,
        createdBy: data.createdBy,
      });

      const endpoint = await this.findById(insertId);
      if (!endpoint) {
        throw new Error('Failed to create signal endpoint');
      }

      return endpoint;
    } catch (error) {
      logger.error('Error creating signal endpoint:', error);
      throw error;
    }
  }

  static async findById(id: number): Promise<SignalEndpoint | null> {
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

  static async findAll(): Promise<SignalEndpoint[]> {
    try {
      const rows = await db(this.TABLE)
        .select([`${this.TABLE}.*`, 'creator.name as createdByName'])
        .leftJoin('g_users as creator', `${this.TABLE}.createdBy`, 'creator.id')
        .orderBy(`${this.TABLE}.createdAt`, 'desc');

      // Batch load tokens
      const endpointIds = rows.map((r: any) => r.id);
      const allTokens =
        endpointIds.length > 0
          ? await db(this.TOKENS_TABLE)
              .select('id', 'signalEndpointId', 'name', 'createdBy', 'createdAt')
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

  static async update(id: number, data: UpdateSignalEndpointData): Promise<SignalEndpoint | null> {
    try {
      const updateData: any = { updatedBy: data.updatedBy, updatedAt: db.fn.now() };
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.isEnabled !== undefined) updateData.isEnabled = data.isEnabled;

      await db(this.TABLE).where('id', id).update(updateData);
      return this.findById(id);
    } catch (error) {
      logger.error('Error updating signal endpoint:', error);
      throw error;
    }
  }

  static async delete(id: number): Promise<boolean> {
    try {
      const result = await db(this.TABLE).where('id', id).del();
      return result > 0;
    } catch (error) {
      logger.error('Error deleting signal endpoint:', error);
      throw error;
    }
  }

  static async toggleEnabled(id: number, updatedBy: number): Promise<SignalEndpoint | null> {
    try {
      const endpoint = await db(this.TABLE).select('isEnabled').where('id', id).first();
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

  static async findTokens(endpointId: number): Promise<SignalEndpointToken[]> {
    try {
      return db(this.TOKENS_TABLE)
        .select('id', 'signalEndpointId', 'name', 'createdBy', 'createdAt')
        .where('signalEndpointId', endpointId)
        .orderBy('createdAt', 'desc');
    } catch (error) {
      logger.error('Error finding endpoint tokens:', error);
      throw error;
    }
  }

  static async createToken(
    endpointId: number,
    name: string,
    tokenHash: string,
    createdBy: number
  ): Promise<SignalEndpointToken> {
    try {
      const [insertId] = await db(this.TOKENS_TABLE).insert({
        signalEndpointId: endpointId,
        name,
        tokenHash,
        createdBy,
      });

      return db(this.TOKENS_TABLE)
        .select('id', 'signalEndpointId', 'name', 'createdBy', 'createdAt')
        .where('id', insertId)
        .first();
    } catch (error) {
      logger.error('Error creating endpoint token:', error);
      throw error;
    }
  }

  static async deleteToken(tokenId: number): Promise<boolean> {
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
  ): Promise<{ endpointId: number; tokenId: number } | null> {
    try {
      const token = await db(this.TOKENS_TABLE).where('tokenHash', tokenHash).first();

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
    sourceId: number,
    payload: Record<string, unknown> | null,
    createdByTokenId: number | null
  ): Promise<Signal> {
    try {
      const [insertId] = await db(this.SIGNALS_TABLE).insert({
        source,
        sourceId,
        payload: payload ? JSON.stringify(payload) : null,
        createdByTokenId,
      });

      return db(this.SIGNALS_TABLE).where('id', insertId).first();
    } catch (error) {
      logger.error('Error creating signal:', error);
      throw error;
    }
  }

  static async findSignals(
    endpointId: number,
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

  static async markSignalProcessed(signalId: number): Promise<void> {
    try {
      await db(this.SIGNALS_TABLE).where('id', signalId).update({ isProcessed: true });
    } catch (error) {
      logger.error('Error marking signal as processed:', error);
      throw error;
    }
  }
}

export default SignalEndpointModel;
