import { useState, useEffect } from 'react';

interface BootScreenProps {
  onComplete: () => void;
}

const BOOT_MESSAGES = [
  { text: 'GATRIX FEATURE FLAGS SYSTEM', delay: 0 },
  { text: 'VERSION 1.0.0', delay: 200 },
  { text: '', delay: 350 },
  { text: 'INITIALIZING MEMORY... OK', delay: 500 },
  { text: 'CHECKING API CONNECTION... OK', delay: 800 },
  { text: 'LOADING SDK MODULES... OK', delay: 1100 },
  { text: 'CONFIGURING FEATURE CLIENT...', delay: 1400 },
  { text: 'PREPARING DASHBOARD... OK', delay: 1700 },
  { text: '', delay: 2000 },
  { text: 'SYSTEM READY!', delay: 2200 },
];

const MIN_BOOT_TIME = 3000; // Reduced from 6500ms to 3000ms

function BootScreen({ onComplete }: BootScreenProps) {
  const [visibleLines, setVisibleLines] = useState<number>(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Show messages one by one
    BOOT_MESSAGES.forEach((msg, index) => {
      setTimeout(() => {
        setVisibleLines(index + 1);
      }, msg.delay);
    });

    // Progress bar animation (adjusted for 6.5 seconds)
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 1;
      });
    }, 30);

    // Complete after minimum boot time
    const completeTimeout = setTimeout(() => {
      onComplete();
    }, MIN_BOOT_TIME);

    return () => {
      clearInterval(progressInterval);
      clearTimeout(completeTimeout);
    };
  }, [onComplete]);

  return (
    <div className="boot-screen">
      <div className="boot-logo">
        <i className="nes-icon trophy is-large"></i>
      </div>

      <div style={{ minHeight: '250px' }}>
        {BOOT_MESSAGES.slice(0, visibleLines).map((msg, index) => (
          <div
            key={index}
            className={`boot-text ${msg.text === '' ? '' : ''}`}
            style={{ animationDelay: `${msg.delay}ms` }}
          >
            {msg.text || '\u00A0'}
            {index === visibleLines - 1 && msg.text && <span className="boot-cursor">_</span>}
          </div>
        ))}
      </div>

      <div className="boot-progress">
        <progress className="nes-progress is-success" value={progress} max="100"></progress>
      </div>

      <div className="boot-text dim" style={{ marginTop: '24px' }}>
        NOW LOADING...
      </div>
    </div>
  );
}

export default BootScreen;
