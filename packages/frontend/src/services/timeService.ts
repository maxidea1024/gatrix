import { apiService } from './api';

export interface ServerTimeResponse {
  success: boolean;
  serverLocalTimeISO: string;
  serverLocalTime: number;
  clientLocalTime: number;
  uptime: number; // Server uptime (in seconds)
}

export interface ServerTimeData {
  serverTime: Date;
  localTime: Date;
  ping: number;
  offset: number; // Time difference between server and client (ms)
  uptime: number; // Server uptime (in seconds)
  uptimeBaseTime: number; // Uptime base time (timestamp)
}

class TimeService {
  private currentServerTime: ServerTimeData | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private listeners: ((data: ServerTimeData) => void)[] = [];

  /**
   * Get server time and calculate ping
   */
  async fetchServerTime(): Promise<ServerTimeData> {
    const clientLocalTime = new Date().getTime();

    try {
      const response = await apiService.get<ServerTimeResponse>(
        `/public/time?clientLocalTime=${clientLocalTime}`
      );
      const currentLocalTime = new Date().getTime();

      const { serverLocalTime, uptime } = response.data || {};

      const roundTripTime = currentLocalTime - clientLocalTime;
      const ping = roundTripTime / 2;
      const serverTime = new Date(serverLocalTime + ping);

      const offset = serverTime.getTime() - currentLocalTime;

      const serverTimeData: ServerTimeData = {
        serverTime,
        localTime: new Date(currentLocalTime),
        ping,
        offset,
        uptime,
        uptimeBaseTime: currentLocalTime,
      };

      this.currentServerTime = serverTimeData;
      this.notifyListeners(serverTimeData);

      return serverTimeData;
    } catch (error) {
      console.error('Failed to fetch server time:', error);
      throw error;
    }
  }

  /**
   * Return currently calculated server time (real-time)
   */
  getCurrentServerTime(): Date {
    if (!this.currentServerTime) {
      return new Date(); // fallback to local time
    }

    const now = Date.now();
    const timeSinceLastSync = now - this.currentServerTime.localTime.getTime();
    return new Date(this.currentServerTime.serverTime.getTime() + timeSinceLastSync);
  }

  /**
   * Return current server uptime (real-time)
   */
  getCurrentUptime(): number {
    if (!this.currentServerTime) {
      return 0;
    }

    const now = Date.now();
    const timeSinceLastSync = (now - this.currentServerTime.uptimeBaseTime) / 1000; // In seconds
    return this.currentServerTime.uptime + timeSinceLastSync;
  }

  /**
   * Start server time synchronization
   */
  startSync(): void {
    // Call immediately for the first time
    this.fetchServerTime().catch(console.error);

    // Synchronize at regular intervals
    this.intervalId = setInterval(() => {
      this.fetchServerTime().catch(console.error);
    }, 60_000);
  }

  /**
   * Stop server time synchronization
   */
  stopSync(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Add server time update listener
   */
  addListener(callback: (data: ServerTimeData) => void): void {
    this.listeners.push(callback);
  }

  /**
   * Remove server time update listener
   */
  removeListener(callback: (data: ServerTimeData) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(data: ServerTimeData): void {
    this.listeners.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in time service listener:', error);
      }
    });
  }

  /**
   * Return current server time information
   */
  getServerTimeData(): ServerTimeData | null {
    return this.currentServerTime;
  }
}

export const timeService = new TimeService();
