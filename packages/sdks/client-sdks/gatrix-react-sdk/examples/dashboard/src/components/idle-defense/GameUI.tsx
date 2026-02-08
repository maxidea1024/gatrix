import React from 'react';
import { InventoryItem, ShopItem, MailItem, SkillDef, HeroStats, UIPanel, RARITY_COLORS } from './GameTypes';

const panelOverlayStyle: React.CSSProperties = {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 100, padding: '20px',
};

const internalPanelStyle: React.CSSProperties = {
    width: '100%', maxHeight: '90%', overflowY: 'auto',
    backgroundColor: '#212529', color: 'white', border: '4px solid #fff',
    padding: '1.5rem',
};

// --- Inventory Panel ---
interface InventoryPanelProps {
    items: InventoryItem[];
    onClose: () => void;
    onSell: (id: string) => void;
    onEquip: (id: string) => void;
}

export const InventoryPanel: React.FC<InventoryPanelProps> = ({ items, onClose, onSell, onEquip }) => (
    <div style={panelOverlayStyle}>
        <div className="nes-container is-dark with-title" style={internalPanelStyle}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
                {items.length === 0 && <p style={{ gridColumn: '1/-1', textAlign: 'center' }}>BAG IS EMPTY.</p>}
                {items.map(item => (
                    <div key={item.id} className="nes-container is-rounded" style={{ padding: '8px', fontSize: '10px', backgroundColor: '#333' }}>
                        <div style={{ fontSize: '16px', marginBottom: '4px' }}>{item.icon}</div>
                        <div style={{ color: RARITY_COLORS[item.rarity], fontWeight: 'bold' }}>{item.name}</div>
                        <div>x{item.quantity}</div>
                        <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexDirection: 'column' }}>
                            <button className={`nes-btn is-small ${item.equipped ? 'is-error' : 'is-success'}`} onClick={() => onEquip(item.id)} style={{ fontSize: '8px', padding: '2px 4px' }}>
                                {item.equipped ? 'REMOVE' : 'EQUIP'}
                            </button>
                            <button className="nes-btn is-small" onClick={() => onSell(item.id)} style={{ fontSize: '8px', padding: '2px 4px' }}>SELL</button>
                        </div>
                    </div>
                ))}
            </div>
            <button className="nes-btn is-error" onClick={onClose} style={{ marginTop: '20px', width: '100%' }}>CLOSE</button>
        </div>
    </div>
);

// --- Shop Panel ---
interface ShopPanelProps {
    items: ShopItem[];
    gold: number;
    onClose: () => void;
    onBuy: (id: string) => void;
}

export const ShopPanel: React.FC<ShopPanelProps> = ({ items, gold, onClose, onBuy }) => (
    <div style={panelOverlayStyle}>
        <div className="nes-container is-dark with-title" style={internalPanelStyle}>
            <p className="title">WAVE SHOP (GOLD: {gold}G)</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                {items.map(item => (
                    <div key={item.id} className="nes-container is-rounded" style={{ padding: '8px', fontSize: '10px', backgroundColor: '#333' }}>
                        <div style={{ fontSize: '16px' }}>{item.icon}</div>
                        <div style={{ color: RARITY_COLORS[item.rarity], marginBottom: '4px' }}>{item.name}</div>
                        <div style={{ color: '#f7d51d' }}>{item.price}G</div>
                        <button className={`nes-btn is-small ${gold < item.price ? 'is-disabled' : 'is-primary'}`}
                            disabled={gold < item.price}
                            onClick={() => onBuy(item.id)}
                            style={{ fontSize: '8px', marginTop: '8px', width: '100%', padding: '2px 4px' }}>BUY</button>
                    </div>
                ))}
            </div>
            <button className="nes-btn is-error" onClick={onClose} style={{ marginTop: '20px', width: '100%' }}>CLOSE</button>
        </div>
    </div>
);

// --- Mail Panel ---
interface MailPanelProps {
    mails: MailItem[];
    onClose: () => void;
    onClaim: (id: string) => void;
    onClaimAll: () => void;
}

