/**
 * Validate resource name format.
 * Only lowercase letters, numbers, underscore, and hyphen are allowed.
 */
const NAME_PATTERN = /^[a-z0-9_-]+$/;

export function isValidResourceName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  return NAME_PATTERN.test(name);
}
