import { useState } from 'react';
import type { GatrixClientConfig } from '@gatrix/react-sdk';

interface ConfigFormProps {
    onConnect: (config: GatrixClientConfig) => void;
}

function ConfigForm({ onConnect }: ConfigFormProps) {
    const [apiUrl, setApiUrl] = useState('http://localhost:45000/api/v1');
    const [apiToken, setApiToken] = useState('');
    const [appName, setAppName] = useState('my-app');
    const [environment, setEnvironment] = useState('development');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConnect({
            apiUrl,
            apiToken,
            appName,
            environment,
        });
    };

    return (
        <form className="form-card" onSubmit={handleSubmit}>
            <h2 className="form-title">🔌 Connect to Gatrix</h2>

            <div className="form-group">
                <label className="form-label">API URL</label>
                <input
                    type="url"
                    className="form-input"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                    placeholder="http://localhost:45000/api/v1"
                    required
                />
            </div>

            <div className="form-group">
                <label className="form-label">API Token</label>
                <input
                    type="text"
                    className="form-input"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                    placeholder="Enter your API token"
                    required
                />
            </div>

            <div className="form-row">
                <div className="form-group">
                    <label className="form-label">App Name</label>
                    <input
                        type="text"
                        className="form-input"
                        value={appName}
                        onChange={(e) => setAppName(e.target.value)}
                        placeholder="my-app"
                        required
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Environment</label>
                    <input
                        type="text"
                        className="form-input"
                        value={environment}
                        onChange={(e) => setEnvironment(e.target.value)}
                        placeholder="development"
                        required
                    />
                </div>
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                Connect
            </button>
        </form>
    );
}

export default ConfigForm;
