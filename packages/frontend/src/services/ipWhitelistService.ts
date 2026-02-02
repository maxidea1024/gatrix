import { apiService } from "./api";
import { prodLogger } from "../utils/logger";

export interface IpWhitelist {
  id: number;
  ipAddress: string;
  purpose: string;
  isEnabled: boolean;
  startDate?: string;
  endDate?: string;
  tags?: string[];
  createdBy: number;
  updatedBy?: number;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
  updatedByName?: string;
}

export interface CreateIpWhitelistData {
  ipAddress: string;
  purpose: string;
  isEnabled?: boolean;
  startDate?: string;
  endDate?: string;
  tags?: string[];
}

export interface UpdateIpWhitelistData {
  ipAddress?: string;
  purpose?: string;
  isEnabled?: boolean;
  startDate?: string;
  endDate?: string;
  tags?: string[];
}

export interface IpWhitelistFilters {
  ipAddress?: string;
  purpose?: string;
  isEnabled?: boolean;
  createdBy?: number;
  search?: string;
  tags?: string[];
}

export interface IpWhitelistListResponse {
  ipWhitelists: IpWhitelist[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BulkCreateIpEntry {
  ipAddress: string;
  purpose: string;
  isEnabled?: boolean;
  startDate?: string;
  endDate?: string;
  tags?: string[];
}

export interface BulkCreateResponse {
  requestedCount: number;
  createdCount: number;
}

export interface IpCheckResponse {
  ipAddress: string;
  isWhitelisted: boolean;
}

export class IpWhitelistService {
  static async getIpWhitelists(
    page: number = 1,
    limit: number = 10,
    filters: IpWhitelistFilters = {},
  ): Promise<IpWhitelistListResponse> {
    // Ensure page and limit are valid numbers
    const validPage =
      typeof page === "number" && !isNaN(page) && page > 0 ? page : 1;
    const validLimit =
      typeof limit === "number" && !isNaN(limit) && limit > 0 ? limit : 10;

    const params = new URLSearchParams({
      page: validPage.toString(),
      limit: validLimit.toString(),
      // Cache prevention for development
      _t: Date.now().toString(),
    });

    if (filters.ipAddress) params.append("ipAddress", filters.ipAddress);
    if (filters.purpose) params.append("purpose", filters.purpose);
    if (filters.isEnabled !== undefined)
      params.append("isEnabled", filters.isEnabled.toString());
    if (filters.createdBy)
      params.append("createdBy", filters.createdBy.toString());
    if (filters.search) params.append("search", filters.search);
    if (filters.tags && filters.tags.length > 0) {
      filters.tags.forEach((tag) => params.append("tags", tag));
    }

    const response = await apiService.get<{
      success: boolean;
      data: IpWhitelistListResponse;
    }>(`/admin/ip-whitelist?${params}`);

    if (response?.success && response?.data) {
      return response.data;
    }

    // Return default response if API fails
    prodLogger.warn("Unexpected getIpWhitelists response structure:", response);
    return {
      ipWhitelists: [],
      total: 0,
      page: page,
      limit: limit,
      totalPages: 0,
    };
  }

  static async getIpWhitelistById(id: number): Promise<IpWhitelist> {
    const response = await apiService.get<{
      success: boolean;
      data: IpWhitelist;
    }>(`/admin/ip-whitelist/${id}`);

    if (response?.success && response?.data) {
      return response.data;
    }

    throw new Error("Failed to fetch IP whitelist entry");
  }

  static async createIpWhitelist(
    data: CreateIpWhitelistData,
  ): Promise<IpWhitelist> {
    const response = await apiService.post<{
      success: boolean;
      data: IpWhitelist;
    }>("/admin/ip-whitelist", data);

    if (response?.success && response?.data) {
      return response.data;
    }

    throw new Error("Failed to create IP whitelist entry");
  }

  static async updateIpWhitelist(
    id: number,
    data: UpdateIpWhitelistData,
  ): Promise<IpWhitelist> {
    const response = await apiService.put<{
      success: boolean;
      data: IpWhitelist;
    }>(`/admin/ip-whitelist/${id}`, data);

    if (response?.success && response?.data) {
      return response.data;
    }

    throw new Error("Failed to update IP whitelist entry");
  }

  static async deleteIpWhitelist(id: number): Promise<void> {
    const response = await apiService.delete<{
      success: boolean;
      message: string;
    }>(`/admin/ip-whitelist/${id}`);

    if (!response?.success) {
      throw new Error("Failed to delete IP whitelist entry");
    }
  }

  static async toggleIpWhitelistStatus(id: number): Promise<IpWhitelist> {
    const response = await apiService.patch<{
      success: boolean;
      data: IpWhitelist;
    }>(`/admin/ip-whitelist/${id}/toggle`);

    if (response?.success && response?.data) {
      return response.data;
    }

    throw new Error("Failed to toggle IP whitelist status");
  }

  static async bulkCreateIpWhitelists(
    entries: BulkCreateIpEntry[],
  ): Promise<BulkCreateResponse> {
    const response = await apiService.post<{
      success: boolean;
      data: BulkCreateResponse;
      message: string;
    }>("/admin/ip-whitelist/bulk", { entries });

    if (response?.success && response?.data) {
      return response.data;
    }

    throw new Error("Failed to bulk create IP whitelist entries");
  }

  static async checkIpWhitelist(ipAddress: string): Promise<IpCheckResponse> {
    const params = new URLSearchParams({ ipAddress });
    const response = await apiService.get<{
      success: boolean;
      data: IpCheckResponse;
    }>(`/admin/ip-whitelist/check?${params}`);

    if (response?.success && response?.data) {
      return response.data;
    }

    throw new Error("Failed to check IP whitelist status");
  }

  /**
   * Validates IP address or CIDR notation on the frontend
   */
  static validateIpOrCidr(input: string): { isValid: boolean; error?: string } {
    if (!input || typeof input !== "string") {
      return { isValid: false, error: "IP address is required" };
    }

    const trimmed = input.trim();

    // Basic IPv4 regex
    const ipv4Regex =
      /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

    // Basic IPv6 regex (simplified)
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;

    // Check if it's CIDR notation
    if (trimmed.includes("/")) {
      const parts = trimmed.split("/");
      if (parts.length !== 2) {
        return { isValid: false, error: "Invalid CIDR format" };
      }

      const [ip, prefixStr] = parts;
      const prefix = parseInt(prefixStr, 10);

      if (isNaN(prefix)) {
        return { isValid: false, error: "Invalid CIDR prefix" };
      }

      if (ipv4Regex.test(ip)) {
        if (prefix < 0 || prefix > 32) {
          return {
            isValid: false,
            error: "IPv4 CIDR prefix must be between 0 and 32",
          };
        }
      } else if (ipv6Regex.test(ip)) {
        if (prefix < 0 || prefix > 128) {
          return {
            isValid: false,
            error: "IPv6 CIDR prefix must be between 0 and 128",
          };
        }
      } else {
        return { isValid: false, error: "Invalid IP address in CIDR notation" };
      }

      return { isValid: true };
    }

    // Check if it's a regular IP address
    if (ipv4Regex.test(trimmed) || ipv6Regex.test(trimmed)) {
      return { isValid: true };
    }

    return { isValid: false, error: "Invalid IP address format" };
  }

  /**
   * Gets a human-readable description of the IP/CIDR
   */
  static getIpDescription(input: string): string {
    if (!input) return "Invalid";

    const trimmed = input.trim();

    if (trimmed.includes("/")) {
      const [ip, prefix] = trimmed.split("/");
      const ipv4Regex =
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

      if (ipv4Regex.test(ip)) {
        const prefixNum = parseInt(prefix, 10);
        const hostBits = 32 - prefixNum;
        const addressCount = Math.pow(2, hostBits);
        return `IPv4 network ${trimmed} (${addressCount.toLocaleString()} addresses)`;
      } else {
        return `IPv6 network ${trimmed}`;
      }
    } else {
      const ipv4Regex =
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

      if (ipv4Regex.test(trimmed)) {
        return `IPv4 address ${trimmed}`;
      } else {
        return `IPv6 address ${trimmed}`;
      }
    }
  }

  /**
   * Parses bulk import text into entries
   */
  static parseBulkImportText(text: string): BulkCreateIpEntry[] {
    if (!text || !text.trim()) {
      return [];
    }

    const lines = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);
    const entries: BulkCreateIpEntry[] = [];

    for (const line of lines) {
      // Support formats:
      // IP_ADDRESS,PURPOSE,START_DATE,END_DATE,TAGS
      // IP_ADDRESS,PURPOSE,START_DATE,END_DATE
      // IP_ADDRESS,PURPOSE,START_DATE
      // IP_ADDRESS,PURPOSE
      // IP_ADDRESS (with default purpose)

      const parts = line.split(",").map((part) => part.trim());

      if (parts.length >= 1) {
        const ipAddress = parts[0];
        const purpose = parts[1] || "Bulk import";
        const startDate = parts[2]?.trim() || undefined;
        const endDate = parts[3]?.trim() || undefined;
        const tagsStr = parts[4]?.trim() || undefined;

        // Parse tags (semicolon separated)
        const tags =
          tagsStr && tagsStr !== ""
            ? tagsStr
                .split(";")
                .map((tag) => tag.trim())
                .filter((tag) => tag !== "")
            : undefined;

        const validation = this.validateIpOrCidr(ipAddress);
        if (validation.isValid) {
          entries.push({
            ipAddress,
            purpose,
            startDate: startDate && startDate !== "" ? startDate : undefined,
            endDate: endDate && endDate !== "" ? endDate : undefined,
            tags,
            isEnabled: true,
          });
        }
      }
    }

    return entries;
  }
}
