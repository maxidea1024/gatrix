/**
 * Semantic Versioning (semver) utility functions
 *
 * Supports version format: MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
 * Examples: 1.0.0, 1.2.3-alpha, 2.0.0-beta.1+build.123
 */

export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
  build?: string;
}

/**
 * Parse a semantic version string into components
 *
 * @param {string} version - Version string to parse
 * @returns {SemanticVersion} Parsed version object
 * @throws {Error} If version string is invalid
 */
export function parseVersion(version: string): SemanticVersion {
  if (!version || typeof version !== 'string') {
    throw new Error('Invalid version: must be a non-empty string');
  }

  // Remove leading 'v' if present
  const cleanVersion = version.trim().replace(/^v/, '');

  // Regex to parse semver: MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
  const semverRegex = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$/;
  const match = cleanVersion.match(semverRegex);

  if (!match) {
    throw new Error(`Invalid semantic version format: ${version}`);
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
    build: match[5],
  };
}

/**
 * Compare two semantic versions
 *
 * @param {string} version1 - First version to compare
 * @param {string} version2 - Second version to compare
 * @returns {number} -1 if version1 < version2, 0 if equal, 1 if version1 > version2
 */
export function compareVersions(version1: string, version2: string): number {
  const v1 = parseVersion(version1);
  const v2 = parseVersion(version2);

  // Compare major version
  if (v1.major !== v2.major) {
    return v1.major > v2.major ? 1 : -1;
  }

  // Compare minor version
  if (v1.minor !== v2.minor) {
    return v1.minor > v2.minor ? 1 : -1;
  }

  // Compare patch version
  if (v1.patch !== v2.patch) {
    return v1.patch > v2.patch ? 1 : -1;
  }

  // Compare prerelease
  // No prerelease > has prerelease (1.0.0 > 1.0.0-alpha)
  if (!v1.prerelease && v2.prerelease) {
    return 1;
  }
  if (v1.prerelease && !v2.prerelease) {
    return -1;
  }
  if (v1.prerelease && v2.prerelease) {
    return comparePrereleases(v1.prerelease, v2.prerelease);
  }

  // Versions are equal (build metadata is ignored in comparison)
  return 0;
}

/**
 * Compare prerelease versions
 *
 * @param {string} pre1 - First prerelease string
 * @param {string} pre2 - Second prerelease string
 * @returns {number} -1 if pre1 < pre2, 0 if equal, 1 if pre1 > pre2
 */
function comparePrereleases(pre1: string, pre2: string): number {
  const parts1 = pre1.split('.');
  const parts2 = pre2.split('.');

  const maxLength = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLength; i++) {
    const part1 = parts1[i];
    const part2 = parts2[i];

    // If one prerelease has fewer parts, it's considered less
    if (part1 === undefined) return -1;
    if (part2 === undefined) return 1;

    // Numeric comparison if both are numbers
    const num1 = parseInt(part1, 10);
    const num2 = parseInt(part2, 10);

    if (!isNaN(num1) && !isNaN(num2)) {
      if (num1 !== num2) {
        return num1 > num2 ? 1 : -1;
      }
    } else {
      // Lexical comparison
      if (part1 !== part2) {
        return part1 > part2 ? 1 : -1;
      }
    }
  }

  return 0;
}

/**
 * Check if version1 is greater than version2
 *
 * @param {string} version1 - First version
 * @param {string} version2 - Second version
 * @returns {boolean} True if version1 > version2
 */
export function isGreaterThan(version1: string, version2: string): boolean {
  return compareVersions(version1, version2) > 0;
}

/**
 * Check if version1 is less than version2
 *
 * @param {string} version1 - First version
 * @param {string} version2 - Second version
 * @returns {boolean} True if version1 < version2
 */
export function isLessThan(version1: string, version2: string): boolean {
  return compareVersions(version1, version2) < 0;
}

/**
 * Check if version1 equals version2
 *
 * @param {string} version1 - First version
 * @param {string} version2 - Second version
 * @returns {boolean} True if versions are equal
 */
export function isEqual(version1: string, version2: string): boolean {
  return compareVersions(version1, version2) === 0;
}

/**
 * Check if version1 is greater than or equal to version2
 *
 * @param {string} version1 - First version
 * @param {string} version2 - Second version
 * @returns {boolean} True if version1 >= version2
 */
export function isGreaterThanOrEqual(version1: string, version2: string): boolean {
  return compareVersions(version1, version2) >= 0;
}

/**
 * Check if version1 is less than or equal to version2
 *
 * @param {string} version1 - First version
 * @param {string} version2 - Second version
 * @returns {boolean} True if version1 <= version2
 */
export function isLessThanOrEqual(version1: string, version2: string): boolean {
  return compareVersions(version1, version2) <= 0;
}

/**
 * Validate if a string is a valid semantic version
 *
 * @param {string} version - Version string to validate
 * @returns {boolean} True if valid semver
 */
export function isValidVersion(version: string): boolean {
  try {
    parseVersion(version);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the maximum version from an array of versions
 *
 * @param {string[]} versions - Array of version strings
 * @returns {string | null} Maximum version or null if array is empty
 */
export function getMaxVersion(versions: string[]): string | null {
  if (!versions || versions.length === 0) {
    return null;
  }

  return versions.reduce((max, current) => {
    return compareVersions(current, max) > 0 ? current : max;
  });
}

/**
 * Get the minimum version from an array of versions
 *
 * @param {string[]} versions - Array of version strings
 * @returns {string | null} Minimum version or null if array is empty
 */
export function getMinVersion(versions: string[]): string | null {
  if (!versions || versions.length === 0) {
    return null;
  }

  return versions.reduce((min, current) => {
    return compareVersions(current, min) < 0 ? current : min;
  });
}

export default {
  parseVersion,
  compareVersions,
  isGreaterThan,
  isLessThan,
  isEqual,
  isGreaterThanOrEqual,
  isLessThanOrEqual,
  isValidVersion,
  getMaxVersion,
  getMinVersion,
};
