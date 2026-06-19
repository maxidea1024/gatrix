import React, { useMemo, useState } from 'react';
import { Box, Typography, Tooltip as MuiTooltip, alpha } from '@mui/material';
import { type VizOptions, CHART_COLORS, formatValue } from './widgetTypes';

interface GeoMapRendererProps {
  data: any[];
  isDark: boolean;
  vizOptions?: VizOptions;
}

/**
 * Geo-map renderer that displays a world choropleth map.
 *
 * Uses an SVG-based simplified world map projection.
 * Expected data format: [{ country_code: 'US', count: 1234 }, ...]
 * or auto-detected from data keys.
 *
 * NOTE: For production, this should be replaced with react-simple-maps
 * for proper TopoJSON rendering. This is a functional placeholder
 * that uses country rectangles in a grid layout.
 */
const GeoMapRenderer: React.FC<GeoMapRendererProps> = ({
  data,
  isDark,
  vizOptions,
}) => {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const geoOpts = vizOptions?.geo;

  const { items, maxVal, minVal, countryField, valueField } = useMemo(() => {
    if (!data || data.length === 0)
      return {
        items: [],
        maxVal: 0,
        minVal: 0,
        countryField: '',
        valueField: '',
      };

    const keys = Object.keys(data[0]);
    // Auto-detect country & value fields
    const cf =
      geoOpts?.country_field ||
      keys.find((k) =>
        [
          'country_code',
          'country',
          'geo_country',
          'geo.country',
          'region',
        ].includes(k.toLowerCase())
      ) ||
      keys.find((k) => typeof data[0][k] === 'string') ||
      keys[0];

    const vf =
      geoOpts?.value_field ||
      keys.find(
        (k) =>
          k !== cf &&
          (typeof data[0][k] === 'number' || !isNaN(Number(data[0][k])))
      ) ||
      keys[1];

    if (!cf || !vf)
      return {
        items: [],
        maxVal: 0,
        minVal: 0,
        countryField: '',
        valueField: '',
      };

    let max = -Infinity;
    let min = Infinity;
    const list = data.map((row) => {
      const v = Number(row[vf]);
      if (v > max) max = v;
      if (v < min) min = v;
      const rawCode = String(row[cf]).toUpperCase();
      // Normalize alpha-3 to alpha-2 if needed
      const code =
        rawCode.length === 3
          ? ALPHA3_TO_ALPHA2[rawCode] || rawCode.slice(0, 2)
          : rawCode;
      return {
        country: code,
        value: v,
        label: COUNTRY_NAMES[code] || COUNTRY_NAMES[rawCode] || String(row[cf]),
      };
    });

    return {
      items: list,
      maxVal: max,
      minVal: min,
      countryField: cf,
      valueField: vf,
    };
  }, [data, geoOpts?.country_field, geoOpts?.value_field]);

  if (items.length === 0) return null;

  const baseColor = vizOptions?.series_colors?.['geo-map'] || CHART_COLORS[0];

  function getIntensity(value: number): number {
    if (maxVal === minVal) return 0.5;
    return 0.1 + ((value - minVal) / (maxVal - minVal)) * 0.8;
  }

  // Build a map for quick lookup
  const countryMap = useMemo(() => {
    const map = new Map<string, { value: number; label: string }>();
    items.forEach((item) => map.set(item.country, item));
    return map;
  }, [items]);

  // Simplified world map: render country items as a ranked list with color bars
  // This is the fallback when react-simple-maps is not installed
  const sortedItems = useMemo(
    () => [...items].sort((a, b) => b.value - a.value),
    [items]
  );

  return (
    <Box
      sx={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Color scale legend */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1,
          py: 0.3,
          flexShrink: 0,
        }}
      >
        <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
          {formatValue(minVal, vizOptions)}
        </Typography>
        <Box
          sx={{
            flex: 1,
            height: 6,
            borderRadius: 3,
            background: `linear-gradient(90deg, ${alpha(baseColor, 0.1)}, ${alpha(baseColor, 0.9)})`,
          }}
        />
        <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
          {formatValue(maxVal, vizOptions)}
        </Typography>
      </Box>

      {/* Country list with geographic color bars */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          px: 0.5,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.3,
        }}
      >
        {sortedItems.slice(0, 30).map((item, i) => {
          const intensity = getIntensity(item.value);
          const isHovered = hoveredCountry === item.country;

          return (
            <MuiTooltip
              key={item.country}
              title={`${item.label}: ${formatValue(item.value, vizOptions)}`}
              arrow
              placement="right"
            >
              <Box
                onMouseEnter={() => setHoveredCountry(item.country)}
                onMouseLeave={() => setHoveredCountry(null)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.8,
                  py: 0.2,
                  px: 0.5,
                  borderRadius: 1,
                  cursor: 'default',
                  backgroundColor: isHovered
                    ? alpha(baseColor, 0.06)
                    : 'transparent',
                  transition: 'background-color 0.15s',
                }}
              >
                {/* Country flag emoji (from code) */}
                <Typography
                  sx={{
                    fontSize: '0.85rem',
                    minWidth: 22,
                    textAlign: 'center',
                  }}
                >
                  {countryCodeToFlag(item.country)}
                </Typography>

                {/* Country name */}
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 500,
                    color: 'text.secondary',
                    minWidth: 80,
                    maxWidth: '35%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {item.label}
                </Typography>

                {/* Bar */}
                <Box
                  sx={{
                    flex: 1,
                    height: 12,
                    borderRadius: 6,
                    overflow: 'hidden',
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.03)',
                  }}
                >
                  <Box
                    sx={{
                      height: '100%',
                      borderRadius: 6,
                      width: `${maxVal > 0 ? (item.value / maxVal) * 100 : 0}%`,
                      backgroundColor: alpha(baseColor, intensity),
                      transition: 'width 0.4s ease',
                      minWidth: item.value > 0 ? 4 : 0,
                    }}
                  />
                </Box>

                {/* Value */}
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    minWidth: 40,
                    textAlign: 'right',
                  }}
                >
                  {formatValue(item.value, vizOptions)}
                </Typography>
              </Box>
            </MuiTooltip>
          );
        })}
      </Box>
    </Box>
  );
};

