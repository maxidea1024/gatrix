import { useState, useEffect, useRef } from 'react';
import { useGatrixClient, type GatrixClientConfig } from '@gatrix/react-sdk';

interface Stats {
    sdkState: string;
    fetchFlagsCount: number;
    updateCount: number;
    notModifiedCount: number;
    errorCount: number;
    recoveryCount: number;
    impressionCount: number;
    etag: string | null;
    startTime: Date | null;
    lastFetchTime: Date | null;
    lastError: Error | null;
    connectionId?: string;
    metricsSentCount?: number;
    metricsErrorCount?: number;
}

interface StatsPanelProps {
    config: GatrixClientConfig;
    enabledCount: number;
    disabledCount: number;
    totalCount: number;
    lastUpdate: Date | null;
    stats: Stats | null;
    errorMessage: string | null;
    context: Record<string, any>;
}

// Typewriter hook with repeat
function useTypewriter(
    text: string,
    speed: number = 50,
    pauseMs: number = 2000,
): { displayText: string; isTyping: boolean } {
    const [displayText, setDisplayText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [cycle, setCycle] = useState(0);

    useEffect(() => {
        if (!text) {
            setDisplayText('');
            setIsTyping(false);
            return;
        }

        setDisplayText('');
        setIsTyping(true);
        let index = 0;

        const typeInterval = setInterval(() => {
            if (index < text.length) {
                setDisplayText(text.substring(0, index + 1));
                index++;
            } else {
                setIsTyping(false);
                clearInterval(typeInterval);
                setTimeout(() => {
                    setCycle((c) => c + 1);
                }, pauseMs);
            }
        }, speed);

        return () => clearInterval(typeInterval);
    }, [text, speed, pauseMs, cycle]);

    return { displayText, isTyping };
}


function StatsPanel({
    config,
    enabledCount,
    disabledCount,
    totalCount,
    lastUpdate,
    stats,
    errorMessage,
    context,
}: StatsPanelProps) {

    // Track previous counts for rumble effect
    const prevTotalRef = useRef(totalCount);
    const prevEnabledRef = useRef(enabledCount);
    const prevDisabledRef = useRef(disabledCount);
    const [rumbleTotal, setRumbleTotal] = useState(false);
    const [rumbleEnabled, setRumbleEnabled] = useState(false);
    const [rumbleDisabled, setRumbleDisabled] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const client = useGatrixClient();

    // Detect count changes and trigger rumble
    useEffect(() => {
        if (prevTotalRef.current !== totalCount && prevTotalRef.current !== 0) {
            setRumbleTotal(true);
            setTimeout(() => setRumbleTotal(false), 500);
        }
        prevTotalRef.current = totalCount;
    }, [totalCount]);

    useEffect(() => {
        if (prevEnabledRef.current !== enabledCount && prevEnabledRef.current !== 0) {
            setRumbleEnabled(true);
            setTimeout(() => setRumbleEnabled(false), 500);
        }
        prevEnabledRef.current = enabledCount;
    }, [enabledCount]);

    useEffect(() => {
        if (prevDisabledRef.current !== disabledCount && prevDisabledRef.current !== 0) {
            setRumbleDisabled(true);
            setTimeout(() => setRumbleDisabled(false), 500);
        }
        prevDisabledRef.current = disabledCount;
    }, [disabledCount]);

    useEffect(() => {
        const handleFetch = () => {
            setIsScanning(true);
            setTimeout(() => setIsScanning(false), 800);
        };

        client.on('flags.fetch', handleFetch);
        return () => {
            client.off('flags.fetch', handleFetch);
        };
    }, [client]);

    const formatTime = (date: Date | null): string => {
        if (!date) return '--:--:--';
        const h = String(date.getHours()).padStart(2, '0');
        const m = String(date.getMinutes()).padStart(2, '0');
        const s = String(date.getSeconds()).padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    const formatUptime = (startTime: Date | null): string => {
        if (!startTime) return '-';
        const ms = Date.now() - startTime.getTime();
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        return `${seconds}s`;
    };

    const getStatusClass = (state: string): string => {
        if (state === 'healthy' || state === 'ready') return 'status-healthy';
        if (state === 'error') return 'status-error';
        return '';
    };

    const getStatusIcon = (state: string): string => {
        if (state === 'healthy' || state === 'ready') return '●';
        if (state === 'error') return '●';
        return '○';
    };

    const isError = stats?.sdkState === 'error' || errorMessage;

    const formatErrorMessage = (msg: string): string => {
        if (msg.includes('ECONNREFUSED')) return 'Connection refused!';
        if (msg.includes('ETIMEDOUT')) return 'Connection timeout!';
        if (msg.includes('ENOTFOUND')) return 'Host not found!';
        if (msg.includes('fetch')) return 'Network error!';
        if (msg.length > 25) return msg.substring(0, 22) + '...';
        return msg;
    };

    const formattedError = errorMessage ? formatErrorMessage(errorMessage) : '';
    const { displayText, isTyping } = useTypewriter(formattedError, 40, 3000);


    const formatEtag = (etag: string | null): string => {
        if (!etag) return '-';
        return etag.replace(/"/g, '').substring(0, 10) + '...';
    };

    // Render mascot with speech bubble on the left side
    const renderMascotWithBubble = () => {
        const state = stats?.sdkState || 'initializing';

        let mascotIcon;
        if (state === 'error' || errorMessage) {
            mascotIcon = <div className={`mascot-error ${isTyping ? 'mascot-talking' : 'mascot-sad'}`}><i className="nes-bcrikko"></i></div>;
        } else if (state === 'healthy' || state === 'ready') {
            mascotIcon = <div className="mascot-happy"><i className="nes-octocat animate"></i></div>;
        } else {
            mascotIcon = <div className="mascot-waiting"><i className="nes-kirby"></i></div>;
        }

        return (
            <div className="mascot-outer-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                    className={`mascot-container clickable ${isScanning ? 'mascot-scanning' : ''}`}
                    onClick={() => !isScanning && client.features.fetchFlags()}
                    title="Click to Refresh Flags"
                >
                    {mascotIcon}
                </div>
                {(state === 'error' || errorMessage) && formattedError && (
                    <div className="nes-balloon from-left is-dark error-balloon-inline">
                        <p>
                            {displayText}
                            {isTyping && <span className="typewriter-cursor">_</span>}
                        </p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <section className="stats-container">
            <div className={`nes-container is-dark with-title ${isError ? 'is-error-border' : ''}`}>
                <p className="title" style={{ backgroundColor: '#212529' }}>
                    STATUS
                </p>

                <div className="stats-grid-layout">
                    {/* Left: Mascot with bubble */}
                    {renderMascotWithBubble()}

                    {/* Spacer - pushes everything else to the right */}
                    <div className="stats-spacer"></div>

                    {/* Right Group: Flag Counts + Context + Stats */}
                    <div className="stats-right-group" style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                        {/* Flag Counts */}
                        <div className="stats-numbers-compact">
                            <div className={`stat-mini ${rumbleTotal ? 'stat-rumble' : ''}`}>
                                <span className="stat-mini-value total">{totalCount}</span>
                                <span className="stat-mini-label">ALL</span>
                            </div>
                            <div className={`stat-mini ${rumbleEnabled ? 'stat-rumble' : ''}`}>
                                <span className="stat-mini-value enabled">{enabledCount}</span>
                                <span className="stat-mini-label">ON</span>
                            </div>
                            <div className={`stat-mini ${rumbleDisabled ? 'stat-rumble' : ''}`}>
                                <span className="stat-mini-value disabled">{disabledCount}</span>
                                <span className="stat-mini-label">OFF</span>
                            </div>
                        </div>

                        {/* Vertical Separator */}
                        <div className="stats-separator"></div>

                        {/* Context Info */}
                        <div className="stats-context-info">
                            {Object.entries(context || {}).map(([key, value]) => (
                                <div key={key} className="context-item">
                                    <span className="context-key">{key}:</span>
                                    <span className="context-value">{String(value)}</span>
                                </div>
                            ))}
                        </div>

                        {/* Vertical Separator */}
                        <div className="stats-separator"></div>

                        {/* Stats Info */}
                        <div className="stats-info">
                            <table className="stats-table">
                                <tbody>
                                    <tr>
                                        <td className="stats-label">API:</td>
                                        <td className="stats-value" colSpan={5}>
                                            {config.apiUrl}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="stats-label">CONN ID:</td>
                                        <td className="stats-value" colSpan={5}>
                                            {stats?.connectionId || '-'}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="stats-label">APP/ENV:</td>
                                        <td className="stats-value" colSpan={5}>
                                            {config.appName} / {config.environment}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td className="stats-label">STATUS:</td>
                                        <td className={`stats-value ${client.features.isOfflineMode() ? 'status-offline' : getStatusClass(stats?.sdkState || '')}`}>
                                            {client.features.isOfflineMode() ? '○ OFFLINE' : `${getStatusIcon(stats?.sdkState || '')} ${stats?.sdkState || 'init'}`}
                                        </td>
                                        <td className="stats-label">UP:</td>
                                        <td className="stats-value">{formatUptime(stats?.startTime || null)}</td>
                                        <td className="stats-label">SYNC:</td>
                                        <td className="stats-value">{formatTime(lastUpdate)}</td>
                                    </tr>
                                    <tr>
                                        <td className="stats-label">FETCH:</td>
                                        <td className="stats-value">{stats?.fetchFlagsCount || 0}</td>
                                        <td className="stats-label">UPD:</td>
                                        <td className="stats-value">{stats?.updateCount || 0}</td>
                                        <td className="stats-label">304:</td>
                                        <td className="stats-value">{stats?.notModifiedCount || 0}</td>
                                    </tr>
                                    <tr>
                                        <td className="stats-label">ERR:</td>
                                        <td className="stats-value">{stats?.errorCount || 0}</td>
                                        <td className="stats-label">REC:</td>
                                        <td className="stats-value">{stats?.recoveryCount || 0}</td>
                                        <td className="stats-label">ETAG:</td>
                                        <td className="stats-value">{formatEtag(stats?.etag || null)}</td>
                                    </tr>
                                    <tr>
                                        <td className="stats-label">METRIC:</td>
                                        <td className="stats-value">{stats?.metricsSentCount || 0}</td>
                                        <td className="stats-label">M-ERR:</td>
                                        <td className="stats-value">{stats?.metricsErrorCount || 0}</td>
                                        <td className="stats-label">IMP:</td>
                                        <td className="stats-value">{stats?.impressionCount || 0}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default StatsPanel;
