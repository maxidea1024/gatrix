import api from './api';
import {
  MutationResult,
  parseChangeRequestResponse,
} from './changeRequestUtils';

// Frame action types
export type FrameActionType = 'openUrl' | 'command' | 'deepLink' | 'none';
export type FrameActionTarget = 'webview' | 'external';

// Frame effect types
export type FrameEffectType =
  | 'fadeIn'
  | 'fadeOut'
  | 'slideLeft'
  | 'slideRight'
  | 'slideUp'
  | 'slideDown'
  | 'zoomIn'
  | 'zoomOut'
  | 'shake'
  | 'none';

// Transition types
export type TransitionType = 'fade' | 'slide' | 'crossfade' | 'none';

// Loop mode types
export type LoopModeType = 'loop' | 'pingpong' | 'once';

// Frame type
export type FrameType = 'jpg' | 'png' | 'gif' | 'mp4' | 'webp' | 'svg';

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
  clickUrl?: string;
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

export interface Banner {
  bannerId: string;
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
  createdByName?: string;
  createdByEmail?: string;
  updatedBy?: number;
  updatedByName?: string;
  updatedByEmail?: string;
  createdAt: string;
  updatedAt: string;
  tags?: any[];
}

export interface CreateBannerInput {
  name: string;
  description?: string;
  width: number;
  height: number;
  metadata?: Record<string, any>;
  playbackSpeed?: number;
  shuffle?: boolean;
  sequences?: Sequence[];
  tags?: any[];
}

export interface UpdateBannerInput {
  name?: string;
  description?: string;
  width?: number;
  height?: number;
  metadata?: Record<string, any>;
  playbackSpeed?: number;
  shuffle?: boolean;
  sequences?: Sequence[];
  tags?: any[];
}

export interface GetBannersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: BannerStatus | BannerStatus[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface GetBannersResponse {
  banners: Banner[];
  total: number;
  page: number;
  limit: number;
}

export type BannerMutationResult = MutationResult<Banner>;

class BannerService {
  /**
   * Get all banners with pagination
   */
  async getBanners(
    projectApiPath: string,
    params?: GetBannersParams
  ): Promise<GetBannersResponse> {
    const response = await api.get(`${projectApiPath}/banners`, { params });
    return response.data;
  }

  /**
   * Get banner by ID
   */
  async getBannerById(
    projectApiPath: string,
    bannerId: string
  ): Promise<Banner> {
    const response = await api.get(`${projectApiPath}/banners/${bannerId}`);
    return response.data.banner;
  }

  /**
   * Create a new banner
   */
  async createBanner(
    projectApiPath: string,
    input: CreateBannerInput,
    skipCr?: boolean
  ): Promise<BannerMutationResult> {
    const response = await api.post(
      `${projectApiPath}/banners${skipCr ? '?skipCr=true' : ''}`,
      input
    );
    return parseChangeRequestResponse<Banner>(response, (r) => r?.banner);
  }

  /**
   * Update a banner
   */
  async updateBanner(
    projectApiPath: string,
    bannerId: string,
    input: UpdateBannerInput,
    skipCr?: boolean
  ): Promise<BannerMutationResult> {
    const response = await api.put(
      `${projectApiPath}/banners/${bannerId}${skipCr ? '?skipCr=true' : ''}`,
      input
    );
    return parseChangeRequestResponse<Banner>(response, (r) => r?.banner);
  }

  /**
   * Delete a banner
   */
  async deleteBanner(
    projectApiPath: string,
    bannerId: string,
    skipCr?: boolean
  ): Promise<MutationResult<void>> {
    const response = await api.delete(
      `${projectApiPath}/banners/${bannerId}${skipCr ? '?skipCr=true' : ''}`
    );
    return parseChangeRequestResponse<void>(response, () => undefined);
  }

  /**
   * Publish a banner
   */
  async publishBanner(
    projectApiPath: string,
    bannerId: string,
    skipCr?: boolean
  ): Promise<BannerMutationResult> {
    const response = await api.post(
      `${projectApiPath}/banners/${bannerId}/publish${skipCr ? '?skipCr=true' : ''}`
    );
    return parseChangeRequestResponse<Banner>(response, (r) => r?.banner);
  }

  /**
   * Archive a banner
   */
  async archiveBanner(
    projectApiPath: string,
    bannerId: string,
    skipCr?: boolean
  ): Promise<BannerMutationResult> {
    const response = await api.post(
      `${projectApiPath}/banners/${bannerId}/archive${skipCr ? '?skipCr=true' : ''}`
    );
    return parseChangeRequestResponse<Banner>(response, (r) => r?.banner);
  }

  /**
   * Duplicate a banner
   */
  async duplicateBanner(
    projectApiPath: string,
    bannerId: string
  ): Promise<Banner> {
    const response = await api.post(
      `${projectApiPath}/banners/${bannerId}/duplicate`
    );
    return response.data.banner;
  }
}

export default new BannerService();
