import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import { renderLexiconIcon } from '@/utils/lexiconIcons';
import { useLocalizedLexicon } from '@/pages/argus/hooks/useLocalizedLexicon';

export interface EventLabelProps {
  /** Raw event key (e.g. "chat_message_sent") */
  eventName: string;
  /** DB display_name (nullable) */
  displayName?: string | null;
  /** DB icon name (nullable) */
  icon?: string | null;
  /** DB icon_color (nullable) */
  iconColor?: string | null;
  /** DB description (nullable) */
  description?: string | null;
  /** Whether this is a system/reserved event */
  isReserved?: boolean;
  /** Size variant */
  size?: 'compact' | 'default' | 'full';
  /** Show icon (default: true) */
  showIcon?: boolean;
  /** Show description (default: auto — only when size='full') */
  showDescription?: boolean;
  /** Show raw event key below display_name (default: auto — when size='default'|'full' and displayName differs) */
  showEventKey?: boolean;
  /** Max width override */
  maxWidth?: number | string;
}

/**
 * Unified event label component.
 *
 * Renders an event with icon + display_name + optional eventKey + optional description,
 * with consistent alignment across all analytics pages.
 *
 * Variants:
 * - `compact`: icon(18px) + display_name only (single line)
 * - `default`: icon(24px box) + display_name + eventKey secondary
 * - `full`:    icon(28px box) + display_name + eventKey + description
 */
const EventLabel: React.FC<EventLabelProps> = ({
  eventName,
  displayName,
  icon,
  iconColor,
  description,
  isReserved = false,
  size = 'default',
  showIcon = true,
  showDescription,
  showEventKey,
  maxWidth,
}) => {
  const { localizeEventName, localizeEventDescription } = useLocalizedLexicon();

  const resolvedName = localizeEventName(
    eventName,
    displayName ?? null,
    isReserved
  );
  const resolvedDescription = localizeEventDescription(
    eventName,
    description ?? null,
    isReserved
  );
  const hasDistinctName = resolvedName !== eventName;

  // Determine what to show
  const shouldShowKey = showEventKey ?? (size !== 'compact' && hasDistinctName);
  const shouldShowDesc =
    showDescription ?? (size === 'full' && !!resolvedDescription);

  if (size === 'compact') {
    const iconSize = 18;
    return (
      <Tooltip
        title={eventName}
        placement="top"
        arrow
        disableInteractive
        PopperProps={{ popperOptions: { strategy: 'fixed' } }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            minWidth: 0,
            maxWidth: maxWidth || '100%',
          }}
        >
          {showIcon && (
            <Box sx={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {renderLexiconIcon(icon, iconSize, iconColor || undefined)}
            </Box>
          )}
          <Typography
            variant="body2"
            sx={{
              fontSize: '0.8rem',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {resolvedName}
          </Typography>
        </Box>
      </Tooltip>
    );
  }

  const iconBoxSize = size === 'full' ? 28 : 24;
  const iconRenderSize = size === 'full' ? 18 : 16;

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'flex-start',
        gap: 1,
        minWidth: 0,
        maxWidth: maxWidth || '100%',
      }}
    >
      {showIcon && (
        <Box
          sx={{
            width: iconBoxSize,
            height: iconBoxSize,
            borderRadius: '6px',
            bgcolor: iconColor ? `${iconColor}1a` : 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            mt: '1px',
          }}
        >
          {renderLexiconIcon(icon, iconRenderSize, iconColor || undefined)}
        </Box>
      )}
      <Box sx={{ minWidth: 0 }}>
        {(() => {
          const nameEl = (
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                fontSize: size === 'full' ? '0.85rem' : '0.8rem',
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {resolvedName}
            </Typography>
          );
          // Show description in tooltip only if it exists and isn't already visible
          const tooltipDesc =
            !shouldShowDesc && resolvedDescription ? resolvedDescription : '';
          return tooltipDesc ? (
            <Tooltip title={tooltipDesc} placement="top" arrow>
              {nameEl}
            </Tooltip>
          ) : (
            nameEl
          );
        })()}
        {shouldShowKey && (
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              fontSize: '0.7rem',
              fontFamily: '"JetBrains Mono", "Fira Code", monospace',
              opacity: 0.5,
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {eventName}
          </Typography>
        )}
        {shouldShowDesc && resolvedDescription && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              display: 'block',
              fontSize: '0.72rem',
              lineHeight: 1.3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              mt: 0.25,
            }}
          >
            {resolvedDescription}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default EventLabel;
