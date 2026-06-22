/**
 * Global Chart.js External Tooltip
 *
 * Renders a table-formatted HTML tooltip for all Chart.js chart instances.
 * Automatically registered as the global default on module import.
 *
 * To opt out for a specific chart, set:
 *   plugins: { tooltip: { external: null } }
 */
import { Chart as ChartJS } from 'chart.js';

// ─── Dark Mode Detection ─────────────────────────────────────────────────────

function isDarkMode(): boolean {
  const bg = getComputedStyle(document.body).backgroundColor;
  const m = bg?.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    return (
      (Number(m[1]) * 299 + Number(m[2]) * 587 + Number(m[3]) * 114) / 1000 <
      128
    );
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

// ─── Tooltip Element Management ──────────────────────────────────────────────

function getOrCreateTooltip(chart: any): HTMLDivElement | null {
  const parent = chart.canvas?.parentNode as HTMLElement | null;
  if (!parent) return null;

  let el = parent.querySelector('.gx-chart-tooltip') as HTMLDivElement | null;
  if (!el) {
    el = document.createElement('div');
    el.className = 'gx-chart-tooltip';
    Object.assign(el.style, {
      position: 'absolute',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 0.15s ease, transform 0.08s ease',
      transform: 'scale(0.96)',
      zIndex: '9999',
    });
    parent.style.position = 'relative';
    parent.appendChild(el);
  }
  return el;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function resolveColor(primary: any, fallback: any): string {
  if (typeof primary === 'string') return primary;
  if (typeof fallback === 'string') return fallback;
  return '#94a3b8';
}

// ─── External Tooltip Handler ────────────────────────────────────────────────

export function externalTooltipHandler(context: any): void {
  const { chart, tooltip } = context;

  const el = getOrCreateTooltip(chart);
  if (!el) return;

  // Hide when tooltip should not be visible
  if (tooltip.opacity === 0) {
    el.style.opacity = '0';
    el.style.transform = 'scale(0.96)';
    return;
  }

  const pts: any[] = tooltip.dataPoints || [];
  if (pts.length === 0) {
    el.style.opacity = '0';
    return;
  }

  const dk = isDarkMode();

  // ── Theme tokens ──
  const bg = dk ? 'rgba(16,16,28,0.97)' : 'rgba(255,255,255,0.98)';
  const bdr = dk ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const shd = dk ? '0 8px 30px rgba(0,0,0,0.55)' : '0 8px 30px rgba(0,0,0,0.1)';
  const ttlC = dk ? '#e2e8f0' : '#1e293b';
  const lblC = dk ? '#94a3b8' : '#64748b';
  const valC = dk ? '#f1f5f9' : '#0f172a';
  const divC = dk ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  // ── Detect chart type ──
  const chartType = chart.config?.type;
  const isPie = chartType === 'pie' || chartType === 'doughnut';

  const titles: string[] = tooltip.title || [];
  const monoFont = "'SF Mono',Consolas,'Fira Code',monospace";

  // ── Build HTML ──
  let h = `<div style="background:${bg};border:1px solid ${bdr};border-radius:10px;padding:10px 14px;box-shadow:${shd};backdrop-filter:blur(16px);min-width:120px;">`;

  // Title row
  if (titles.length > 0) {
    h += `<div style="font-size:11px;font-weight:600;color:${ttlC};margin-bottom:7px;padding-bottom:6px;border-bottom:1px solid ${divC};letter-spacing:0.3px;white-space:nowrap;">${titles.join(' · ')}</div>`;
  }

  // Data table
  h += '<table style="border-collapse:collapse;width:100%;"><tbody>';

  let numTotal = 0;
  let allNumeric = true;

  pts.forEach((pt: any, i: number) => {
    const lc = tooltip.labelColors?.[i];
    const dot = resolveColor(lc?.borderColor, lc?.backgroundColor);
    const label = pt.dataset?.label || pt.label || '';
    const raw = pt.raw != null ? pt.raw : (pt.parsed?.y ?? pt.parsed?.x ?? 0);
    const isNum = typeof raw === 'number' && isFinite(raw);
    const val = isNum ? fmt(raw) : String(raw);

    if (isNum) numTotal += raw;
    else allNumeric = false;

    // Percentage column for pie/doughnut
    let pctTd = '';
    if (isPie && isNum && pt.dataset?.data) {
      const sum = (pt.dataset.data as number[]).reduce(
        (a, b) => a + (b || 0),
        0
      );
      if (sum > 0) {
        const pct = (raw / sum) * 100;
        pctTd = `<td style="text-align:right;font-size:10.5px;color:${lblC};padding-left:10px;white-space:nowrap;opacity:0.7;">${pct.toFixed(1)}%</td>`;
      }
    }

    h += `<tr>
      <td style="padding:2.5px 0;white-space:nowrap;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dot};margin-right:8px;vertical-align:middle;"></span>
        <span style="font-size:11.5px;color:${lblC};vertical-align:middle;">${label}</span>
      </td>
      <td style="text-align:right;font-size:12px;font-weight:700;color:${valC};padding-left:16px;white-space:nowrap;font-variant-numeric:tabular-nums;font-family:${monoFont};">${val}</td>
      ${pctTd}
    </tr>`;
  });

  // Total row (multi-series non-pie only)
  if (!isPie && pts.length > 1 && allNumeric) {
    h += `<tr>
      <td style="padding-top:6px;border-top:1px solid ${divC};white-space:nowrap;">
        <span style="display:inline-block;width:8px;margin-right:8px;"></span>
        <span style="font-size:11px;font-weight:600;color:${lblC};vertical-align:middle;">Total</span>
      </td>
      <td style="text-align:right;font-size:12px;font-weight:700;color:${valC};padding-left:16px;padding-top:6px;border-top:1px solid ${divC};white-space:nowrap;font-variant-numeric:tabular-nums;font-family:${monoFont};">${fmt(numTotal)}</td>
    </tr>`;
  }

  h += '</tbody></table></div>';
  el.innerHTML = h;

  // ── Position ──
  const parent = chart.canvas.parentNode as HTMLElement;
  const pW = parent.offsetWidth;
  const pH = parent.offsetHeight;
  const tW = el.offsetWidth;
  const tH = el.offsetHeight;

  let left = tooltip.caretX + 12;
  let top = tooltip.caretY - tH / 2;

  // Flip left if overflowing right
  if (left + tW > pW - 4) left = tooltip.caretX - tW - 12;
  // Clamp vertical
  if (top + tH > pH - 4) top = pH - tH - 4;
  if (top < 4) top = 4;
  // Clamp left
  if (left < 4) left = 4;

  el.style.left = `${left}px`;
  el.style.top = `${top}px`;
  el.style.opacity = '1';
  el.style.transform = 'scale(1)';
}

// ─── Global Registration (side-effect on import) ─────────────────────────────
// Disables the built-in canvas tooltip and installs our HTML external tooltip.

if (!ChartJS.defaults.plugins) {
  (ChartJS.defaults as any).plugins = {};
}
if (!ChartJS.defaults.plugins.tooltip) {
  (ChartJS.defaults.plugins as any).tooltip = {};
}

ChartJS.defaults.plugins.tooltip.enabled = false;
ChartJS.defaults.plugins.tooltip.external =
  externalTooltipHandler as unknown as (
    this: any,
    args: { chart: any; tooltip: any }
  ) => void;
