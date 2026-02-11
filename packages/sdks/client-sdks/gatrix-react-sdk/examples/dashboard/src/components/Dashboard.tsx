import {
  useFlags,
  useGatrixClient,
  useGatrixContext,
  type GatrixClientConfig,
  type EvaluatedFlag,
} from '@gatrix/react-sdk';
import { useEffect, useState, useRef, useCallback } from 'react';
import FlagCard from './FlagCard';
import StatsPanel from './StatsPanel';
import FlagDetailModal from './FlagDetailModal';

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
  connectionId: string;
  metricsSentCount?: number;
  metricsErrorCount?: number;
}

function Dashboard({ config }: DashboardProps) {
  const rawFlags = useFlags();
  const cachedFlagsRef = useRef(rawFlags);

  // Update cached flags only when we get a non-empty result or initial load
  if (rawFlags.length > 0 || cachedFlagsRef.current.length === 0) {
    cachedFlagsRef.current = rawFlags;
  }
  const flags = cachedFlagsRef.current;
  const { flagsReady, flagsError, isExplicitSyncEnabled, hasPendingSyncFlags, fetchFlags, syncFlags } =
    useGatrixContext();
  const client = useGatrixClient();
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const initialVersionsRef = useRef<Map<string, number>>(new Map());
  const [initialVersions, setInitialVersions] = useState<Map<string, number>>(new Map());
  const [showRecoveryEffect, setShowRecoveryEffect] = useState(false);
  const [showErrorEffect, setShowErrorEffect] = useState(false);
  const prevSdkStateRef = useRef<string | null>(null);
  const [context, setContext] = useState<Record<string, any>>({});
  const [isFetching, setIsFetching] = useState(false);
  const [viewMode, setViewMode] = useState<'detailed' | 'simple' | 'list'>(() => {
    return (localStorage.getItem('gatrix-dashboard-view-mode') as 'detailed' | 'simple' | 'list') || 'simple';
  });
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setSearchQuery(value.toLowerCase());
    }, 300);
  }, []);

  useEffect(() => {
    const updateStats = () => {
      const clientStats = client.getStats();
      // Flatten: merge top-level stats with features stats
      const flatStats = { ...clientStats.features, ...clientStats };
      setStats(flatStats as unknown as Stats);
      if (clientStats.features?.lastFetchTime) {
        setLastUpdate(clientStats.features.lastFetchTime);
      }
      setContext(client.features.getContext());
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

    const handleFetchStart = () => setIsFetching(true);
    const handleFetchEnd = () => setIsFetching(false);

    client.on('flags.change', updateStats);
    client.on('flags.ready', handleReady);
    client.on('flags.sync', updateStats);
    client.on('flags.fetch_start', handleFetchStart);
    client.on('flags.fetch_end', handleFetchEnd);
    client.on('error', updateStats);

    // Update stats periodically
    const interval = setInterval(updateStats, 1000);

    return () => {
      client.off('flags.change', updateStats);
      client.off('flags.ready', handleReady);
      client.off('flags.sync', updateStats);
      client.off('flags.fetch_start', handleFetchStart);
      client.off('flags.fetch_end', handleFetchEnd);
      client.off('error', updateStats);
      clearInterval(interval);
    };
  }, [client]);

  // Detect recovery from error state and entering error state
  useEffect(() => {
    const currentState = stats?.sdkState || null;
    if (
      prevSdkStateRef.current === 'error' &&
      (currentState === 'healthy' || currentState === 'ready')
    ) {
      // Recovery: white shimmer
      setShowRecoveryEffect(true);
      setTimeout(() => setShowRecoveryEffect(false), 1000);
    } else if (
      prevSdkStateRef.current !== 'error' &&
      prevSdkStateRef.current !== null &&
      currentState === 'error'
    ) {
      // Entering error: red shimmer
      setShowErrorEffect(true);
      setTimeout(() => setShowErrorEffect(false), 1000);
    }
    prevSdkStateRef.current = currentState;
  }, [stats?.sdkState]);

  const filteredFlags = searchQuery
    ? flags.filter((f) => f.name.toLowerCase().includes(searchQuery))
    : flags;

  const enabledCount = flags.filter((f) => f.enabled).length;
  const disabledCount = flags.filter((f) => !f.enabled).length;

  // Get error message for display - only show when currently in error state
  const isInErrorState = stats?.sdkState === 'error';
  const errorMessage = isInErrorState
    ? (flagsError?.message || (stats?.lastError as Error)?.message || 'Unknown error')
    : null;

  // Check if we haven't fetched any flags yet (no cached data either)
  const isSearching = !flagsReady && flags.length === 0;

  const [selectedFlag, setSelectedFlag] = useState<EvaluatedFlag | null>(null);

  return (
    <div className={`dashboard-content ${showRecoveryEffect ? 'recovery-shimmer' : ''} ${showErrorEffect ? 'error-shimmer' : ''}`}>
      {selectedFlag && (
        <FlagDetailModal flag={selectedFlag} onClose={() => setSelectedFlag(null)} />
      )}
      <StatsPanel
        config={config}
        enabledCount={enabledCount}
        disabledCount={disabledCount}
        totalCount={flags.length}
        lastUpdate={lastUpdate}
        stats={stats}
        errorMessage={errorMessage}
        context={context}
        flagsReady={flagsReady}
      />

      <section className="flags-section">
        <div className="nes-container is-dark with-title">
          <p className="title" style={{ backgroundColor: '#000' }}>
            FEATURE FLAGS ({filteredFlags.length}{searchQuery ? `/${flags.length}` : ''})
          </p>

          <div
            style={{
              padding: '10px',
              display: 'flex',
              gap: '15px',
              alignItems: 'center',
              marginBottom: '10px',
            }}
          >
            {/* Search input */}
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                className="nes-input is-dark"
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search flags..."
                style={{ width: '100%', fontSize: '12px' }}
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => { setSearchInput(''); setSearchQuery(''); }}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#e76e55',
                    cursor: 'pointer',
                    fontSize: '16px',
                    fontWeight: 'bold',
                    padding: '4px 8px',
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
            {!client.features.isOfflineMode() &&
              client.features.getConfig().refreshInterval === 0 && (
                <button
                  type="button"
                  className={`nes-btn is-primary ${isFetching ? 'is-disabled' : ''}`}
                  onClick={() => fetchFlags()}
                  disabled={isFetching}
                  title="Manual Fetch"
                >
                  {isFetching ? 'FETCHING...' : 'FETCH FLAGS'}
                </button>
              )}

            {isExplicitSyncEnabled() && !client.features.isOfflineMode() && (
              <button
                type="button"
                className={`nes-btn is-warning ${!hasPendingSyncFlags() ? 'is-disabled' : 'sync-available-rumble'}`}
                onClick={() => syncFlags()}
                disabled={!hasPendingSyncFlags()}
                title="Synchronize Flags"
              >
                SYNC FLAGS
              </button>
            )}

            <div className="view-mode-selector nes-select is-dark" style={{ width: '200px' }}>
              <select
                id="view-mode-select"
                value={viewMode}
                onChange={(e) => {
                  const mode = e.target.value as 'detailed' | 'simple' | 'list';
                  localStorage.setItem('gatrix-dashboard-view-mode', mode);
                  setViewMode(mode);
                }}
              >
                <option value="detailed">Detailed Card</option>
                <option value="simple">Simple Card</option>
                <option value="list">List View</option>
              </select>
            </div>
          </div>

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
            <div className={`flags-display-container mode-${viewMode}`}>
              {viewMode === 'list' && (
                <div className="flag-list-header">
                  <div className="col-name">NAME</div>
                  <div className="col-status">STATUS</div>
                  <div className="col-version">VER</div>
                  <div className="col-changes">CHG</div>
                  <div className="col-time">LAST</div>
                  <div className="col-type">TYPE</div>
                  <div className="col-variant">VARIANT</div>
                  <div className="col-payload">PAYLOAD</div>
                </div>
              )}
              <div className={viewMode === 'list' ? 'flag-list' : 'flags-grid'}>
                {filteredFlags.map((flag) => (
                  <FlagCard
                    key={flag.name}
                    flag={flag}
                    viewMode={viewMode}
                    initialVersion={initialVersions.get(flag.name) ?? null}
                    lastChangedTime={stats?.flagLastChangedTimes?.[flag.name] ?? null}
                    onSelect={() => setSelectedFlag(flag)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
