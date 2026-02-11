// Slot Machine Sound Effects - Web Audio API (no external files needed)

export class SlotSounds {
    private ctx: AudioContext | null = null;
    private enabled = true;
    private masterGain: GainNode | null = null;

    init(): void {
        try {
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.4;
            this.masterGain.connect(this.ctx.destination);
        } catch {
            // Web Audio not available
        }
    }

    setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    private ensureContext(): void {
        if (this.ctx?.state === 'suspended') {
            this.ctx.resume();
        }
    }

    private playNote(
        freq: number,
        duration: number,
        type: OscillatorType = 'sine',
        volume = 0.3,
        delay = 0
    ): void {
        if (!this.enabled || !this.ctx || !this.masterGain) return;
        this.ensureContext();

        const startTime = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    private playNoise(duration: number, volume = 0.1, delay = 0): void {
        if (!this.enabled || !this.ctx || !this.masterGain) return;
        this.ensureContext();

        const startTime = this.ctx.currentTime + delay;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / bufferSize);
        }

        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(volume, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        source.connect(gain);
        gain.connect(this.masterGain);
        source.start(startTime);
    }

    // Lever pull / spin start
    spinStart(): void {
        this.playNote(120, 0.15, 'sawtooth', 0.25);
        this.playNote(180, 0.1, 'square', 0.15, 0.05);
        this.playNote(240, 0.08, 'square', 0.12, 0.1);
        this.playNoise(0.2, 0.08);
    }

    // Reel tick (during spin)
    reelTick(): void {
        this.playNote(800 + Math.random() * 400, 0.03, 'square', 0.05);
    }

    // Reel stop (thunk sound)
    reelStop(): void {
        this.playNote(100, 0.12, 'square', 0.3);
        this.playNote(80, 0.08, 'triangle', 0.2, 0.02);
        this.playNoise(0.08, 0.15);
    }

    // Small win
    win(): void {
        const melody = [523, 659, 784, 1047];
        melody.forEach((f, i) => {
            this.playNote(f, 0.25, 'sine', 0.3, i * 0.12);
            this.playNote(f * 1.5, 0.15, 'sine', 0.1, i * 0.12 + 0.05);
        });
    }

    // Big win (3 sevens, diamonds, etc.)
    bigWin(): void {
        const fanfare = [523, 659, 784, 1047, 1319, 1568, 2093];
        fanfare.forEach((f, i) => {
            this.playNote(f, 0.35, 'sine', 0.35, i * 0.1);
            this.playNote(f * 0.5, 0.3, 'triangle', 0.15, i * 0.1);
        });
        // Add shimmer
        for (let i = 0; i < 15; i++) {
            this.playNote(2000 + Math.random() * 3000, 0.08, 'sine', 0.06, 0.7 + i * 0.06);
        }
    }

    // Jackpot (3 diamonds)
    jackpot(): void {
        // Epic ascending fanfare
        for (let i = 0; i < 24; i++) {
            const freq = 200 + i * 100;
            this.playNote(freq, 0.3, 'sawtooth', 0.12, i * 0.08);
            this.playNote(freq * 1.25, 0.25, 'sine', 0.1, i * 0.08 + 0.04);
        }
        // Shimmer rain
        for (let i = 0; i < 30; i++) {
            this.playNote(1500 + Math.random() * 4000, 0.1, 'sine', 0.05, 1.5 + i * 0.05);
        }
    }

    // Coin / credit add
    coin(): void {
        this.playNote(1200, 0.06, 'sine', 0.2);
        this.playNote(1800, 0.06, 'sine', 0.15, 0.04);
    }

    // Button click
    buttonClick(): void {
        this.playNote(600, 0.04, 'square', 0.12);
        this.playNote(900, 0.03, 'square', 0.08, 0.02);
    }

    // Bonus round activation
    bonusStart(): void {
        const notes = [440, 554, 659, 880, 1109, 1319, 1760];
        notes.forEach((f, i) => {
            this.playNote(f, 0.3, 'sine', 0.3, i * 0.12);
            this.playNote(f * 2, 0.2, 'sine', 0.1, i * 0.12 + 0.06);
        });
        this.playNoise(0.3, 0.08, 0.8);
    }

    // Free spin notification
    freeSpin(): void {
        this.playNote(880, 0.15, 'sine', 0.25);
        this.playNote(1175, 0.15, 'sine', 0.25, 0.1);
        this.playNote(1760, 0.25, 'sine', 0.3, 0.2);
    }

    // Flag changed notification
    flagChanged(): void {
        this.playNote(1047, 0.08, 'sine', 0.2);
        this.playNote(1319, 0.08, 'sine', 0.2, 0.06);
        this.playNote(1568, 0.12, 'sine', 0.25, 0.12);
    }

    // Theme switch
    themeSwitch(): void {
        for (let i = 0; i < 8; i++) {
            this.playNote(400 + i * 200, 0.06, 'triangle', 0.12, i * 0.04);
        }
    }

    destroy(): void {
        if (this.ctx) {
            this.ctx.close().catch(() => { });
            this.ctx = null;
            this.masterGain = null;
        }
    }
}
