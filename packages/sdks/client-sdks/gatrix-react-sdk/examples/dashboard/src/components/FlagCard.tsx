import { useState, useEffect, useRef } from 'react';
import type { EvaluatedFlag } from '@gatrix/react-sdk';

interface FlagCardProps {
  flag: EvaluatedFlag;
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

function FlagCard({ flag, initialVersion, lastChangedTime, onSelect }: FlagCardProps) {
  const payload = flag.variant?.payload;
  const hasPayload = payload !== undefined && payload !== null;
  const isEmptyString = payload === '';
  const [isRumbling, setIsRumbling] = useState(false);
  const [timeAgo, setTimeAgo] = useState(formatTimeAgo(lastChangedTime));
  const prevVersionRef = useRef(flag.version);

  // Detect flag changes and trigger rumble
  useEffect(() => {
    if (prevVersionRef.current !== undefined && prevVersionRef.current !== flag.version) {
      setIsRumbling(true);
      const timeout = setTimeout(() => setIsRumbling(false), 500);
      return () => clearTimeout(timeout);
    }
    prevVersionRef.current = flag.version;
  }, [flag.version]);

  // Update time ago every second
  useEffect(() => {
    setTimeAgo(formatTimeAgo(lastChangedTime));
    const interval = setInterval(() => {
      setTimeAgo(formatTimeAgo(lastChangedTime));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastChangedTime]);

  const formatPayload = (p: unknown): string => {
    if (p === '') return 'EMPTY STRING';
    if (typeof p === 'object') {
      const str = JSON.stringify(p, null, 2);
      return str.length > 80 ? str.substring(0, 77) + '...' : str;
    }
    return String(p);
  };

  const getPayloadSize = (p: unknown): number => {
    if (p === undefined || p === null) return 0;
    const str = typeof p === 'object' ? JSON.stringify(p) : String(p);
    return new Blob([str]).size;
  };

  const payloadSize = hasPayload ? getPayloadSize(payload) : 0;

  // Calculate change count from initial version
  const changeCount =
    initialVersion !== null ? Math.max(0, (flag.version || 0) - initialVersion) : 0;

  return (
    <div
      className={`flag-card ${isRumbling ? 'flag-card-rumble' : ''}`}
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
              <span className="pixel-chip type-chip">{flag.variantType || 'none'}</span>
            </span>
          </div>

          <div className="flag-detail">
            <span className="flag-detail-label">Variant</span>
            <span className="flag-detail-value">
              <span className="pixel-chip variant-chip">{flag.variant?.name || '-'}</span>
            </span>
          </div>


          <div className="flag-payload">
            <div className="flag-payload-label">Payload</div>
            {hasPayload ? (
              <>
                <div
                  className={`flag-payload-value ${isEmptyString ? 'empty-string' : 'has-payload'}`}
                >
                  {formatPayload(payload)}
                </div>
                <div className="flag-payload-size">{payloadSize} BYTES</div>
              </>
            ) : (
              <div className="flag-payload-value no-payload">✕ NO PAYLOAD</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


export default FlagCard;
