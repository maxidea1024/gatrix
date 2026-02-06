import { useState, useCallback } from 'react';
import { GatrixProvider, type GatrixClientConfig } from '@gatrix/react-sdk';
import Dashboard from './components/Dashboard';
import ConfigForm from './components/ConfigForm';
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

    const handleConnect = useCallback((newConfig: GatrixClientConfig) => {
        localStorage.setItem('gatrix-dashboard-config', JSON.stringify(newConfig));
        setConfig(newConfig);
    }, []);

    const handleDisconnect = useCallback(() => {
        localStorage.removeItem('gatrix-dashboard-config');
        setConfig(null);
    }, []);

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
                            <h1>🚀 Gatrix Feature Flags Dashboard</h1>
                            <button className="btn btn-secondary" onClick={handleDisconnect}>
                                Disconnect
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
