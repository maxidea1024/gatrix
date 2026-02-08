import React, { useEffect, useRef, useState } from 'react';

interface ArkanoidGameProps {
    onExit: () => void;
}

interface Particle {
    x: number;
    y: number;
    dx: number;
    dy: number;
    size: number;
    color: string;
    life: number;
}

interface PowerUp {
    x: number;
    y: number;
    type: 'MULTI' | 'EXPAND' | 'LIFE' | 'SLOW';
    color: string;
    char: string;
}

interface Ball {
    x: number;
    y: number;
    dx: number;
    dy: number;
    active: boolean;
}

interface Level {
    name: string;
    layout: number[][]; // 0: empty, 1: blue, 2: dark-red, 3: red, 4: yellow
}

const LEVELS: Level[] = [
    {
        name: 'BASIC GRID',
        layout: [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 2, 2, 1, 1, 1, 1, 2, 2, 1],
            [1, 3, 3, 3, 4, 4, 3, 3, 3, 1],
            [1, 2, 2, 1, 1, 1, 1, 2, 2, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        ]
    },
    {
        name: 'CUPID HEART',
        layout: [
            [0, 0, 3, 3, 0, 0, 3, 3, 0, 0],
            [0, 3, 4, 4, 3, 3, 4, 4, 3, 0],
            [3, 4, 1, 1, 4, 4, 1, 1, 4, 3],
            [3, 4, 1, 1, 1, 1, 1, 1, 4, 3],
            [0, 3, 4, 1, 1, 1, 1, 4, 3, 0],
            [0, 0, 3, 4, 1, 1, 4, 3, 0, 0],
            [0, 0, 0, 3, 4, 4, 3, 0, 0, 0],
            [0, 0, 0, 0, 3, 3, 0, 0, 0, 0],
        ]
    },
    {
        name: 'SPACE INVADER',
        layout: [
            [0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
            [0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
            [0, 0, 1, 1, 1, 1, 1, 1, 0, 0],
            [0, 1, 1, 2, 1, 1, 2, 1, 1, 0],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 1, 1, 1, 1, 1, 1, 0, 1],
            [1, 0, 1, 0, 0, 0, 0, 1, 0, 1],
            [0, 0, 0, 1, 1, 1, 1, 0, 0, 0],
        ]
    },
    {
        name: 'GATRIX PYRAMID',
        layout: [
            [0, 0, 0, 0, 4, 4, 0, 0, 0, 0],
            [0, 0, 0, 3, 2, 2, 3, 0, 0, 0],
            [0, 0, 2, 1, 1, 1, 1, 2, 0, 0],
            [0, 1, 3, 3, 4, 4, 3, 3, 1, 0],
            [4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
        ]
    },
    {
        name: 'DIAMOND VAULT',
        layout: [
            [0, 0, 0, 0, 4, 4, 0, 0, 0, 0],
            [0, 0, 0, 4, 3, 3, 4, 0, 0, 0],
            [0, 0, 4, 3, 2, 2, 3, 4, 0, 0],
            [0, 4, 3, 2, 1, 1, 2, 3, 4, 0],
            [0, 0, 4, 3, 2, 2, 3, 4, 0, 0],
            [0, 0, 0, 4, 3, 3, 4, 0, 0, 0],
            [0, 0, 0, 0, 4, 4, 0, 0, 0, 0],
        ]
    }
];

const ArkanoidGame: React.FC<ArkanoidGameProps> = ({ onExit }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [gameState, setGameState] = useState<'ready' | 'playing' | 'gameOver' | 'win'>('ready');
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);
    const [levelIndex, setLevelIndex] = useState(0);

    const stateRef = useRef({
        gameState: 'ready' as 'ready' | 'playing' | 'gameOver' | 'win',
        score: 0,
        lives: 3,
        levelIndex: 0,
        paddleX: 340,
        paddleWidth: 120,
        balls: [] as Ball[],
        bricks: [] as { x: number; y: number; status: number; type: number; width: number; height: number }[][],
        particles: [] as Particle[],
        powerUps: [] as PowerUp[],
        expandTimer: 0,
        slowTimer: 0,
        winParticlesTimer: 0,
        keys: {} as Record<string, boolean>
    });

    const ballRadius = 6;
    const paddleHeight = 15;
    const brickWidth = 65;
    const brickHeight = 25;
    const brickPadding = 12;
    const brickOffsetTop = 80;
    const paddleY = 600 - 10 - paddleHeight;

    const initLevel = (idx: number) => {
        const level = LEVELS[idx];
        const cols = level.layout[0].length;
        const brickOffsetLeft = (800 - (cols * (brickWidth + brickPadding) - brickPadding)) / 2;

        stateRef.current.bricks = level.layout.map((row, r) =>
            row.map((type, c) => ({
                x: c * (brickWidth + brickPadding) + brickOffsetLeft,
                y: r * (brickHeight + brickPadding) + brickOffsetTop,
                status: type > 0 ? 1 : 0,
                type: type,
                width: brickWidth,
                height: brickHeight
            }))
        );

        stateRef.current.balls = [{
            x: 400,
            y: paddleY - ballRadius - 2,
            dx: 4,
            dy: -4,
            active: true
        }];
        stateRef.current.paddleX = 400 - stateRef.current.paddleWidth / 2;
        stateRef.current.levelIndex = idx;
        stateRef.current.gameState = 'ready';

        setLevelIndex(idx);
        setGameState('ready');
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        initLevel(0);

        const handleKeyDown = (e: KeyboardEvent) => {
            stateRef.current.keys[e.key] = true;
            if (e.code === 'Space' && stateRef.current.gameState === 'ready') {
                stateRef.current.gameState = 'playing';
                setGameState('playing');
            }
        };
        const handleKeyUp = (e: KeyboardEvent) => { stateRef.current.keys[e.key] = false; };
        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = 800 / rect.width;
            stateRef.current.paddleX = Math.max(0, Math.min(800 - stateRef.current.paddleWidth, (e.clientX - rect.left) * scaleX - stateRef.current.paddleWidth / 2));
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('mousemove', handleMouseMove);

        const loop = () => {
            const s = stateRef.current;
            ctx.clearRect(0, 0, 800, 600);

            // Grid
            ctx.strokeStyle = '#111'; ctx.lineWidth = 1;
            for (let i = 0; i < 800; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 600); ctx.stroke(); }
            for (let i = 0; i < 600; i += 40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(800, i); ctx.stroke(); }

            // Paddle Movement (Keys)
            if (s.keys['ArrowRight'] || s.keys['Right']) s.paddleX = Math.min(800 - s.paddleWidth, s.paddleX + 10);
            if (s.keys['ArrowLeft'] || s.keys['Left']) s.paddleX = Math.max(0, s.paddleX - 10);

            // Sub-stepping for physics accuracy (4 steps per frame)
            const subSteps = 4;
            for (let step = 0; step < subSteps; step++) {
                if (s.gameState !== 'playing') break;

                s.balls.forEach(ball => {
                    if (!ball.active) return;

                    const nextX = ball.x + ball.dx / subSteps;
                    const nextY = ball.y + ball.dy / subSteps;

                    // Wall collision
                    if (nextX > 800 - ballRadius) { ball.x = 800 - ballRadius; ball.dx = -Math.abs(ball.dx); }
                    else if (nextX < ballRadius) { ball.x = ballRadius; ball.dx = Math.abs(ball.dx); }
                    else { ball.x = nextX; }

                    if (nextY < ballRadius) { ball.y = ballRadius; ball.dy = Math.abs(ball.dy); }
                    else if (nextY > 600) { ball.active = false; }
                    else if (nextY >= paddleY - ballRadius && ball.dy > 0) {
                        // Paddle Collision
                        if (ball.x >= s.paddleX && ball.x <= s.paddleX + s.paddleWidth) {
                            ball.y = paddleY - ballRadius;
                            ball.dy = -Math.abs(ball.dy);
                            ball.dx = (ball.x - (s.paddleX + s.paddleWidth / 2)) * 0.18;
                        } else {
                            ball.y = nextY;
                        }
                    } else {
                        ball.y = nextY;
                    }

                    // Brick Collision Detection
                    for (let r = 0; r < s.bricks.length; r++) {
                        let hit = false;
                        for (let c = 0; c < s.bricks[r].length; c++) {
                            const b = s.bricks[r][c];
                            if (b.status === 1) {
                                // AABB Circle collision check
                                const closestX = Math.max(b.x, Math.min(ball.x, b.x + b.width));
                                const closestY = Math.max(b.y, Math.min(ball.y, b.y + b.height));
                                const distX = ball.x - closestX;
                                const distY = ball.y - closestY;
                                const distSq = distX * distX + distY * distY;

                                if (distSq < ballRadius * ballRadius) {
                                    b.status = 0; s.score += 10; setScore(s.score);
                                    // Reflect based on impact direction
                                    if (Math.abs(distX) > Math.abs(distY)) ball.dx = -ball.dx;
                                    else ball.dy = -ball.dy;

                                    // Spontaneous Particles
                                    const brickCols = ['#fff', '#209cee', '#8c2020', '#e76e55', '#f7d51d'];
                                    for (let i = 0; i < 6; i++) {
                                        s.particles.push({
                                            x: closestX, y: closestY, dx: (Math.random() - 0.5) * 10, dy: (Math.random() - 0.5) * 10,
                                            size: Math.random() * 4 + 2, color: brickCols[b.type] || '#fff', life: 1.0
                                        });
                                    }

                                    // Item Drop
                                    if (Math.random() > 0.88) {
                                        const types: PowerUp['type'][] = ['MULTI', 'EXPAND', 'LIFE', 'SLOW'];
                                        const type = types[Math.floor(Math.random() * 4)];
                                        const pCols = { MULTI: '#92cc41', EXPAND: '#209cee', LIFE: '#e76e55', SLOW: '#f7d51d' };
                                        s.powerUps.push({ x: b.x + b.width / 2, y: b.y + b.height / 2, type, char: type[0], color: pCols[type] });
                                    }
                                    hit = true; break;
                                }
                            }
                        }
                        if (hit) break;
                    }
                });
            }

            // Draw Bricks
            let bricksLeft = 0;
            s.bricks.forEach(row => row.forEach(b => {
                if (b.status === 1) {
                    bricksLeft++;
                    const colors = ['#000', '#209cee', '#8c2020', '#e76e55', '#f7d51d'];
                    ctx.fillStyle = colors[b.type]; ctx.fillRect(b.x, b.y, b.width, b.height);
                    ctx.strokeStyle = '#000'; ctx.strokeRect(b.x, b.y, b.width, b.height);
                    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(b.x + 2, b.y + 2, b.width - 4, 4);
                }
            }));

            // Power-ups and Particles (Non-Sub-stepped for performance)
            s.particles = s.particles.filter(p => p.life > 0);
            s.particles.forEach(p => {
                p.x += p.dx; p.y += p.dy; p.life -= 0.02;
                ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.size, p.size);
            });
            ctx.globalAlpha = 1.0;

            s.powerUps = s.powerUps.filter(p => p.y < 600);
            s.powerUps.forEach(p => {
                p.y += 2.5; ctx.fillStyle = '#fff'; ctx.fillRect(p.x - 12, p.y - 12, 24, 24);
                ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.strokeRect(p.x - 12, p.y - 12, 24, 24);
                ctx.fillStyle = p.color; ctx.font = 'bold 16px "Press Start 2P"'; ctx.textAlign = 'center'; ctx.fillText(p.char, p.x, p.y + 8);
                if (p.y + 12 >= paddleY && p.x >= s.paddleX && p.x <= s.paddleX + s.paddleWidth) {
                    if (p.type === 'MULTI') {
                        const b = s.balls.find(ball => ball.active) || s.balls[0];
                        s.balls.push({ x: b.x, y: b.y, dx: 4.5, dy: -4.5, active: true }, { x: b.x, y: b.y, dx: -4.5, dy: -4.5, active: true });
                    } else if (p.type === 'EXPAND') { s.paddleWidth = 200; s.expandTimer = 600; }
                    else if (p.type === 'LIFE') { s.lives = Math.min(5, s.lives + 1); setLives(s.lives); }
                    else if (p.type === 'SLOW') { s.balls.forEach(b => { b.dx *= 0.7; b.dy *= 0.7; }); }
                    p.y = 700;
                }
            });

            if (s.expandTimer > 0) { s.expandTimer--; if (s.expandTimer === 0) s.paddleWidth = 120; }

            // Draw Paddle
            ctx.fillStyle = '#209cee'; ctx.fillRect(s.paddleX, paddleY, s.paddleWidth, paddleHeight);
            ctx.fillStyle = '#fff'; ctx.fillRect(s.paddleX, paddleY, s.paddleWidth, 3);
            ctx.fillStyle = '#0069c0'; ctx.fillRect(s.paddleX, paddleY + paddleHeight - 3, s.paddleWidth, 3);

            // Draw Balls
            let activeCount = 0;
            s.balls.forEach(ball => {
                if (!ball.active) return; activeCount++;
                if (s.gameState === 'ready') { ball.x = s.paddleX + s.paddleWidth / 2; ball.y = paddleY - ballRadius - 2; }
                ctx.beginPath(); ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2); ctx.fillStyle = '#f7d51d'; ctx.fill(); ctx.closePath();
                ctx.fillStyle = '#fff'; ctx.fillRect(ball.x - 2, ball.y - 2, 3, 3);
            });

            // Logic Check
            if (activeCount === 0 && s.gameState === 'playing') {
                s.lives--; setLives(s.lives);
                if (s.lives <= 0) { s.gameState = 'gameOver'; setGameState('gameOver'); }
                else { s.gameState = 'ready'; setGameState('ready'); s.balls = [{ x: 400, y: 550, dx: 4, dy: -4, active: true }]; }
            }
            if (bricksLeft === 0 && s.gameState === 'playing') {
                if (s.levelIndex < LEVELS.length - 1) initLevel(s.levelIndex + 1);
                else { s.gameState = 'win'; setGameState('win'); s.winParticlesTimer = 180; }
            }
            if (s.gameState === 'win' && s.winParticlesTimer > 0) {
                s.winParticlesTimer--;
                for (let i = 0; i < 2; i++) s.particles.push({ x: Math.random() * 800, y: Math.random() * 600, dx: (Math.random() - 0.5) * 5, dy: (Math.random() - 0.5) * 5, size: Math.random() * 5 + 2, color: `hsl(${Math.random() * 360}, 100%, 70%)`, life: 1.0 });
            }

            // CRT Overlay
            ctx.fillStyle = 'rgba(0,0,0,0.06)'; for (let i = 0; i < 600; i += 4) ctx.fillRect(0, i, 800, 2);
            animationFrameIdRef.current = requestAnimationFrame(loop);
        };

        const animationFrameIdRef = { current: requestAnimationFrame(loop) };
        return () => {
            window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); window.removeEventListener('mousemove', handleMouseMove);
            cancelAnimationFrame(animationFrameIdRef.current);
        };
    }, []);

    const handleRetry = () => { stateRef.current.score = 0; setScore(0); stateRef.current.lives = 3; setLives(3); initLevel(0); };

    return (
        <div className="arkanoid-fullscreen">
            <div className="game-header">
                <h1 className="nes-text is-primary">GATRIX ARKANOID ELITE</h1>
                <div className="score-board">
                    <span className="nes-text">STAGE: {levelIndex + 1} / {LEVELS.length}</span>
                    <span className="nes-text" style={{ margin: '0 40px' }}>SCORE: {score}</span>
                    <span className="nes-text is-error">LIVES: {'❤️'.repeat(lives)}</span>
                </div>
            </div>
            <div className="game-canvas-container">
                <canvas ref={canvasRef} width={800} height={600} className="pixel-canvas" />
                {gameState === 'ready' && <div className="game-over-overlay" style={{ background: 'transparent', pointerEvents: 'none' }}><div className="nes-container is-dark with-title"><p className="title">SYSTEM READY</p><p style={{ fontSize: '12px' }}>PRESS [SPACE] TO INITIALIZE</p></div></div>}
                {(gameState === 'gameOver' || gameState === 'win') && <div className="game-over-overlay"><div className="nes-container is-dark with-title"><p className="title">{gameState === 'win' ? 'VICTORY' : 'DEFEAT'}</p><h2 className={gameState === 'win' ? 'nes-text is-success' : 'nes-text is-error'}>{gameState === 'win' ? 'GATRIX RESTORED!' : 'SYSTEM FAILURE'}</h2><div className="menu-buttons"><button type="button" className="nes-btn is-primary" onClick={handleRetry}>REBOOT</button><button type="button" className="nes-btn is-error" onClick={onExit}>ABORT</button></div></div></div>}
            </div>
            <div className="game-footer"><p className="nes-text is-disabled">ITEM: M(Multi), E(Expand), H(Heart), S(Slow)</p><div style={{ marginTop: '10px' }}><button type="button" className="nes-btn" onClick={onExit}>EXIT TO CONSOLE</button></div></div>
            <div className="crt-overlay"></div>
        </div>
    );
};

export default ArkanoidGame;
