/**
 * HTML Report Generator for Coupon Benchmark
 * Produces a self-contained dark-themed report file.
 */
import { writeFileSync } from 'fs';
import { join } from 'path';

export interface DbSample {
  elapsedMs: number;
  threadsConnected: number;
  threadsRunning: number;
  activeQueries: number;
  poolUsed: number;
  poolFree: number;
  poolPendingAcquires: number;
}

export interface DbMonitorReport {
  samples: DbSample[];
  peakConnections: number;
  avgConnections: number;
  peakRunning: number;
  avgRunning: number;
  totalLockWaits: number;
  totalLockTimeMs: number;
  deadlocksDelta: number;
  peakActiveQueries: number;
  peakPoolUsed: number;
  peakPoolPending: number;
  avgPoolPending: number;
}

export interface IntegrityCheck {
  label: string;
  expected: number;
  actual: number;
  pass: boolean;
}

export interface PhaseResult {
  name: string;
  totalTimeMs: number;
  throughput: number;
  successCount: number;
  totalRequests: number;
  duplicateCount: number;
  limitExceededCount: number;
  globalLimitCount: number;
  errorCount: number;
  poolTimeoutErrors: number;
  latencies: number[];
  dbMonitor: DbMonitorReport;
  integrity: IntegrityCheck[];
}

function latencyStats(latencies: number[]) {
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    avg: Math.round((sum / sorted.length) * 10) / 10,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p90: sorted[Math.floor(sorted.length * 0.9)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
    max: sorted[sorted.length - 1],
    min: sorted[0],
  };
}

function latencyHistogram(latencies: number[]) {
  const buckets = [
    { label: '0–50ms', min: 0, max: 50 },
    { label: '50–100ms', min: 50, max: 100 },
    { label: '100–200ms', min: 100, max: 200 },
    { label: '200–500ms', min: 200, max: 500 },
    { label: '500ms–1s', min: 500, max: 1000 },
    { label: '1s+', min: 1000, max: Infinity },
  ];
  return buckets.map((b) => {
    const count = latencies.filter((l) => l >= b.min && l < b.max).length;
    return {
      bucket: b.label,
      count,
      pct:
        latencies.length > 0
          ? Math.round((count / latencies.length) * 1000) / 10
          : 0,
    };
  });
}

