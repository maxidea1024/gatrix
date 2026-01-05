import db from '../config/knex';
import logger from '../config/logger';

// Frame action types
export type FrameActionType = 'openUrl' | 'command' | 'deepLink' | 'none';
export type FrameActionTarget = 'webview' | 'external';

// Frame effect types
export type FrameEffectType = 'fadeIn' | 'fadeOut' | 'slideLeft' | 'slideRight' | 'slideUp' | 'slideDown' | 'zoomIn' | 'zoomOut' | 'shake' | 'none';

// Transition types
export type TransitionType = 'fade' | 'slide' | 'crossfade' | 'none';

// Loop mode types
export type LoopModeType = 'loop' | 'pingpong' | 'once';

// Frame type
export type FrameType = 'jpg' | 'png' | 'gif' | 'mp4';

// Banner status
export type BannerStatus = 'draft' | 'published' | 'archived';

export interface FrameAction {
  type: FrameActionType;
  value?: string;
  target?: FrameActionTarget;
}

export interface FrameEffects {
  enter?: FrameEffectType;
  exit?: FrameEffectType;
  duration?: number;
}

export interface FrameTransition {
  type: TransitionType;
  duration: number;
}

// Frame filter logic type
export type FrameFilterLogic = 'and' | 'or';

// Frame targeting/filtering options
export interface FrameTargeting {
  // Target platforms (e.g., 'pc', 'ios', 'android')
  platforms?: string[];
  platformsInverted?: boolean;
  // Target channel/subchannels
  channelSubchannels?: Array<{ channel: string; subchannels: string[] }>;
  channelSubchannelsInverted?: boolean;
  // Target worlds
  worlds?: string[];
  worldsInverted?: boolean;
  // User level range
  levelMin?: number;
  levelMax?: number;
  // Days since joining range
  joinDaysMin?: number;
  joinDaysMax?: number;
  // Logic for combining conditions (AND = all conditions must match, OR = any condition matches)
  filterLogic?: FrameFilterLogic;
}

export interface Frame {
  frameId: string;
  imageUrl: string;
  type: FrameType;
  delay: number;
  loop?: boolean;
  action?: FrameAction;
  effects?: FrameEffects;
  transition?: FrameTransition;
  meta?: Record<string, any>;
  // Frame targeting/filtering
  targeting?: FrameTargeting;
}

export interface SequenceTransition {
  type: TransitionType;
  duration: number;
}

export interface Sequence {
  sequenceId: string;
  name: string;
  speedMultiplier: number;
  loopMode: LoopModeType;
  transition?: SequenceTransition;
  frames: Frame[];
}

