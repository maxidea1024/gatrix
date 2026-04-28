/**
 * Coupon code generator utility
 * Generates coupon codes based on specified pattern
 */

import crypto from 'crypto';

export type CodePattern =
  | 'ALPHANUMERIC_8'
  | 'ALPHANUMERIC_16'
  | 'ALPHANUMERIC_16_HYPHEN';

const CHARSET =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const CHARSET_LEN = CHARSET.length; // 62

/**
 * Generate a cryptographically secure random alphanumeric string.
 * Uses crypto.randomBytes() for uniform distribution over the 62-char charset.
 * Rejection sampling ensures no modulo bias.
 *
 * @param length - Length of the string to generate
 * @returns Random alphanumeric string
 */
function generateRandomAlphanumeric(length: number): string {
  const result: string[] = [];
  // 256 % 62 = 8, so values >= 248 are rejected to avoid modulo bias
  const maxValid = 256 - (256 % CHARSET_LEN); // 248

  while (result.length < length) {
    // Request extra bytes to account for rejections (~3.1% rejection rate)
    const needed = length - result.length;
    const bytes = crypto.randomBytes(needed + 4);
    for (let i = 0; i < bytes.length && result.length < length; i++) {
      if (bytes[i] < maxValid) {
        result.push(CHARSET[bytes[i] % CHARSET_LEN]);
      }
    }
  }

  return result.join('');
}

/**
 * Generate coupon code based on pattern
 * @param pattern - Code pattern type
 * @returns Generated coupon code
 */
export function generateCouponCode(pattern: CodePattern): string {
  switch (pattern) {
    case 'ALPHANUMERIC_8':
      return generateRandomAlphanumeric(8);

    case 'ALPHANUMERIC_16':
      return generateRandomAlphanumeric(16);

    case 'ALPHANUMERIC_16_HYPHEN': {
      const code = generateRandomAlphanumeric(16);
      // Insert hyphens every 4 characters: XXXX-XXXX-XXXX-XXXX
      return `${code.substring(0, 4)}-${code.substring(4, 8)}-${code.substring(8, 12)}-${code.substring(12, 16)}`;
    }

    default:
      return generateRandomAlphanumeric(8);
  }
}

/**
 * Get code length for pattern (without hyphens)
 * @param pattern - Code pattern type
 * @returns Code length
 */
export function getCodeLength(pattern: CodePattern): number {
  switch (pattern) {
    case 'ALPHANUMERIC_8':
      return 8;
    case 'ALPHANUMERIC_16':
    case 'ALPHANUMERIC_16_HYPHEN':
      return 16;
    default:
      return 8;
  }
}

/**
 * Get code length with hyphens for pattern
 * @param pattern - Code pattern type
 * @returns Code length including hyphens
 */
export function getCodeLengthWithHyphens(pattern: CodePattern): number {
  switch (pattern) {
    case 'ALPHANUMERIC_8':
      return 8;
    case 'ALPHANUMERIC_16':
      return 16;
    case 'ALPHANUMERIC_16_HYPHEN':
      return 19; // 16 chars + 3 hyphens
    default:
      return 8;
  }
}
