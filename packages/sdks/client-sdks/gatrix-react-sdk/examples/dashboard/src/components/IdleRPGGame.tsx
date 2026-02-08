import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { useGatrixClient, useGatrixContext } from '@gatrix/react-sdk';

interface IdleRPGGameProps {
    onExit: () => void;
}

// Assets from Sunny Land (Ansimuz) - CC0 License
const ASSETS = {
    HERO_IDLE: [
        'https://raw.githubusercontent.com/ansimuz/sunny-land-assets/master/PNG/sprites/player/idle/player-idle-1.png',
        'https://raw.githubusercontent.com/ansimuz/sunny-land-assets/master/PNG/sprites/player/idle/player-idle-2.png',
        'https://raw.githubusercontent.com/ansimuz/sunny-land-assets/master/PNG/sprites/player/idle/player-idle-3.png',
        'https://raw.githubusercontent.com/ansimuz/sunny-land-assets/master/PNG/sprites/player/idle/player-idle-4.png',
    ],
    HERO_RUN: [
        'https://raw.githubusercontent.com/ansimuz/sunny-land-assets/master/PNG/sprites/player/run/player-run-1.png',
        'https://raw.githubusercontent.com/ansimuz/sunny-land-assets/master/PNG/sprites/player/run/player-run-2.png',
        'https://raw.githubusercontent.com/ansimuz/sunny-land-assets/master/PNG/sprites/player/run/player-run-3.png',
        'https://raw.githubusercontent.com/ansimuz/sunny-land-assets/master/PNG/sprites/player/run/player-run-4.png',
        'https://raw.githubusercontent.com/ansimuz/sunny-land-assets/master/PNG/sprites/player/run/player-run-5.png',
        'https://raw.githubusercontent.com/ansimuz/sunny-land-assets/master/PNG/sprites/player/run/player-run-6.png',
    ],
    ENEMY_IDLE: [
        'https://raw.githubusercontent.com/ansimuz/sunny-land-assets/master/PNG/sprites/opossum/opossum-1.png',
        'https://raw.githubusercontent.com/ansimuz/sunny-land-assets/master/PNG/sprites/opossum/opossum-2.png',
        'https://raw.githubusercontent.com/ansimuz/sunny-land-assets/master/PNG/sprites/opossum/opossum-3.png',
        'https://raw.githubusercontent.com/ansimuz/sunny-land-assets/master/PNG/sprites/opossum/opossum-4.png',
        'https://raw.githubusercontent.com/ansimuz/sunny-land-assets/master/PNG/sprites/opossum/opossum-5.png',
        'https://raw.githubusercontent.com/ansimuz/sunny-land-assets/master/PNG/sprites/opossum/opossum-6.png',
    ],
    BG_SKY: 'https://raw.githubusercontent.com/ansimuz/sunny-land-assets/master/PNG/environment/layers/back.png',
    BG_TREES: 'https://raw.githubusercontent.com/ansimuz/sunny-land-assets/master/PNG/environment/layers/middle.png',
};

const COLORS = {
    GOLD: '#f7d51d',
    EXP: '#92cc41',
    HP: '#ff4b2b',
    HP_BG: '#444444',
};

