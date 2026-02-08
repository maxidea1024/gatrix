import { useState, useEffect } from 'react';

interface BootScreenProps {
  onComplete: () => void;
}

const BOOT_MESSAGES = [
  { text: 'GATRIX FEATURE FLAGS SYSTEM', delay: 0 },
  { text: 'VERSION 1.0.0', delay: 400 },
  { text: '', delay: 700 },
  { text: 'INITIALIZING MEMORY... OK', delay: 1000 },
  { text: 'CHECKING API CONNECTION... OK', delay: 1600 },
  { text: 'LOADING SDK MODULES... OK', delay: 2200 },
  { text: 'CONFIGURING FEATURE CLIENT...', delay: 2800 },
  { text: 'PREPARING DASHBOARD... OK', delay: 3400 },
  { text: '', delay: 4000 },
  { text: 'SYSTEM READY!', delay: 4500 },
];

const MIN_BOOT_TIME = 6500; // Increased to allow 2s delay after 'SYSTEM READY!'

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
    }, 65);

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
