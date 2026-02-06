import { useState, useEffect } from 'react';
import type { GatrixClientConfig } from '@gatrix/react-sdk';

interface Stats {
  sdkState: string;
  fetchFlagsCount: number;
  updateCount: number;
  notModifiedCount: number;
  errorCount: number;
  recoveryCount: number;
  impressionCount: number;
  etag: string | null;
  startTime: Date | null;
  lastFetchTime: Date | null;
  lastError: Error | null;
}

interface StatsPanelProps {
  config: GatrixClientConfig;
  enabledCount: number;
  disabledCount: number;
  totalCount: number;
  lastUpdate: Date | null;
  stats: Stats | null;
  errorMessage: string | null;
}

// Typewriter hook with repeat
function useTypewriter(
  text: string,
  speed: number = 50,
  pauseMs: number = 2000
): { displayText: string; isTyping: boolean } {
  const [displayText, setDisplayText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!text) {
      setDisplayText('');
      setIsTyping(false);
      return;
    }

    setDisplayText('');
    setIsTyping(true);
    let index = 0;

    const typeInterval = setInterval(() => {
      if (index < text.length) {
        setDisplayText(text.substring(0, index + 1));
        index++;
      } else {
        setIsTyping(false);
        clearInterval(typeInterval);
        setTimeout(() => {
          setCycle((c) => c + 1);
        }, pauseMs);
      }
    }, speed);

    return () => clearInterval(typeInterval);
  }, [text, speed, pauseMs, cycle]);

  return { displayText, isTyping };
}

function StatsPanel({
  config,
  enabledCount,
  disabledCount,
  totalCount,
  lastUpdate,
  stats,
  errorMessage,
}: StatsPanelProps) {
  const formatTime = (date: Date | null): string => {
    if (!date) return '--:--:--';
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const formatUptime = (startTime: Date | null): string => {
    if (!startTime) return '-';
    const ms = Date.now() - startTime.getTime();
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const getStatusClass = (state: string): string => {
    if (state === 'healthy' || state === 'ready') return 'status-healthy';
    if (state === 'error') return 'status-error';
    return '';
  };

  const getStatusIcon = (state: string): string => {
    if (state === 'healthy' || state === 'ready') return '●';
    if (state === 'error') return '●';
    return '○';
  };

  const isError = stats?.sdkState === 'error' || errorMessage;

  const formatErrorMessage = (msg: string): string => {
    if (msg.includes('ECONNREFUSED')) return 'Connection refused!';
    if (msg.includes('ETIMEDOUT')) return 'Connection timeout!';
    if (msg.includes('ENOTFOUND')) return 'Host not found!';
    if (msg.includes('fetch')) return 'Network error!';
    if (msg.length > 25) return msg.substring(0, 22) + '...';
    return msg;
  };

  const formattedError = errorMessage ? formatErrorMessage(errorMessage) : '';
  const { displayText, isTyping } = useTypewriter(formattedError, 40);

  const formatEtag = (etag: string | null): string => {
    if (!etag) return '-';
    return etag.replace(/"/g, '').substring(0, 10) + '...';
  };

  // Get mascot based on status
  const getMascotClass = () => {
    const state = stats?.sdkState || 'initializing';
    if (state === 'error' || errorMessage) {
      return isTyping ? 'mascot-talking' : 'mascot-sad';
    } else if (state === 'healthy' || state === 'ready') {
      return 'mascot-happy';
    }
    return 'mascot-waiting';
  };

  const getMascotIcon = () => {
    const state = stats?.sdkState || 'initializing';
    if (state === 'error' || errorMessage) {
      return <i className="nes-bcrikko"></i>;
    } else if (state === 'healthy' || state === 'ready') {
      return <i className="nes-octocat animate"></i>;
    }
    return <i className="nes-kirby"></i>;
  };

  return (
    <section className="stats-container">
      <div className={`nes-container is-dark with-title ${isError ? 'is-error-border' : ''}`}>
        <p className="title" style={{ backgroundColor: '#212529' }}>
          STATUS
        </p>

        <div className="stats-grid-layout">
          {/* Left: Mascot */}
          <div className={`mascot-container ${getMascotClass()}`}>{getMascotIcon()}</div>

          {/* Center: Stats Info */}
          <div className="stats-info">
            <table className="stats-table">
              <tbody>
                <tr>
                  <td className="stats-label">API:</td>
                  <td className="stats-value" colSpan={5}>
                    {config.apiUrl}
                  </td>
                </tr>
                <tr>
                  <td className="stats-label">APP/ENV:</td>
                  <td className="stats-value" colSpan={5}>
                    {config.appName} / {config.environment}
                  </td>
                </tr>
                <tr>
                  <td className="stats-label">STATUS:</td>
                  <td className={`stats-value ${getStatusClass(stats?.sdkState || '')}`}>
                    {getStatusIcon(stats?.sdkState || '')} {stats?.sdkState || 'init'}
                  </td>
                  <td className="stats-label">UP:</td>
                  <td className="stats-value">{formatUptime(stats?.startTime || null)}</td>
                  <td className="stats-label">SYNC:</td>
                  <td className="stats-value">{formatTime(lastUpdate)}</td>
                </tr>
                <tr>
                  <td className="stats-label">FETCH:</td>
                  <td className="stats-value">{stats?.fetchFlagsCount || 0}</td>
                  <td className="stats-label">UPD:</td>
                  <td className="stats-value">{stats?.updateCount || 0}</td>
                  <td className="stats-label">304:</td>
                  <td className="stats-value">{stats?.notModifiedCount || 0}</td>
                </tr>
                <tr>
                  <td className="stats-label">ERR:</td>
                  <td className="stats-value">{stats?.errorCount || 0}</td>
                  <td className="stats-label">REC:</td>
                  <td className="stats-value">{stats?.recoveryCount || 0}</td>
                  <td className="stats-label">ETAG:</td>
                  <td className="stats-value">{formatEtag(stats?.etag || null)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Right: Error Balloon + Flag Counts */}
          <div className="stats-right">
            {/* Error balloon (fixed size) */}
            {isError && (
              <div className="error-balloon-container">
                <div className="nes-balloon from-left is-dark error-balloon-fixed">
                  <p>
                    {displayText}
                    {isTyping && <span className="typewriter-cursor">_</span>}
                  </p>
                </div>
              </div>
            )}

            {/* Flag Counts */}
            <div className="stats-numbers-compact">
              <div className="stat-mini">
                <span className="stat-mini-value total">{totalCount}</span>
                <span className="stat-mini-label">ALL</span>
              </div>
              <div className="stat-mini">
                <span className="stat-mini-value enabled">{enabledCount}</span>
                <span className="stat-mini-label">ON</span>
              </div>
              <div className="stat-mini">
                <span className="stat-mini-value disabled">{disabledCount}</span>
                <span className="stat-mini-label">OFF</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default StatsPanel;
