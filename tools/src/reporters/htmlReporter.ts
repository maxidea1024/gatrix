import * as fs from 'fs';
import * as path from 'path';
import { ScanReport, FlagUsage, ValidationIssue } from '../types';

// ============================================================
// HTML reporter - visual HTML report with confidence info
// Supports English (default) and Korean localization
// ============================================================

type ReportLocale = 'en' | 'ko';

interface ReportStrings {
  title: string;
  subtitle: string;
  metadata: string;
  repository: string;
  branch: string;
  commit: string;
  scanTime: string;
  version: string;
  summary: string;
  filesScanned: string;
  flagUsages: string;
  errors: string;
  warnings: string;
  unusedFlagsLabel: string;
  confidenceDistribution: string;
  confidenceHigh: string;
  confidenceMedium: string;
  confidenceLow: string;
  issues: string;
  noIssuesTitle: string;
  noIssuesDescription: string;
  viewInRepository: string;
  confidence: string;
  tier: string;
  lineTruncation: string;
}

const LOCALES: Record<ReportLocale, ReportStrings> = {
  en: {
    title: 'gatrix-flag-code-refs Report',
    subtitle: 'Feature Flag Static Analysis & Confidence Scoring',
    metadata: 'Metadata',
    repository: 'Repository',
    branch: 'Branch',
    commit: 'Commit',
    scanTime: 'Scan Time',
    version: 'Version',
    summary: 'Summary',
    filesScanned: 'Files Scanned',
    flagUsages: 'Flag Usages',
    errors: 'Errors',
    warnings: 'Warnings',
    unusedFlagsLabel: 'Unused Flags',
    confidenceDistribution: 'Confidence Distribution',
    confidenceHigh: 'High (>=80)',
    confidenceMedium: 'Medium (50-79)',
    confidenceLow: 'Low (<50)',
    issues: 'Issues',
    noIssuesTitle: 'No Issues Found',
    noIssuesDescription: 'All flag references are valid.',
    viewInRepository: 'View in repository',
    confidence: 'Confidence',
    tier: 'Tier',
    lineTruncation: 'files had long lines truncated',
  },
  ko: {
    title: 'gatrix-flag-code-refs 리포트',
    subtitle: '기능 플래그 정적 분석 & 신뢰도 점수',
    metadata: '메타데이터',
    repository: '저장소',
    branch: '브랜치',
    commit: '커밋',
    scanTime: '스캔 시간',
    version: '버전',
    summary: '요약',
    filesScanned: '스캔된 파일',
    flagUsages: '플래그 사용',
    errors: '오류',
    warnings: '경고',
    unusedFlagsLabel: '미사용 플래그',
    confidenceDistribution: '신뢰도 분포',
    confidenceHigh: '높음 (>=80)',
    confidenceMedium: '중간 (50-79)',
    confidenceLow: '낮음 (<50)',
    issues: '이슈',
    noIssuesTitle: '이슈 없음',
    noIssuesDescription: '모든 플래그 참조가 유효합니다.',
    viewInRepository: '저장소에서 보기',
    confidence: '신뢰도',
    tier: '티어',
    lineTruncation: '개 파일에서 긴 줄이 잘렸습니다',
  },
};

