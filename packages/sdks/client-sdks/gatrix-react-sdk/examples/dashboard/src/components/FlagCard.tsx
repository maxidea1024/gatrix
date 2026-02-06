import type { EvaluatedFlag } from '@gatrix/react-sdk';

interface FlagCardProps {
  flag: EvaluatedFlag;
}

function FlagCard({ flag }: FlagCardProps) {
  const payload = flag.variant?.payload;
  const hasPayload = payload !== undefined && payload !== null;
  const isEmptyString = payload === '';

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

  return (
    <div className="flag-card">
      <div
        className="nes-container is-rounded flag-card-inner"
        style={{
          borderColor: flag.enabled ? '#92cc41' : '#e76e55',
          backgroundColor: flag.enabled ? 'rgba(146, 204, 65, 0.1)' : 'rgba(231, 110, 85, 0.1)',
        }}
      >
        <div className="flag-header">
          <span className="flag-name">
            {flag.enabled ? '🟢' : '🔴'} {flag.name}
          </span>
          <span className={`badge ${flag.enabled ? 'badge-success' : 'badge-error'}`}>
            {flag.enabled ? 'ON' : 'OFF'}
          </span>
        </div>

        <div className="flag-details">
          <div className="flag-detail">
            <span className="flag-detail-label">Variant</span>
            <span className="flag-detail-value">{flag.variant?.name || '-'}</span>
          </div>

          <div className="flag-detail">
            <span className="flag-detail-label">Type</span>
            <span className="flag-detail-value">{flag.variantType || 'none'}</span>
          </div>

          <div className="flag-detail">
            <span className="flag-detail-label">Version</span>
            <span className="flag-detail-value">{flag.version || 0}</span>
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