/** Convert ISO 3166-1 alpha-2 to flag emoji */
function countryCodeToFlag(code: string): string {
  if (!code || code.length < 2) return '🌍';
  const upper = code.toUpperCase().slice(0, 2);
  try {
    return String.fromCodePoint(
      ...upper.split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
    );
  } catch {
    return '🌍';
  }
}

/** Common country code → name mapping */
const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  DE: 'Germany',
  FR: 'France',
  JP: 'Japan',
  KR: 'South Korea',
  CN: 'China',
  IN: 'India',
  BR: 'Brazil',
  CA: 'Canada',
  AU: 'Australia',
  RU: 'Russia',
  IT: 'Italy',
  ES: 'Spain',
  NL: 'Netherlands',
  SE: 'Sweden',
  PL: 'Poland',
  TR: 'Turkey',
  MX: 'Mexico',
  ID: 'Indonesia',
  TH: 'Thailand',
  VN: 'Vietnam',
  PH: 'Philippines',
  SG: 'Singapore',
  MY: 'Malaysia',
  TW: 'Taiwan',
  HK: 'Hong Kong',
  IL: 'Israel',
  AE: 'UAE',
  SA: 'Saudi Arabia',
  ZA: 'South Africa',
  NG: 'Nigeria',
  EG: 'Egypt',
  AR: 'Argentina',
  CL: 'Chile',
  CO: 'Colombia',
  PE: 'Peru',
  UA: 'Ukraine',
  CZ: 'Czech Republic',
  RO: 'Romania',
  HU: 'Hungary',
  AT: 'Austria',
  CH: 'Switzerland',
  BE: 'Belgium',
  DK: 'Denmark',
  FI: 'Finland',
  NO: 'Norway',
  IE: 'Ireland',
  PT: 'Portugal',
  NZ: 'New Zealand',
  GR: 'Greece',
};

/** Common ISO 3166-1 alpha-3 → alpha-2 mapping */
const ALPHA3_TO_ALPHA2: Record<string, string> = {
  USA: 'US',
  GBR: 'GB',
  DEU: 'DE',
  FRA: 'FR',
  JPN: 'JP',
  KOR: 'KR',
  CHN: 'CN',
  IND: 'IN',
  BRA: 'BR',
  CAN: 'CA',
  AUS: 'AU',
  RUS: 'RU',
  ITA: 'IT',
  ESP: 'ES',
  NLD: 'NL',
  SWE: 'SE',
  POL: 'PL',
  TUR: 'TR',
  MEX: 'MX',
  IDN: 'ID',
  THA: 'TH',
  VNM: 'VN',
  PHL: 'PH',
  SGP: 'SG',
  MYS: 'MY',
  TWN: 'TW',
  HKG: 'HK',
  ISR: 'IL',
  ARE: 'AE',
  SAU: 'SA',
  ZAF: 'ZA',
  NGA: 'NG',
  EGY: 'EG',
  ARG: 'AR',
  CHL: 'CL',
  COL: 'CO',
  PER: 'PE',
  UKR: 'UA',
  CZE: 'CZ',
  ROU: 'RO',
  HUN: 'HU',
  AUT: 'AT',
  CHE: 'CH',
  BEL: 'BE',
  DNK: 'DK',
  FIN: 'FI',
  NOR: 'NO',
  IRL: 'IE',
  PRT: 'PT',
  NZL: 'NZ',
  GRC: 'GR',
};

export default GeoMapRenderer;
