/**
 * Coupon code generator utility
 * Generates coupon codes based on specified pattern
 */

export type CodePattern = 'ALPHANUMERIC_8' | 'ALPHANUMERIC_16' | 'ALPHANUMERIC_16_HYPHEN';

/**
 * Generate a random alphanumeric string
 * @param length - Length of the string to generate
 * @returns Random alphanumeric string
 */
function generateRandomAlphanumeric(length: number): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
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
