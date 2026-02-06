import type { EvaluatedFlag } from '@gatrix/react-sdk';

interface FlagCardProps {
    flag: EvaluatedFlag;
}

function FlagCard({ flag }: FlagCardProps) {
    const formatPayload = (payload: unknown): string => {
        if (payload === undefined || payload === null) return '-';
        if (typeof payload === 'object') {
            const str = JSON.stringify(payload);
            return str.length > 50 ? str.substring(0, 47) + '...' : str;
        }
        return String(payload);
    };

    return (
        <div className={`flag-card ${flag.enabled ? 'enabled' : 'disabled'}`}>
            <div className="flag-header">
                <span className="flag-name">{flag.name}</span>
                <span className={`flag-badge ${flag.enabled ? 'on' : 'off'}`}>
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

                {flag.variant?.payload !== undefined && (
                    <div className="flag-payload">
                        <div className="flag-payload-label">Payload</div>
                        <div className="flag-payload-value">
                            {formatPayload(flag.variant.payload)}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default FlagCard;
