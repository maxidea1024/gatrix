import { useState, useEffect } from 'react';
import type { GatrixClientConfig } from '@gatrix/react-sdk';

interface ConfigFormProps {
  onConnect: (config: GatrixClientConfig) => void;
}

// Dev tokens for local development
const DEV_TOKEN_EDGE = 'gatrix-unsecured-edge-api-token';
const DEV_TOKEN_BACKEND = 'gatrix-unsecured-client-api-token';

// Storage keys
const STORAGE_KEY_LOCATION = 'gatrix-dashboard-location';
const STORAGE_KEY_SERVER_TYPE = 'gatrix-dashboard-server-type';
const STORAGE_KEY_TOKEN = 'gatrix-dashboard-last-token';
const STORAGE_KEY_REMEMBER = 'gatrix-dashboard-remember-token';
const STORAGE_KEY_API_URL = 'gatrix-dashboard-api-url';
const STORAGE_KEY_APP_NAME = 'gatrix-dashboard-app-name';
const STORAGE_KEY_ENVIRONMENT = 'gatrix-dashboard-environment';
const STORAGE_KEY_OFFLINE_MODE = 'gatrix-dashboard-offline-mode';
const STORAGE_KEY_REFRESH_INTERVAL = 'gatrix-dashboard-refresh-interval';
const STORAGE_KEY_EXPLICIT_SYNC = 'gatrix-dashboard-explicit-sync';
const STORAGE_KEY_MANUAL_POLLING = 'gatrix-dashboard-manual-polling';
const STORAGE_KEY_USER_ID = 'gatrix-dashboard-user-id';

function generateRandomUserId(): string {
  return 'user-' + Math.random().toString(36).substring(2, 10);
}

type ServerLocation = 'local' | 'remote';
type ServerType = 'edge' | 'backend';

function getLocalUrl(serverType: ServerType): string {
  return serverType === 'edge'
    ? 'http://localhost:3400/api/v1'
    : 'http://localhost:45000/api/v1';
}

function getDevToken(serverType: ServerType): string {
  return serverType === 'edge' ? DEV_TOKEN_EDGE : DEV_TOKEN_BACKEND;
}

