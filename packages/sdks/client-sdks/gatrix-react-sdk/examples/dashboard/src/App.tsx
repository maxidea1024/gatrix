import { useState, useCallback } from 'react';
import { GatrixProvider, type GatrixClientConfig } from '@gatrix/react-sdk';
import Dashboard from './components/Dashboard';
import ConfigForm from './components/ConfigForm';
import BootScreen from './components/BootScreen';
import './styles.css';

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

  const handleConnect = useCallback((newConfig: GatrixClientConfig) => {
    localStorage.setItem('gatrix-dashboard-config', JSON.stringify(newConfig));
    setConfig(newConfig);
    setIsBooting(true);
    setBootComplete(false);
  }, []);

  const handleBootComplete = useCallback(() => {
    setIsBooting(false);
    setBootComplete(true);
  }, []);

  const handleDisconnect = useCallback(() => {
    localStorage.removeItem('gatrix-dashboard-config');
    setConfig(null);
    setIsBooting(false);
    setBootComplete(false);
  }, []);

  // Show boot screen
  if (config && isBooting && !bootComplete) {
    return <BootScreen onComplete={handleBootComplete} />;
  }

  return (
    <div className="app">
      {!config ? (
        <div className="center-container">
          <ConfigForm onConnect={handleConnect} />
        </div>
      ) : (
        <GatrixProvider
          config={{
            ...config,
            features: {
              refreshInterval: 2,
            },
          }}
        >
          <div className="dashboard-container">
            <header className="header">
              <h1 className="header-title">
                <i className="nes-icon trophy is-small"></i>
                &nbsp;GATRIX FEATURE FLAGS
              </h1>
              <button type="button" className="nes-btn is-error" onClick={handleDisconnect}>
                DISCONNECT
              </button>
            </header>
            <Dashboard config={config} />
          </div>
        </GatrixProvider>
      )}
    </div>
  );
}

export default App;
