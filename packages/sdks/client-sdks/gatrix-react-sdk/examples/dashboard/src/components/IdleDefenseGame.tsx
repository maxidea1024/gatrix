import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useGatrixClient, useGatrixContext } from '@gatrix/react-sdk';
import { createInitialState, tick, useSkill as engineUseSkill } from './idle-defense/GameEngine';
import type { GameState, FeatureFlagReader } from './idle-defense/GameEngine';
import { createRenderer, renderFrame, destroyRenderer } from './idle-defense/GameRenderer';
import type { RendererObjects } from './idle-defense/GameRenderer';
import type { UIPanel } from './idle-defense/GameTypes';
import { shopItemToInventory } from './idle-defense/GameData';
import { InventoryPanel, ShopPanel, MailPanel, GameHUD } from './idle-defense/GameUI';

interface IdleDefenseGameProps {
    onExit: () => void;
}

const IdleDefenseGame: React.FC<IdleDefenseGameProps> = ({ onExit }) => {
    const canvasRef = useRef<HTMLDivElement>(null);
    const client = useGatrixClient();
    const { syncFlags } = useGatrixContext();

    // Game state ref (mutable, not triggering re-renders on every frame)
    const gsRef = useRef<GameState>(createInitialState());
    const rendererRef = useRef<RendererObjects | null>(null);

    // React state for HUD (synced periodically)
    const [hudHero, setHudHero] = useState(gsRef.current.hero);
    const [skills, setSkills] = useState(gsRef.current.skills);
    const [inventory, setInventory] = useState(gsRef.current.inventory);
    const [mails, setMails] = useState(gsRef.current.mails);
    const [shopItems, setShopItems] = useState(gsRef.current.shopItems);
    const [activePanel, setActivePanel] = useState<UIPanel>('none');
    const [log, setLog] = useState<string[]>([]);
    const [gameState, setGameState] = useState<'playing' | 'loading'>('playing');

    const addLog = useCallback((msg: string) => {
        setLog(prev => [msg, ...prev].slice(0, 15));
    }, []);

    // Sync React state from game state
    const syncHud = useCallback(() => {
        const gs = gsRef.current;
        setHudHero({ ...gs.hero });
        setSkills([...gs.skills]);
        setInventory([...gs.inventory]);
        setMails([...gs.mails]);
        setShopItems([...gs.shopItems]);
    }, []);

    // Feature flag reader adapter
    const flagReader = useCallback((): FeatureFlagReader => ({
        boolVariation: (key: string, def: boolean) => client.features.boolVariation(key, def),
        numberVariation: (key: string, def: number) => client.features.numberVariation(key, def),
    }), [client]);

    // Initialize PIXI.js and game loop
    useEffect(() => {
        let destroyed = false;
        let renderer: RendererObjects | null = null;

        const init = async () => {
            if (!canvasRef.current) return;
            renderer = await createRenderer(canvasRef.current);
            if (destroyed) {
                destroyRenderer(renderer);
                return;
            }
            rendererRef.current = renderer;

            let hudSyncCounter = 0;

            renderer.app.ticker.add((ticker) => {
                if (destroyed) return;
                const gs = gsRef.current;
                const delta = ticker.deltaTime;

                try {
                    // Run game logic
                    tick(gs, delta, flagReader(), addLog);

                    // Render via PIXI.js
                    if (renderer) {
                        renderFrame(renderer, gs);
                    }
                } catch (e) {
                    console.error('Game loop error:', e);
                }

                // Sync HUD every 10 frames
                hudSyncCounter++;
                if (hudSyncCounter >= 10) {
                    hudSyncCounter = 0;
                    syncHud();
                }
            });
        };

        init();

        return () => {
            destroyed = true;
            if (renderer) destroyRenderer(renderer);
        };
    }, [flagReader, addLog, syncHud]);

    // ---- UI Handlers ----
    const handleSkillUse = useCallback((skillId: string) => {
        engineUseSkill(gsRef.current, skillId, flagReader(), addLog);
        syncHud();
    }, [flagReader, addLog, syncHud]);

    const handleBuy = useCallback((shopItemId: string) => {
        const gs = gsRef.current;
        const item = gs.shopItems.find(s => s.id === shopItemId);
        if (!item || gs.hero.gold < item.price) return;
        gs.hero.gold -= item.price;
        const invItem = shopItemToInventory(item);
        const existing = gs.inventory.find(i => i.name === invItem.name && i.rarity === invItem.rarity);
        if (existing) {
            existing.quantity += 1;
        } else {
            gs.inventory.push(invItem);
        }
        addLog(`🏪 Bought ${item.icon} ${item.name}!`);
        syncHud();
    }, [addLog, syncHud]);

    const handleSell = useCallback((itemId: string) => {
        const gs = gsRef.current;
        const idx = gs.inventory.findIndex(i => i.id === itemId);
        if (idx < 0) return;
        const item = gs.inventory[idx];
        gs.hero.gold += item.sellPrice * item.quantity;
        addLog(`💰 Sold ${item.icon} ${item.name} for ${item.sellPrice * item.quantity}G`);
        gs.inventory.splice(idx, 1);
        syncHud();
    }, [addLog, syncHud]);

    const handleEquip = useCallback((itemId: string) => {
        const gs = gsRef.current;
        const item = gs.inventory.find(i => i.id === itemId);
        if (!item) return;

        if (item.equipped) {
            // Unequip
            item.equipped = false;
            if (item.stat?.atk) gs.hero.atk -= item.stat.atk;
            if (item.stat?.def) gs.hero.def -= item.stat.def;
            if (item.stat?.hp) { gs.hero.maxHp -= item.stat.hp; gs.hero.hp = Math.min(gs.hero.hp, gs.hero.maxHp); }
            addLog(`🔽 Unequipped ${item.icon} ${item.name}`);
        } else {
            // Unequip other items of same type first
            for (const other of gs.inventory) {
                if (other.type === item.type && other.equipped) {
                    other.equipped = false;
                    if (other.stat?.atk) gs.hero.atk -= other.stat.atk;
                    if (other.stat?.def) gs.hero.def -= other.stat.def;
                    if (other.stat?.hp) { gs.hero.maxHp -= other.stat.hp; gs.hero.hp = Math.min(gs.hero.hp, gs.hero.maxHp); }
                }
            }
            item.equipped = true;
            if (item.stat?.atk) gs.hero.atk += item.stat.atk;
            if (item.stat?.def) gs.hero.def += item.stat.def;
            if (item.stat?.hp) { gs.hero.maxHp += item.stat.hp; gs.hero.hp = Math.min(gs.hero.hp, gs.hero.maxHp); }
            addLog(`🔼 Equipped ${item.icon} ${item.name}`);
        }
        syncHud();
    }, [addLog, syncHud]);

    const handleClaimMail = useCallback((mailId: string) => {
        const gs = gsRef.current;
        const mail = gs.mails.find(m => m.id === mailId);
        if (!mail || mail.claimed) return;
        mail.read = true;
        mail.claimed = true;
        if (mail.rewards?.gold) gs.hero.gold += mail.rewards.gold;
        if (mail.rewards?.items) {
            for (const item of mail.rewards.items) {
                const existing = gs.inventory.find(i => i.name === item.name);
                if (existing) existing.quantity += item.quantity;
                else gs.inventory.push({ ...item });
            }
        }
        addLog(`📬 Claimed: ${mail.subject}`);
        syncHud();
    }, [addLog, syncHud]);

    const handleClaimAll = useCallback(() => {
        const gs = gsRef.current;
        for (const mail of gs.mails) {
            if (!mail.claimed && mail.rewards) {
                mail.read = true;
                mail.claimed = true;
                if (mail.rewards.gold) gs.hero.gold += mail.rewards.gold;
                if (mail.rewards.items) {
                    for (const item of mail.rewards.items) {
                        const existing = gs.inventory.find(i => i.name === item.name);
                        if (existing) existing.quantity += item.quantity;
                        else gs.inventory.push({ ...item });
                    }
                }
            }
        }
        addLog('📬 Claimed all mail rewards!');
        syncHud();
    }, [addLog, syncHud]);

    const handleSyncFlags = useCallback(async () => {
        gsRef.current.isPaused = true;
        setGameState('loading');
        await syncFlags(true);
        setTimeout(() => {
            gsRef.current.isPaused = false;
            setGameState('playing');
            addLog('🔄 Config synced from server!');
        }, 1500);
    }, [syncFlags, addLog]);

    const expPercent = hudHero.maxExp > 0
        ? Math.min(100, (hudHero.exp / hudHero.maxExp) * 100)
        : 0;

    const flagStatus = {
        bossMode: client.features.boolVariation('idle-boss-mode', false),
        gameSpeed: client.features.numberVariation('idle-game-speed', 1),
        expBooster: client.features.numberVariation('idle-exp-booster', 1),
        autoSkill: client.features.boolVariation('idle-auto-skill', false),
    };

    return (
        <div style={{
            background: '#111', height: '100vh',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
            <GameHUD
                hero={hudHero}
                skills={skills}
                activePanel={activePanel}
                unreadMails={mails.filter(m => !m.read).length}
                inventoryCount={inventory.length}
                onSkillUse={handleSkillUse}
                onOpenPanel={setActivePanel}
                onExit={onExit}
                flagStatus={flagStatus}
            />

            {/* Game Canvas */}
            <div style={{
                position: 'relative', border: '4px solid #444',
                width: '808px', height: '408px', overflow: 'hidden', borderRadius: '4px',
            }}>
                <div ref={canvasRef} />

                {/* UI Panels overlay */}
                {activePanel === 'inventory' && (
                    <InventoryPanel items={inventory} onClose={() => setActivePanel('none')}
                        onSell={handleSell} onEquip={handleEquip} />
                )}
                {activePanel === 'shop' && (
                    <ShopPanel items={shopItems} gold={hudHero.gold}
                        onClose={() => setActivePanel('none')} onBuy={handleBuy} />
                )}
                {activePanel === 'mail' && (
                    <MailPanel mails={mails} onClose={() => setActivePanel('none')}
                        onClaim={handleClaimMail} onClaimAll={handleClaimAll} />
                )}

                {/* Loading overlay */}
                {gameState === 'loading' && (
                    <div style={{
                        position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                        background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', zIndex: 40,
                    }}>
                        <div className="nes-container is-dark with-title" style={{ width: '350px' }}>
                            <p className="title">SYNCING FLAGS</p>
                            <div style={{ textAlign: 'center' }}>
                                <i className="nes-icon is-large star"></i>
                                <p style={{ fontSize: '11px', marginTop: '12px' }}>Fetching feature config...</p>
                                <progress className="nes-progress is-success" max={100}></progress>
                            </div>
                        </div>
                    </div>
                )}

                {/* Sync button */}
                {client.features.canSyncFlags() && (
                    <div style={{
                        position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 20,
                    }}>
                        <button className="nes-btn is-warning" onClick={handleSyncFlags}
                            style={{ fontSize: '10px', animation: 'pulse 1s infinite' }}>
                            ⚡ NEW CONFIG — SYNC NOW
                        </button>
                    </div>
                )}

                {/* EXP bar */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '6px', background: '#333' }}>
                    <div style={{ height: '100%', background: '#92cc41', width: `${expPercent}%`, transition: 'width 0.3s' }} />
                </div>
            </div>

            {/* Battle Log - Expanded and Cleaned */}
            <div className="nes-container is-dark with-title" style={{
                width: '800px', height: '180px', overflow: 'hidden', marginTop: '10px',
                padding: '10px'
            }}>
                <p className="title" style={{ backgroundColor: '#212529' }}>BATTLE LOG</p>
                <div style={{
                    fontSize: '11px', textAlign: 'left', lineHeight: '1.4',
                    display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '12px'
                }}>
                    {log.map((m, i) => (
                        <div key={i} style={{
                            opacity: 1 - i * 0.06,
                            borderBottom: i === 0 ? '1px solid #444' : 'none',
                            paddingBottom: i === 0 ? '4px' : 0,
                            color: i === 0 ? '#fff' : '#ccc'
                        }}>
                            {i === 0 ? '▶ ' : '  '}{m}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default IdleDefenseGame;
