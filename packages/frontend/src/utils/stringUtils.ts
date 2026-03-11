/**
 * Convert kebab-case, snake_case, or camelCase to Title Case.
 * Examples:
 *   "beta-users"  → "Beta Users"
 *   "my_flag"     → "My Flag"
 *   "userId"      → "User Id"
 */
export const toTitleCase = (str: string): string =>
  str
    .replace(/([a-z])([A-Z])/g, '$1 $2') // split camelCase
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
