// Utility for generating example coupon codes for display purposes
export type CodePattern =
  | "ALPHANUMERIC_8"
  | "ALPHANUMERIC_16"
  | "ALPHANUMERIC_16_HYPHEN";

const CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Generate a random alphanumeric string of specified length
 */
function generateRandomAlphanumeric(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
  }
  return result;
}

/**
 * Generate an example coupon code based on the pattern
 * Used for displaying examples in the UI
 */
export function generateExampleCouponCode(pattern: CodePattern): string {
  switch (pattern) {
    case "ALPHANUMERIC_8":
      return generateRandomAlphanumeric(8);
    case "ALPHANUMERIC_16":
      return generateRandomAlphanumeric(16);
    case "ALPHANUMERIC_16_HYPHEN": {
      const code = generateRandomAlphanumeric(16);
      return `${code.substring(0, 4)}-${code.substring(4, 8)}-${code.substring(8, 12)}-${code.substring(12, 16)}`;
    }
    default:
      return generateRandomAlphanumeric(8);
  }
}
