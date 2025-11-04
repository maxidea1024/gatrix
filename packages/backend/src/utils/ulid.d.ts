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
export declare function generateULID(): string;
/**
 * Generate a ULID with a specific timestamp
 *
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} A new ULID string with the specified timestamp
 */
export declare function generateULIDWithTimestamp(timestamp: number): string;
/**
 * Validate if a string is a valid ULID
 *
 * @param {string} id - The string to validate
 * @returns {boolean} True if valid ULID, false otherwise
 */
export declare function isValidULID(id: string): boolean;
/**
 * Extract timestamp from a ULID
 *
 * @param {string} id - The ULID to extract timestamp from
 * @returns {number} Unix timestamp in milliseconds
 */
export declare function getTimestampFromULID(id: string): number;
declare const _default: {
    generateULID: typeof generateULID;
    generateULIDWithTimestamp: typeof generateULIDWithTimestamp;
    isValidULID: typeof isValidULID;
    getTimestampFromULID: typeof getTimestampFromULID;
};
export default _default;
//# sourceMappingURL=ulid.d.ts.map