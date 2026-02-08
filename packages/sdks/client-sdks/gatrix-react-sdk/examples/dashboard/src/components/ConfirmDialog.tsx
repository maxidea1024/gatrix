interface ConfirmDialogProps {
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

function ConfirmDialog({ title, message, onConfirm, onCancel }: ConfirmDialogProps) {
    return (
        <div className="confirm-overlay">
            <div className="nes-container is-dark with-title confirm-dialog">
                <p className="title" style={{ backgroundColor: '#000' }}>
                    {title}
                </p>
                <p className="confirm-message">{message}</p>
                <div className="confirm-buttons">
                    <button type="button" className="nes-btn" onClick={onCancel}>
                        CANCEL
                    </button>
                    <button type="button" className="nes-btn is-error" onClick={onConfirm}>
                        POWER OFF
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmDialog;