export interface BannerAttributes {
  bannerId: string;
  environment: string;
  name: string;
  description?: string;
  width: number;
  height: number;
  metadata?: Record<string, any>;
  playbackSpeed: number;
  shuffle: boolean;
  sequences: Sequence[];
  version: number;
  status: BannerStatus;
  createdBy?: number;
  updatedBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface BannerFilters {
  environment: string;
  search?: string;
  status?: BannerStatus | BannerStatus[];
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface BannerListResult {
  banners: BannerAttributes[];
  total: number;
}

export class BannerModel {
  static async findAll(filters: BannerFilters): Promise<BannerListResult> {
    try {
      const limit = filters?.limit ?? 10;
      const offset = filters?.offset ?? 0;
      const sortBy = filters?.sortBy || 'createdAt';
      const sortOrder = filters?.sortOrder || 'DESC';
      const environment = filters.environment;

      const baseQuery = () => db('g_banners as b')
        .leftJoin('g_users as creator', 'b.createdBy', 'creator.id')
        .leftJoin('g_users as updater', 'b.updatedBy', 'updater.id')
        .where('b.environment', environment);

      const applyFilters = (query: any) => {
        if (filters?.search) {
          query.where((qb: any) => {
            qb.where('b.name', 'like', `%${filters.search}%`)
              .orWhere('b.description', 'like', `%${filters.search}%`);
          });
        }

        if (filters?.status) {
          if (Array.isArray(filters.status)) {
            query.whereIn('b.status', filters.status);
          } else {
            query.where('b.status', filters.status);
          }
        }

        return query;
      };

      const countQuery = applyFilters(baseQuery())
        .count('b.bannerId as total')
        .first();

      const dataQuery = applyFilters(baseQuery())
        .select([
          'b.*',
          'creator.name as createdByName',
          'creator.email as createdByEmail',
          'updater.name as updatedByName',
          'updater.email as updatedByEmail'
        ])
        .orderBy(`b.${sortBy}`, sortOrder)
        .limit(limit)
        .offset(offset);

      const [countResult, banners] = await Promise.all([countQuery, dataQuery]);

      const total = countResult?.total || 0;

      // Parse JSON fields and convert shuffle to boolean
      const parsedBanners = banners.map((b: any) => ({
        ...b,
        shuffle: Boolean(b.shuffle),
        sequences: typeof b.sequences === 'string' ? JSON.parse(b.sequences) : b.sequences,
        metadata: b.metadata ? (typeof b.metadata === 'string' ? JSON.parse(b.metadata) : b.metadata) : null,
      }));

      return { banners: parsedBanners, total };
    } catch (error) {
      logger.error('Error finding banners:', error);
      throw error;
    }
  }

  static async findById(bannerId: string, environment: string): Promise<BannerAttributes | null> {
    try {
      const banner = await db('g_banners as b')
        .leftJoin('g_users as creator', 'b.createdBy', 'creator.id')
        .leftJoin('g_users as updater', 'b.updatedBy', 'updater.id')
        .select([
          'b.*',
          'creator.name as createdByName',
          'creator.email as createdByEmail',
          'updater.name as updatedByName',
          'updater.email as updatedByEmail'
        ])
        .where('b.bannerId', bannerId)
        .where('b.environment', environment)
        .first();

      if (!banner) {
        return null;
      }

      return {
        ...banner,
        shuffle: Boolean(banner.shuffle),
        sequences: typeof banner.sequences === 'string' ? JSON.parse(banner.sequences) : banner.sequences,
        metadata: banner.metadata ? (typeof banner.metadata === 'string' ? JSON.parse(banner.metadata) : banner.metadata) : null,
      };
    } catch (error) {
      logger.error('Error finding banner by ID:', error);
      throw error;
    }
  }

  /**
   * Find banner by name (for duplicate check)
   * @param name Banner name to search
   * @param excludeBannerId Optional bannerId to exclude (for update check)
   */
  static async findByName(name: string, environment: string, excludeBannerId?: string): Promise<BannerAttributes | null> {
    try {
      let query = db('g_banners').where('name', name).where('environment', environment);
      if (excludeBannerId) {
        query = query.whereNot('bannerId', excludeBannerId);
      }
      const banner = await query.first();
      if (!banner) {
        return null;
      }
      return {
        ...banner,
        shuffle: Boolean(banner.shuffle),
        sequences: typeof banner.sequences === 'string' ? JSON.parse(banner.sequences) : banner.sequences,
        metadata: banner.metadata ? (typeof banner.metadata === 'string' ? JSON.parse(banner.metadata) : banner.metadata) : null,
      };
    } catch (error) {
      logger.error('Error finding banner by name:', error);
      throw error;
    }
  }

  static async create(data: Omit<BannerAttributes, 'createdAt' | 'updatedAt'>): Promise<BannerAttributes> {
    try {
      const environment = data.environment;
      await db('g_banners').insert({
        bannerId: data.bannerId,
        environment: environment,
        name: data.name,
        description: data.description || null,
        width: data.width,
        height: data.height,
        metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        playbackSpeed: data.playbackSpeed,
        shuffle: data.shuffle ? 1 : 0,
        sequences: JSON.stringify(data.sequences),
        version: data.version || 1,
        status: data.status || 'draft',
        createdBy: data.createdBy || null,
        updatedBy: data.updatedBy || null,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      const banner = await this.findById(data.bannerId, environment);
      if (!banner) {
        throw new Error('Failed to create banner');
      }
      return banner;
    } catch (error) {
      logger.error('Error creating banner:', error);
      throw error;
    }
  }

  static async update(bannerId: string, data: Partial<BannerAttributes>, environment: string): Promise<BannerAttributes> {
    try {
      const updateData: any = {
        updatedAt: new Date()
      };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.width !== undefined) updateData.width = data.width;
      if (data.height !== undefined) updateData.height = data.height;
      if (data.metadata !== undefined) updateData.metadata = JSON.stringify(data.metadata);
      if (data.playbackSpeed !== undefined) updateData.playbackSpeed = data.playbackSpeed;
      if (data.shuffle !== undefined) updateData.shuffle = data.shuffle ? 1 : 0;
      if (data.sequences !== undefined) updateData.sequences = JSON.stringify(data.sequences);
      if (data.status !== undefined) updateData.status = data.status;
      if (data.updatedBy !== undefined) updateData.updatedBy = data.updatedBy;

      // Increment version on update
      await db('g_banners')
        .where('bannerId', bannerId)
        .where('environment', environment)
        .update({
          ...updateData,
          version: db.raw('version + 1')
        });

      const banner = await this.findById(bannerId, environment);
      if (!banner) {
        throw new Error('Banner not found after update');
      }
      return banner;
    } catch (error) {
      logger.error('Error updating banner:', error);
      throw error;
    }
  }

  static async delete(bannerId: string, environment: string): Promise<void> {
    try {
      await db('g_banners').where('bannerId', bannerId).where('environment', environment).del();
    } catch (error) {
      logger.error('Error deleting banner:', error);
      throw error;
    }
  }

  static async updateStatus(bannerId: string, status: BannerStatus, environment: string, updatedBy?: number): Promise<BannerAttributes> {
    try {
      await db('g_banners')
        .where('bannerId', bannerId)
        .where('environment', environment)
        .update({
          status,
          updatedBy: updatedBy || null,
          updatedAt: new Date(),
          version: db.raw('version + 1')
        });

      const banner = await this.findById(bannerId, environment);
      if (!banner) {
        throw new Error('Banner not found after status update');
      }
      return banner;
    } catch (error) {
      logger.error('Error updating banner status:', error);
      throw error;
    }
  }

  static async duplicate(bannerId: string, newBannerId: string, environment: string, createdBy?: number): Promise<BannerAttributes> {
    try {
      const original = await this.findById(bannerId, environment);
      if (!original) {
        throw new Error('Original banner not found');
      }

      return await this.create({
        bannerId: newBannerId,
        environment,
        name: `${original.name} (Copy)`,
        description: original.description,
        width: original.width,
        height: original.height,
        metadata: original.metadata,
        playbackSpeed: original.playbackSpeed,
        shuffle: original.shuffle,
        sequences: original.sequences,
        version: 1,
        status: 'draft',
        createdBy,
        updatedBy: createdBy
      });
    } catch (error) {
      logger.error('Error duplicating banner:', error);
      throw error;
    }
  }

  // Get only published banners for client API
  static async findPublished(environment: string): Promise<BannerAttributes[]> {
    try {
      const banners = await db('g_banners')
        .select('*')
        .where('status', 'published')
        .where('environment', environment)
        .orderBy('createdAt', 'DESC');

      return banners.map((b: any) => ({
        ...b,
        sequences: typeof b.sequences === 'string' ? JSON.parse(b.sequences) : b.sequences,
        metadata: b.metadata ? (typeof b.metadata === 'string' ? JSON.parse(b.metadata) : b.metadata) : null,
      }));
    } catch (error) {
      logger.error('Error finding published banners:', error);
      throw error;
    }
  }
}

