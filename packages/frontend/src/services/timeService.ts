import { apiService } from './api';

export interface ServerTimeResponse {
  success: boolean;
  serverLocalTimeISO: string;
  serverLocalTime: number;
  clientLocalTime: number;
  uptime: number; // 서버 업타임 (초 단위)
}

export interface ServerTimeData {
  serverTime: Date;
  localTime: Date;
  ping: number;
  offset: number; // 서버와 클라이언트 시간 차이 (ms)
  uptime: number; // 서버 업타임 (초 단위)
  uptimeBaseTime: number; // uptime 기준 시간 (timestamp)
}

class TimeService {
  private currentServerTime: ServerTimeData | null = null;
  private intervalId: NodeJS.Timeout | null = null;
  private listeners: ((data: ServerTimeData) => void)[] = [];

  /**
   * 서버 시간 조회 및 핑 계산
   */
  async fetchServerTime(): Promise<ServerTimeData> {
    const clientLocalTime = new Date().getTime();

    try {
      const response = await apiService.get<ServerTimeResponse>(`/public/time?clientLocalTime=${clientLocalTime}`);
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
        uptimeBaseTime: currentLocalTime
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
   * 현재 계산된 서버 시간 반환 (실시간)
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
   * 현재 서버 업타임 반환 (실시간)
   */
  getCurrentUptime(): number {
    if (!this.currentServerTime) {
      return 0;
    }

    const now = Date.now();
    const timeSinceLastSync = (now - this.currentServerTime.uptimeBaseTime) / 1000; // 초 단위
    return this.currentServerTime.uptime + timeSinceLastSync;
  }

  /**
   * 서버 시간 동기화 시작
   */
  startSync(): void {
    // 최초에 한번은 즉시 호출
    this.fetchServerTime().catch(console.error);
    
    // 일정주기마다 동기화
    this.intervalId = setInterval(() => {
      this.fetchServerTime().catch(console.error);
    }, 60_000);
  }

  /**
   * 서버 시간 동기화 중지
   */
  stopSync(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * 서버 시간 업데이트 리스너 추가
   */
  addListener(callback: (data: ServerTimeData) => void): void {
    this.listeners.push(callback);
  }

  /**
   * 서버 시간 업데이트 리스너 제거
   */
  removeListener(callback: (data: ServerTimeData) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 모든 리스너에게 알림
   */
  private notifyListeners(data: ServerTimeData): void {
    this.listeners.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Error in time service listener:', error);
      }
    });
  }

  /**
   * 현재 서버 시간 정보 반환
   */
  getServerTimeData(): ServerTimeData | null {
    return this.currentServerTime;
  }
}

export const timeService = new TimeService();
