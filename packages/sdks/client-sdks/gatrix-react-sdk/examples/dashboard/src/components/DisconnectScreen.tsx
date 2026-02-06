import { useState, useEffect } from 'react';

interface DisconnectScreenProps {
    onComplete: () => void;
}

const DISCONNECT_MESSAGES = [
    { text: 'DISCONNECTING FROM GATRIX...', delay: 0 },
    { text: '', delay: 300 },
    { text: 'SAVING SESSION DATA... OK', delay: 500 },
    { text: 'CLOSING CONNECTIONS... OK', delay: 1000 },
    { text: 'CLEARING CACHE... OK', delay: 1500 },
    { text: '', delay: 1800 },
    { text: 'GOODBYE!', delay: 2000 },
];

function DisconnectScreen({ onComplete }: DisconnectScreenProps) {
    const [visibleMessages, setVisibleMessages] = useState<string[]>([]);
    const [progress, setProgress] = useState(0);
    const [showGoodbye, setShowGoodbye] = useState(false);

    useEffect(() => {
        const timers: NodeJS.Timeout[] = [];

        // Show messages progressively
        DISCONNECT_MESSAGES.forEach((msg, index) => {
            const timer = setTimeout(() => {
                setVisibleMessages((prev) => [...prev, msg.text]);
                setProgress(((index + 1) / DISCONNECT_MESSAGES.length) * 100);
            }, msg.delay);
            timers.push(timer);
        });

        // Show goodbye character after last message
        const goodbyeTimer = setTimeout(() => {
            setShowGoodbye(true);
        }, 2200);
        timers.push(goodbyeTimer);

        // Complete 2.5 seconds after goodbye
        const completeTimer = setTimeout(() => {
            onComplete();
        }, 4700); // 2200 + 2500
        timers.push(completeTimer);

        return () => {
            timers.forEach((t) => clearTimeout(t));
        };
    }, [onComplete]);

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                backgroundColor: '#212529',
                color: '#fff',
                fontFamily: '"Press Start 2P", cursive',
                textAlign: 'center',
                padding: '24px',
            }}
        >
            <div style={{ minHeight: '200px', marginBottom: '24px' }}>
                {visibleMessages.map((msg, i) => (
                    <div
                        key={i}
                        style={{
                            fontSize: '10px',
                            marginBottom: '8px',
                            color: msg === 'GOODBYE!' ? '#e76e55' : '#adafbc',
                        }}
                    >
                        {msg || '\u00A0'}
                    </div>
                ))}
                {showGoodbye && (
                    <div
                        style={{
                            marginTop: '16px',
                            animation: 'sad-sway 1s ease-in-out infinite',
                        }}
                    >
                        <i className="nes-bcrikko"></i>
                    </div>
                )}
            </div>
            <div style={{ width: '300px' }}>
                <progress className="nes-progress is-error" value={progress} max="100"></progress>
            </div>
            <div style={{ fontSize: '8px', color: '#e76e55', marginTop: '24px' }}>
                {showGoodbye ? 'SEE YOU SOON...' : 'TERMINATING SESSION...'}
            </div>
        </div>
    );
}

export default DisconnectScreen;
