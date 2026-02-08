import { useState, useCallback } from 'react';
import { GatrixProvider, type GatrixClientConfig } from '@gatrix/react-sdk';
import Dashboard from './components/Dashboard';
import ConfigForm from './components/ConfigForm';
import BootScreen from './components/BootScreen';
import DisconnectScreen from './components/DisconnectScreen';
import ConfirmDialog from './components/ConfirmDialog';
import IdleRPGGame from './components/IdleRPGGame';
import IdleDefenseGame from './components/IdleDefenseGame';
import MatrixBackground from './components/MatrixBackground';
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
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showGame, setShowGame] = useState<false | 'rpg' | 'defense'>(false);

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
            features: {
              metricsIntervalInitial: 1,
              metricsInterval: 5,
              ...config.features,
            },
          }}
        >
          {showGame === 'rpg' ? (
            <IdleRPGGame onExit={() => setShowGame(false)} />
          ) : showGame === 'defense' ? (
            <IdleDefenseGame onExit={() => setShowGame(false)} />
          ) : (
            <div className="dashboard-container">
              <header className="header">
                <h1 className="header-title">
                  <i className="nes-icon trophy is-small"></i>
                  &nbsp;GATRIX FEATURE FLAGS
                </h1>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    type="button"
                    className="nes-btn is-primary"
                    onClick={() => setShowGame('rpg')}
                  >
                    IDLE RPG
                  </button>
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
          )}
        </GatrixProvider>
      )}
    </div>
  );
}

export default App;
