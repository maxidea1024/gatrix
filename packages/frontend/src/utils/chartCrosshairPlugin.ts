import { Plugin, Chart } from 'chart.js';

/**
 * Chart.js Crosshair Plugin
 *
 * Draws a vertical dashed line at the hovered data point position,
 * making it easier to identify exact timestamps on time-series charts.
 *
 * Usage: import and register with ChartJS.register(crosshairPlugin)
 */
export const crosshairPlugin: Plugin<'line'> = {
  id: 'crosshair',

  afterDraw(chart: Chart<'line'>) {
    const tooltip = chart.tooltip;
    if (
      !tooltip ||
      !tooltip.getActiveElements ||
      tooltip.getActiveElements().length === 0
    ) {
      return;
    }

    const activeElements = tooltip.getActiveElements();
    const x = activeElements[0].element.x;
    const yAxis = chart.scales.y;

    if (!yAxis) return;

    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, yAxis.top);
    ctx.lineTo(x, yAxis.bottom);
    ctx.lineWidth = 1;

    // Adapt color to dark/light mode
    const isDark =
      chart.options?.plugins?.legend?.labels?.color === '#fff' ||
      (typeof document !== 'undefined' &&
        document.documentElement.getAttribute('data-theme') === 'dark');
    ctx.strokeStyle = isDark
      ? 'rgba(255, 255, 255, 0.3)'
      : 'rgba(0, 0, 0, 0.2)';
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();
  },
};

export default crosshairPlugin;
