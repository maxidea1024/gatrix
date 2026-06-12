/**
 * AnalogClock Component
 *
 * SVG-based analog clock that displays hour, minute, and second hands.
 * Automatically adapts to MUI dark/light theme.
 */

import React from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';

interface AnalogClockProps {
  /** Current time to display */
  time: Date;
  /** Label shown below the clock (e.g. "Local", "Server", "UTC") */
  label: string;
  /** Clock diameter in pixels (default: 120) */
  size?: number;
}

const AnalogClock: React.FC<AnalogClockProps> = ({
  time,
  label,
  size = 120,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const hours = time.getHours() % 12;
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  // Angles in degrees
  const hourAngle = hours * 30 + minutes * 0.5; // 360/12 = 30 per hour + minute offset
  const minuteAngle = minutes * 6 + seconds * 0.1; // 360/60 = 6 per minute
  const secondAngle = seconds * 6; // 360/60 = 6 per second

  const center = size / 2;
  const radius = size / 2 - 4;

  // Colors
  const faceColor = isDark
    ? alpha(theme.palette.background.paper, 0.8)
    : alpha(theme.palette.grey[50], 1);
  const borderColor = isDark
    ? alpha(theme.palette.divider, 0.5)
    : alpha(theme.palette.grey[300], 1);
  const tickColor = isDark
    ? theme.palette.text.secondary
    : theme.palette.text.primary;
  const hourHandColor = theme.palette.text.primary;
  const minuteHandColor = theme.palette.text.primary;
  const secondHandColor = theme.palette.primary.main;
  const numberColor = isDark
    ? theme.palette.text.secondary
    : theme.palette.text.secondary;

  // Digital date + time strings
  const digitalDate = `${time.getFullYear()}-${(time.getMonth() + 1).toString().padStart(2, '0')}-${time.getDate().toString().padStart(2, '0')}`;
  const digitalTime = [
    time.getHours().toString().padStart(2, '0'),
    time.getMinutes().toString().padStart(2, '0'),
    time.getSeconds().toString().padStart(2, '0'),
  ].join(':');

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.75,
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ display: 'block' }}
      >
        {/* Clock face */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill={faceColor}
          stroke={borderColor}
          strokeWidth={1.5}
        />

        {/* Hour numbers & tick marks */}
        {Array.from({ length: 12 }, (_, i) => {
          const angle = ((i * 30 - 90) * Math.PI) / 180;
          const isQuarter = i % 3 === 0;

          // Tick marks
          const tickOuterR = radius - 2;
          const tickInnerR = radius - (isQuarter ? 8 : 5);
          const tx1 = center + tickOuterR * Math.cos(angle);
          const ty1 = center + tickOuterR * Math.sin(angle);
          const tx2 = center + tickInnerR * Math.cos(angle);
          const ty2 = center + tickInnerR * Math.sin(angle);

          // Number positions
          const numR = radius - 16;
          const nx = center + numR * Math.cos(angle);
          const ny = center + numR * Math.sin(angle);
          const displayNum = i === 0 ? 12 : i;

          return (
            <g key={i}>
              <line
                x1={tx1}
                y1={ty1}
                x2={tx2}
                y2={ty2}
                stroke={tickColor}
                strokeWidth={isQuarter ? 1.5 : 0.75}
                strokeLinecap="round"
                opacity={isQuarter ? 0.7 : 0.3}
              />
              {isQuarter && (
                <text
                  x={nx}
                  y={ny}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={size * 0.09}
                  fontWeight={600}
                  fill={numberColor}
                  fontFamily={theme.typography.fontFamily}
                >
                  {displayNum}
                </text>
              )}
            </g>
          );
        })}

        {/* Hour hand */}
        <line
          x1={center}
          y1={center}
          x2={
            center +
            (radius * 0.5) *
              Math.cos(((hourAngle - 90) * Math.PI) / 180)
          }
          y2={
            center +
            (radius * 0.5) *
              Math.sin(((hourAngle - 90) * Math.PI) / 180)
          }
          stroke={hourHandColor}
          strokeWidth={2.5}
          strokeLinecap="round"
        />

        {/* Minute hand */}
        <line
          x1={center}
          y1={center}
          x2={
            center +
            (radius * 0.7) *
              Math.cos(((minuteAngle - 90) * Math.PI) / 180)
          }
          y2={
            center +
            (radius * 0.7) *
              Math.sin(((minuteAngle - 90) * Math.PI) / 180)
          }
          stroke={minuteHandColor}
          strokeWidth={1.5}
          strokeLinecap="round"
        />

        {/* Second hand */}
        <line
          x1={center}
          y1={center}
          x2={
            center +
            (radius * 0.75) *
              Math.cos(((secondAngle - 90) * Math.PI) / 180)
          }
          y2={
            center +
            (radius * 0.75) *
              Math.sin(((secondAngle - 90) * Math.PI) / 180)
          }
          stroke={secondHandColor}
          strokeWidth={0.75}
          strokeLinecap="round"
        />

        {/* Center dot */}
        <circle cx={center} cy={center} r={2.5} fill={secondHandColor} />
      </svg>

      {/* Label */}
      <Typography
        variant="caption"
        fontWeight={600}
        color="text.secondary"
        sx={{ lineHeight: 1, letterSpacing: 0.5 }}
      >
        {label}
      </Typography>

      {/* Digital date */}
      <Typography
        variant="caption"
        fontFamily="monospace"
        color="text.secondary"
        sx={{ lineHeight: 1, fontSize: '0.7rem' }}
      >
        {digitalDate}
      </Typography>

      {/* Digital time */}
      <Typography
        variant="body2"
        fontFamily="monospace"
        fontWeight={500}
        color="text.primary"
        sx={{ lineHeight: 1, fontSize: '0.85rem' }}
      >
        {digitalTime}
      </Typography>
    </Box>
  );
};

export default AnalogClock;
