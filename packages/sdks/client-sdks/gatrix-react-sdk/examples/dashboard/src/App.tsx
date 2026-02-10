import { useState, useCallback, useRef } from 'react';
import { GatrixProvider, type GatrixClientConfig } from '@gatrix/react-sdk';
import Dashboard from './components/Dashboard';
import ConfigForm from './components/ConfigForm';
import BootScreen from './components/BootScreen';
import DisconnectScreen from './components/DisconnectScreen';
import ConfirmDialog from './components/ConfirmDialog';
import IdleDefenseGame from './components/IdleDefenseGame';
import MatrixBackground from './components/MatrixBackground';
import LogViewer, { type LogEntry } from './components/LogViewer';
import './styles.css';

// Log capture system
let logIdCounter = 0;

function createCaptureLogger(logsRef: React.MutableRefObject<LogEntry[]>, forceUpdate: () => void) {
  return {
    debug(message: string, ...args: any[]) {
      logsRef.current = [...logsRef.current, { id: logIdCounter++, level: 'debug' as const, message, timestamp: new Date(), args }];
      forceUpdate();
      console.debug(`[GatrixClient] ${message}`, ...args);
    },
    info(message: string, ...args: any[]) {
      logsRef.current = [...logsRef.current, { id: logIdCounter++, level: 'info' as const, message, timestamp: new Date(), args }];
      forceUpdate();
      console.info(`[GatrixClient] ${message}`, ...args);
    },
    warn(message: string, ...args: any[]) {
      logsRef.current = [...logsRef.current, { id: logIdCounter++, level: 'warn' as const, message, timestamp: new Date(), args }];
      forceUpdate();
      console.warn(`[GatrixClient] ${message}`, ...args);
    },
    error(message: string, ...args: any[]) {
      logsRef.current = [...logsRef.current, { id: logIdCounter++, level: 'error' as const, message, timestamp: new Date(), args }];
      forceUpdate();
      console.error(`[GatrixClient] ${message}`, ...args);
    },
  };
}

function App() {
  const [config, setConfig] = useState<GatrixClientConfig | null>(() => {
    const saved = localStorage.getItem('gatrix-dashboard-config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isBooting, setIsBooting] = useState(false);
  const [bootComplete, setBootComplete] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showGame, setShowGame] = useState<false | 'defense'>(false);
  const [showLogViewer, setShowLogViewer] = useState(false);
  const [, setLogVersion] = useState(0); // Force re-render on log changes

  const logsRef = useRef<LogEntry[]>([]);
  const forceUpdate = useCallback(() => setLogVersion((v) => v + 1), []);
  const captureLogger = useRef(createCaptureLogger(logsRef, forceUpdate)).current;

  const errorLogCount = logsRef.current.filter((l) => l.level === 'error').length;

  const handleConnect = useCallback((newConfig: GatrixClientConfig) => {
    localStorage.setItem('gatrix-dashboard-config', JSON.stringify(newConfig));
    setConfig(newConfig);
    setIsBooting(true);
    setBootComplete(false);
    logsRef.current = [];
    logIdCounter = 0;
  }, []);

  const handleBootComplete = useCallback(() => {
    setIsBooting(false);
    setBootComplete(true);
  }, []);

  const handleDisconnectRequest = useCallback(() => {
    setShowConfirmDialog(true);
  }, []);

  const handleConfirmDisconnect = useCallback(() => {
    setShowConfirmDialog(false);
    setIsDisconnecting(true);
  }, []);

  const handleCancelDisconnect = useCallback(() => {
    setShowConfirmDialog(false);
  }, []);

  const handleDisconnectComplete = useCallback(() => {
    localStorage.removeItem('gatrix-dashboard-config');
    setConfig(null);
    setIsBooting(false);
    setBootComplete(false);
    setIsDisconnecting(false);
  }, []);

  const handleClearLogs = useCallback(() => {
    logsRef.current = [];
    logIdCounter = 0;
    forceUpdate();
  }, [forceUpdate]);

  // Show boot screen
  if (config && isBooting && !bootComplete) {
    return <BootScreen onComplete={handleBootComplete} />;
  }

  // Show disconnect screen
  if (isDisconnecting) {
    return <DisconnectScreen onComplete={handleDisconnectComplete} />;
  }

  return (
    <div className="app">
      {showConfirmDialog && (
        <ConfirmDialog
          title="POWER OFF"
          message="Are you sure you want to shut down the connection?"
          onConfirm={handleConfirmDisconnect}
          onCancel={handleCancelDisconnect}
        />
      )}
      {!config ? (
        <div className="center-container">
          <MatrixBackground />
          <ConfigForm onConnect={handleConnect} />
        </div>
      ) : (
        <GatrixProvider
          config={{
            ...config,
            logger: captureLogger,
            enableDevMode: true,
            features: {
              metricsIntervalInitial: 1,
              metricsInterval: 5,
              ...config.features,
            },
          }}
        >
          {showGame === 'defense' ? (
            <IdleDefenseGame onExit={() => setShowGame(false)} />
          ) : (
            <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
              <div className="dashboard-container" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
                <header className="header">
                  <h1 className="header-title">
                    <i className="nes-icon trophy is-small"></i>
                    &nbsp;GATRIX FEATURE FLAGS (React SDK)
                  </h1>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                      type="button"
                      className="nes-btn is-success"
                      onClick={() => setShowGame('defense')}
                    >
                      SLIME DEFENSE
                    </button>
                    <button
                      type="button"
                      className="nes-btn is-error"
                      onClick={handleDisconnectRequest}
                    >
                      POWER OFF
                    </button>
                  </div>
                </header>
                <Dashboard config={config} />
              </div>

              {showLogViewer && (
                <LogViewer
                  logs={logsRef.current}
                  onClose={() => setShowLogViewer(false)}
                  onClear={handleClearLogs}
                />
              )}
            </div>
          )}

          {/* Floating log toggle button */}
          {!showLogViewer && !showGame && (
            <button
              type="button"
              className="log-fab"
              onClick={() => setShowLogViewer(true)}
              title="Toggle SDK Logs"
            >
              📋
              {errorLogCount > 0 && (
                <span className="log-fab-badge">
                  {errorLogCount > 99 ? '99+' : errorLogCount}
                </span>
              )}
            </button>
          )}
        </GatrixProvider>
      )}
    </div>
  );
}

export default App;
