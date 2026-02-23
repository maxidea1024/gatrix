<script lang="ts">
  import { onMount } from 'svelte';

  export let onComplete: () => void;

  const DISCONNECT_MESSAGES = [
    { text: 'DISCONNECTING FROM GATRIX...', delay: 0 },
    { text: '', delay: 300 },
    { text: 'SAVING SESSION DATA... OK', delay: 500 },
    { text: 'CLOSING CONNECTIONS... OK', delay: 1000 },
    { text: 'CLEARING CACHE... OK', delay: 1500 },
    { text: '', delay: 1800 },
    { text: 'GOODBYE!', delay: 2000 },
  ];

  let visibleMessages: string[] = [];
  let showGoodbye = false;

  onMount(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    DISCONNECT_MESSAGES.forEach((msg) => {
      const timer = setTimeout(() => {
        visibleMessages = [...visibleMessages, msg.text];
      }, msg.delay);
      timers.push(timer);
    });

    const goodbyeTimer = setTimeout(() => {
      showGoodbye = true;
    }, 2200);
    timers.push(goodbyeTimer);

    const completeTimer = setTimeout(() => {
      onComplete();
    }, 4700);
    timers.push(completeTimer);

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  });
</script>

<div
  style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background-color:#212529;color:#fff;font-family:'Press Start 2P',cursive;text-align:center;padding:24px"
>
  <div style="min-height:200px;margin-bottom:24px">
    {#each visibleMessages as msg}
      <div
        style="font-size:10px;margin-bottom:8px;color:{msg === 'GOODBYE!' ? '#e76e55' : '#adafbc'}"
      >
        {msg || '\u00A0'}
      </div>
    {/each}
    {#if showGoodbye}
      <div style="margin-top:16px;animation:sad-sway 1s ease-in-out infinite">
        <i class="nes-bcrikko"></i>
      </div>
    {/if}
  </div>
</div>
