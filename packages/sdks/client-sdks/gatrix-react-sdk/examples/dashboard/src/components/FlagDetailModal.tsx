import type { EvaluatedFlag } from '@gatrix/react-sdk';

interface FlagDetailModalProps {
  flag: EvaluatedFlag;
  onClose: () => void;
}

function FlagDetailModal({ flag, onClose }: FlagDetailModalProps) {
  const payload = flag.variant?.payload;
  const hasPayload = payload !== undefined && payload !== null;
  const isEmptyString = payload === '';

  const formatPayload = (p: unknown): string => {
    try {
      if (typeof p === 'object') {
        return JSON.stringify(p, null, 2);
      }
      return String(p);
    } catch {
      return String(p);
    }
  };

  const getPayloadSize = (p: unknown): number => {
    if (p === undefined || p === null) return 0;
    const str = typeof p === 'object' ? JSON.stringify(p) : String(p);
    return new Blob([str]).size;
  };

  const payloadSize = hasPayload ? getPayloadSize(payload) : 0;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 5000 }}>
      <div
        className={`modal-content flag-card-inner rumble-on-pop ${flag.enabled ? 'is-enabled' : 'is-disabled'}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '700px',
          width: '90%',
          maxHeight: '70vh',
          padding: '0 !important',
          overflow: 'hidden',
          backgroundColor: '#fff',
          boxShadow: '0 0 40px rgba(0,0,0,0.5)',
          cursor: 'default',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div className="flag-header" style={{ margin: '0', padding: '8px 16px' }}>
          <span className="flag-name" style={{ fontSize: '12px' }}>
            <span className="status-dot" style={{ width: '10px', height: '10px' }}></span>{' '}
            {flag.name}
          </span>
          <span
            className={`badge ${flag.enabled ? 'badge-success' : 'badge-error'}`}
            style={{ fontSize: '9px' }}
          >
            {flag.enabled ? 'ON' : 'OFF'}
          </span>
        </div>

        <div
          className="modal-scroll-area"
          style={{ padding: '12px', margin: '0', flex: 1, overflowY: 'auto' }}
        >
          <div className="flag-details">
            <div
              className="detail-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '12px',
                borderBottom: '4px solid #eee',
                paddingBottom: '12px',
              }}
            >
              <div
                className="flag-detail"
                style={{
                  margin: '0',
                  border: 'none',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '4px',
                }}
              >
                <span className="flag-detail-label">Version</span>
                <span className="flag-detail-value">{flag.version || 0}</span>
              </div>

              <div
                className="flag-detail"
                style={{
                  margin: '0',
                  border: 'none',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '4px',
                }}
              >
                <span className="flag-detail-label">Type</span>
                <span className="flag-detail-value">
                  <span className="pixel-chip type-chip">{flag.variantType || 'none'}</span>
                </span>
              </div>

              <div
                className="flag-detail"
                style={{
                  margin: '0',
                  border: 'none',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: '4px',
                }}
              >
                <span className="flag-detail-label">Variant</span>
                <span className="flag-detail-value">
                  <span className="pixel-chip variant-chip">{flag.variant?.name || '-'}</span>
                </span>
              </div>
            </div>

            <div className="flag-payload" style={{ marginTop: '12px' }}>
              <div className="flag-payload-label" style={{ marginBottom: '6px' }}>
                Payload Detail
              </div>
              {hasPayload ? (
                <>
                  <pre
                    className={`flag-payload-value ${isEmptyString ? 'empty-string' : 'has-payload'}`}
                    style={{
                      maxHeight: '200px',
                      overflow: 'auto',
                      whiteSpace: 'pre-wrap',
                      fontSize: '9px',
                      lineHeight: '1.5',
                      border: '4px solid #ddd',
                      backgroundColor: '#f9f9f9',
                      color: '#1b5e20',
                      padding: '12px',
                      margin: '0',
                    }}
                  >
                    {formatPayload(payload)}
                  </pre>
                  <div
                    className="flag-payload-size"
                    style={{ fontSize: '8px', color: '#888', marginTop: '6px', textAlign: 'right' }}
                  >
                    {payloadSize} BYTES
                  </div>
                </>
              ) : (
                <div className="flag-payload-value no-payload" style={{ padding: '20px' }}>
                  ✕ NO PAYLOAD
                </div>
              )}
            </div>

            {flag.impressionData && (
              <div
                className="flag-detail"
                style={{
                  marginTop: '12px',
                  border: 'none',
                  justifyContent: 'flex-start',
                  gap: '10px',
                }}
              >
                <span className="flag-detail-label">Impressions:</span>
                <span
                  className="pixel-chip"
                  style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', borderColor: '#2e7d32' }}
                >
                  ENABLED
                </span>
              </div>
            )}
          </div>
        </div>

        <div
          className="modal-footer"
          style={{
            padding: '8px 16px',
            borderTop: '4px solid #eee',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: '#f5f5f5',
          }}
        >
          <button
            type="button"
            className="nes-btn is-primary"
            onClick={onClose}
            style={{ fontSize: '9px', padding: '6px 12px' }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}

export default FlagDetailModal;
