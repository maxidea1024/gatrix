<script lang="ts">
  export interface LogEntry {
    id: number;
    level: 'debug' | 'info' | 'warn' | 'error';
    message: string;
    timestamp: Date;
    args: any[];
  }

  export let logs: LogEntry[] = [];
  export let onClose: () => void;
  export let onClear: () => void;

  let filterLevel: 'all' | 'debug' | 'info' | 'warn' | 'error' = 'all';
  let searchQuery = '';
  let autoScroll = true;
  let logListEl: HTMLElement;
  let panelWidth = parseInt(localStorage.getItem('gatrix-log-panel-width') || '420', 10);
  let isResizing = false;

  $: filteredLogs = logs.filter((l) => {
    if (filterLevel !== 'all' && l.level !== filterLevel) return false;
    if (searchQuery) return l.message.toLowerCase().includes(searchQuery.toLowerCase());
    return true;
  });

  $: countByLevel = (() => {
    const counts = { debug: 0, info: 0, warn: 0, error: 0 };
    for (const log of logs) counts[log.level]++;
    return counts;
  })();

  // Auto-scroll when logs change
  $: if (autoScroll && logs.length && logListEl) {
    requestAnimationFrame(() => {
      if (logListEl) logListEl.scrollTop = logListEl.scrollHeight;
    });
  }

  function getLevelColor(level: string): string {
    switch (level) {
      case 'debug': return '#adafbc';
      case 'info': return '#209cee';
      case 'warn': return '#f7d51d';
      case 'error': return '#e76e55';
      default: return '#fff';
    }
  }

  function getLevelIcon(level: string): string {
    switch (level) {
      case 'debug': return '⚙';
      case 'info': return 'ℹ';
      case 'warn': return '⚠';
      case 'error': return '✕';
      default: return '•';
    }
  }

  function formatTime(date: Date): string {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    return `${h}:${m}:${s}.${ms}`;
  }

  function formatArgs(args: any[]): string {
    if (!args || args.length === 0) return '';
    return args.map((a) => {
      try {
        if (typeof a === 'object') return JSON.stringify(a);
        return String(a);
      } catch { return String(a); }
    }).join(' ');
  }

  function onResizeStart(e: MouseEvent) {
    e.preventDefault();
    isResizing = true;
    const startX = e.clientX;
    const startWidth = panelWidth;

    function onMouseMove(ev: MouseEvent) {
      const delta = startX - ev.clientX;
      panelWidth = Math.max(280, Math.min(window.innerWidth * 0.7, startWidth + delta));
    }

    function onMouseUp() {
      isResizing = false;
      localStorage.setItem('gatrix-log-panel-width', String(Math.round(panelWidth)));
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  const levels: Array<'all' | 'debug' | 'info' | 'warn' | 'error'> = ['all', 'debug', 'info', 'warn', 'error'];
</script>

<div class="log-panel" style="width:{panelWidth}px">
  <!-- Resize handle -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="log-panel-resize-handle"
    class:resizing={isResizing}
    on:mousedown={onResizeStart}
  ></div>

  <!-- Header -->
  <div class="log-panel-header">
    <div style="display:flex;align-items:center;gap:8px">
      <span style="color:#92cc41;font-size:10px">SDK LOGS</span>
      <span style="font-size:7px;color:#adafbc">
        ({filteredLogs.length}/{logs.length})
      </span>
    </div>
    <div style="display:flex;gap:6px;align-items:center">
      <label class="log-panel-autoscroll">
        <input type="checkbox" bind:checked={autoScroll} />
        <span>AUTO</span>
      </label>
      <button type="button" class="nes-btn is-warning" on:click={onClear}
        style="font-size:7px;padding:2px 6px">CLR</button>
      <button type="button" class="nes-btn is-error" on:click={onClose}
        style="font-size:7px;padding:2px 6px">✕</button>
    </div>
  </div>

  <!-- Toolbar -->
  <div class="log-panel-toolbar">
    {#each levels as level}
      <button
        type="button"
        class="log-filter-btn"
        class:active={filterLevel === level}
        style="color:{level === 'all' ? '#fff' : getLevelColor(level)}"
        on:click={() => (filterLevel = level)}
      >
        {level === 'all' ? 'ALL' : level.toUpperCase()}
        <span class="log-filter-count">{level === 'all' ? logs.length : countByLevel[level]}</span>
      </button>
    {/each}
    <div style="flex:1"></div>
    <input type="text" class="nes-input is-dark log-panel-search" bind:value={searchQuery}
      placeholder="Filter..." />
  </div>

  <!-- Log list -->
  <div class="log-panel-list" bind:this={logListEl}>
    {#if filteredLogs.length === 0}
      <div class="log-panel-empty">
        {logs.length === 0 ? 'NO LOGS YET...' : 'NO MATCHING LOGS'}
      </div>
    {:else}
      {#each filteredLogs as entry (entry.id)}
        <div class="log-entry log-entry-{entry.level}">
          <span class="log-entry-time">{formatTime(entry.timestamp)}</span>
          <span class="log-entry-icon" style="color:{getLevelColor(entry.level)}">
            {getLevelIcon(entry.level)}
          </span>
          <span class="log-entry-msg" style="color:{getLevelColor(entry.level)}">
            {entry.message}
            {#if entry.args.length > 0}
              <span class="log-entry-args">{formatArgs(entry.args)}</span>
            {/if}
          </span>
        </div>
      {/each}
    {/if}
  </div>
</div>
