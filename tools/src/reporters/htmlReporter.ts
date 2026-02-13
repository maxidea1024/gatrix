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
      --bg: #ffffff;
      --bg-card: #f6f8fa;
      --text: #1f2328;
      --text-sub: #656d76;
      --blue: #0969da;
      --green: #1a7f37;
      --red: #cf222e;
      --yellow: #9a6700;
      --purple: #8250df;
      --border: #d0d7de;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: var(--bg); color: var(--text); line-height: 1.5; padding: 1.5rem 2rem; }
    .container { max-width: 1100px; margin: 0 auto; }

    /* Header */
    .header { margin-bottom: 1.25rem; }
    .header h1 { font-size: 1.4rem; font-weight: 700; }
    .header .sub { color: var(--text-sub); font-size: 0.85rem; margin-top: 0.15rem; }

    /* Meta strip */
    .meta-strip { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem; }
    .meta-chip {
      display: inline-flex; align-items: center; gap: 0.35rem;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px;
      padding: 0.25rem 0.6rem; font-size: 0.8rem;
    }
    .meta-chip .label { color: var(--text-sub); font-weight: 500; }
    .meta-chip code { font-size: 0.78rem; background: #e8ecf0; padding: 0.05rem 0.3rem; border-radius: 3px; }

    /* Stats bar */
    .stats-bar {
      display: flex; gap: 0; margin-bottom: 1rem;
      background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px;
      overflow: hidden;
    }
    .stats-section {
      flex: 1; padding: 0.75rem 0;
      border-right: 1px solid var(--border);
    }
    .stats-section:last-child { border-right: none; }
    .stats-section h3 {
      font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.5px;
      color: var(--text-sub); text-align: center; margin-bottom: 0.4rem; font-weight: 600;
    }
    .stats-row { display: flex; justify-content: center; gap: 1.25rem; }
    .s { text-align: center; }
    .s .v { font-size: 1.3rem; font-weight: 700; line-height: 1.2; }
    .s .l { font-size: 0.7rem; color: var(--text-sub); }
    .v-green { color: var(--green); }
    .v-red { color: var(--red); }
    .v-yellow { color: var(--yellow); }

    /* Card */
    .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 0.85rem 1rem; margin-bottom: 0.75rem; }
    .card h2 { font-size: 0.95rem; color: var(--blue); margin-bottom: 0.5rem; font-weight: 600; }

    /* Issues */
    .issue {
      background: var(--bg); border: 1px solid var(--border); border-left: 3px solid var(--border);
      border-radius: 6px; padding: 0.6rem 0.75rem; margin-bottom: 0.4rem;
    }
    .issue.error { border-left-color: var(--red); }
    .issue.warning { border-left-color: var(--yellow); }
    .issue-top { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.25rem; }
    .flag-name { font-weight: 600; color: var(--blue); font-size: 0.88rem; }
    .loc { color: var(--text-sub); font-size: 0.72rem; font-family: monospace; }
    .vm { margin-top: 0.25rem; font-size: 0.82rem; }

    /* Badges */
    .b { display: inline-block; font-size: 0.63rem; padding: 0.08rem 0.4rem; border-radius: 10px; font-weight: 500; }
    .b-err { background: #ffebe9; color: var(--red); }
    .b-warn { background: #fff8c5; color: var(--yellow); }
    .b-info { background: #ddf4ff; color: var(--blue); }
    .b-conf { background: #dafbe1; color: var(--green); }
    .b-tier { background: #fbefff; color: var(--purple); }
    .b-conf.low { background: #ffebe9; color: var(--red); }
    .b-conf.med { background: #fff8c5; color: var(--yellow); }

    /* Confidence bar */
    .cbar { height: 3px; border-radius: 2px; background: #e8ecf0; margin-top: 0.2rem; overflow: hidden; }
    .cfill { height: 100%; border-radius: 2px; }
    .cfill.high { background: var(--green); }
    .cfill.med { background: var(--yellow); }
    .cfill.low { background: var(--red); }

    .code-link { color: var(--blue); text-decoration: none; font-size: 0.78rem; }
    .code-link:hover { text-decoration: underline; }

    /* Unused flags */
    .tags { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .tag { background: #fff8c5; color: var(--yellow); padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.78rem; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${esc(t.title)}</h1>
      <div class="sub">${esc(t.subtitle)}</div>
    </div>

    <div class="meta-strip">
      <span class="meta-chip"><span class="label">${esc(t.repository)}</span> ${esc(metadata.repository)}</span>
      <span class="meta-chip"><span class="label">${esc(t.branch)}</span> ${esc(metadata.branch)}</span>
      <span class="meta-chip"><span class="label">${esc(t.commit)}</span> <code>${esc(metadata.commit.slice(0, 8))}</code></span>
      <span class="meta-chip"><span class="label">${esc(t.scanTime)}</span> ${esc(metadata.scanTime)}</span>
      <span class="meta-chip"><span class="label">${esc(t.version)}</span> ${esc(metadata.toolVersion)}</span>
    </div>

    <div class="stats-bar">
      <div class="stats-section">
        <h3>${esc(t.summary)}</h3>
        <div class="stats-row">
          <div class="s"><div class="v v-green">${summary.totalFilesScanned}</div><div class="l">${esc(t.filesScanned)}</div></div>
          <div class="s"><div class="v v-green">${summary.totalUsages}</div><div class="l">${esc(t.flagUsages)}</div></div>
          <div class="s"><div class="v ${summary.errors > 0 ? 'v-red' : 'v-green'}">${summary.errors}</div><div class="l">${esc(t.errors)}</div></div>
          <div class="s"><div class="v ${summary.warnings > 0 ? 'v-yellow' : 'v-green'}">${summary.warnings}</div><div class="l">${esc(t.warnings)}</div></div>
          <div class="s"><div class="v ${summary.unusedFlags.length > 0 ? 'v-yellow' : 'v-green'}">${summary.unusedFlags.length}</div><div class="l">${esc(t.unusedFlagsLabel)}</div></div>
        </div>
      </div>
      <div class="stats-section">
        <h3>${esc(t.confidenceDistribution)}</h3>
        <div class="stats-row">
          <div class="s"><div class="v v-green">${highConf}</div><div class="l">${esc(t.confidenceHigh)}</div></div>
          <div class="s"><div class="v v-yellow">${medConf}</div><div class="l">${esc(t.confidenceMedium)}</div></div>
          <div class="s"><div class="v v-red">${lowConf}</div><div class="l">${esc(t.confidenceLow)}</div></div>
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
      <p style="color: var(--text-sub); font-size: 0.85rem;">${esc(t.noIssuesDescription)}</p>
    </div>`
    }

    ${summary.unusedFlags.length > 0
      ? `
    <div class="card">
      <h2>${esc(t.unusedFlagsLabel)} (${summary.unusedFlags.length})</h2>
      <div class="tags">
        ${summary.unusedFlags.map((f) => `<span class="tag">${esc(f)}</span>`).join('\n')}
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
    usage.confidenceScore >= 80 ? 'high' : usage.confidenceScore >= 50 ? 'med' : 'low';

  return `
    <div class="issue ${maxSeverity}">
      <div class="issue-top">
        <div>
          <span class="flag-name">${esc(usage.flagName)}</span>
          <span style="color: var(--text-sub); margin-left: 0.4rem; font-size: 0.82rem;">${esc(usage.methodName)}()</span>
          <span class="b b-info" style="margin-left: 0.4rem;">${esc(usage.language)}</span>
          <span class="b b-tier" style="margin-left: 0.2rem;">${esc(t.tier)} ${usage.languageTier}</span>
          <span class="b b-conf ${confClass}" style="margin-left: 0.2rem;">${esc(t.confidence)}: ${usage.confidenceScore}</span>
        </div>
        <span class="loc">${esc(usage.filePath)}:${usage.line}</span>
      </div>
      <div class="cbar"><div class="cfill ${confClass}" style="width: ${usage.confidenceScore}%"></div></div>
      ${usage.validation.map((v) => renderValidationHtml(v)).join('\n')}
      ${usage.codeUrl ? `<div style="margin-top: 0.2rem;"><a class="code-link" href="${esc(usage.codeUrl)}" target="_blank">${esc(t.viewInRepository)}</a></div>` : ''}
    </div>`;
}

function renderValidationHtml(issue: ValidationIssue): string {
  const badgeClass =
    issue.severity === 'error'
      ? 'b-err'
      : issue.severity === 'warning'
        ? 'b-warn'
        : 'b-info';
  return `
    <div class="vm">
      <span class="b ${badgeClass}">${esc(issue.code)}</span>
      <span style="margin-left: 0.4rem;">${esc(issue.message)}</span>
      ${issue.suggestion ? `<div style="color: var(--text-sub); font-size: 0.75rem; margin-top: 0.1rem;">Hint: ${esc(issue.suggestion)}</div>` : ''}
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
