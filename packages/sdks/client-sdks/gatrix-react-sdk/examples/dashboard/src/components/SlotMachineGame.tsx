// Slot Machine Game - React Wrapper Component
// Title screen → Login → Game with SDK Feature Flag showcase panel
import { useState, useEffect, useRef, useCallback } from 'react';
import Phaser from 'phaser';
import { useGatrixClient } from '@gatrix/react-sdk';
import { SlotScene, type SlotBridge } from './slot-machine/SlotScene';
import {
  SlotConfig,
  DEFAULT_SLOT_CONFIG,
  FLAG_NAMES,
  ThemeKey,
  SYMBOL_CONFIGS,
  type FlagChangeLog,
} from './slot-machine/SlotTypes';
import type { FeaturesClient } from '@gatrix/js-client-sdk';
import { WatchFlagGroup } from '@gatrix/js-client-sdk';

// ==================== Title Screen ====================
function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="slot-title-screen">
      <div className="slot-title-bg" />
      <div className="slot-title-content">
        <img src="/assets/slot/logo.png" alt="logo" className="slot-title-logo" />
        <h1 className="slot-title-text">GATRIX SLOT SAGA</h1>
        <p className="slot-title-sub">Feature Flag Showcase</p>
        <button className="slot-title-btn" onClick={onStart}>
          ▶ PLAY
        </button>
        <p className="slot-title-credit">Powered by Gatrix SDK</p>
      </div>
    </div>
  );
}

// ==================== Login Screen ====================
function LoginScreen({ onLogin }: { onLogin: (name: string, vip: number) => void }) {
  const [name, setName] = useState('Player1');
  const [vip, setVip] = useState(1);
  return (
    <div className="slot-login-screen">
      <div className="slot-login-card">
        <h2 className="slot-login-title">🎰 Enter the Casino</h2>
        <div className="slot-login-field">
          <label>Player Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
          />
        </div>
        <div className="slot-login-field">
          <label>VIP Level</label>
          <div className="slot-vip-select">
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                className={`slot-vip-btn ${vip === v ? 'active' : ''}`}
                onClick={() => setVip(v)}
              >
                {'★'.repeat(v)}
              </button>
            ))}
          </div>
          <p className="slot-login-hint">VIP level affects flag targeting (context field)</p>
        </div>
        <button
          className="slot-title-btn"
          onClick={() => name.trim() && onLogin(name.trim(), vip)}
          disabled={!name.trim()}
        >
          🎲 START GAME
        </button>
      </div>
    </div>
  );
}

// ==================== Flag Status Panel ====================
interface FlagPanelProps {
  config: SlotConfig;
  bridge: SlotBridge | null;
  flagLogs: FlagChangeLog[];
  hasPending: boolean;
  onSync: () => void;
  onVipChange: (vip: number) => void;
  playerName: string;
  vipLevel: number;
}