function ConfigForm({ onConnect }: ConfigFormProps) {
  // Step 1: Server location
  const [location, setLocation] = useState<ServerLocation>(() => {
    return (localStorage.getItem(STORAGE_KEY_LOCATION) as ServerLocation) || 'local';
  });

  // Step 2: Server type (edge/backend for local)
  const [serverType, setServerType] = useState<ServerType>(() => {
    return (localStorage.getItem(STORAGE_KEY_SERVER_TYPE) as ServerType) || 'edge';
  });

  // Connection details
  const [apiUrl, setApiUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [appName, setAppName] = useState('my-app');
  const [environment, setEnvironment] = useState('development');
  const [userId, setUserId] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_USER_ID) || generateRandomUserId();
  });
  const [rememberToken, setRememberToken] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Advanced options
  const [offlineMode, setOfflineMode] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(1);
  const [manualPolling, setManualPolling] = useState(false);
  const [explicitSyncMode, setExplicitSyncMode] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    const savedRememberToken = localStorage.getItem(STORAGE_KEY_REMEMBER) === 'true';
    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN) || '';
    const savedApiUrl = localStorage.getItem(STORAGE_KEY_API_URL);
    const savedAppName = localStorage.getItem(STORAGE_KEY_APP_NAME);
    const savedEnvironment = localStorage.getItem(STORAGE_KEY_ENVIRONMENT);

    if (savedAppName) setAppName(savedAppName);
    if (savedEnvironment) setEnvironment(savedEnvironment);

    setRememberToken(savedRememberToken);

    // Set URL and token based on location
    if (location === 'local') {
      setApiUrl(getLocalUrl(serverType));
      setApiToken(getDevToken(serverType));
    } else {
      setApiUrl(savedApiUrl || '');
      if (savedRememberToken && savedToken) {
        setApiToken(savedToken);
      }
    }

    setOfflineMode(localStorage.getItem(STORAGE_KEY_OFFLINE_MODE) === 'true');
    const savedManualPolling = localStorage.getItem(STORAGE_KEY_MANUAL_POLLING) === 'true';
    const savedRefreshInterval = parseInt(
      localStorage.getItem(STORAGE_KEY_REFRESH_INTERVAL) || '1',
      10
    );

    setManualPolling(savedManualPolling);
    setRefreshInterval(
      !savedManualPolling && savedRefreshInterval === 0 ? 1 : savedRefreshInterval
    );
    setExplicitSyncMode(localStorage.getItem(STORAGE_KEY_EXPLICIT_SYNC) === 'true');
  }, []);

  // When location or serverType changes, update URL and token
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_LOCATION, location);
    localStorage.setItem(STORAGE_KEY_SERVER_TYPE, serverType);

    if (location === 'local') {
      setApiUrl(getLocalUrl(serverType));
      setApiToken(getDevToken(serverType));
    } else {
      // Remote: clear fields for manual input
      setApiUrl('');
      setApiToken('');
    }
  }, [location, serverType]);

  const handleManualPollingChange = (checked: boolean) => {
    setManualPolling(checked);
    if (!checked && refreshInterval === 0) {
      setRefreshInterval(1);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Save all form values for next session
    localStorage.setItem(STORAGE_KEY_LOCATION, location);
    localStorage.setItem(STORAGE_KEY_SERVER_TYPE, serverType);
    localStorage.setItem(STORAGE_KEY_ENVIRONMENT, environment);
    localStorage.setItem(STORAGE_KEY_USER_ID, userId);
    localStorage.setItem(STORAGE_KEY_OFFLINE_MODE, String(offlineMode));
    localStorage.setItem(STORAGE_KEY_REFRESH_INTERVAL, String(manualPolling ? 0 : refreshInterval));
    localStorage.setItem(STORAGE_KEY_MANUAL_POLLING, String(manualPolling));
    localStorage.setItem(STORAGE_KEY_EXPLICIT_SYNC, String(explicitSyncMode));

    if (location === 'remote') {
      localStorage.setItem(STORAGE_KEY_API_URL, apiUrl);
      if (rememberToken) {
        localStorage.setItem(STORAGE_KEY_TOKEN, apiToken);
        localStorage.setItem(STORAGE_KEY_REMEMBER, 'true');
      } else {
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        localStorage.setItem(STORAGE_KEY_REMEMBER, 'false');
      }
    }

    onConnect({
      apiUrl,
      apiToken,
      appName,
      environment,
      offlineMode,
      context: {
        userId,
      },
      features: {
        refreshInterval: manualPolling ? 0 : refreshInterval,
        explicitSyncMode,
      },
    });
  };

  const isLocal = location === 'local';

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="nes-container is-dark with-title">
          <p className="title" style={{ backgroundColor: '#000' }}>
            <i className="nes-icon coin is-small"></i> CONNECT TO GATRIX
          </p>

          <form onSubmit={handleSubmit}>
            {/* Step 1: Server Location */}
            <div className="form-group">
              <label className="form-label">SERVER LOCATION</label>
              <div style={{ display: 'flex', gap: '40px', marginBottom: '20px' }}>
                <label>
                  <input
                    type="radio"
                    className="nes-radio is-dark"
                    name="serverLocation"
                    checked={location === 'local'}
                    onChange={() => setLocation('local')}
                  />
                  <span>LOCAL</span>
                </label>
                <label>
                  <input
                    type="radio"
                    className="nes-radio is-dark"
                    name="serverLocation"
                    checked={location === 'remote'}
                    onChange={() => setLocation('remote')}
                  />
                  <span>REMOTE</span>
                </label>
              </div>
            </div>

            {/* Step 2: For LOCAL - choose edge/backend */}
            {isLocal && (
              <div className="form-group">
                <label className="form-label">SERVER TYPE</label>
                <div style={{ display: 'flex', gap: '40px', marginBottom: '20px' }}>
                  <label>
                    <input
                      type="radio"
                      className="nes-radio is-dark"
                      name="serverType"
                      checked={serverType === 'edge'}
                      onChange={() => setServerType('edge')}
                    />
                    <span>EDGE (:{3400})</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      className="nes-radio is-dark"
                      name="serverType"
                      checked={serverType === 'backend'}
                      onChange={() => setServerType('backend')}
                    />
                    <span>BACKEND (:{45000})</span>
                  </label>
                </div>
              </div>
            )}

            {/* API URL & TOKEN (remote only - local is auto-configured) */}
            {!isLocal && (
              <>
                <div className="form-group">
                  <label className="form-label">API URL</label>
                  <input
                    type="url"
                    className="nes-input is-dark"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="https://your-server.com/api/v1"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">API TOKEN</label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={!showToken ? 'password' : 'text'}
                      className="nes-input is-dark"
                      value={apiToken}
                      onChange={(e) => setApiToken(e.target.value)}
                      placeholder="Enter your API token"
                      required
                      style={{ paddingRight: '50px' }}
                    />
                    <button
                      type="button"
                      className="nes-btn is-primary"
                      onClick={() => setShowToken(!showToken)}
                      style={{
                        position: 'absolute',
                        right: '4px',
                        padding: '4px 8px',
                        height: '38px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title={showToken ? 'Hide Token' : 'Show Token'}
                    >
                      <i
                        className={`nes-icon is-small ${showToken ? 'close' : 'eye'}`}
                        style={{ transform: 'scale(1.2)' }}
                      ></i>
                    </button>
                  </div>
                </div>

                <div className="checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      className="nes-checkbox is-dark"
                      checked={rememberToken}
                      onChange={(e) => setRememberToken(e.target.checked)}
                    />
                    <span className="checkbox-label">REMEMBER TOKEN</span>
                  </label>
                </div>
              </>
            )}

            <hr className="nes-hr" style={{ margin: '25px 0' }} />

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">APP NAME</label>
                <input
                  type="text"
                  className="nes-input is-dark"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="my-app"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">ENVIRONMENT</label>
                <input
                  type="text"
                  className="nes-input is-dark"
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  placeholder="development"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">USER ID (CONTEXT)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="nes-input is-dark"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="user-abc123"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="nes-btn is-warning"
                  onClick={() => setUserId(generateRandomUserId())}
                  title="Generate random User ID"
                  style={{ fontSize: '10px', whiteSpace: 'nowrap' }}
                >
                  🎲 RANDOM
                </button>
              </div>
            </div>

            <hr className="nes-hr" style={{ margin: '25px 0' }} />

            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  className="nes-checkbox is-dark"
                  checked={offlineMode}
                  onChange={(e) => setOfflineMode(e.target.checked)}
                />
                <span className="checkbox-label">OFFLINE MODE</span>
              </label>
            </div>

            <div className={`form-group ${offlineMode ? 'is-disabled-section' : ''}`}>
              <label className="form-label" style={{ opacity: offlineMode ? 0.5 : 1 }}>
                POLLING INTERVAL (SEC)
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <input
                  type="number"
                  className={`nes-input is-dark ${manualPolling || offlineMode ? 'is-disabled' : ''}`}
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  disabled={manualPolling || offlineMode}
                  style={{ flex: 1 }}
                />
                <label style={{ marginBottom: 0, opacity: offlineMode ? 0.5 : 1 }}>
                  <input
                    type="checkbox"
                    className="nes-checkbox is-dark"
                    checked={manualPolling && !offlineMode}
                    onChange={(e) => handleManualPollingChange(e.target.checked)}
                    disabled={offlineMode}
                  />
                  <span className="checkbox-label">MANUAL</span>
                </label>
              </div>
            </div>

            <div className="checkbox-group" style={{ opacity: offlineMode ? 0.5 : 1 }}>
              <label>
                <input
                  type="checkbox"
                  className="nes-checkbox is-dark"
                  checked={explicitSyncMode && !offlineMode}
                  onChange={(e) => setExplicitSyncMode(e.target.checked)}
                  disabled={offlineMode}
                />
                <span className="checkbox-label">EXPLICIT SYNC</span>
              </label>
            </div>

            <button
              type="submit"
              className="nes-btn is-success rumble-on-click"
              style={{ width: '100%' }}
            >
              START GAME
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ConfigForm;
