import React from 'react';
import {
  Storage as StorageIcon,
  Http as HttpIcon,
  Functions as FuncIcon,
  Cached as CacheIcon,
  Send as SendIcon,
  Lock as LockIcon,
} from '@mui/icons-material';

// ─── Operation Icons ───
export const OP_ICONS: Record<string, React.ReactElement> = {
  db: <StorageIcon sx={{ fontSize: 13 }} />,
  http: <HttpIcon sx={{ fontSize: 13 }} />,
  function: <FuncIcon sx={{ fontSize: 13 }} />,
  cache: <CacheIcon sx={{ fontSize: 13 }} />,
  message: <SendIcon sx={{ fontSize: 13 }} />,
  crypto: <LockIcon sx={{ fontSize: 13 }} />,
};
export const getOpIcon = (op: string) =>
  OP_ICONS[op.split('.')[0]] || <FuncIcon sx={{ fontSize: 13 }} />;

// ─── Method Colors ───
const METHOD_COLORS: Record<string, string> = {
  GET: '#4caf50',
  POST: '#2196f3',
  PUT: '#ff9800',
  PATCH: '#7c4dff',
  DELETE: '#f44336',
  HEAD: '#9e9e9e',
  OPTIONS: '#607d8b',
  WS: '#00bcd4',
  CRON: '#e91e63',
  JOB: '#e91e63',
  GRPC: '#ff5722',
  TXN: '#8d6e63',
  FUNC: '#8d6e63',
};
export function getMethodColor(method: string): string {
  return METHOD_COLORS[method.toUpperCase()] || '#9e9e9e';
}

// ─── Transaction Parser ───
export function parseTransaction(name: string): {
  method: string;
  path: string;
} {
  const match = name.match(/^([A-Z]{2,10})\s+(.+)$/);
  if (match) return { method: match[1].toUpperCase(), path: match[2] };
  return { method: 'TXN', path: name };
}

// ─── Formatters ───
export function formatHour(hourStr: string): string {
  try {
    const d = new Date(hourStr);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${mm}/${dd} ${hh}:${mi}`;
  } catch {
    return hourStr;
  }
}

export function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  } catch {
    return ts;
  }
}

// ─── Operation Color ───
export function getOpColor(op: string): string {
  if (!op) return '#9e9e9e';
  if (op.startsWith('db')) return '#ff9800';
  if (op.startsWith('http')) return '#2196f3';
  if (op.startsWith('queue')) return '#9c27b0';
  if (op.startsWith('cache')) return '#00bcd4';
  return '#9e9e9e';
}
