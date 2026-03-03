/**
 * Normalize a value read from a MySQL JSON column.
 *
 * mysql2 auto-parses JSON columns to native JS types, so this function
 * only handles null/undefined normalization. No JSON.parse is needed.
 *
 * IMPORTANT: Do NOT add JSON.parse() here. mysql2 already parses JSON
 * columns and calling JSON.parse again causes type coercion bugs:
 *   "55555" → 55555 (number), "true" → true (boolean)
 * See ISSUES.md for details.
 */
export function parseJsonField<T>(value: any): T | undefined {
  if (value === null || value === undefined || value === 'null') {
    return undefined;
  }

  if (typeof value === 'string') {
    if (value === '' || value.trim() === '') {
      return undefined;
    }
    try {
      return JSON.parse(value);
    } catch {
      // Malformed JSON in DB — return undefined instead of crashing
      return undefined;
    }
  }

  return value as T;
}
