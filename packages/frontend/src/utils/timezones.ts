/**
 * IANA Time Zone database - commonly used timezones
 * Grouped by region for easier browsing
 */
export interface TimezoneEntry {
  tz: string; // IANA timezone identifier (e.g. 'Asia/Seoul')
  label: string; // Human-readable label
  offset: string; // UTC offset label
}

/**
 * Commonly used IANA timezones
 */
export const TIMEZONES: TimezoneEntry[] = [
  // UTC
  { tz: 'UTC', label: 'UTC', offset: 'UTC+0' },
  { tz: 'GMT', label: 'GMT', offset: 'UTC+0' },

  // Americas
  { tz: 'America/New_York', label: 'New York (Eastern)', offset: 'UTC-5' },
  { tz: 'America/Chicago', label: 'Chicago (Central)', offset: 'UTC-6' },
  { tz: 'America/Denver', label: 'Denver (Mountain)', offset: 'UTC-7' },
  { tz: 'America/Los_Angeles', label: 'Los Angeles (Pacific)', offset: 'UTC-8' },
  { tz: 'America/Anchorage', label: 'Anchorage (Alaska)', offset: 'UTC-9' },
  { tz: 'Pacific/Honolulu', label: 'Honolulu (Hawaii)', offset: 'UTC-10' },
  { tz: 'America/Toronto', label: 'Toronto', offset: 'UTC-5' },
  { tz: 'America/Vancouver', label: 'Vancouver', offset: 'UTC-8' },
  { tz: 'America/Mexico_City', label: 'Mexico City', offset: 'UTC-6' },
  { tz: 'America/Bogota', label: 'Bogotá', offset: 'UTC-5' },
  { tz: 'America/Lima', label: 'Lima', offset: 'UTC-5' },
  { tz: 'America/Santiago', label: 'Santiago', offset: 'UTC-4' },
  { tz: 'America/Buenos_Aires', label: 'Buenos Aires', offset: 'UTC-3' },
  { tz: 'America/Sao_Paulo', label: 'São Paulo', offset: 'UTC-3' },

  // Europe
  { tz: 'Europe/London', label: 'London', offset: 'UTC+0' },
  { tz: 'Europe/Dublin', label: 'Dublin', offset: 'UTC+0' },
  { tz: 'Europe/Paris', label: 'Paris', offset: 'UTC+1' },
  { tz: 'Europe/Berlin', label: 'Berlin', offset: 'UTC+1' },
  { tz: 'Europe/Madrid', label: 'Madrid', offset: 'UTC+1' },
  { tz: 'Europe/Rome', label: 'Rome', offset: 'UTC+1' },
  { tz: 'Europe/Amsterdam', label: 'Amsterdam', offset: 'UTC+1' },
  { tz: 'Europe/Brussels', label: 'Brussels', offset: 'UTC+1' },
  { tz: 'Europe/Zurich', label: 'Zurich', offset: 'UTC+1' },
  { tz: 'Europe/Vienna', label: 'Vienna', offset: 'UTC+1' },
  { tz: 'Europe/Stockholm', label: 'Stockholm', offset: 'UTC+1' },
  { tz: 'Europe/Oslo', label: 'Oslo', offset: 'UTC+1' },
  { tz: 'Europe/Copenhagen', label: 'Copenhagen', offset: 'UTC+1' },
  { tz: 'Europe/Helsinki', label: 'Helsinki', offset: 'UTC+2' },
  { tz: 'Europe/Warsaw', label: 'Warsaw', offset: 'UTC+1' },
  { tz: 'Europe/Prague', label: 'Prague', offset: 'UTC+1' },
  { tz: 'Europe/Budapest', label: 'Budapest', offset: 'UTC+1' },
  { tz: 'Europe/Bucharest', label: 'Bucharest', offset: 'UTC+2' },
  { tz: 'Europe/Athens', label: 'Athens', offset: 'UTC+2' },
  { tz: 'Europe/Istanbul', label: 'Istanbul', offset: 'UTC+3' },
  { tz: 'Europe/Moscow', label: 'Moscow', offset: 'UTC+3' },
  { tz: 'Europe/Kiev', label: 'Kyiv', offset: 'UTC+2' },
  { tz: 'Europe/Lisbon', label: 'Lisbon', offset: 'UTC+0' },

  // Asia
  { tz: 'Asia/Seoul', label: 'Seoul', offset: 'UTC+9' },
  { tz: 'Asia/Tokyo', label: 'Tokyo', offset: 'UTC+9' },
  { tz: 'Asia/Shanghai', label: 'Shanghai', offset: 'UTC+8' },
  { tz: 'Asia/Hong_Kong', label: 'Hong Kong', offset: 'UTC+8' },
  { tz: 'Asia/Taipei', label: 'Taipei', offset: 'UTC+8' },
  { tz: 'Asia/Singapore', label: 'Singapore', offset: 'UTC+8' },
  { tz: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur', offset: 'UTC+8' },
  { tz: 'Asia/Jakarta', label: 'Jakarta', offset: 'UTC+7' },
  { tz: 'Asia/Bangkok', label: 'Bangkok', offset: 'UTC+7' },
  { tz: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh', offset: 'UTC+7' },
  { tz: 'Asia/Manila', label: 'Manila', offset: 'UTC+8' },
  { tz: 'Asia/Kolkata', label: 'Kolkata (India)', offset: 'UTC+5:30' },
  { tz: 'Asia/Mumbai', label: 'Mumbai', offset: 'UTC+5:30' },
  { tz: 'Asia/Karachi', label: 'Karachi', offset: 'UTC+5' },
  { tz: 'Asia/Dhaka', label: 'Dhaka', offset: 'UTC+6' },
  { tz: 'Asia/Colombo', label: 'Colombo', offset: 'UTC+5:30' },
  { tz: 'Asia/Dubai', label: 'Dubai', offset: 'UTC+4' },
  { tz: 'Asia/Riyadh', label: 'Riyadh', offset: 'UTC+3' },
  { tz: 'Asia/Tehran', label: 'Tehran', offset: 'UTC+3:30' },
  { tz: 'Asia/Baghdad', label: 'Baghdad', offset: 'UTC+3' },
  { tz: 'Asia/Jerusalem', label: 'Jerusalem', offset: 'UTC+2' },
  { tz: 'Asia/Almaty', label: 'Almaty', offset: 'UTC+6' },
  { tz: 'Asia/Tashkent', label: 'Tashkent', offset: 'UTC+5' },
  { tz: 'Asia/Vladivostok', label: 'Vladivostok', offset: 'UTC+10' },
  { tz: 'Asia/Novosibirsk', label: 'Novosibirsk', offset: 'UTC+7' },
  { tz: 'Asia/Yekaterinburg', label: 'Yekaterinburg', offset: 'UTC+5' },
  { tz: 'Asia/Phnom_Penh', label: 'Phnom Penh', offset: 'UTC+7' },
  { tz: 'Asia/Yangon', label: 'Yangon', offset: 'UTC+6:30' },
  { tz: 'Asia/Kathmandu', label: 'Kathmandu', offset: 'UTC+5:45' },
  { tz: 'Asia/Ulaanbaatar', label: 'Ulaanbaatar', offset: 'UTC+8' },

  // Africa
  { tz: 'Africa/Cairo', label: 'Cairo', offset: 'UTC+2' },
  { tz: 'Africa/Lagos', label: 'Lagos', offset: 'UTC+1' },
  { tz: 'Africa/Nairobi', label: 'Nairobi', offset: 'UTC+3' },
  { tz: 'Africa/Johannesburg', label: 'Johannesburg', offset: 'UTC+2' },
  { tz: 'Africa/Casablanca', label: 'Casablanca', offset: 'UTC+1' },
  { tz: 'Africa/Addis_Ababa', label: 'Addis Ababa', offset: 'UTC+3' },
  { tz: 'Africa/Accra', label: 'Accra', offset: 'UTC+0' },
  { tz: 'Africa/Dar_es_Salaam', label: 'Dar es Salaam', offset: 'UTC+3' },

  // Oceania
  { tz: 'Australia/Sydney', label: 'Sydney', offset: 'UTC+11' },
  { tz: 'Australia/Melbourne', label: 'Melbourne', offset: 'UTC+11' },
  { tz: 'Australia/Brisbane', label: 'Brisbane', offset: 'UTC+10' },
  { tz: 'Australia/Perth', label: 'Perth', offset: 'UTC+8' },
  { tz: 'Australia/Adelaide', label: 'Adelaide', offset: 'UTC+10:30' },
  { tz: 'Pacific/Auckland', label: 'Auckland', offset: 'UTC+13' },
  { tz: 'Pacific/Fiji', label: 'Fiji', offset: 'UTC+12' },
  { tz: 'Pacific/Guam', label: 'Guam', offset: 'UTC+10' },
];

/**
 * Set of valid timezone identifiers for quick lookup
 */
export const TIMEZONE_SET = new Set(TIMEZONES.map((t) => t.tz));

/**
 * Lookup a timezone entry
 */
export const getTimezoneEntry = (tz: string): TimezoneEntry | undefined => {
  return TIMEZONES.find((t) => t.tz === tz);
};

/**
 * Get display label for a timezone: "Asia/Seoul (UTC+9)"
 */
export const getTimezoneLabel = (tz: string): string => {
  const entry = getTimezoneEntry(tz);
  if (!entry) return tz;
  return `${entry.label} (${entry.offset})`;
};