const IdleRPGGame: React.FC<IdleRPGGameProps> = ({ onExit }) => {
    const canvasRef = useRef<HTMLDivElement>(null);
    const client = useGatrixClient();
    const { syncFlags } = useGatrixContext();

    // Game Local State
    const [gameState, setGameState] = useState<'playing' | 'loading' | 'stageClear'>('playing');
    const [level, setLevel] = useState(1);
    const [gold, setGold] = useState(0);
    const [exp, setExp] = useState(0);
    const [kills, setKills] = useState(0);
    const [stage, setStage] = useState(1);
    const [subStage, setSubStage] = useState(1);
    const [log, setLog] = useState<string[]>([]);

    const gameRef = useRef<any>({
        app: null,
        hero: null,
        enemy: null,
        containers: {},
        bgSky: null,
        bgTrees: null,
        enemyHp: 100,
        enemyMaxHp: 100,
        isAttacking: false,
        attackTimer: 0,
        damageNumbers: [],
    });

    const addLog = (msg: string) => {
        setLog(prev => [msg, ...prev].slice(0, 5));
    };

    useEffect(() => {
        const initPixi = async () => {
            const app = new PIXI.Application();
            await app.init({
                width: 800,
                height: 400,
                backgroundColor: 0x212529,
                antialias: false,
            });

            if (canvasRef.current) {
                canvasRef.current.appendChild(app.canvas);
            }
            gameRef.current.app = app;

            // PIXI Settings
            PIXI.AbstractRenderer.defaultOptions.resolution = 2; // pixel perfect scaling

            // Create Layers
            const bgLayer = new PIXI.Container();
            const worldLayer = new PIXI.Container();
            const uiLayer = new PIXI.Container();
            app.stage.addChild(bgLayer, worldLayer, uiLayer);
            gameRef.current.containers = { bgLayer, worldLayer, uiLayer };

            // Load Assets
            const textures = {
                heroIdle: ASSETS.HERO_IDLE.map(url => PIXI.Texture.from(url)),
                heroRun: ASSETS.HERO_RUN.map(url => PIXI.Texture.from(url)),
                enemyIdle: ASSETS.ENEMY_IDLE.map(url => PIXI.Texture.from(url)),
                bgSky: PIXI.Texture.from(ASSETS.BG_SKY),
                bgTrees: PIXI.Texture.from(ASSETS.BG_TREES),
            };

            // Setup Background
            const bgSky = new PIXI.TilingSprite({
                texture: textures.bgSky,
                width: 800,
                height: 480,
            });
            bgSky.scale.set(1.5);
            bgLayer.addChild(bgSky);
            gameRef.current.bgSky = bgSky;

            const bgTrees = new PIXI.TilingSprite({
                texture: textures.bgTrees,
                width: 800,
                height: 480,
            });
            bgTrees.scale.set(1.5);
            bgTrees.y = 100;
            bgLayer.addChild(bgTrees);
            gameRef.current.bgTrees = bgTrees;

            // Setup Hero
            const hero = new PIXI.AnimatedSprite(textures.heroIdle);
            hero.animationSpeed = 0.1;
            hero.play();
            hero.scale.set(3);
            hero.anchor.set(0.5, 1);
            hero.x = 200;
            hero.y = 350;
            worldLayer.addChild(hero);
            gameRef.current.hero = hero;

            // Setup Enemy
            spawnEnemy(textures);

            // Game Loop
            app.ticker.add((ticker) => {
                const delta = ticker.deltaTime;

                // Flags
                const gameSpeed = client.features.numberVariation('idle-game-speed', 1);
                const moveSpeed = client.features.numberVariation('idle-move-speed', 1);
                const isAutoSkill = client.features.boolVariation('idle-auto-skill', false);
                const bossMode = client.features.boolVariation('idle-boss-mode', false);

                updateGame(delta, gameSpeed, moveSpeed, isAutoSkill, bossMode);
            });
        };

        initPixi();

        return () => {
            if (gameRef.current.app) {
                gameRef.current.app.destroy(true, { children: true, texture: true });
            }
        };
    }, []);

    const spawnEnemy = (textures?: any) => {
        const s = gameRef.current;
        if (!textures) {
            textures = {
                enemyIdle: ASSETS.ENEMY_IDLE.map(url => PIXI.Texture.from(url)),
            };
        }

        if (s.enemy) s.containers.worldLayer.removeChild(s.enemy);

        const enemy = new PIXI.AnimatedSprite(textures.enemyIdle);
        enemy.animationSpeed = 0.1;
        enemy.play();
        enemy.scale.set(3);
        enemy.scale.x *= -1; // Face left
        enemy.anchor.set(0.5, 1);
        enemy.x = 1000; // Start off-screen
        enemy.y = 350;

        s.containers.worldLayer.addChild(enemy);
        s.enemy = enemy;

        const bossMode = client.features.boolVariation('idle-boss-mode', false);
        const hpBase = stage * 100;
        s.enemyMaxHp = bossMode ? hpBase * 5 : hpBase;
        s.enemyHp = s.enemyMaxHp;

        if (bossMode) {
            enemy.tint = 0xff0000;
            enemy.scale.set(4.5);
            enemy.scale.x *= -1;
        } else {
            enemy.tint = 0xffffff;
        }
    };

    const updateGame = (delta: number, gameSpeed: number, moveSpeed: number, isAuto: boolean, isBoss: boolean) => {
        if (gameState !== 'playing') return;
        const s = gameRef.current;

        // Background scrolling (Parallax)
        s.bgSky.tilePosition.x -= 0.2 * delta * gameSpeed * moveSpeed;
        s.bgTrees.tilePosition.x -= 1.0 * delta * gameSpeed * moveSpeed;

        // Enemy movement (entering world)
        if (s.enemy.x > 600) {
            s.enemy.x -= 5 * delta * gameSpeed;
        }

        // Combat logic
        s.attackTimer += 0.05 * delta * gameSpeed;
        if (s.attackTimer > 2) {
            s.attackTimer = 0;
            const damage = (10 + level * 2);
            dealDamage(damage);

            // Auto skill trigger
            if (isAuto && Math.random() > 0.8) {
                dealDamage(damage * 3, true);
            }
        }

        // Update damage numbers
        s.damageNumbers.forEach((txt: PIXI.Text, index: number) => {
            txt.y -= 2 * delta;
            txt.alpha -= 0.02 * delta;
            if (txt.alpha <= 0) {
                s.containers.worldLayer.removeChild(txt);
                s.damageNumbers.splice(index, 1);
            }
        });
    };

    const dealDamage = (amount: number, isSkill = false) => {
        const s = gameRef.current;
        s.enemyHp -= amount;

        // Damage Number
        const txt = new PIXI.Text({
            text: isSkill ? `!! ${amount} !!` : `${amount}`,
            style: {
                fontFamily: '"Press Start 2P", cursive',
                fontSize: isSkill ? 24 : 16,
                fill: isSkill ? 0xffff00 : 0xffffff,
                stroke: { color: 0x000000, width: 4 },
            }
        });
        txt.x = s.enemy.x + (Math.random() * 40 - 20);
        txt.y = s.enemy.y - 100;
        s.containers.worldLayer.addChild(txt);
        s.damageNumbers.push(txt);

        // Shake effect
        s.enemy.x += 5;
        setTimeout(() => s.enemy.x -= 5, 50);

        if (s.enemyHp <= 0) {
            defeatEnemy();
        }
    };

    const defeatEnemy = () => {
        const s = gameRef.current;
        const expMult = client.features.numberVariation('idle-exp-booster', 1);
        const gainExp = Math.floor(20 * expMult);
        const gainGold = stage * 10;

        setExp(prev => {
            const next = prev + gainExp;
            if (next >= level * 100) {
                setLevel(l => l + 1);
                addLog('LEVEL UP!');
                return next - level * 100;
            }
            return next;
        });
        setGold(prev => prev + gainGold);
        setKills(prev => {
            const next = prev + 1;
            if (next % 5 === 0) {
                handleStageComplete();
            }
            return next;
        });

        addLog(`Defeated Opossum! +${gainExp} EXP, +${gainGold} Gold`);
        spawnEnemy();
    };

    const handleStageComplete = () => {
        setGameState('stageClear');
        setTimeout(() => {
            setSubStage(prev => {
                const next = prev + 1;
                if (next > 3) {
                    setStage(s => s + 1);
                    return 1;
                }
                return next;
            });
            setGameState('playing');
        }, 1500);
    };

    const useSkill = () => {
        if (gameState !== 'playing') return;
        dealDamage(level * 10 + 100, true);
        addLog('MANUAL SKILL: POWER BASH!');
    };

    const startStageTransition = async () => {
        setGameState('loading');
        await syncFlags(true);
        setTimeout(() => {
            setGameState('playing');
        }, 2000);
    };

    return (
        <div className="game-screen" style={{ background: '#000', height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            {/* Header / Stats */}
            <div className="nes-container is-dark with-title" style={{ width: '800px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', padding: '10px 20px' }}>
                <p className="title">GATRIX ADVANTURE (IDLE)</p>
                <div style={{ display: 'flex', gap: '30px', fontSize: '10px' }}>
                    <div>STAGE: {stage}-{subStage}</div>
                    <div style={{ color: COLORS.GOLD }}>GOLD: {gold.toLocaleString()}</div>
                    <div>LEVEL: {level}</div>
                    <div style={{ color: '#aaa' }}>KILLS: {kills}</div>
                </div>
            </div>

            <div className="game-canvas-container" style={{ position: 'relative', border: '4px solid #fff', width: '800px', height: '400px', overflow: 'hidden' }}>
                <div ref={canvasRef} />

                {/* Overlays */}
                {gameState === 'loading' && (
                    <div className="game-over-overlay" style={{ background: 'rgba(0,0,0,0.85)', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                        <div className="nes-container is-dark with-title" style={{ width: '400px' }}>
                            <p className="title">PATCHING SYSTEM</p>
                            <div style={{ textAlign: 'center' }}>
                                <i className="nes-icon is-large star animate"></i>
                                <p style={{ marginTop: '20px', fontSize: '12px' }}>LOADING NEW WORLD CONFIG...</p>
                                <progress className="nes-progress is-success" max={100}></progress>
                            </div>
                        </div>
                    </div>
                )}

                {gameState === 'stageClear' && (
                    <div className="game-over-overlay" style={{ background: 'rgba(0,0,0,0.5)', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
                        <h1 className="nes-text is-warning" style={{ fontSize: '40px', textAlign: 'center' }}>STAGE CLEAR!</h1>
                    </div>
                )}

                {/* Enemy HP Bar */}
                <div style={{ position: 'absolute', top: '20px', right: '50px', width: '200px' }}>
                    <div style={{ fontSize: '8px', marginBottom: '4px', textAlign: 'right' }}>ENEMY MISSION</div>
                    <div style={{ height: '10px', background: COLORS.HP_BG, border: '2px solid #fff' }}>
                        <div style={{ height: '100%', background: COLORS.HP, width: `${(gameRef.current.enemyHp / gameRef.current.enemyMaxHp) * 100}%`, transition: 'width 0.2s' }} />
                    </div>
                </div>

                {/* EXP Bar (Bottom) */}
                <div style={{ position: 'absolute', bottom: '0', left: '0', width: '100%', height: '6px', background: '#333' }}>
                    <div style={{ height: '100%', background: COLORS.EXP, width: `${exp}%`, transition: 'width 0.3s' }} />
                </div>
            </div>

            {/* Bottom Controls / Logs */}
            <div style={{ display: 'flex', gap: '10px', width: '800px', marginTop: '10px', height: '120px' }}>
                <div className="nes-container is-dark with-title" style={{ flex: 1 }}>
                    <p className="title">SYSTEM LOG</p>
                    <div style={{ fontSize: '9px', textAlign: 'left' }}>
                        {log.map((m, i) => <div key={i} style={{ opacity: 1 - (i * 0.2) }}>{m}</div>)}
                    </div>
                </div>

                <div className="nes-container is-dark with-title" style={{ width: '300px' }}>
                    <p className="title">SKILLS</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <button className="nes-btn is-primary is-small" onClick={useSkill}>POWER BASH</button>
                        <button className="nes-btn is-error is-small" onClick={onExit}>EXIT GAME</button>
                    </div>
                </div>

                {/* Explicit Sync Demo Button */}
                {client.features.canSyncFlags() && (
                    <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 100 }}>
                        <button className="nes-btn is-warning rumble-on-pop" onClick={startStageTransition}>
                            WORLD UPDATE AVAILABLE! (SYNC NOW)
                        </button>
                    </div>
                )}
            </div>

            {/* Legend / Info */}
            <div style={{ marginTop: '10px', fontSize: '8px', color: '#888', textAlign: 'center' }}>
                ADVENTURE MODE: {client.features.boolVariation('idle-boss-mode', false) ? '!! BOSS INVASION !!' : 'NORMAL'} |
                SPEED: x{client.features.numberVariation('idle-game-speed', 1)} |
                EXP x{client.features.numberVariation('idle-exp-booster', 1)}
            </div>
        </div>
    );
};

export default IdleRPGGame;
