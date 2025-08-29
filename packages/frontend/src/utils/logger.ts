/**
 * Frontend Logger Utility
 * 
 * 프론트엔드에서 사용할 수 있는 로깅 유틸리티
 * 개발 환경에서는 console에 출력하고, 프로덕션에서는 선택적으로 서버에 전송
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  url?: string;
  userAgent?: string;
}

class Logger {
  private isDevelopment: boolean;
  private enableServerLogging: boolean;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize: number = 100;

  constructor() {
    this.isDevelopment = import.meta.env.DEV;
    this.enableServerLogging = import.meta.env.VITE_ENABLE_SERVER_LOGGING === 'true';
  }

  /**
   * Debug 레벨 로그
   */
  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  /**
   * Info 레벨 로그
   */
  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  /**
   * Warning 레벨 로그
   */
  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  /**
   * Error 레벨 로그
   */
  error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  /**
   * 내부 로그 처리 메서드
   */
  private log(level: LogLevel, message: string, data?: any): void {
    const logEntry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    // 개발 환경에서는 항상 콘솔에 출력
    if (this.isDevelopment) {
      this.logToConsole(level, message, data);
    }

    // 프로덕션에서는 error와 warn만 콘솔에 출력
    if (!this.isDevelopment && (level === 'error' || level === 'warn')) {
      this.logToConsole(level, message, data);
    }

    // 서버 로깅이 활성화된 경우 버퍼에 추가
    if (this.enableServerLogging) {
      this.addToBuffer(logEntry);
    }
  }

  /**
   * 콘솔에 로그 출력
   */
  private logToConsole(level: LogLevel, message: string, data?: any): void {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    switch (level) {
      case 'debug':
        console.debug(prefix, message, data || '');
        break;
      case 'info':
        console.info(prefix, message, data || '');
        break;
      case 'warn':
        console.warn(prefix, message, data || '');
        break;
      case 'error':
        console.error(prefix, message, data || '');
        break;
    }
  }

  /**
   * 로그 버퍼에 추가
   */
  private addToBuffer(logEntry: LogEntry): void {
    this.logBuffer.push(logEntry);

    // 버퍼 크기 제한
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Error 레벨은 즉시 서버에 전송
    if (logEntry.level === 'error') {
      this.flushToServer();
    }
  }

  /**
   * 버퍼의 로그를 서버에 전송
   */
  private async flushToServer(): Promise<void> {
    if (this.logBuffer.length === 0) {
      return;
    }

    try {
      const logs = [...this.logBuffer];
      this.logBuffer = [];

      // 서버에 로그 전송 (실제 구현 시 API 엔드포인트 필요)
      await fetch('/api/v1/client/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs }),
      });
    } catch (error) {
      // 서버 로깅 실패 시 콘솔에만 출력
      console.error('Failed to send logs to server:', error);
    }
  }

  /**
   * 수동으로 로그 플러시
   */
  flush(): void {
    this.flushToServer();
  }

  /**
   * 로그 버퍼 클리어
   */
  clear(): void {
    this.logBuffer = [];
  }

  /**
   * 현재 로그 버퍼 상태 반환
   */
  getBufferStatus(): { count: number; maxSize: number } {
    return {
      count: this.logBuffer.length,
      maxSize: this.maxBufferSize,
    };
  }
}

// 싱글톤 인스턴스 생성
const logger = new Logger();

// 페이지 언로드 시 로그 플러시
window.addEventListener('beforeunload', () => {
  logger.flush();
});

// 주기적으로 로그 플러시 (5분마다)
setInterval(() => {
  logger.flush();
}, 5 * 60 * 1000);

export default logger;

/**
 * 개발 환경에서만 사용하는 디버그 로거
 */
export const devLogger = {
  debug: (message: string, data?: any) => {
    if (import.meta.env.DEV) {
      logger.debug(message, data);
    }
  },
  info: (message: string, data?: any) => {
    if (import.meta.env.DEV) {
      logger.info(message, data);
    }
  },
  warn: (message: string, data?: any) => {
    if (import.meta.env.DEV) {
      logger.warn(message, data);
    }
  },
  error: (message: string, data?: any) => {
    if (import.meta.env.DEV) {
      logger.error(message, data);
    }
  },
};

/**
 * 프로덕션에서도 사용하는 중요한 로거
 */
export const prodLogger = {
  warn: (message: string, data?: any) => {
    logger.warn(message, data);
  },
  error: (message: string, data?: any) => {
    logger.error(message, data);
  },
};