function buildPhaseSection(r: PhaseResult): string {
  const stats = latencyStats(r.latencies);
  const hist = latencyHistogram(r.latencies);
  const maxPct = Math.max(...hist.map((h) => h.pct), 1);

  // DB connection sparkline (sample every 5th point to keep it small)
  const dbSamples = r.dbMonitor.samples.filter((_, i) => i % 5 === 0);
  const maxConn = Math.max(...dbSamples.map((s) => s.threadsConnected), 1);

  const connSvgPoints = dbSamples
    .map((s, i) => {
      const x = (i / Math.max(dbSamples.length - 1, 1)) * 380 + 10;
      const y = 55 - (s.threadsConnected / maxConn) * 45;
      return `${x},${y}`;
    })
    .join(' ');

  const runningSvgPoints = dbSamples
    .map((s, i) => {
      const x = (i / Math.max(dbSamples.length - 1, 1)) * 380 + 10;
      const y = 55 - (s.threadsRunning / Math.max(maxConn, 1)) * 45;
      return `${x},${y}`;
    })
    .join(' ');

  return `
    <div class="phase">
      <h2>${r.name}</h2>
      <div class="cards">
        <div class="card">
          <div class="card-value">${r.totalRequests.toLocaleString()}</div>
          <div class="card-label">Total Requests</div>
        </div>
        <div class="card success">
          <div class="card-value">${r.successCount.toLocaleString()}</div>
          <div class="card-label">Success</div>
        </div>
        <div class="card">
          <div class="card-value">${r.throughput}</div>
          <div class="card-label">req/s</div>
        </div>
        <div class="card ${r.errorCount > 0 ? 'danger' : 'success'}">
          <div class="card-value">${r.errorCount}</div>
          <div class="card-label">Errors</div>
        </div>
        <div class="card ${r.dbMonitor.deadlocksDelta > 0 ? 'danger' : 'success'}">
          <div class="card-value">${r.dbMonitor.deadlocksDelta}</div>
          <div class="card-label">Deadlocks</div>
        </div>
        <div class="card ${r.dbMonitor.peakPoolPending > 0 ? 'danger' : 'success'}">
          <div class="card-value">${r.dbMonitor.peakPoolPending}</div>
          <div class="card-label">Peak Pool Queue</div>
        </div>
        <div class="card ${r.poolTimeoutErrors > 0 ? 'danger' : 'success'}">
          <div class="card-value">${r.poolTimeoutErrors}</div>
          <div class="card-label">Pool Timeouts</div>
        </div>
      </div>

      <div class="grid-2">
        <!-- Latency -->
        <div class="section-box">
          <h3>⏱ Latency Distribution</h3>
          <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Avg</td><td>${stats.avg}ms</td></tr>
            <tr><td>P50</td><td>${stats.p50}ms</td></tr>
            <tr><td>P90</td><td>${stats.p90}ms</td></tr>
            <tr><td>P95</td><td>${stats.p95}ms</td></tr>
            <tr><td>P99</td><td>${stats.p99}ms</td></tr>
            <tr><td>Max</td><td>${stats.max}ms</td></tr>
          </table>
          <div class="histogram">
            ${hist
              .map(
                (h) => `
              <div class="hist-row">
                <span class="hist-label">${h.bucket}</span>
                <div class="hist-bar-bg">
                  <div class="hist-bar" style="width: ${(h.pct / maxPct) * 100}%"></div>
                </div>
                <span class="hist-value">${h.pct}% (${h.count.toLocaleString()})</span>
              </div>
            `
              )
              .join('')}
          </div>
        </div>

        <!-- DB Health -->
        <div class="section-box">
          <h3>🗄 DB Connection &amp; Lock Health</h3>
          <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Peak Connections</td><td><strong>${r.dbMonitor.peakConnections}</strong></td></tr>
            <tr><td>Avg Connections</td><td>${r.dbMonitor.avgConnections}</td></tr>
            <tr><td>Peak Running Threads</td><td>${r.dbMonitor.peakRunning}</td></tr>
            <tr><td>Avg Running Threads</td><td>${r.dbMonitor.avgRunning}</td></tr>
            <tr><td>Peak Active Queries</td><td>${r.dbMonitor.peakActiveQueries}</td></tr>
            <tr class="${r.dbMonitor.peakPoolPending > 5 ? 'row-danger' : r.dbMonitor.peakPoolPending > 0 ? 'row-warn' : 'row-success'}">
              <td>Pool Peak Used</td><td><strong>${r.dbMonitor.peakPoolUsed}</strong> / 10</td>
            </tr>
            <tr class="${r.dbMonitor.peakPoolPending > 5 ? 'row-danger' : r.dbMonitor.peakPoolPending > 0 ? 'row-warn' : 'row-success'}">
              <td>Pool Peak Pending</td><td><strong>${r.dbMonitor.peakPoolPending}</strong></td>
            </tr>
            <tr><td>Pool Avg Pending</td><td>${r.dbMonitor.avgPoolPending}</td></tr>
            <tr><td>InnoDB Row Lock Waits</td><td>${r.dbMonitor.totalLockWaits}</td></tr>
            <tr><td>InnoDB Row Lock Time</td><td>${r.dbMonitor.totalLockTimeMs}ms</td></tr>
            <tr class="${r.dbMonitor.deadlocksDelta > 0 ? 'row-danger' : 'row-success'}">
              <td>InnoDB Deadlocks</td><td><strong>${r.dbMonitor.deadlocksDelta}</strong></td>
            </tr>
          </table>
          ${
            dbSamples.length > 2
              ? `
          <div class="chart-title">Connections & Pool Pending Over Time (${(dbSamples[dbSamples.length - 1]?.elapsedMs / 1000).toFixed(0)}s)</div>
          <svg viewBox="0 0 400 65" class="sparkline">
            <polyline points="${connSvgPoints}" fill="none" stroke="#58a6ff" stroke-width="1.5"/>
            <polyline points="${runningSvgPoints}" fill="none" stroke="#f0883e" stroke-width="1.2" stroke-dasharray="3,2"/>
            ${(() => {
              const maxPending = Math.max(
                ...dbSamples.map((s) => s.poolPendingAcquires),
                1
              );
              const pendingPts = dbSamples
                .map((s, i) => {
                  const x = (i / Math.max(dbSamples.length - 1, 1)) * 380 + 10;
                  const y = 55 - (s.poolPendingAcquires / maxPending) * 45;
                  return `${x},${y}`;
                })
                .join(' ');
              return `<polyline points="${pendingPts}" fill="none" stroke="#f85149" stroke-width="1.5" stroke-dasharray="5,3"/>`;
            })()}
            <text x="395" y="12" class="legend-text" fill="#58a6ff">Connected</text>
            <text x="395" y="24" class="legend-text" fill="#f0883e">Running</text>
            <text x="395" y="36" class="legend-text" fill="#f85149">Pool Pending</text>
          </svg>`
              : ''
          }
        </div>
      </div>

      <!-- Integrity -->
      <div class="section-box">
        <h3>🔍 Data Integrity Check</h3>
        <table>
          <tr><th>Check</th><th>Expected</th><th>Actual</th><th>Result</th></tr>
          ${r.integrity
            .map(
              (c) => `
            <tr class="${c.pass ? 'row-success' : 'row-danger'}">
              <td>${c.label}</td>
              <td>${c.expected.toLocaleString()}</td>
              <td>${c.actual.toLocaleString()}</td>
              <td>${c.pass ? '✅ PASS' : '❌ FAIL'}</td>
            </tr>
          `
            )
            .join('')}
        </table>
      </div>
    </div>`;
}

