<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const canvasRef = ref<HTMLCanvasElement | null>(null);

onMounted(() => {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const fontSize = 20;
  let columns = Math.floor(window.innerWidth / fontSize);
  let drops: number[] = new Array(columns).fill(1).map(() => Math.floor(Math.random() * -100));

  const updateSize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const newColumns = Math.floor(canvas.width / fontSize);
    if (newColumns !== columns) {
      const newDrops = new Array(newColumns).fill(0).map((_, i) =>
        i < drops.length ? drops[i] : Math.floor(Math.random() * -100),
      );
      columns = newColumns;
      drops = newDrops;
    }
  };
  updateSize();
  window.addEventListener('resize', updateSize);

  const chars =
    'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝabcdefghijklmnopqrstuvwxyz0123456789';
  const charArray = chars.split('');

  let animationId: number;
  let lastTime = 0;
  const fps = 20;
  const interval = 1000 / fps;

  const render = (timestamp: number) => {
    if (timestamp - lastTime > interval) {
      lastTime = timestamp;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px "Courier New", Courier, monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = charArray[Math.floor(Math.random() * charArray.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        ctx.fillStyle = Math.random() > 0.98 ? 'rgba(200, 255, 200, 0.9)' : 'rgba(0, 200, 80, 0.7)';
        ctx.fillText(text, x, y);
        if (y > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    }
    animationId = requestAnimationFrame(render);
  };

  animationId = requestAnimationFrame(render);

  onUnmounted(() => {
    window.removeEventListener('resize', updateSize);
    cancelAnimationFrame(animationId);
  });
});
</script>

<template>
  <div
    :style="{
      position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
      zIndex: -2, backgroundColor: '#000', overflow: 'hidden',
    }"
  >
    <canvas
      ref="canvasRef"
      :style="{
        display: 'block', imageRendering: 'pixelated',
        filter: 'contrast(1.2) brightness(1.0)', opacity: '0.8',
      }"
    />
    <div
      :style="{
        position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
        background: 'radial-gradient(circle at center, transparent 10%, rgba(0,0,0,0.85) 100%)',
        pointerEvents: 'none',
      }"
    />
  </div>
</template>
