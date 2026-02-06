import {
  useFlags,
  useFlagsStatus,
  useGatrixClient,
  type GatrixClientConfig,
} from '@gatrix/react-sdk';
import { useEffect, useState, useRef } from 'react';
import FlagCard from './FlagCard';
import StatsPanel from './StatsPanel';

interface DashboardProps {
  config: GatrixClientConfig;
}

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
  flagLastChangedTimes: Record<string, Date>;
}

function Dashboard({ config }: DashboardProps) {
  const flags = useFlags();
  const { flagsReady, flagsError } = useFlagsStatus();
  const client = useGatrixClient();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const initialVersionsRef = useRef<Map<string, number>>(new Map());
  const [initialVersions, setInitialVersions] = useState<Map<string, number>>(new Map());
  const [showRecoveryEffect, setShowRecoveryEffect] = useState(false);
  const prevSdkStateRef = useRef<string | null>(null);

  useEffect(() => {
    const updateStats = () => {
      const clientStats = client.features.getStats();
      setStats(clientStats as Stats);
      setLastUpdate(new Date());
    };

    // Capture initial versions on ready
    const handleReady = () => {
      const currentFlags = client.features.getAllFlags();
      const newInitialVersions = new Map<string, number>();
      for (const flag of currentFlags) {
        if (!initialVersionsRef.current.has(flag.name)) {
          newInitialVersions.set(flag.name, flag.version || 0);
        } else {
          newInitialVersions.set(flag.name, initialVersionsRef.current.get(flag.name)!);
        }
      }
      initialVersionsRef.current = newInitialVersions;
      setInitialVersions(newInitialVersions);
      updateStats();
    };

    // Initial stats
    updateStats();

    client.on('flags.update', updateStats);
    client.on('flags.ready', handleReady);
    client.on('error', updateStats);

    // Update stats periodically
    const interval = setInterval(updateStats, 1000);

    return () => {
      client.off('flags.update', updateStats);
      client.off('flags.ready', handleReady);
      client.off('error', updateStats);
      clearInterval(interval);
    };
  }, [client]);

  // Detect recovery from error state
  useEffect(() => {
    const currentState = stats?.sdkState || null;
    if (
      prevSdkStateRef.current === 'error' &&
      (currentState === 'healthy' || currentState === 'ready')
    ) {
      setShowRecoveryEffect(true);
      setTimeout(() => setShowRecoveryEffect(false), 1000);
    }
    prevSdkStateRef.current = currentState;
  }, [stats?.sdkState]);

  const enabledCount = flags.filter((f) => f.enabled).length;
  const disabledCount = flags.filter((f) => !f.enabled).length;

  // Get error message for display - only show if currently in error state
  const isInErrorState = stats?.sdkState === 'error';
  const errorMessage = isInErrorState
    ? flagsError?.message || stats?.lastError?.message || null
    : null;

  // Check if we haven't fetched any flags yet
  const isSearching = !flagsReady && flags.length === 0;

  return (
    <div className={`dashboard-content ${showRecoveryEffect ? 'recovery-shimmer' : ''}`}>
      <StatsPanel
        config={config}
        enabledCount={enabledCount}
        disabledCount={disabledCount}
        totalCount={flags.length}
        lastUpdate={lastUpdate}
        stats={stats}
        errorMessage={errorMessage}
      />

      <section className="flags-section">
        <div className="nes-container is-dark with-title">
          <p className="title" style={{ backgroundColor: '#000' }}>
            FEATURE FLAGS ({flags.length})
          </p>

          {isSearching ? (
            <div className="searching-state">
              <div className="searching-icon">
                <span role="img" aria-label="searching">
                  🔍
                </span>
              </div>
              <p className="searching-text">WHERE ARE MY FLAGS?... COME BACK!</p>
            </div>
          ) : flags.length === 0 ? (
            <div className="empty-state">
              <i className="nes-icon is-large heart is-empty"></i>
              <p className="empty-text">NO FEATURE FLAGS FOUND</p>
            </div>
          ) : (
            <div className="flags-grid">
              {flags.map((flag) => (
                <FlagCard
                  key={flag.name}
                  flag={flag}
                  initialVersion={initialVersions.get(flag.name) ?? null}
                  lastChangedTime={stats?.flagLastChangedTimes?.[flag.name] ?? null}
                />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