function FlagStatusPanel({
  config,
  bridge,
  flagLogs,
  hasPending,
  onSync,
  onVipChange,
  playerName,
  vipLevel,
}: FlagPanelProps) {
  // Real-time flags (applied immediately via watchFlag)
  const realTimeFlags = [
    { name: FLAG_NAMES.SOUND, label: 'Sound', value: String(config.soundEnabled), type: 'bool' },
    { name: FLAG_NAMES.THEME, label: 'Theme', value: config.theme, type: 'string' },
    {
      name: FLAG_NAMES.WILD_SYMBOL,
      label: 'Wild Symbol',
      value: String(config.wildSymbolEnabled),
      type: 'bool',
    },
    {
      name: FLAG_NAMES.BONUS_ROUND,
      label: 'Bonus Round',
      value: String(config.bonusRoundEnabled),
      type: 'bool',
    },
    {
      name: FLAG_NAMES.AUTO_SPIN,
      label: 'Auto Spin',
      value: String(config.autoSpinEnabled),
      type: 'bool',
    },
  ];

  // Manual sync flags (applied only via syncFlags)
  const syncFlags = [
    {
      name: FLAG_NAMES.SPIN_SPEED,
      label: 'Spin Speed',
      value: String(config.spinSpeed),
      type: 'number',
    },
    {
      name: FLAG_NAMES.WIN_MULTIPLIER,
      label: 'Win Multiplier',
      value: String(config.winMultiplier),
      type: 'number',
    },
    {
      name: FLAG_NAMES.INITIAL_CREDITS,
      label: 'Initial Credits',
      value: String(config.initialCredits),
      type: 'number',
    },
    {
      name: FLAG_NAMES.PAYOUT_TABLE,
      label: 'Payout Table',
      value: config.payoutTable ? 'Custom' : 'Default',
      type: 'json',
    },
  ];

  return (
    <div className="slot-flag-panel">
      <h3 className="slot-panel-title">🚩 Feature Flag Status</h3>

      {/* Context info */}
      <div className="slot-panel-section">
        <h4>Context (updateContext)</h4>
        <div className="slot-context-info">
          <span>👤 {playerName}</span>
          <div className="slot-vip-inline">
            <span>VIP:</span>
            {[1, 2, 3, 4, 5].map((v) => (
              <button
                key={v}
                className={`slot-vip-mini ${vipLevel >= v ? 'filled' : ''}`}
                onClick={() => onVipChange(v)}
                title={`VIP ${v}`}
              >
                ★
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Real-time flags */}
      <div className="slot-panel-section">
        <h4>⚡ Real-time (watchFlag)</h4>
        {realTimeFlags.map((f) => (
          <div key={f.name} className="slot-flag-row">
            <span className="slot-flag-name">{f.name}</span>
            <span className={`slot-flag-value ${f.type}`}>{f.value}</span>
            <span className="slot-flag-badge live">LIVE</span>
          </div>
        ))}
      </div>

      {/* Manual sync flags */}
      <div className="slot-panel-section">
        <h4>🔄 Manual Sync (syncFlags)</h4>
        {syncFlags.map((f) => (
          <div key={f.name} className="slot-flag-row">
            <span className="slot-flag-name">{f.name}</span>
            <span className={`slot-flag-value ${f.type}`}>{f.value}</span>
            <span className="slot-flag-badge sync">SYNC</span>
          </div>
        ))}
        <button className={`slot-sync-btn ${hasPending ? 'pending' : ''}`} onClick={onSync}>
          {hasPending ? '🔴 Sync Pending — Click to Apply' : '✅ Synced'}
        </button>
      </div>

      {/* Game stats */}
      {bridge && (
        <div className="slot-panel-section">
          <h4>📊 Game Stats</h4>
          <div className="slot-stats-grid">
            <span className="slot-stat-label">Credits:</span>
            <span className="slot-stat-value">{bridge.credits}</span>
            <span className="slot-stat-label">Total Bet:</span>
            <span className="slot-stat-value">{bridge.totalBet}</span>
            <span className="slot-stat-label">Total Win:</span>
            <span className="slot-stat-value">{bridge.totalWin}</span>
            <span className="slot-stat-label">Combo:</span>
            <span className="slot-stat-value">{bridge.comboCount}</span>
            <span className="slot-stat-label">Free Spins:</span>
            <span className="slot-stat-value">{bridge.freeSpinsLeft}</span>
          </div>
        </div>
      )}

      {/* Payout table */}
      <div className="slot-panel-section">
        <h4>💰 Payouts (jsonVariation)</h4>
        <div className="slot-payout-table">
          {SYMBOL_CONFIGS.filter((s) => s.key !== 'wild').map((s) => (
            <div key={s.key} className="slot-payout-row">
              <img src={`/assets/slot/${s.imageFile}`} alt={s.label} className="slot-payout-icon" />
              <span>{s.label}</span>
              <span className="slot-payout-val">×{config.payoutTable?.[s.key] ?? s.payout3}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Flag change log */}
      <div className="slot-panel-section">
        <h4>📝 Flag Changes</h4>
        <div className="slot-flag-log">
          {flagLogs.length === 0 ? (
            <p className="slot-log-empty">No changes yet. Modify flags in the admin panel.</p>
          ) : (
            flagLogs
              .slice(-8)
              .reverse()
              .map((log) => (
                <div key={log.id} className="slot-log-entry">
                  <span className="slot-log-flag">{log.flagName}</span>
                  <span className="slot-log-change">
                    {log.oldValue} → {log.newValue}
                  </span>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}

// ==================== Main Game Component ====================
export default function SlotMachineGame({ onExit }: { onExit: () => void }) {
  const client = useGatrixClient();
  const [phase, setPhase] = useState<'title' | 'login' | 'playing'>('title');
  const [playerName, setPlayerName] = useState('');
  const [vipLevel, setVipLevel] = useState(1);
  const [config, setConfig] = useState<SlotConfig>({ ...DEFAULT_SLOT_CONFIG });
  const [flagLogs, setFlagLogs] = useState<FlagChangeLog[]>([]);
  const [hasPending, setHasPending] = useState(false);
  const [, setTick] = useState(0);

  const gameContainerRef = useRef<HTMLDivElement>(null);
  const phaserGameRef = useRef<Phaser.Game | null>(null);
  const bridgeRef = useRef<SlotBridge | null>(null);
  const watchGroupRef = useRef<WatchFlagGroup | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _watchGroupRef = watchGroupRef; // Keep ref for potential future use
  const logIdRef = useRef(0);

  const forceTick = useCallback(() => setTick((t) => t + 1), []);

  // Add flag change to log
  const addFlagLog = useCallback((flagName: string, oldValue: string, newValue: string) => {
    setFlagLogs((prev) => [
      ...prev,
      { id: logIdRef.current++, timestamp: Date.now(), flagName, oldValue, newValue },
    ]);
  }, []);

  // Setup real-time flag watchers (watchFlag via WatchFlagGroup)
  useEffect(() => {
    if (phase !== 'playing' || !client) return;
    const features: FeaturesClient = client.features;
    const group = features.createWatchGroup('slot-game');
    watchGroupRef.current = group;

    // Real-time: sound
    group.watchFlagWithInitialState(FLAG_NAMES.SOUND, (flag) => {
      const val = flag.boolVariation(true);
      const old = config.soundEnabled;
      setConfig((c) => ({ ...c, soundEnabled: val }));
      if (old !== val) addFlagLog(FLAG_NAMES.SOUND, String(old), String(val));
      // Immediately apply to scene
      const scene = phaserGameRef.current?.scene.getScene('SlotScene') as SlotScene | undefined;
      scene?.updateSoundEnabled(val);
    });

    // Real-time: theme
    group.watchFlagWithInitialState(FLAG_NAMES.THEME, (flag) => {
      const val = flag.stringVariation('classic') as ThemeKey;
      const old = config.theme;
      setConfig((c) => ({ ...c, theme: val }));
      if (old !== val) addFlagLog(FLAG_NAMES.THEME, old, val);
      const scene = phaserGameRef.current?.scene.getScene('SlotScene') as SlotScene | undefined;
      scene?.updateTheme(val);
    });

    // Real-time: wild symbol
    group.watchFlagWithInitialState(FLAG_NAMES.WILD_SYMBOL, (flag) => {
      const val = flag.boolVariation(false);
      const old = config.wildSymbolEnabled;
      setConfig((c) => ({ ...c, wildSymbolEnabled: val }));
      if (old !== val) addFlagLog(FLAG_NAMES.WILD_SYMBOL, String(old), String(val));
    });

    // Real-time: bonus round
    group.watchFlagWithInitialState(FLAG_NAMES.BONUS_ROUND, (flag) => {
      const val = flag.boolVariation(false);
      const old = config.bonusRoundEnabled;
      setConfig((c) => ({ ...c, bonusRoundEnabled: val }));
      if (old !== val) addFlagLog(FLAG_NAMES.BONUS_ROUND, String(old), String(val));
    });

    // Real-time: auto spin
    group.watchFlagWithInitialState(FLAG_NAMES.AUTO_SPIN, (flag) => {
      const val = flag.boolVariation(false);
      const old = config.autoSpinEnabled;
      setConfig((c) => ({ ...c, autoSpinEnabled: val }));
      if (old !== val) addFlagLog(FLAG_NAMES.AUTO_SPIN, String(old), String(val));
      if (bridgeRef.current) {
        bridgeRef.current.autoSpinActive = val;
        bridgeRef.current.config.autoSpinEnabled = val;
      }
      // Trigger auto-spin if flag is now true
      if (val) {
        const scene = phaserGameRef.current?.scene.getScene('SlotScene') as SlotScene | undefined;
        scene?.triggerAutoSpin();
      }
    });

    // Manual sync flags: check pending on flagsUpdated
    const handleFlagsUpdated = () => {
      setHasPending(true);
    };
    client.on('flagsUpdated', handleFlagsUpdated);

    return () => {
      group.destroy();
      client.off('flagsUpdated', handleFlagsUpdated);
      watchGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, client]);

  // Manual sync handler
  const handleSync = useCallback(() => {
    if (!client) return;
    const features: FeaturesClient = client.features;
    features.syncFlags();

    // Read manual sync flags after sync
    const speed = features.numberVariation(FLAG_NAMES.SPIN_SPEED, 1);
    const mult = features.numberVariation(FLAG_NAMES.WIN_MULTIPLIER, 1);
    const credits = features.numberVariation(FLAG_NAMES.INITIAL_CREDITS, 1000);
    const autoSpin = features.boolVariation(FLAG_NAMES.AUTO_SPIN, false);
    const payoutRaw = features.jsonVariation(FLAG_NAMES.PAYOUT_TABLE, null);
    const payout =
      payoutRaw && typeof payoutRaw === 'object' ? (payoutRaw as Record<string, number>) : null;

    setConfig((c) => {
      const newConfig = {
        ...c,
        spinSpeed: speed,
        winMultiplier: mult,
        initialCredits: credits,
        autoSpinEnabled: autoSpin,
        payoutTable: payout,
      };
      // Update bridge
      if (bridgeRef.current) {
        bridgeRef.current.config = newConfig;
      }
      return newConfig;
    });
    setHasPending(false);
    addFlagLog('syncFlags()', '-', 'Synced all manual flags');
  }, [client, addFlagLog]);

  // VIP level change → updateContext
  const handleVipChange = useCallback(
    (newVip: number) => {
      setVipLevel(newVip);
      if (client) {
        client.features.updateContext({ vipLevel: newVip } as Record<string, unknown>);
        addFlagLog('updateContext', `vipLevel=${vipLevel}`, `vipLevel=${newVip}`);
      }
      if (bridgeRef.current) bridgeRef.current.vipLevel = newVip;
    },
    [client, vipLevel, addFlagLog]
  );

  // Login handler → sets context and starts game
  const handleLogin = useCallback(
    (name: string, vip: number) => {
      setPlayerName(name);
      setVipLevel(vip);
      if (client) {
        client.features.updateContext({ playerName: name, vipLevel: vip } as Record<
          string,
          unknown
        >);
      }
      setPhase('playing');
    },
    [client]
  );

  // Initialize Phaser game when entering playing phase
  useEffect(() => {
    if (phase !== 'playing' || !gameContainerRef.current || !client) return;

    const features = client.features;
    let cancelled = false;

    // Sync flags first, then create game with fresh values
    features.syncFlags().then(() => {
      if (cancelled) return;

      // Read all flag values directly from SDK after sync
      const autoSpinNow = features.boolVariation(FLAG_NAMES.AUTO_SPIN, false);
      const soundNow = features.boolVariation(FLAG_NAMES.SOUND, true);
      const wildNow = features.boolVariation(FLAG_NAMES.WILD_SYMBOL, false);
      const bonusNow = features.boolVariation(FLAG_NAMES.BONUS_ROUND, false);
      const speedNow = features.numberVariation(FLAG_NAMES.SPIN_SPEED, 1);
      const multNow = features.numberVariation(FLAG_NAMES.WIN_MULTIPLIER, 1);
      const creditsNow = features.numberVariation(FLAG_NAMES.INITIAL_CREDITS, 1000);
      const themeNow = (features.stringVariation(FLAG_NAMES.THEME, 'classic') ||
        'classic') as SlotConfig['theme'];

      const freshConfig: SlotConfig = {
        spinSpeed: speedNow,
        winMultiplier: multNow,
        initialCredits: creditsNow,
        theme: themeNow,
        bonusRoundEnabled: bonusNow,
        wildSymbolEnabled: wildNow,
        autoSpinEnabled: autoSpinNow,
        soundEnabled: soundNow,
        payoutTable: null,
      };

      // Try reading payout table
      try {
        const payoutRaw = features.jsonVariation(FLAG_NAMES.PAYOUT_TABLE, null);
        if (payoutRaw && typeof payoutRaw === 'object') {
          freshConfig.payoutTable = payoutRaw as Record<string, number>;
        }
      } catch {
        /* use default */
      }

      setConfig(freshConfig);

      const bridge: SlotBridge = {
        config: { ...freshConfig },
        playerName,
        vipLevel,
        credits: freshConfig.initialCredits,
        bet: 10,
        lastWin: 0,
        totalBet: 0,
        totalWin: 0,
        isSpinning: false,
        spinRequested: false,
        autoSpinActive: autoSpinNow,
        comboCount: 0,
        freeSpinsLeft: 0,
        onStateChange: forceTick,
      };
      bridgeRef.current = bridge;

      SlotScene.pendingBridge = bridge;

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        width: 700,
        height: 550,
        parent: gameContainerRef.current!,
        backgroundColor: '#000000',
        scene: [SlotScene],
      });
      phaserGameRef.current = game;
    });

    return () => {
      cancelled = true;
      if (phaserGameRef.current) {
        phaserGameRef.current.destroy(true);
        phaserGameRef.current = null;
      }
      bridgeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ==================== Render ====================

  if (phase === 'title') {
    return (
      <div className="slot-container">
        <button className="slot-exit-btn" onClick={onExit}>
          ✕
        </button>
        <TitleScreen onStart={() => setPhase('login')} />
      </div>
    );
  }

  if (phase === 'login') {
    return (
      <div className="slot-container">
        <button className="slot-exit-btn" onClick={onExit}>
          ✕
        </button>
        <LoginScreen onLogin={handleLogin} />
      </div>
    );
  }

  return (
    <div className="slot-container">
      <button className="slot-exit-btn" onClick={onExit}>
        ✕
      </button>
      <div className="slot-game-layout">
        <div className="slot-game-area" ref={gameContainerRef} />
        <FlagStatusPanel
          config={config}
          bridge={bridgeRef.current}
          flagLogs={flagLogs}
          hasPending={hasPending}
          onSync={handleSync}
          onVipChange={handleVipChange}
          playerName={playerName}
          vipLevel={vipLevel}
        />
      </div>
    </div>
  );
}
