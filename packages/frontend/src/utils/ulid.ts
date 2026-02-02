/**
 * ULID (Universally Unique Lexicographically Sortable Identifier) Generator
 *
 * Browser-compatible implementation without external dependencies.
 * Generates 26-character identifiers using Crockford's Base32.
 */

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"; // Crockford's Base32

/**
 * Encode timestamp to Crockford's Base32
 */
function encodeTime(now: number, len: number): string {
  let str = "";
  for (let i = len - 1; i >= 0; i--) {
    const mod = now % 32;
    str = ENCODING[mod] + str;
    now = Math.floor(now / 32);
  }
  return str;
}

/**
 * Generate random characters using Crockford's Base32
 */
function encodeRandom(len: number): string {
  let str = "";
  const randomValues = new Uint8Array(len);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < len; i++) {
    str += ENCODING[randomValues[i] % 32];
  }
  return str;
}

/**
 * Generate a new ULID
 *
 * ULIDs are:
 * - 26 character string
 * - Lexicographically sortable
 * - Uses Crockford's Base32
 * - Case insensitive
 * - URL safe
 *
 * @returns A new ULID string
 */
export function generateULID(): string {
  const timestamp = Date.now();
  const timeChars = encodeTime(timestamp, 10);
  const randomChars = encodeRandom(16);
  return timeChars + randomChars;
}

/**
 * Validate if a string is a valid ULID
 *
 * @param id - The string to validate
 * @returns True if valid ULID, false otherwise
 */
export function isValidULID(id: string): boolean {
  const ulidRegex = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/i;
  return ulidRegex.test(id);
}

export default {
  generateULID,
  isValidULID,
};
