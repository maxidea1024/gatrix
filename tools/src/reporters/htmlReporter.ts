import * as fs from 'fs';
import * as path from 'path';
import { ScanReport, FlagUsage, ValidationIssue } from '../types';

// ============================================================
// HTML reporter - visual HTML report with confidence info
// ============================================================

export function reportToHtml(report: ScanReport, outputPath?: string): string {
  const { metadata, usages, summary } = report;
  const usagesWithIssues = usages.filter((u) => u.validation.length > 0);

  const highConf = usages.filter((u) => u.confidenceScore >= 80).length;
  const medConf = usages.filter((u) => u.confidenceScore >= 50 && u.confidenceScore < 80).length;
  const lowConf = usages.filter((u) => u.confidenceScore < 50).length;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>gatrix-flag-code-refs Report</title>
  <style>
    :root {
      --bg-primary: #0d1117;
      --bg-secondary: #161b22;
      --bg-tertiary: #21262d;
      --text-primary: #f0f6fc;
      --text-secondary: #8b949e;
      --accent-blue: #58a6ff;
      --accent-green: #3fb950;
      --accent-red: #f85149;
      --accent-yellow: #d29922;
      --accent-purple: #bc8cff;
      --border: #30363d;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 1.8rem; margin-bottom: 0.5rem; }
    .subtitle { color: var(--text-secondary); margin-bottom: 2rem; }
    .card {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    .card h2 { font-size: 1.2rem; margin-bottom: 1rem; color: var(--accent-blue); }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; }
    .stat { text-align: center; }
    .stat-value { font-size: 2rem; font-weight: bold; }
    .stat-label { color: var(--text-secondary); font-size: 0.85rem; }
    .stat-error .stat-value { color: var(--accent-red); }
    .stat-warn .stat-value { color: var(--accent-yellow); }
    .stat-ok .stat-value { color: var(--accent-green); }
    .stat-purple .stat-value { color: var(--accent-purple); }
    .issue {
      background: var(--bg-tertiary);
      border-radius: 6px;
      padding: 1rem;
      margin-bottom: 0.75rem;
      border-left: 3px solid var(--border);
    }
    .issue.error { border-left-color: var(--accent-red); }
    .issue.warning { border-left-color: var(--accent-yellow); }
    .issue-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
    .flag-name { font-weight: bold; color: var(--accent-blue); }
    .location { color: var(--text-secondary); font-size: 0.85rem; font-family: monospace; }
    .validation-msg { margin-top: 0.5rem; font-size: 0.9rem; }
    .badge {
      display: inline-block;
      font-size: 0.7rem;
      padding: 0.15rem 0.5rem;
      border-radius: 12px;
      font-weight: 500;
    }
    .badge-error { background: rgba(248, 81, 73, 0.2); color: var(--accent-red); }
    .badge-warning { background: rgba(210, 153, 34, 0.2); color: var(--accent-yellow); }
    .badge-info { background: rgba(88, 166, 255, 0.2); color: var(--accent-blue); }
    .badge-confidence { background: rgba(63, 185, 80, 0.15); color: var(--accent-green); }
    .badge-tier { background: rgba(188, 140, 255, 0.15); color: var(--accent-purple); }
    .badge-confidence.low { background: rgba(248, 81, 73, 0.15); color: var(--accent-red); }
    .badge-confidence.medium { background: rgba(210, 153, 34, 0.15); color: var(--accent-yellow); }
    .code-link { color: var(--accent-blue); text-decoration: none; }
    .code-link:hover { text-decoration: underline; }
    .meta-grid { display: grid; grid-template-columns: 120px 1fr; gap: 0.3rem 1rem; }
    .meta-label { color: var(--text-secondary); }
    .unused-list { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
    .unused-tag {
      background: rgba(210, 153, 34, 0.15);
      color: var(--accent-yellow);
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-family: monospace;
    }
    .confidence-bar {
      height: 6px;
      border-radius: 3px;
      background: var(--bg-primary);
      margin-top: 0.3rem;
      overflow: hidden;
    }
    .confidence-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s;
    }
    .confidence-fill.high { background: var(--accent-green); }
    .confidence-fill.medium { background: var(--accent-yellow); }
    .confidence-fill.low { background: var(--accent-red); }
  </style>
</head>
<body>
  <div class="container">
    <h1>gatrix-flag-code-refs Report</h1>
    <p class="subtitle">Feature Flag Static Analysis &amp; Confidence Scoring</p>

    <div class="card">
      <h2>Metadata</h2>
      <div class="meta-grid">
        <span class="meta-label">Repository</span><span>${esc(metadata.repository)}</span>
        <span class="meta-label">Branch</span><span>${esc(metadata.branch)}</span>
        <span class="meta-label">Commit</span><span><code>${esc(metadata.commit.slice(0, 8))}</code></span>
        <span class="meta-label">Scan Time</span><span>${esc(metadata.scanTime)}</span>
        <span class="meta-label">Version</span><span>${esc(metadata.toolVersion)}</span>
      </div>
    </div>

    <div class="card">
      <h2>Summary</h2>
      <div class="stats">
        <div class="stat stat-ok"><div class="stat-value">${summary.totalFilesScanned}</div><div class="stat-label">Files Scanned</div></div>
        <div class="stat stat-ok"><div class="stat-value">${summary.totalUsages}</div><div class="stat-label">Flag Usages</div></div>
        <div class="stat ${summary.errors > 0 ? 'stat-error' : 'stat-ok'}"><div class="stat-value">${summary.errors}</div><div class="stat-label">Errors</div></div>
        <div class="stat ${summary.warnings > 0 ? 'stat-warn' : 'stat-ok'}"><div class="stat-value">${summary.warnings}</div><div class="stat-label">Warnings</div></div>
        <div class="stat ${summary.unusedFlags.length > 0 ? 'stat-warn' : 'stat-ok'}"><div class="stat-value">${summary.unusedFlags.length}</div><div class="stat-label">Unused Flags</div></div>
      </div>
    </div>

    <div class="card">
      <h2>Confidence Distribution</h2>
      <div class="stats">
        <div class="stat stat-ok"><div class="stat-value">${highConf}</div><div class="stat-label">High (>=80)</div></div>
        <div class="stat stat-warn"><div class="stat-value">${medConf}</div><div class="stat-label">Medium (50-79)</div></div>
        <div class="stat stat-error"><div class="stat-value">${lowConf}</div><div class="stat-label">Low (&lt;50)</div></div>
      </div>
    </div>

    ${
      usagesWithIssues.length > 0
        ? `
    <div class="card">
      <h2>Issues (${usagesWithIssues.length})</h2>
      ${usagesWithIssues.map((u) => renderIssueHtml(u)).join('\n')}
    </div>`
        : `
    <div class="card">
      <h2>No Issues Found</h2>
      <p style="color: var(--text-secondary);">All flag references are valid.</p>
    </div>`
    }

    ${
      summary.unusedFlags.length > 0
        ? `
    <div class="card">
      <h2>Unused Flags (${summary.unusedFlags.length})</h2>
      <div class="unused-list">
        ${summary.unusedFlags.map((f) => `<span class="unused-tag">${esc(f)}</span>`).join('\n')}
      </div>
    </div>`
        : ''
    }
  </div>
</body>
</html>`;

  if (outputPath) {
    const resolved = path.resolve(outputPath);
    const dir = path.dirname(resolved);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(resolved, html, 'utf-8');
    console.log(`[INFO] HTML report saved to: ${resolved}`);
  }

  return html;
}

function renderIssueHtml(usage: FlagUsage): string {
  const maxSeverity = usage.validation.reduce<string>((max, v) => {
    if (v.severity === 'error') return 'error';
    if (v.severity === 'warning' && max !== 'error') return 'warning';
    return max;
  }, 'info');

  const confClass =
    usage.confidenceScore >= 80 ? 'high' : usage.confidenceScore >= 50 ? 'medium' : 'low';

  return `
    <div class="issue ${maxSeverity}">
      <div class="issue-header">
        <div>
          <span class="flag-name">${esc(usage.flagName)}</span>
          <span style="color: var(--text-secondary); margin-left: 0.5rem;">${esc(usage.methodName)}()</span>
          <span class="badge badge-info" style="margin-left: 0.5rem;">${esc(usage.language)}</span>
          <span class="badge badge-tier" style="margin-left: 0.3rem;">Tier ${usage.languageTier}</span>
          <span class="badge badge-confidence ${confClass}" style="margin-left: 0.3rem;">Confidence: ${usage.confidenceScore}</span>
        </div>
        <span class="location">${esc(usage.filePath)}:${usage.line}</span>
      </div>
      <div class="confidence-bar"><div class="confidence-fill ${confClass}" style="width: ${usage.confidenceScore}%"></div></div>
      ${usage.validation.map((v) => renderValidationHtml(v)).join('\n')}
      ${usage.codeUrl ? `<div style="margin-top: 0.5rem;"><a class="code-link" href="${esc(usage.codeUrl)}" target="_blank">View in repository</a></div>` : ''}
    </div>`;
}

function renderValidationHtml(issue: ValidationIssue): string {
  const badgeClass =
    issue.severity === 'error'
      ? 'badge-error'
      : issue.severity === 'warning'
        ? 'badge-warning'
        : 'badge-info';
  return `
    <div class="validation-msg">
      <span class="badge ${badgeClass}">${esc(issue.code)}</span>
      <span style="margin-left: 0.5rem;">${esc(issue.message)}</span>
      ${issue.suggestion ? `<div style="color: var(--text-secondary); font-size: 0.85rem; margin-top: 0.2rem;">Hint: ${esc(issue.suggestion)}</div>` : ''}
    </div>`;
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
