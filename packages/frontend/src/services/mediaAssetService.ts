/**
 * Media Asset Service (Frontend API Client)
 *
 * Provides methods for uploading, listing, and managing media assets.
 */
import api from './api';

export interface MediaAsset {
  id: string;
  hash: string;
  storageKey: string;
  cdnUrl: string;
  fileName: string;
  contentType: string;
  size: number;
  width?: number | null;
  height?: number | null;
  refCount: number;
  gcEligibleAt?: string | null;
  uploadedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UploadResult {
  id: string;
  cdnUrl: string;
  hash: string;
  fileName: string;
  contentType: string;
  size: number;
  width?: number | null;
  height?: number | null;
  isDuplicate: boolean;
}

export interface ReferencingBanner {
  bannerId: string;
  name: string;
  environmentId: string;
  status: string;
}

export interface ListAssetsParams {
  page?: number;
  limit?: number;
  search?: string;
  contentType?: string;
  refStatus?: 'all' | 'referenced' | 'garbage';
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ListAssetsResponse {
  assets: MediaAsset[];
  total: number;
  page: number;
  limit: number;
}

export interface AssetDetailResponse {
  asset: MediaAsset;
  referencingBanners: ReferencingBanner[];
}

class MediaAssetServiceClient {
  private basePath = '/admin/media-assets';

  /**
   * Upload an image file.
   * Returns the CDN URL and whether it was a duplicate.
   */
  async uploadImage(file: File): Promise<UploadResult> {
    const response = await api.upload<UploadResult>(
      `${this.basePath}/upload`,
      file,
      'file'
    );
    return response.data;
  }

  /**
   * List media assets with pagination and filtering.
   */
  async listAssets(params: ListAssetsParams = {}): Promise<ListAssetsResponse> {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', String(params.page));
    if (params.limit) queryParams.set('limit', String(params.limit));
    if (params.search) queryParams.set('search', params.search);
    if (params.contentType) queryParams.set('contentType', params.contentType);
    if (params.refStatus) queryParams.set('refStatus', params.refStatus);
    if (params.sortBy) queryParams.set('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);

    const qs = queryParams.toString();
    const url = qs ? `${this.basePath}?${qs}` : this.basePath;

    const response = await api.get<ListAssetsResponse>(url);
    return response.data;
  }

  /**
   * Get a single media asset with referencing banners.
   */
  async getAsset(id: string): Promise<AssetDetailResponse> {
    const response = await api.get<AssetDetailResponse>(
      `${this.basePath}/${id}`
    );
    return response.data;
  }

  /**
   * Force-delete a media asset.
   */
  async deleteAsset(id: string): Promise<void> {
    await api.delete(`${this.basePath}/${id}`);
  }

  /**
   * Bulk-delete all unreferenced media assets (refCount = 0).
   */
  async bulkDeleteUnreferenced(): Promise<{ deleted: number }> {
    const response = await api.delete<{ deleted: number }>(
      `${this.basePath}/bulk/unreferenced`
    );
    return response.data;
  }
}

export const mediaAssetService = new MediaAssetServiceClient();
export default mediaAssetService;
