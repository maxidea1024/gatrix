import { ulid } from 'ulid';

/**
 * Generate a new ULID (Universally Unique Lexicographically Sortable Identifier)
 *
 * ULIDs are:
 * - 26 character string
 * - Lexicographically sortable
 * - Canonically encoded as a 26 character string
 * - Uses Crockford's base32 for better efficiency and readability
 * - Case insensitive
 * - No special characters (URL safe)
 * - Monotonic sort order (correctly detects and handles the same millisecond)
 *
 * @returns {string} A new ULID string
 */
export function generateULID(): string {
  return ulid();
}

/**
 * Generate a ULID with a specific timestamp
 *
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} A new ULID string with the specified timestamp
 */
export function generateULIDWithTimestamp(timestamp: number): string {
  return ulid(timestamp);
}

/**
 * Validate if a string is a valid ULID
 *
 * @param {string} id - The string to validate
 * @returns {boolean} True if valid ULID, false otherwise
 */
export function isValidULID(id: string): boolean {
  // ULID is 26 characters long and uses Crockford's base32
  const ulidRegex = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/i;
  return ulidRegex.test(id);
}

/**
 * Extract timestamp from a ULID
 *
 * @param {string} id - The ULID to extract timestamp from
 * @returns {number} Unix timestamp in milliseconds
 */
export function getTimestampFromULID(id: string): number {
  if (!isValidULID(id)) {
    throw new Error('Invalid ULID format');
  }

  // First 10 characters represent the timestamp
  const timestampPart = id.substring(0, 10);

  // Decode from Crockford's base32
  const crockfordBase32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let timestamp = 0;

  for (let i = 0; i < timestampPart.length; i++) {
    const char = timestampPart[i].toUpperCase();
    const value = crockfordBase32.indexOf(char);
    timestamp = timestamp * 32 + value;
  }

  return timestamp;
}

export default {
  generateULID,
  generateULIDWithTimestamp,
  isValidULID,
  getTimestampFromULID,
};
