import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useGatrixClient, useFlags, useGatrixContext } from '@gatrix/react-sdk';

interface IdleRPGGameProps {
    onExit: () => void;
}

// Retro Color Palette
const COLORS = {
    BG: 0x212529,
    HERO: 0x209cee,
    ENEMY: 0xe76e55,
    BOSS: 0x8c2020,
    GOLD: 0xf7d51d,
    EXP: 0x92cc41,
    TEXT: 0xffffff,
    BAR_BG: 0x444444
};

const IdleRPGGame: React.FC<IdleRPGGameProps> = ({ onExit }) => {
    const canvasRef = useRef<HTMLDivElement>(null);
    const client = useGatrixClient();
    const { syncFlags, canSyncFlags } = useGatrixContext();
    const flags = useFlags(); // Reactively track flags (though we might read values directly for performance)

    // Game Local State
    const [gameState, setGameState] = useState<'playing' | 'loading' | 'stageComplete'>('playing');
    const [level, setLevel] = useState(1);
    const [gold, setGold] = useState(0);
    const [exp, setExp] = useState(0);
    const [stage, setStage] = useState(1);
    const [isBoss, setIsBoss] = useState(false);
    const [killCount, setKillCount] = useState(0);
    const [log, setLog] = useState<string[]>(['Entering the Gatrix Realm...']);

    // Refs for game loop state (avoiding React render cycles for high frequency data)
    const gameRef = useRef({
        app: null as PIXI.Application | null,
        hero: null as PIXI.Container | null,
        enemy: null as PIXI.Container | null,
        hpBar: null as PIXI.Graphics | null,
        enemyHpBar: null as PIXI.Graphics | null,
        playerHp: 100,
        playerMaxHp: 100,
        enemyHp: 100,
        enemyMaxHp: 100,
        attackTimer: 0,
        moveTimer: 0,
        stageProgress: 0,
        isAttacking: false,
        pendingSync: false,
        lastFrameTime: 0
    });

    const addLog = (msg: string) => {
        setLog(prev => [msg, ...prev].slice(0, 5));
    };

    // Feature Flag Real-time Watcher (Demo: watchFlag)
    useEffect(() => {
        const unwatchBoss = client.features.watchFlag('boss_mode', (isBossMode) => {
            addLog(`[WATCH] Boss Mode ${isBossMode ? 'ACTIVATED' : 'DEACTIVATED'}`);
            // Visual feedback for real-time change
            if (gameRef.current.enemy) {
                gameRef.current.enemy.scale.set(1.5);
                setTimeout(() => {
                    if (gameRef.current.enemy) gameRef.current.enemy.scale.set(1);
                }, 500);
            }
        });

        const unwatchSpeed = client.features.watchFlag('game_speed', (speed) => {
            addLog(`[WATCH] Game speed changed to x${speed}`);
        });

        // Track sync availability for notification
        const handleSyncAvailable = () => {
            if (client.features.getConfig().explicitSyncMode) {
                addLog('!! NEW VERSION DETECTED ON SERVER !!');
            }
        };
        client.on('flags.can_sync', handleSyncAvailable);

        return () => {
            unwatchBoss();
            unwatchSpeed();
            client.off('flags.can_sync', handleSyncAvailable);
        };
    }, [client]);

    // Initialize Pixi App
    useEffect(() => {
        const initPixi = async () => {
            const app = new PIXI.Application();
            await app.init({
                width: 800,
                height: 450,
                backgroundColor: COLORS.BG,
                antialias: false,
                resolution: window.devicePixelRatio || 1
            });

            if (canvasRef.current && !canvasRef.current.firstChild) {
                canvasRef.current.appendChild(app.canvas);
            }
            gameRef.current.app = app;

            // Character Container
            const hero = new PIXI.Container();
            const heroBody = new PIXI.Graphics().rect(-20, -40, 40, 40).fill(COLORS.HERO).stroke({ width: 2, color: 0xffffff });
            const heroSword = new PIXI.Graphics().rect(15, -30, 30, 10).fill(0xcccccc);
            hero.addChild(heroBody, heroSword);
            hero.x = 200;
            hero.y = 300;
            app.stage.addChild(hero);
            gameRef.current.hero = hero;

            // Enemy Container
            const enemy = new PIXI.Container();
            const enemyBody = new PIXI.Graphics().rect(-25, -50, 50, 50).fill(COLORS.ENEMY).stroke({ width: 2, color: 0xffffff });
            enemy.addChild(enemyBody);
            enemy.x = 600;
            enemy.y = 300;
            app.stage.addChild(enemy);
            gameRef.current.enemy = enemy;

            // HP Bars
            const hpBar = new PIXI.Graphics();
            app.stage.addChild(hpBar);
            gameRef.current.hpBar = hpBar;

            const enemyHpBar = new PIXI.Graphics();
            app.stage.addChild(enemyHpBar);
            gameRef.current.enemyHpBar = enemyHpBar;

            // Simple Shaders/Effects for "WebGL" feel (Particles)
            const particles = new PIXI.Container();
            app.stage.addChild(particles);

            // Game Loop
            app.ticker.add((ticker) => {
                const delta = ticker.deltaTime;

                // Read Feature Flags (Real-time)
                const gameSpeed = client.features.getFlagValue('game_speed', 1);
                const moveSpeedMult = client.features.getFlagValue('move_speed', 1);
                const isAutoSkill = client.features.getFlagValue('auto_skill', false);
                const bossModeFlag = client.features.getFlagValue('boss_mode', false);

                const speed = gameSpeed * delta;

                updateGame(speed, moveSpeedMult, isAutoSkill, bossModeFlag);
            });
        };

        const updateGame = (speed: number, moveMult: number, autoSkill: boolean, bossMode: boolean) => {
            const s = gameRef.current;
            if (!s.hero || !s.enemy || gameState !== 'playing') return;

            // Floating effect
            s.hero.y = 300 + Math.sin(Date.now() / 200) * 5;
            s.enemy.y = 300 + Math.cos(Date.now() / 200) * 5;

            // Movement logic (simulated idle "approaching")
            if (!s.isAttacking) {
                s.moveTimer += 0.05 * speed * moveMult;
                if (s.moveTimer > 10) {
                    s.isAttacking = true;
                    s.moveTimer = 0;
                }
            } else {
                // Battle Simulation
                s.attackTimer += 0.1 * speed;
                if (s.attackTimer > 5) {
                    s.attackTimer = 0;

                    // Hit Enemy
                    const crit = autoSkill && Math.random() > 0.7;
                    const damage = (10 + level) * (crit ? 3 : 1);
                    s.enemyHp -= damage;

                    // Rumble/Hit Effect
                    s.enemy.x += 10;
                    setTimeout(() => { if (s.enemy) s.enemy.x -= 10; }, 50);

                    if (crit) addLog('CRITICAL STRIKE! (Auto Skill Active)');

                    if (s.enemyHp <= 0) {
                        defeatEnemy();
                    } else {
                        // Enemy counter attack
                        s.playerHp -= 5;
                        s.hero.x -= 5;
                        setTimeout(() => { if (s.hero) s.hero.x += 5; }, 50);
                    }

                    s.isAttacking = false;
                }
            }

            // Draw HP Bars
            renderHpBars();
        };

        const renderHpBars = () => {
            const s = gameRef.current;
            if (!s.hpBar || !s.enemyHpBar) return;

            s.hpBar.clear();
            s.hpBar.rect(150, 240, 100, 8).fill(COLORS.BAR_BG);
            s.hpBar.rect(150, 240, (s.playerHp / s.playerMaxHp) * 100, 8).fill(COLORS.EXP);

            s.enemyHpBar.clear();
            s.enemyHpBar.rect(550, 230, 100, 10).fill(COLORS.BAR_BG);
            s.enemyHpBar.rect(550, 230, (s.enemyHp / s.enemyMaxHp) * 100, 10).fill(COLORS.ENEMY);
        };

        initPixi();

        return () => {
            if (gameRef.current.app) {
                gameRef.current.app.destroy(true, { children: true, texture: true });
                gameRef.current.app = null;
            }
        };
    }, [gameState, level]); // Re-init core on major state changes if needed, or keep loop external

    const defeatEnemy = () => {
        const s = gameRef.current;
        const expMult = client.features.getFlagValue('exp_booster', 1);
        const gainExp = Math.floor(20 * expMult);
        const gainGold = stage * 10;

        setExp(prev => prev + gainExp);
        setGold(prev => prev + gainGold);
        setKillCount(prev => {
            const next = prev + 1;
            if (next >= 5) {
                startTransition();
                return 0;
            }
            return next;
        });

        addLog(`Victory! +${gainExp} EXP, +${gainGold} GOLD`);
        s.enemyHp = s.enemyMaxHp;
        s.playerHp = Math.min(s.playerMaxHp, s.playerHp + 10);
    };

    const startTransition = () => {
        setGameState('loading');
        addLog('Moving to next area...');

        // Demo: Explicit Sync during transition
        setTimeout(() => {
            if (canSyncFlags()) {
                syncFlags();
                addLog('!! System Patch Applied (Flags Synced) !!');
            }
            setStage(prev => prev + 1);
            setGameState('playing');
            addLog(`Welcome to Floor ${stage + 1}`);
        }, 2000);
    };

    // Level up check
    useEffect(() => {
        if (exp >= level * 100) {
            setExp(0);
            setLevel(prev => prev + 1);
            gameRef.current.playerMaxHp += 20;
            gameRef.current.playerHp = gameRef.current.playerMaxHp;
            addLog(`LEVEL UP! REACHED Lv.${level + 1}`);
        }
    }, [exp, level]);

    return (
        <div className="arkanoid-fullscreen">
            <div className="game-header" style={{ padding: '10px 40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <div>
                        <h2 className="nes-text is-primary" style={{ margin: 0, fontSize: '20px' }}>GATRIX IDLE RPG</h2>
                        <p style={{ fontSize: '8px', color: '#adafbc', margin: '4px 0' }}>
                            {client.features.getFlagValue('special_event_msg', 'Defend the pipeline!')}
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '20px' }}>
                        <div className="nes-badge">
                            <span className="is-success">STAGE {stage}</span>
                        </div>
                        <button type="button" className="nes-btn is-error" onClick={onExit} style={{ fontSize: '10px' }}>EXIT</button>
                    </div>
                </div>
            </div>

            <div className="game-canvas-container" style={{ position: 'relative', border: '4px solid #fff' }}>
                <div ref={canvasRef} />

                {gameState === 'loading' && (
                    <div className="game-over-overlay" style={{ background: 'rgba(0,0,0,0.85)' }}>
                        <div className="nes-container is-dark with-title" style={{ width: '400px' }}>
                            <p className="title">PATCHING SYSTEM</p>
                            <div style={{ textAlign: 'center' }}>
                                <i className="nes-icon is-large star animate"></i>
                                <p style={{ marginTop: '20px', fontSize: '12px' }}>SYNCHRONIZING FLAGS...</p>
                                <progress className="nes-progress is-success" value={undefined} max="100"></progress>
                            </div>
                        </div>
                    </div>
                )}

                {/* HUD Overlay */}
                <div style={{ position: 'absolute', top: '10px', left: '10px', pointerEvents: 'none' }}>
                    <div className="nes-container is-dark" style={{ padding: '10px', fontSize: '10px' }}>
                        <p style={{ color: COLORS.GOLD, margin: '2px 0' }}>GOLD: {gold}</p>
                        <p style={{ color: COLORS.EXP, margin: '2px 0' }}>LEVEL: {level}</p>
                        <p style={{ color: '#fff', margin: '2px 0' }}>EXP: {exp} / {level * 100}</p>
                    </div>
                </div>

                {/* Notification for Explicit Sync */}
                {canSyncFlags() && gameState === 'playing' && (
                    <div style={{ position: 'absolute', bottom: '100px', width: '100%', textAlign: 'center', pointerEvents: 'none' }}>
                        <div className="nes-balloon from-right is-dark rumble-on-pop" style={{ display: 'inline-block', fontSize: '8px' }}>
                            <span className="nes-text is-warning">NEW UPDATE DETECTED! STAGE END TO APPLY.</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="game-footer" style={{ padding: '10px 40px', display: 'flex', gap: '20px' }}>
                <div className="nes-container is-dark with-title" style={{ flex: 1, height: '100px' }}>
                    <p className="title">BATTLE LOG</p>
                    <div style={{ fontSize: '8px', textAlign: 'left' }}>
                        {log.map((m, i) => <div key={i} style={{ opacity: 1 - (i * 0.2), padding: '2px 0' }}>{`> ${m}`}</div>)}
                    </div>
                </div>
                <div className="nes-container is-dark with-title" style={{ width: '300px', height: '100px' }}>
                    <p className="title">HOT-FLAGS</p>
                    <div style={{ fontSize: '7px', textAlign: 'left', lineHeight: '1.5' }}>
                        <div>SPEED: x{client.features.getFlagValue('game_speed', 1)}</div>
                        <div>BOOST: x{client.features.getFlagValue('exp_booster', 1)}</div>
                        <div style={{ color: client.features.getFlagValue('auto_skill', false) ? '#92cc41' : '#888' }}>
                            AUTO-SKILL: {client.features.getFlagValue('auto_skill', false) ? 'ENABLED' : 'DISABLED'}
                        </div>
                        <div style={{ color: client.features.getFlagValue('boss_mode', false) ? '#e76e55' : '#888' }}>
                            BOSS-MODE: {client.features.getFlagValue('boss_mode', false) ? 'ON' : 'OFF'}
                        </div>
                    </div>
                </div>
            </div>

            <div className="crt-overlay" style={{ pointerEvents: 'none' }}></div>
        </div>
    );
};

export default IdleRPGGame;
