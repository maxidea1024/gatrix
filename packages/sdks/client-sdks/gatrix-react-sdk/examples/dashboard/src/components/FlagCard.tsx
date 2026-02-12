import { useState, useEffect, useRef } from 'react';
import { useGatrixClient, type EvaluatedFlag } from '@gatrix/react-sdk';

interface FlagCardProps {
  flag: EvaluatedFlag;
  viewMode: 'detailed' | 'simple' | 'list';
  initialVersion: number | null;
  lastChangedTime: Date | null;
  onSelect: () => void;
}

function formatTimeAgo(date: Date | null): string {
  if (!date) return '-';
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour > 0) {
    return `${diffHour}h ago`;
  } else if (diffMin > 0) {
    return `${diffMin}m ago`;
  } else if (diffSec > 5) {
    return `${diffSec}s ago`;
  }
  return 'just now';
}

function FlagCard({ flag, viewMode, initialVersion, lastChangedTime, onSelect }: FlagCardProps) {
  const value = flag.variant?.value;
  const hasValue = value !== undefined && value !== null;
  const isEmptyString = value === '';
  const [isUpdating, setIsUpdating] = useState(false);
  const [timeAgo, setTimeAgo] = useState(formatTimeAgo(lastChangedTime));
  const prevVersionRef = useRef(flag.version);
  const client = useGatrixClient();

  // Register flag access for metrics when card mounts or version changes
  useEffect(() => {
    client.features.isEnabled(flag.name);
  }, [client, flag.name, flag.version]);

  // Detect flag changes and trigger flash
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      prevVersionRef.current = flag.version;
      return;
    }
    if (prevVersionRef.current !== flag.version) {
      prevVersionRef.current = flag.version;
      setIsUpdating(true);
      const timeout = setTimeout(() => setIsUpdating(false), 500);
      return () => clearTimeout(timeout);
    }
  }, [flag.version]);

  // Update time ago every second
  useEffect(() => {
    setTimeAgo(formatTimeAgo(lastChangedTime));
    const interval = setInterval(() => {
      setTimeAgo(formatTimeAgo(lastChangedTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastChangedTime]);

  const formatValue = (p: unknown): string => {
    if (p === '') return 'EMPTY STRING';
    if (typeof p === 'object') {
      const str = JSON.stringify(p, null, 2);
      return str.length > 80 ? str.substring(0, 77) + '...' : str;
    }
    return String(p);
  };

  const getValueSize = (p: unknown): number => {
    if (p === undefined || p === null) return 0;
    const str = typeof p === 'object' ? JSON.stringify(p) : String(p);
    return new Blob([str]).size;
  };

  const valueSize = hasValue ? getValueSize(value) : 0;

  // Calculate change count from initial version
  const changeCount =
    initialVersion !== null ? Math.max(0, (flag.version || 0) - initialVersion) : 0;

  if (viewMode === 'list') {
    return (
      <div
        className={`flag-list-item ${isUpdating ? 'flag-card-flash' : ''} ${flag.enabled ? 'is-enabled' : 'is-disabled'}`}
        onClick={onSelect}
      >
        <div className="col-name">
          <span className="status-dot"></span>
          {flag.name}
        </div>
        <div className="col-status">
          <span className={`badge is-small ${flag.enabled ? 'badge-success' : 'badge-error'}`}>
            {flag.enabled ? 'ON' : 'OFF'}
          </span>
        </div>
        <div className="col-version">{flag.version || 0}</div>
        <div className="col-changes">
          {changeCount > 0 ? <span className="has-changes">+{changeCount}</span> : '-'}
        </div>
        <div className="col-time">{timeAgo}</div>
        <div className="col-type">
          <span className="pixel-chip type-chip is-mini">{flag.valueType || 'none'}</span>
        </div>
        <div className="col-variant">
          <span className="pixel-chip variant-chip is-mini">{flag.variant?.name || '-'}</span>
        </div>
        <div className="col-payload">
          <span className="payload-preview">{hasValue ? formatValue(value) : '-'}</span>
        </div>
      </div>
    );
  }

  if (viewMode === 'simple') {
    return (
      <div
        className={`flag-card simple-mode ${isUpdating ? 'flag-card-flash' : ''}`}
        onClick={onSelect}
        title={flag.name}
      >
        <div className={`flag-card-inner ${flag.enabled ? 'is-enabled' : 'is-disabled'}`}>
          <div className="flag-header">
            <span className="flag-name" style={{ fontSize: '10px' }}>
              <span className="status-dot"></span> {flag.name}
            </span>
            <span className="pixel-chip type-chip is-mini" style={{ fontSize: '6px' }}>
              {flag.valueType || 'none'}
            </span>
          </div>
          <div className="flag-details" style={{ marginTop: 0 }}>
            <div
              className="flag-detail"
              style={{ paddingBottom: 0, marginBottom: 0, borderBottom: 'none' }}
            >
              <span
                className="pixel-chip variant-chip is-mini"
                style={{
                  fontSize: '8px',
                  width: '100%',
                  textAlign: 'center',
                  color: '#000',
                  fontWeight: 'bold',
                }}
              >
                {flag.variant?.name || '-'}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flag-card ${isUpdating ? 'flag-card-flash' : ''}`}
      onClick={onSelect}
      style={{ cursor: 'pointer' }}
    >
      <div className={`flag-card-inner ${flag.enabled ? 'is-enabled' : 'is-disabled'}`}>
        <div className="flag-header">
          <span className="flag-name">
            <span className="status-dot"></span> {flag.name}
          </span>
          <span className={`badge ${flag.enabled ? 'badge-success' : 'badge-error'}`}>
            {flag.enabled ? 'ON' : 'OFF'}
          </span>
        </div>

        <div className="flag-details">
          <div className="flag-detail">
            <span className="flag-detail-label">Version</span>
            <span className="flag-detail-value">{flag.version || 0}</span>
          </div>

          <div className="flag-detail">
            <span className="flag-detail-label">Changes</span>
            <span className={`flag-detail-value ${changeCount > 0 ? 'has-changes' : ''}`}>
              {changeCount > 0 ? `+${changeCount}` : '-'}
            </span>
          </div>

          <div className="flag-detail">
            <span className="flag-detail-label">Last Change</span>
            <span className="flag-detail-value">{timeAgo}</span>
          </div>

          <div className="flag-detail">
            <span className="flag-detail-label">Type</span>
            <span className="flag-detail-value">
              <span className="pixel-chip type-chip">{flag.valueType || 'none'}</span>
            </span>
          </div>

          <div className="flag-detail">
            <span className="flag-detail-label">Variant</span>
            <span className="flag-detail-value">
              <span className="pixel-chip variant-chip">{flag.variant?.name || '-'}</span>
            </span>
          </div>

          <div className="flag-payload">
            <div className="flag-payload-label">Value</div>
            {hasValue ? (
              <>
                <div
                  className={`flag-payload-value ${isEmptyString ? 'empty-string' : 'has-payload'}`}
                >
                  {formatValue(value)}
                </div>
                <div className="flag-payload-size">{valueSize} BYTES</div>
              </>
            ) : (
              <div className="flag-payload-value no-payload">✕ NO VALUE</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default FlagCard;