export function generateHtmlReport(
  phases: PhaseResult[],
  outputDir: string
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `benchmark-report-${timestamp}.html`;
  const filepath = join(outputDir, filename);

  const allPassed =
    phases.every((p) => p.integrity.every((c) => c.pass)) &&
    phases.every((p) => p.dbMonitor.deadlocksDelta === 0);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Coupon System Benchmark Report — ${new Date().toLocaleDateString('en-US')}</title>
<style>
  :root { --bg:#0d1117; --card:#161b22; --border:#30363d; --text:#e6edf3; --dim:#8b949e;
    --accent:#58a6ff; --success:#3fb950; --danger:#f85149; --warning:#d29922; --orange:#f0883e; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,-apple-system,sans-serif; background:var(--bg); color:var(--text); line-height:1.6; }
  .container { max-width:1100px; margin:0 auto; padding:24px; }
  header { text-align:center; padding:32px 0 16px; border-bottom:1px solid var(--border); margin-bottom:24px; }
  header h1 { font-size:1.8rem; background:linear-gradient(135deg,var(--accent),#a371f7); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
  header .sub { color:var(--dim); margin-top:4px; font-size:0.9rem; }
  .verdict { text-align:center; font-size:1.3rem; padding:16px; border-radius:12px; margin-bottom:28px;
    background:${allPassed ? 'linear-gradient(135deg,#0d2818,#0d3520)' : 'linear-gradient(135deg,#3d1214,#5a1a1a)'}; border:1px solid ${allPassed ? 'var(--success)' : 'var(--danger)'}; }
  .phase { margin-bottom:36px; }
  .phase h2 { font-size:1.3rem; color:var(--accent); margin-bottom:12px; padding-bottom:6px; border-bottom:1px solid var(--border); }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin-bottom:18px; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:16px; text-align:center; }
  .card-value { font-size:1.6rem; font-weight:700; }
  .card-label { font-size:0.78rem; color:var(--dim); margin-top:4px; text-transform:uppercase; letter-spacing:0.5px; }
  .card.success .card-value { color:var(--success); }
  .card.danger .card-value { color:var(--danger); }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
  @media(max-width:768px){ .grid-2{grid-template-columns:1fr;} }
  .section-box { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:18px; }
  .section-box h3 { font-size:0.95rem; color:var(--dim); margin-bottom:10px; }
  table { width:100%; border-collapse:collapse; font-size:0.85rem; }
  th,td { padding:6px 10px; text-align:left; border-bottom:1px solid var(--border); }
  th { color:var(--dim); font-weight:600; font-size:0.78rem; text-transform:uppercase; }
  .row-success td:last-child { color:var(--success); font-weight:600; }
  .row-danger td:last-child { color:var(--danger); font-weight:600; }
  .row-warn td:last-child { color:var(--warning); font-weight:600; }
  .histogram { margin-top:12px; }
  .hist-row { display:flex; align-items:center; margin-bottom:5px; font-size:0.8rem; }
  .hist-label { width:80px; color:var(--dim); flex-shrink:0; text-align:right; padding-right:8px; }
  .hist-bar-bg { flex:1; height:16px; background:var(--border); border-radius:4px; overflow:hidden; }
  .hist-bar { height:100%; background:linear-gradient(90deg,var(--accent),#a371f7); border-radius:4px; min-width:2px; transition:width 0.3s; }
  .hist-value { width:100px; text-align:right; color:var(--dim); flex-shrink:0; padding-left:6px; }
  .sparkline { width:100%; margin-top:8px; }
  .legend-text { font-size:7px; text-anchor:end; }
  .chart-title { font-size:0.75rem; color:var(--dim); margin-top:12px; }
  footer { text-align:center; color:var(--dim); font-size:0.75rem; padding:20px 0; border-top:1px solid var(--border); margin-top:24px; }
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>🎫 Coupon System Benchmark Report</h1>
    <div class="sub">${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'medium' })} — Gatrix Backend</div>
  </header>
  <div class="verdict">${allPassed ? '🎉 ALL CHECKS PASSED — Zero Deadlocks, 100% Data Integrity' : '💥 SOME CHECKS FAILED — See Details Below'}</div>
  ${phases.map((p) => buildPhaseSection(p)).join('')}
  <footer>Generated by benchmark-coupon.ts — Gatrix Coupon System</footer>
</div>
</body>
</html>`;

  writeFileSync(filepath, html, 'utf-8');
  return filepath;
}
