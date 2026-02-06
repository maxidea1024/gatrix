import type { GatrixClientConfig } from '@gatrix/react-sdk';

interface StatsPanelProps {
    config: GatrixClientConfig;
    enabledCount: number;
    disabledCount: number;
    totalCount: number;
    lastUpdate: Date | null;
}

function StatsPanel({
    config,
    enabledCount,
    disabledCount,
    totalCount,
    lastUpdate,
}: StatsPanelProps) {
    const formatTime = (date: Date | null): string => {
        if (!date) return '-';
        return date.toLocaleTimeString();
    };

    return (
        <div className="stats-panel">
            <div className="stats-content">
                <div className="stats-info">
                    <div className="stats-info-label">API</div>
                    <div className="stats-info-value">{config.apiUrl}</div>
                </div>

                <div className="stats-info">
                    <div className="stats-info-label">App / Env</div>
                    <div className="stats-info-value">
                        {config.appName} / {config.environment}
                    </div>
                </div>

                <div className="stats-numbers">
                    <div className="stat-item">
                        <div className="stat-label">Total</div>
                        <div className="stat-value total">{totalCount}</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-label">Enabled</div>
                        <div className="stat-value enabled">{enabledCount}</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-label">Disabled</div>
                        <div className="stat-value disabled">{disabledCount}</div>
                    </div>
                </div>
            </div>

            <div className="stats-footer">
                <span>Last update: {formatTime(lastUpdate)}</span>
            </div>
        </div>
    );
}

export default StatsPanel;
