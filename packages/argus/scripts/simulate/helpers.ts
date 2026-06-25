/**
 * Simulate Data — Shared Utility Functions
 */
import crypto from 'crypto';
import { NOW, DAYS_BACK } from './config';

export function md5(s: string): string {
  return crypto.createHash('md5').update(s).digest('hex');
}

export function uuid(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randomFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function weightedPick<T>(arr: T[], weights: number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}

/**
 * Realistic time distribution: peak at 20-24h KST, low at 3-7h
 */
export function randomDateWeighted(daysBack: number = DAYS_BACK): Date {
  const base = NOW.getTime() - Math.random() * daysBack * 86400000;
  const d = new Date(base);
  const hour = d.getUTCHours();
  const peakHours = [11, 12, 13, 14, 15, 16, 17, 18]; // UTC = 20-24+ KST
  const lowHours = [18, 19, 20, 21, 22]; // UTC = 3-7 KST
  if (lowHours.includes(hour) && Math.random() < 0.7) {
    d.setUTCHours(randomPick(peakHours), randomInt(0, 59), randomInt(0, 59));
  }
  return d;
}

export function formatDate(d: Date): string {
  return d.toISOString().replace('T', ' ').replace('Z', '');
}
