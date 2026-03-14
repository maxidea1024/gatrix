/**
 * Deep-compare two objects regardless of key order
 * by producing a canonical JSON string with sorted keys.
 */
export function sortedStringify(obj: any): string {
  if (obj === null || obj === undefined) return JSON.stringify(obj);
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(sortedStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + sortedStringify(obj[k]))
      .join(',') +
    '}'
  );
}
