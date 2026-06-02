import { Plugin } from 'chart.js';

export const getCrosshairPlugin = (isDark: boolean): Plugin => ({
  id: 'crosshair',
  afterDraw: (chart: any) => {
    if (chart.tooltip?._active?.length) {
      const activePoint = chart.tooltip._active[0];
      const ctx = chart.ctx;
      const x = activePoint.element.x;
      const topY = chart.scales.y.top;
      const bottomY = chart.scales.y.bottom;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, topY);
      ctx.lineTo(x, bottomY);
      ctx.lineWidth = 1;
      ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();
    }
  }
});

/**
 * Chart.js plugin: Drag to select a time range on the X axis.
 * Draws a highlight overlay during drag, and calls `onRangeSelected(startIdx, endIdx)` on mouseup.
 */
export const getDragSelectPlugin = (
  isDark: boolean,
  onRangeSelected: (startIndex: number, endIndex: number) => void,
): Plugin => {
  let dragging = false;
  let startX = 0;
  let currentX = 0;

  return {
    id: 'dragSelect',

    afterInit(chart: any) {
      const canvas = chart.canvas as HTMLCanvasElement;
      canvas.style.cursor = 'crosshair';

      const onMouseDown = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const xScale = chart.scales.x;
        if (!xScale) return;
        // Only start drag inside chart area
        if (x >= xScale.left && x <= xScale.right) {
          dragging = true;
          startX = x;
          currentX = x;
          // Disable tooltip during drag
          if (chart.options.plugins?.tooltip) {
            chart.options.plugins.tooltip.enabled = false;
          }
        }
      };

      const onMouseMove = (e: MouseEvent) => {
        if (!dragging) return;
        const rect = canvas.getBoundingClientRect();
        currentX = Math.max(chart.scales.x.left, Math.min(e.clientX - rect.left, chart.scales.x.right));
        chart.draw();
      };

      const onMouseUp = () => {
        if (!dragging) return;
        dragging = false;
        // Re-enable tooltip
        if (chart.options.plugins?.tooltip) {
          chart.options.plugins.tooltip.enabled = true;
        }
        chart.draw();

        const xScale = chart.scales.x;
        if (!xScale) return;

        const x1 = Math.min(startX, currentX);
        const x2 = Math.max(startX, currentX);

        // Require minimum 10px drag to avoid accidental clicks
        if (x2 - x1 < 10) return;

        // Find label indices at both edges
        const startIdx = xScale.getValueForPixel(x1);
        const endIdx = xScale.getValueForPixel(x2);

        if (startIdx != null && endIdx != null) {
          const si = Math.max(0, Math.round(startIdx));
          const ei = Math.min((chart.data.labels?.length || 1) - 1, Math.round(endIdx));
          if (si !== ei) {
            onRangeSelected(si, ei);
          }
        }
      };

      const onMouseLeave = () => {
        if (dragging) {
          dragging = false;
          if (chart.options.plugins?.tooltip) {
            chart.options.plugins.tooltip.enabled = true;
          }
          chart.draw();
        }
      };

      canvas.addEventListener('mousedown', onMouseDown);
      canvas.addEventListener('mousemove', onMouseMove);
      canvas.addEventListener('mouseup', onMouseUp);
      canvas.addEventListener('mouseleave', onMouseLeave);

      // Store handlers for cleanup
      (chart as any).__dragHandlers = { onMouseDown, onMouseMove, onMouseUp, onMouseLeave };
    },

    beforeDestroy(chart: any) {
      const handlers = (chart as any).__dragHandlers;
      if (handlers) {
        const canvas = chart.canvas as HTMLCanvasElement;
        canvas.removeEventListener('mousedown', handlers.onMouseDown);
        canvas.removeEventListener('mousemove', handlers.onMouseMove);
        canvas.removeEventListener('mouseup', handlers.onMouseUp);
        canvas.removeEventListener('mouseleave', handlers.onMouseLeave);
      }
    },

    afterDraw(chart: any) {
      if (!dragging) return;
      const ctx = chart.ctx;
      const xScale = chart.scales.x;
      const yScale = chart.scales.y;
      if (!ctx || !xScale || !yScale) return;

      const x1 = Math.min(startX, currentX);
      const x2 = Math.max(startX, currentX);

      ctx.save();

      // Selection overlay
      ctx.fillStyle = isDark
        ? 'rgba(124, 77, 255, 0.12)'
        : 'rgba(124, 77, 255, 0.08)';
      ctx.fillRect(x1, yScale.top, x2 - x1, yScale.bottom - yScale.top);

      // Left and right edge lines
      ctx.strokeStyle = isDark ? 'rgba(124, 77, 255, 0.6)' : 'rgba(124, 77, 255, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x1, yScale.top);
      ctx.lineTo(x1, yScale.bottom);
      ctx.moveTo(x2, yScale.top);
      ctx.lineTo(x2, yScale.bottom);
      ctx.stroke();

      // Top label showing drag range hint (drawn INSIDE chart area to avoid clipping)
      const si = Math.max(0, Math.round(xScale.getValueForPixel(x1) || 0));
      const ei = Math.min((chart.data.labels?.length || 1) - 1, Math.round(xScale.getValueForPixel(x2) || 0));
      const startLabel = chart.data.labels?.[si] || '';
      const endLabel = chart.data.labels?.[ei] || '';
      const labelText = `${startLabel} → ${endLabel}`;

      ctx.font = '600 10px system-ui, sans-serif';
      const textW = ctx.measureText(labelText).width;
      const bgW = textW + 16;
      const bgH = 22;
      const midX = Math.max(xScale.left, Math.min((x1 + x2) / 2 - bgW / 2, xScale.right - bgW));
      const labelY = yScale.top + 6;

      ctx.fillStyle = isDark ? 'rgba(124, 77, 255, 0.92)' : 'rgba(124, 77, 255, 0.88)';
      ctx.beginPath();
      ctx.roundRect(midX, labelY, bgW, bgH, 4);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(labelText, midX + bgW / 2, labelY + bgH / 2);

      ctx.restore();
    },
  };
};
