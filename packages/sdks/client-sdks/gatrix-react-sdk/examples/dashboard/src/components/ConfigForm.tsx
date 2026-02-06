import { useState, useEffect } from 'react';
import type { GatrixClientConfig } from '@gatrix/react-sdk';

interface ConfigFormProps {
  onConnect: (config: GatrixClientConfig) => void;
}

const DEV_TOKEN = 'gatrix-unsecured-client-api-token';
const STORAGE_KEY_TOKEN = 'gatrix-dashboard-last-token';
const STORAGE_KEY_USE_DEV = 'gatrix-dashboard-use-dev-token';
const STORAGE_KEY_REMEMBER = 'gatrix-dashboard-remember-token';
const STORAGE_KEY_API_URL = 'gatrix-dashboard-api-url';
const STORAGE_KEY_APP_NAME = 'gatrix-dashboard-app-name';
const STORAGE_KEY_ENVIRONMENT = 'gatrix-dashboard-environment';

function ConfigForm({ onConnect }: ConfigFormProps) {
  const [apiUrl, setApiUrl] = useState('http://localhost:45000/api/v1');
  const [apiToken, setApiToken] = useState('');
  const [appName, setAppName] = useState('my-app');
  const [environment, setEnvironment] = useState('development');
  const [useDevToken, setUseDevToken] = useState(false);
  const [rememberToken, setRememberToken] = useState(false);

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
    if (savedAppName) setAppName(savedAppName);
    if (savedEnvironment) setEnvironment(savedEnvironment);

    setUseDevToken(savedUseDevToken);
    setRememberToken(savedRememberToken);

    if (savedUseDevToken) {
      setApiToken(DEV_TOKEN);
    } else if (savedRememberToken && savedToken) {
      setApiToken(savedToken);
    }
  }, []);

  // Update token when useDevToken changes
  useEffect(() => {
    if (useDevToken) {
      setApiToken(DEV_TOKEN);
    } else {
      // Restore saved token if remember is enabled
      const savedToken = localStorage.getItem(STORAGE_KEY_TOKEN) || '';
      if (rememberToken && savedToken && savedToken !== DEV_TOKEN) {
        setApiToken(savedToken);
      } else if (apiToken === DEV_TOKEN) {
        setApiToken('');
      }
    }
  }, [useDevToken]);

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

    // Save token if remember is enabled
    if (rememberToken && apiToken !== DEV_TOKEN) {
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
      return '****************************';
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
              <label className="form-label">API URL</label>
              <input
                type="url"
                className="nes-input is-dark"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:45000/api/v1"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">API TOKEN</label>
              <input
                type={useDevToken ? 'password' : 'text'}
                className="nes-input is-dark"
                value={getDisplayToken()}
                onChange={(e) => !useDevToken && setApiToken(e.target.value)}
                placeholder="Enter your API token"
                required
                readOnly={useDevToken}
                style={{ opacity: useDevToken ? 0.7 : 1 }}
              />
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
