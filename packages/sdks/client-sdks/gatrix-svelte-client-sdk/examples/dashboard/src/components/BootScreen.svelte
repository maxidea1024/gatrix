<script lang="ts">
  import { onMount } from 'svelte';

  export let onComplete: () => void;

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

  let visibleLines = 0;
  let progress = 0;

  onMount(() => {
    // Show messages one by one
    const timers: ReturnType<typeof setTimeout>[] = [];
    BOOT_MESSAGES.forEach((msg, index) => {
      const t = setTimeout(() => {
        visibleLines = index + 1;
      }, msg.delay);
      timers.push(t);
    });

    // Progress bar animation
    const progressInterval = setInterval(() => {
      progress += 1;
      if (progress >= 100) {
        clearInterval(progressInterval);
        progress = 100;
      }
    }, 30);

    // Complete after minimum boot time
    const completeTimeout = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => {
      timers.forEach(t => clearTimeout(t));
      clearInterval(progressInterval);
      clearTimeout(completeTimeout);
    };
  });
</script>

<div class="boot-screen">
  <div class="boot-logo">
    <i class="nes-icon trophy is-large"></i>
  </div>

  <div style="min-height: 250px">
    {#each BOOT_MESSAGES.slice(0, visibleLines) as msg, index}
      <div class="boot-text" style="animation-delay: {msg.delay}ms">
        {msg.text || '\u00A0'}
        {#if index === visibleLines - 1 && msg.text}
          <span class="boot-cursor">_</span>
        {/if}
      </div>
    {/each}
  </div>

  <div class="boot-progress">
    <progress class="nes-progress is-success" value={progress} max="100"></progress>
  </div>

  <div class="boot-text dim" style="margin-top: 24px">
    NOW LOADING...
  </div>
</div>
