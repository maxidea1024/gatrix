// ─── Constants ───

export const OP_COLORS: Record<string, string> = {
  db: '#8b5cf6',
  'db.query': '#8b5cf6',
  http: '#3b82f6',
  'http.client': '#3b82f6',
  'http.server': '#60a5fa',
  cache: '#f59e0b',
  queue: '#ef4444',
  grpc: '#10b981',
  resource: '#6366f1',
  browser: '#ec4899',
  ui: '#f97316',
  navigation: '#14b8a6',
  serialize: '#a855f7',
  middleware: '#06b6d4',
};

export function getOpColor(op: string): string {
  return OP_COLORS[op?.toLowerCase()] || '#6b7280';
}

export function formatDuration(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}