export function reportToHtml(
  report: ScanReport,
  outputPath?: string,
  locale: ReportLocale = 'en',
): string {
  const t = LOCALES[locale] || LOCALES.en;
  const { metadata, usages, summary } = report;
  const usagesWithIssues = usages.filter((u) => u.validation.length > 0);

  const highConf = usages.filter((u) => u.confidenceScore >= 80).length;
  const medConf = usages.filter((u) => u.confidenceScore >= 50 && u.confidenceScore < 80).length;
  const lowConf = usages.filter((u) => u.confidenceScore < 50).length;

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(t.title)}</title>
  <style>
    :root {
      --bg-primary: #ffffff;
      --bg-secondary: #f8f9fa;
      --bg-tertiary: #f1f3f5;
      --text-primary: #212529;
      --text-secondary: #6c757d;
      --accent-blue: #0969da;
      --accent-green: #1a7f37;
      --accent-red: #cf222e;
      --accent-yellow: #9a6700;
      --accent-purple: #8250df;
      --border: #d0d7de;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.5;
      padding: 1.5rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 1.5rem; margin-bottom: 0.25rem; color: var(--text-primary); }
    .subtitle { color: var(--text-secondary); margin-bottom: 1rem; font-size: 0.9rem; }
    .card {
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem;
      margin-bottom: 1rem;
    }
    .card h2 { font-size: 1rem; margin-bottom: 0.5rem; color: var(--accent-blue); }
    .card h3 { font-size: 0.85rem; margin-bottom: 0.4rem; color: var(--accent-blue); font-weight: 600; }
    .overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 0.5rem; }
    .stat { text-align: center; }
    .stat-value { font-size: 1.4rem; font-weight: bold; }
    .stat-label { color: var(--text-secondary); font-size: 0.75rem; }
    .stat-error .stat-value { color: var(--accent-red); }
    .stat-warn .stat-value { color: var(--accent-yellow); }
    .stat-ok .stat-value { color: var(--accent-green); }
    .stat-purple .stat-value { color: var(--accent-purple); }
    .meta-grid { display: grid; grid-template-columns: 80px 1fr; gap: 0.15rem 0.75rem; font-size: 0.85rem; }
    .meta-label { color: var(--text-secondary); font-weight: 500; }
    .issue {
      background: var(--bg-primary);
      border-radius: 6px;
      padding: 0.75rem;
      margin-bottom: 0.5rem;
      border: 1px solid var(--border);
      border-left: 3px solid var(--border);
    }
    .issue.error { border-left-color: var(--accent-red); }
    .issue.warning { border-left-color: var(--accent-yellow); }
    .issue-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.3rem; }
    .flag-name { font-weight: bold; color: var(--accent-blue); font-size: 0.9rem; }
    .location { color: var(--text-secondary); font-size: 0.75rem; font-family: monospace; }
    .validation-msg { margin-top: 0.3rem; font-size: 0.85rem; }
    .badge {
      display: inline-block;
      font-size: 0.65rem;
      padding: 0.1rem 0.4rem;
      border-radius: 12px;
      font-weight: 500;
    }
    .badge-error { background: #ffebe9; color: var(--accent-red); }
    .badge-warning { background: #fff8c5; color: var(--accent-yellow); }
    .badge-info { background: #ddf4ff; color: var(--accent-blue); }
    .badge-confidence { background: #dafbe1; color: var(--accent-green); }
    .badge-tier { background: #fbefff; color: var(--accent-purple); }
    .badge-confidence.low { background: #ffebe9; color: var(--accent-red); }
    .badge-confidence.medium { background: #fff8c5; color: var(--accent-yellow); }
    .code-link { color: var(--accent-blue); text-decoration: none; font-size: 0.8rem; }
    .code-link:hover { text-decoration: underline; }
    .unused-list { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-top: 0.3rem; }
    .unused-tag {
      background: #fff8c5;
      color: var(--accent-yellow);
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-family: monospace;
    }
    .confidence-bar {
      height: 4px;
      border-radius: 2px;
      background: var(--bg-tertiary);
      margin-top: 0.2rem;
      overflow: hidden;
    }
    .confidence-fill {
      height: 100%;
      border-radius: 2px;
    }
    .confidence-fill.high { background: var(--accent-green); }
    .confidence-fill.medium { background: var(--accent-yellow); }
    .confidence-fill.low { background: var(--accent-red); }
    @media (max-width: 768px) {
      .overview-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${esc(t.title)}</h1>
    <p class="subtitle">${esc(t.subtitle)}</p>

    <div class="card">
      <div class="overview-grid">
        <div>
          <h3>${esc(t.metadata)}</h3>
          <div class="meta-grid">
            <span class="meta-label">${esc(t.repository)}</span><span>${esc(metadata.repository)}</span>
            <span class="meta-label">${esc(t.branch)}</span><span>${esc(metadata.branch)}</span>
            <span class="meta-label">${esc(t.commit)}</span><span><code>${esc(metadata.commit.slice(0, 8))}</code></span>
            <span class="meta-label">${esc(t.scanTime)}</span><span>${esc(metadata.scanTime)}</span>
            <span class="meta-label">${esc(t.version)}</span><span>${esc(metadata.toolVersion)}</span>
          </div>
        </div>
        <div>
          <h3>${esc(t.summary)}</h3>
          <div class="stats">
            <div class="stat stat-ok"><div class="stat-value">${summary.totalFilesScanned}</div><div class="stat-label">${esc(t.filesScanned)}</div></div>
            <div class="stat stat-ok"><div class="stat-value">${summary.totalUsages}</div><div class="stat-label">${esc(t.flagUsages)}</div></div>
            <div class="stat ${summary.errors > 0 ? 'stat-error' : 'stat-ok'}"><div class="stat-value">${summary.errors}</div><div class="stat-label">${esc(t.errors)}</div></div>
            <div class="stat ${summary.warnings > 0 ? 'stat-warn' : 'stat-ok'}"><div class="stat-value">${summary.warnings}</div><div class="stat-label">${esc(t.warnings)}</div></div>
            <div class="stat ${summary.unusedFlags.length > 0 ? 'stat-warn' : 'stat-ok'}"><div class="stat-value">${summary.unusedFlags.length}</div><div class="stat-label">${esc(t.unusedFlagsLabel)}</div></div>
          </div>
          <h3 style="margin-top: 0.75rem;">${esc(t.confidenceDistribution)}</h3>
          <div class="stats">
            <div class="stat stat-ok"><div class="stat-value">${highConf}</div><div class="stat-label">${esc(t.confidenceHigh)}</div></div>
            <div class="stat stat-warn"><div class="stat-value">${medConf}</div><div class="stat-label">${esc(t.confidenceMedium)}</div></div>
            <div class="stat stat-error"><div class="stat-value">${lowConf}</div><div class="stat-label">${esc(t.confidenceLow)}</div></div>
          </div>
        </div>
      </div>
    </div>

    ${usagesWithIssues.length > 0
      ? `
    <div class="card">
      <h2>${esc(t.issues)} (${usagesWithIssues.length})</h2>
      ${usagesWithIssues.map((u) => renderIssueHtml(u, t)).join('\n')}
    </div>`
      : `
    <div class="card">
      <h2>${esc(t.noIssuesTitle)}</h2>
      <p style="color: var(--text-secondary); font-size: 0.9rem;">${esc(t.noIssuesDescription)}</p>
    </div>`
    }

    ${summary.unusedFlags.length > 0
      ? `
    <div class="card">
      <h2>${esc(t.unusedFlagsLabel)} (${summary.unusedFlags.length})</h2>
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

function renderIssueHtml(usage: FlagUsage, t: ReportStrings): string {
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
          <span style="color: var(--text-secondary); margin-left: 0.5rem; font-size: 0.85rem;">${esc(usage.methodName)}()</span>
          <span class="badge badge-info" style="margin-left: 0.5rem;">${esc(usage.language)}</span>
          <span class="badge badge-tier" style="margin-left: 0.3rem;">${esc(t.tier)} ${usage.languageTier}</span>
          <span class="badge badge-confidence ${confClass}" style="margin-left: 0.3rem;">${esc(t.confidence)}: ${usage.confidenceScore}</span>
        </div>
        <span class="location">${esc(usage.filePath)}:${usage.line}</span>
      </div>
      <div class="confidence-bar"><div class="confidence-fill ${confClass}" style="width: ${usage.confidenceScore}%"></div></div>
      ${usage.validation.map((v) => renderValidationHtml(v)).join('\n')}
      ${usage.codeUrl ? `<div style="margin-top: 0.3rem;"><a class="code-link" href="${esc(usage.codeUrl)}" target="_blank">${esc(t.viewInRepository)}</a></div>` : ''}
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
      ${issue.suggestion ? `<div style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 0.15rem;">Hint: ${esc(issue.suggestion)}</div>` : ''}
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