export const MailPanel: React.FC<MailPanelProps> = ({ mails, onClose, onClaim, onClaimAll }) => (
    <div style={panelOverlayStyle}>
        <div className="nes-container is-dark with-title" style={internalPanelStyle}>
            <p className="title">POST OFFICE</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {mails.length === 0 && <p style={{ textAlign: 'center' }}>INBOX IS EMPTY.</p>}
                {mails.map(mail => (
                    <div key={mail.id} className="nes-container is-rounded is-dark" style={{ padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '10px' }}>
                            <div style={{ fontWeight: 'bold', color: mail.read ? '#aaa' : '#fff' }}>{mail.subject} {mail.read ? '' : '🆕'}</div>
                            <div style={{ fontSize: '8px', color: '#ccc' }}>{mail.body}</div>
                        </div>
                        <button className={`nes-btn is-small ${mail.claimed ? 'is-disabled' : 'is-warning'}`}
                            disabled={mail.claimed}
                            onClick={() => onClaim(mail.id)}
                            style={{ fontSize: '8px', padding: '4px 8px' }}>{mail.claimed ? 'CLAIMED' : 'CLAIM'}</button>
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                <button className="nes-btn is-primary" style={{ flex: 1 }} onClick={onClaimAll}>CLAIM ALL</button>
                <button className="nes-btn is-error" style={{ flex: 1 }} onClick={onClose}>CLOSE</button>
            </div>
        </div>
    </div>
);

// --- Game HUD ---
interface GameHUDProps {
    hero: HeroStats;
    skills: SkillDef[];
    activePanel: UIPanel;
    unreadMails: number;
    inventoryCount: number;
    onSkillUse: (id: string) => void;
    onOpenPanel: (panel: UIPanel) => void;
    onExit: () => void;
    flagStatus: { bossMode: boolean; gameSpeed: number; expBooster: number; autoSkill: boolean };
}

export const GameHUD: React.FC<GameHUDProps> = ({
    hero, skills, activePanel, unreadMails, inventoryCount, onSkillUse, onOpenPanel, onExit, flagStatus
}) => {
    return (
        <div style={{ width: '800px', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '8px' }}>
            {/* Header: Title & Global Stats */}
            <div className="nes-container is-dark with-title" style={{ padding: '10px', margin: 0 }}>
                <p className="title" style={{ backgroundColor: '#212529' }}>SLIME DEFENSE</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <span style={{ color: '#fff' }}>STAGE <span style={{ color: '#f7d51d' }}>{hero.wave}</span></span>
                        <span style={{ color: '#f7d51d' }}>💰 {hero.gold.toLocaleString()}</span>
                        <span style={{ color: '#92cc41' }}>LV.{hero.level}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '15px' }}>
                        <span style={{ color: '#ff4444' }}>HP {hero.hp}/{hero.maxHp}</span>
                        <span>⚔️ {hero.atk}</span>
                        <span>🛡️ {hero.def}</span>
                        <span style={{ color: '#aaa' }}>💀 {hero.kills}</span>
                    </div>
                </div>
            </div>

            {/* Middle: Skills & Menu */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '12px' }}>
                {/* Skills Container */}
                <div className="nes-container is-dark with-title" style={{ padding: '10px' }}>
                    <p className="title" style={{ backgroundColor: '#212529' }}>SKILLS</p>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '5px' }}>
                        {skills.map(skill => {
                            const isOnCd = skill.currentCd > 0;
                            const cdPercent = isOnCd ? (skill.currentCd / skill.cooldown) * 100 : 0;
                            return (
                                <button key={skill.id}
                                    className={`nes-btn ${isOnCd ? 'is-disabled' : 'is-primary'}`}
                                    disabled={isOnCd}
                                    onClick={() => onSkillUse(skill.id)}
                                    style={{
                                        position: 'relative', fontSize: '9px', padding: '6px 12px', minWidth: '100px',
                                        overflow: 'hidden'
                                    }}>
                                    {isOnCd && (
                                        <div style={{
                                            position: 'absolute', bottom: 0, left: 0, width: '100%',
                                            height: `${cdPercent}%`,
                                            background: 'rgba(0,0,0,0.5)',
                                            pointerEvents: 'none',
                                            transition: 'height 0.1s linear',
                                            zIndex: 1
                                        }} />
                                    )}
                                    <span style={{ position: 'relative', zIndex: 2 }}>
                                        {skill.icon} {skill.name} {isOnCd && `(${Math.ceil(skill.currentCd / 60)}s)`}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Menu Buttons Container */}
                <div className="nes-container is-dark with-title" style={{ padding: '10px' }}>
                    <p className="title" style={{ backgroundColor: '#212529' }}>MENU</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '5px' }}>
                        <button className={`nes-btn is-small ${activePanel === 'inventory' ? 'is-primary' : ''}`}
                            onClick={() => onOpenPanel(activePanel === 'inventory' ? 'none' : 'inventory')}
                            style={{ fontSize: '9px', padding: '4px' }}>
                            BAG({inventoryCount})
                        </button>
                        <button className={`nes-btn is-small ${activePanel === 'shop' ? 'is-primary' : ''}`}
                            onClick={() => onOpenPanel(activePanel === 'shop' ? 'none' : 'shop')}
                            style={{ fontSize: '9px', padding: '4px' }}>
                            SHOP
                        </button>
                        <button className={`nes-btn is-small ${activePanel === 'mail' ? 'is-primary' : ''}`}
                            onClick={() => onOpenPanel(activePanel === 'mail' ? 'none' : 'mail')}
                            style={{ fontSize: '9px', padding: '4px' }}>
                            MAIL{unreadMails > 0 ? `(${unreadMails})` : ''}
                        </button>
                        <button className="nes-btn is-error is-small" onClick={onExit} style={{ fontSize: '9px', padding: '4px' }}>
                            EXIT
                        </button>
                    </div>
                </div>
            </div>

            {/* Feature Flag Labels (Clean horizontal row) */}
            <div style={{
                display: 'flex', gap: '12px', fontSize: '8px', justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.5)', padding: '4px', borderRadius: '4px'
            }}>
                <span style={{ color: flagStatus.bossMode ? '#f7d51d' : '#888' }}>● BOSS: {flagStatus.bossMode ? 'ON' : 'OFF'}</span>
                <span style={{ color: flagStatus.gameSpeed > 1 ? '#92cc41' : '#888' }}>● SPEED: x{flagStatus.gameSpeed}</span>
                <span style={{ color: flagStatus.expBooster > 1 ? '#92cc41' : '#888' }}>● EXP: x{flagStatus.expBooster}</span>
                <span style={{ color: flagStatus.autoSkill ? '#209cee' : '#888' }}>● AUTO-SKILL: {flagStatus.autoSkill ? 'ON' : 'OFF'}</span>
            </div>
        </div>
    );
};
