import { useFlags, useFlagsStatus, useGatrixClient, type GatrixClientConfig } from '@gatrix/react-sdk';
import { useEffect, useState } from 'react';
import FlagCard from './FlagCard';
import StatsPanel from './StatsPanel';

interface DashboardProps {
    config: GatrixClientConfig;
}

function Dashboard({ config }: DashboardProps) {
    const flags = useFlags();
    const { flagsReady, flagsError } = useFlagsStatus();
    const client = useGatrixClient();
    const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

    useEffect(() => {
        const handleUpdate = () => {
            setLastUpdate(new Date());
        };

        client.on('flags.update', handleUpdate);
        client.on('flags.ready', handleUpdate);

        return () => {
            client.off('flags.update', handleUpdate);
            client.off('flags.ready', handleUpdate);
        };
    }, [client]);

    if (flagsError) {
        return (
            <div className="error-box">
                <div className="error-title">❌ Connection Error</div>
                <div className="error-message">
                    {flagsError.message || 'Failed to connect to Gatrix server'}
                </div>
            </div>
        );
    }

    if (!flagsReady) {
        return (
            <div className="loading-container">
                <div className="loading-content">
                    <div className="loading-icon">⏳</div>
                    <div className="loading-text">Connecting to Gatrix...</div>
                </div>
            </div>
        );
    }

    const enabledCount = flags.filter((f) => f.enabled).length;
    const disabledCount = flags.filter((f) => !f.enabled).length;

    return (
        <div>
            <StatsPanel
                config={config}
                enabledCount={enabledCount}
                disabledCount={disabledCount}
                totalCount={flags.length}
                lastUpdate={lastUpdate}
            />

            <h2 className="section-title">Feature Flags ({flags.length})</h2>

            {flags.length === 0 ? (
                <div className="empty-state">
                    <span>No feature flags found</span>
                </div>
            ) : (
                <div className="flags-grid">
                    {flags.map((flag) => (
                        <FlagCard key={flag.name} flag={flag} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default Dashboard;
