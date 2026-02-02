/**
 * Platform and Channel Configuration Types
 */

export interface PlatformOption {
  label: string;
  value: string;
}

export interface SubChannel {
  label: string;
  value: string;
}

export interface ChannelOption {
  label: string;
  value: string;
  subChannels: SubChannel[];
}

export interface PlatformConfig {
  platforms: PlatformOption[];
  channels: ChannelOption[];
}

export interface PlatformConfigContextType {
  platforms: PlatformOption[];
  channels: ChannelOption[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}
