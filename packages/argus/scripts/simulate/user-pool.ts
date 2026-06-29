/**
 * Simulate Data — User Pool Generation
 */
import { USER_POOL_SIZE } from './config';
import { randomInt, randomPick, weightedPick } from './helpers';

// ═══════════════════ COUNTRY / GEO DATA ═══════════════════

const COUNTRIES_WEIGHTED = [
  { code: 'KR', weight: 40 },
  { code: 'JP', weight: 20 },
  { code: 'US', weight: 12 },
  { code: 'TW', weight: 8 },
  { code: 'TH', weight: 5 },
  { code: 'DE', weight: 4 },
  { code: 'BR', weight: 3 },
  { code: 'FR', weight: 3 },
  { code: 'GB', weight: 3 },
  { code: 'SG', weight: 2 },
];

const CITIES: Record<string, string[]> = {
  KR: ['Seoul', 'Busan', 'Incheon', 'Daejeon', 'Gwangju'],
  JP: ['Tokyo', 'Osaka', 'Nagoya', 'Yokohama', 'Sapporo'],
  US: ['Los Angeles', 'New York', 'Seattle', 'Chicago', 'San Francisco'],
  TW: ['Taipei', 'Kaohsiung', 'Taichung'],
  TH: ['Bangkok', 'Chiang Mai'],
  DE: ['Berlin', 'Munich', 'Hamburg'],
  BR: ['São Paulo', 'Rio de Janeiro'],
  FR: ['Paris', 'Lyon'],
  GB: ['London', 'Manchester'],
  SG: ['Singapore'],
};

const EMAIL_DOMAINS = [
  'gmail.com',
  'naver.com',
  'yahoo.co.jp',
  'outlook.com',
  'daum.net',
  'qq.com',
  'hotmail.com',
];

const NAMES_PREFIX = [
  'Navigator',
  'Captain',
  'Admiral',
  'Merchant',
  'Explorer',
  'Pirate',
  'Corsair',
  'Trader',
  'Sailor',
  'Buccaneer',
];

// ═══════════════════ USER POOL ═══════════════════

export interface SimUser {
  id: string;
  email: string;
  name: string;
  ip: string;
  country: string;
  city: string;
  avatarUrl?: string;
}

export const USERS: SimUser[] = Array.from(
  { length: USER_POOL_SIZE },
  (_, i) => {
    const country = weightedPick(
      COUNTRIES_WEIGHTED.map((c) => c.code),
      COUNTRIES_WEIGHTED.map((c) => c.weight)
    );
    const avatarUrl = `https://i.pravatar.cc/150?u=user_${10000 + i}`;

    return {
      id: `user_${10000 + i}`,
      email: `player${10000 + i}@${randomPick(EMAIL_DOMAINS)}`,
      name: `${randomPick(NAMES_PREFIX)}_${10000 + i}`,
      ip: `${randomInt(1, 223)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`,
      country,
      city: randomPick(CITIES[country] || ['Unknown']),
      avatarUrl,
    };
  }
);

// ═══════════════════ BROWSER / OS ═══════════════════

export const BROWSERS = [
  { name: 'Chrome', version: '125.0', w: 40 },
  { name: 'Chrome', version: '124.0', w: 20 },
  { name: 'Firefox', version: '126.0', w: 10 },
  { name: 'Safari', version: '17.5', w: 8 },
  { name: 'Edge', version: '125.0', w: 8 },
  { name: 'Whale', version: '3.26', w: 5 },
  { name: 'Opera', version: '110.0', w: 3 },
  { name: 'Samsung Internet', version: '25.0', w: 3 },
  { name: 'UE4 Embedded', version: '4.27', w: 3 },
];

export const OS_LIST = [
  { name: 'Windows', version: '11', w: 35 },
  { name: 'Windows', version: '10', w: 25 },
  { name: 'macOS', version: '14.5', w: 10 },
  { name: 'iOS', version: '17.5', w: 8 },
  { name: 'Android', version: '14', w: 8 },
  { name: 'Linux', version: '6.8', w: 5 },
  { name: 'Ubuntu', version: '24.04', w: 5 },
  { name: 'Steam Deck', version: '3.5', w: 4 },
];
