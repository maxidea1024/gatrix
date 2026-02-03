import logger from '../config/logger';

/**
 * Resolve passive data based on client version.
 * Handles version-keyed objects with wildcards (e.g., "1.0.*", "*").
 *
 * If the input object doesn't appear to be version-keyed, it's returned as-is.
 *
 * @param passiveDataStr The raw JSON string from KV
 * @param clientVersion The client version to match against
 * @returns A flat object of matched passive data
 */
export function resolvePassiveData(
  passiveDataStr: string | null | undefined,
  clientVersion: string
): Record<string, any> {
  if (!passiveDataStr) return {};

  let parsed: any;
  try {
    parsed = JSON.parse(passiveDataStr);

    // Handle double-encoded JSON string
    if (typeof parsed === 'string') {
      try {
        parsed = JSON.parse(parsed);
      } catch (e) {
        // ignore
      }
    }
  } catch (error) {
    logger.warn('Failed to parse passive data string:', error);
    return {};
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }

  const keys = Object.keys(parsed);

  // Check if it's version-keyed.
  // We assume it's version-keyed if it has a '*' key or any key containing a dot and a digit.
  const isVersionKeyed = keys.includes('*') || keys.some((k) => /\d+\.\d+/.test(k));

  if (!isVersionKeyed) {
    return parsed;
  }

  // 1. Try exact match
  if (parsed[clientVersion]) {
    return parsed[clientVersion];
  }

  // 2. Try wildcard matches (e.g., "1.0.*")
  let bestMatch: string | null = null;
  for (const key of keys) {
    if (key === '*') continue;

    try {
      // Escape dots, convert * to regex match-all
      const pattern = '^' + key.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
      const regex = new RegExp(pattern);
      if (regex.test(clientVersion)) {
        // Preference: longer matches are more specific
        if (!bestMatch || key.length > bestMatch.length) {
          bestMatch = key;
        }
      }
    } catch (e) {
      // Ignore invalid regex patterns
    }
  }

  if (bestMatch) {
    return parsed[bestMatch];
  }

  // 3. Fallback to '*'
  if (parsed['*']) {
    return parsed['*'];
  }

  // If keyed but no match found, returned empty object
  return {};
}
