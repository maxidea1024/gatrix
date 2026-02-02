import api from "./api";
import {
  MutationResult,
  parseChangeRequestResponse,
} from "./changeRequestUtils";

// Frame action types
export type FrameActionType = "openUrl" | "command" | "deepLink" | "none";
export type FrameActionTarget = "webview" | "external";

// Frame effect types
export type FrameEffectType =
  | "fadeIn"
  | "fadeOut"
  | "slideLeft"
  | "slideRight"
  | "slideUp"
  | "slideDown"
  | "zoomIn"
  | "zoomOut"
  | "shake"
  | "none";

// Transition types
export type TransitionType = "fade" | "slide" | "crossfade" | "none";

// Loop mode types
export type LoopModeType = "loop" | "pingpong" | "once";

// Frame type
export type FrameType = "jpg" | "png" | "gif" | "mp4";

// Banner status
export type BannerStatus = "draft" | "published" | "archived";

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
export type FrameFilterLogic = "and" | "or";

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
  link?: string;
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
}

export interface GetBannersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: BannerStatus | BannerStatus[];
  sortBy?: string;
  sortOrder?: "asc" | "desc";
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
  async getBanners(params?: GetBannersParams): Promise<GetBannersResponse> {
    const response = await api.get("/admin/banners", { params });
    return response.data;
  }

  /**
   * Get banner by ID
   */
  async getBannerById(bannerId: string): Promise<Banner> {
    const response = await api.get(`/admin/banners/${bannerId}`);
    return response.data.banner;
  }

  /**
   * Create a new banner
   */
  async createBanner(input: CreateBannerInput): Promise<BannerMutationResult> {
    const response = await api.post("/admin/banners", input);
    return parseChangeRequestResponse<Banner>(response, (r) => r?.banner);
  }

  /**
   * Update a banner
   */
  async updateBanner(
    bannerId: string,
    input: UpdateBannerInput,
  ): Promise<BannerMutationResult> {
    const response = await api.put(`/admin/banners/${bannerId}`, input);
    return parseChangeRequestResponse<Banner>(response, (r) => r?.banner);
  }

  /**
   * Delete a banner
   */
  async deleteBanner(bannerId: string): Promise<MutationResult<void>> {
    const response = await api.delete(`/admin/banners/${bannerId}`);
    return parseChangeRequestResponse<void>(response, () => undefined);
  }

  /**
   * Publish a banner
   */
  async publishBanner(bannerId: string): Promise<BannerMutationResult> {
    const response = await api.post(`/admin/banners/${bannerId}/publish`);
    return parseChangeRequestResponse<Banner>(response, (r) => r?.banner);
  }

  /**
   * Archive a banner
   */
  async archiveBanner(bannerId: string): Promise<BannerMutationResult> {
    const response = await api.post(`/admin/banners/${bannerId}/archive`);
    return parseChangeRequestResponse<Banner>(response, (r) => r?.banner);
  }

  /**
   * Duplicate a banner
   */
  async duplicateBanner(bannerId: string): Promise<Banner> {
    const response = await api.post(`/admin/banners/${bannerId}/duplicate`);
    return response.data.banner;
  }
}

export default new BannerService();
