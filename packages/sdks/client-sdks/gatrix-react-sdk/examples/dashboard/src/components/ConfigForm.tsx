import { useState, useEffect } from 'react';
import type { GatrixClientConfig } from '@gatrix/react-sdk';

interface ConfigFormProps {
  onConnect: (config: GatrixClientConfig) => void;
}

const DEV_TOKEN_ALL = 'gatrix-unsecured-edge-api-token';
const DEV_TOKEN_CLIENT = 'gatrix-unsecured-client-api-token';
const STORAGE_KEY_TOKEN = 'gatrix-dashboard-last-token';
const STORAGE_KEY_USE_DEV = 'gatrix-dashboard-use-dev-token';
const STORAGE_KEY_REMEMBER = 'gatrix-dashboard-remember-token';
const STORAGE_KEY_API_URL = 'gatrix-dashboard-api-url';
const STORAGE_KEY_APP_NAME = 'gatrix-dashboard-app-name';
const STORAGE_KEY_ENVIRONMENT = 'gatrix-dashboard-environment';
const STORAGE_KEY_SERVER_TYPE = 'gatrix-dashboard-server-type';

function ConfigForm({ onConnect }: ConfigFormProps) {
  const [serverType, setServerType] = useState<'edge' | 'backend'>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SERVER_TYPE);
    return (saved as 'edge' | 'backend') || 'edge';
  });
  const [apiUrl, setApiUrl] = useState('http://localhost:45000/api/v1');
  const [apiToken, setApiToken] = useState('');
  const [appName, setAppName] = useState('my-app');
  const [environment, setEnvironment] = useState('development');
  const [useDevToken, setUseDevToken] = useState(false);
  const [rememberToken, setRememberToken] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Load saved preferences on mount
  useEffect(() => {
    const savedUseDevToken = localStorage.getItem(STORAGE_KEY_USE_DEV) === 'true';
    const savedRememberToken = localStorage.getItem(STORAGE_KEY_REMEMBER) === 'true';
    const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN) || '';
    const savedApiUrl = localStorage.getItem(STORAGE_KEY_API_URL);
    const savedAppName = localStorage.getItem(STORAGE_KEY_APP_NAME);
    const savedEnvironment = localStorage.getItem(STORAGE_KEY_ENVIRONMENT);

    // Restore saved form values
    if (savedApiUrl) setApiUrl(savedApiUrl);
    else {
      // Set default based on server type if no saved URL
      setApiUrl(serverType === 'edge' ? 'http://localhost:45000/api/v1' : 'http://localhost:5000/api/v1');
    }

    if (savedAppName) setAppName(savedAppName);
    if (savedEnvironment) setEnvironment(savedEnvironment);

    setUseDevToken(savedUseDevToken);
    setRememberToken(savedRememberToken);

    if (savedUseDevToken) {
      setApiToken(serverType === 'edge' ? DEV_TOKEN_ALL : DEV_TOKEN_CLIENT);
    } else if (savedRememberToken && savedToken) {
      setApiToken(savedToken);
    }
  }, []);

  // Update token and URL when serverType or useDevToken changes
  useEffect(() => {
    // If no saved URL, update to default for the server type
    const savedApiUrl = localStorage.getItem(STORAGE_KEY_API_URL);
    if (!savedApiUrl) {
      setApiUrl(serverType === 'edge' ? 'http://localhost:45000/api/v1' : 'http://localhost:5000/api/v1');
    }

    if (useDevToken) {
      setApiToken(serverType === 'edge' ? DEV_TOKEN_ALL : DEV_TOKEN_CLIENT);
    } else {
      // Restore saved token if remember is enabled
      const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN) || '';
      const isDevToken = savedToken === DEV_TOKEN_ALL || savedToken === DEV_TOKEN_CLIENT;

      if (rememberToken && savedToken && !isDevToken) {
        setApiToken(savedToken);
      } else if (apiToken === DEV_TOKEN_ALL || apiToken === DEV_TOKEN_CLIENT) {
        setApiToken('');
      }
    }

    localStorage.setItem(STORAGE_KEY_SERVER_TYPE, serverType);
  }, [serverType, useDevToken]);

  const handleUseDevTokenChange = (checked: boolean) => {
    setUseDevToken(checked);
    localStorage.setItem(STORAGE_KEY_USE_DEV, String(checked));
    if (checked) {
      setRememberToken(false);
      localStorage.setItem(STORAGE_KEY_REMEMBER, 'false');
    }
  };

  const handleRememberTokenChange = (checked: boolean) => {
    setRememberToken(checked);
    localStorage.setItem(STORAGE_KEY_REMEMBER, String(checked));
    if (checked) {
      setUseDevToken(false);
      localStorage.setItem(STORAGE_KEY_USE_DEV, 'false');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Save all form values for next session
    localStorage.setItem(STORAGE_KEY_API_URL, apiUrl);
    localStorage.setItem(STORAGE_KEY_APP_NAME, appName);
    localStorage.setItem(STORAGE_KEY_ENVIRONMENT, environment);
    localStorage.setItem(STORAGE_KEY_SERVER_TYPE, serverType);

    // Save token if remember is enabled
    const isDevToken = apiToken === DEV_TOKEN_ALL || apiToken === DEV_TOKEN_CLIENT;
    if (rememberToken && !isDevToken) {
      localStorage.setItem(STORAGE_KEY_TOKEN, apiToken);
    }

    onConnect({
      apiUrl,
      apiToken,
      appName,
      environment,
    });
  };

  // Mask token for display
  const getDisplayToken = (): string => {
    if (useDevToken) {
      return serverType === 'edge' ? DEV_TOKEN_ALL : DEV_TOKEN_CLIENT;
    }
    return apiToken;
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="nes-container is-dark with-title">
          <p className="title" style={{ backgroundColor: '#000' }}>
            <i className="nes-icon coin is-small"></i> CONNECT TO GATRIX
          </p>

          <form onSubmit={handleSubmit}>
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
                  <span>EDGE</span>
                </label>
                <label>
                  <input
                    type="radio"
                    className="nes-radio is-dark"
                    name="serverType"
                    checked={serverType === 'backend'}
                    onChange={() => setServerType('backend')}
                  />
                  <span>BACKEND</span>
                </label>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">API URL</label>
              <input
                type="url"
                className="nes-input is-dark"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder={serverType === 'edge' ? "http://localhost:45000/api/v1" : "http://localhost:5000/api/v1"}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">API TOKEN</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={!showToken ? 'password' : 'text'}
                  className="nes-input is-dark"
                  value={getDisplayToken()}
                  onChange={(e) => !useDevToken && setApiToken(e.target.value)}
                  placeholder="Enter your API token"
                  required
                  readOnly={useDevToken}
                  style={{ opacity: useDevToken ? 0.7 : 1, paddingRight: '50px' }}
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
                    justifyContent: 'center'
                  }}
                  title={showToken ? "Hide Token" : "Show Token"}
                >
                  <i className={`nes-icon is-small ${showToken ? 'close' : 'eye'}`} style={{ transform: 'scale(1.2)' }}></i>
                </button>
              </div>
            </div>

            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  className="nes-checkbox is-dark"
                  checked={useDevToken}
                  onChange={(e) => handleUseDevTokenChange(e.target.checked)}
                />
                <span className="checkbox-label">
                  &nbsp;<i className="nes-icon trophy is-small"></i> USE DEV TOKEN (unsecured)
                </span>
              </label>
            </div>

            <div className="checkbox-group">
              <label>
                <input
                  type="checkbox"
                  className="nes-checkbox is-dark"
                  checked={rememberToken}
                  onChange={(e) => handleRememberTokenChange(e.target.checked)}
                  disabled={useDevToken}
                />
                <span className="checkbox-label" style={{ opacity: useDevToken ? 0.5 : 1 }}>
                  &nbsp;<i className="nes-icon heart is-small"></i> REMEMBER LAST TOKEN
                </span>
              </label>
            </div>

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

            <button type="submit" className="nes-btn is-success" style={{ width: '100%' }}>
              <i className="nes-icon is-small star"></i>
              &nbsp;START GAME
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ConfigForm;
