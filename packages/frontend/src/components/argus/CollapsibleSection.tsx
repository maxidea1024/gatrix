/**
 * CollapsibleSection — Sentry-style collapsible section wrapper.
 *
 * Renders a clickable header bar that toggles collapse/expand of its children.
 * Collapse state is persisted via useLocalStorage so it survives page reloads.
 *
 * Usage:
 *   <CollapsibleSection title="Stack Trace" icon={<BugIcon />} storageKey="stacktrace">
 *     <StacktraceView ... />
 *   </CollapsibleSection>
 */
import React from 'react';
import {
  Box,
  Typography,
  Collapse,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import { ChevronRight as ChevronIcon } from '@mui/icons-material';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export interface CollapsibleSectionProps {
  /** Section title displayed in the header */
  title: string;
  /** Optional icon rendered before the title */
  icon?: React.ReactNode;
  /** Optional badge (e.g. count chip) rendered after the title */
  badge?: React.ReactNode;
  /** Optional actions rendered on the right side of the header */
  actions?: React.ReactNode;
  /** If true, actions are hidden when the section is collapsed (default: false) */
  hideActionsOnCollapse?: boolean;
  /** localStorage key suffix — full key: `argus_section_{storageKey}` */
  storageKey: string;
  /** Whether the section is expanded by default (default: true = expanded) */
  defaultExpanded?: boolean;
  /** Section content */
  children: React.ReactNode;
  /** If true, section is not rendered at all (useful for conditional sections) */
  hidden?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  icon,
  badge,
  actions,
  hideActionsOnCollapse = false,
  storageKey,
  defaultExpanded = true,
  children,
  hidden = false,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [expanded, setExpanded] = useLocalStorage<boolean>(
    `argus_section_${storageKey}`,
    defaultExpanded
  );

  if (hidden) return null;

  return (
    <Box
      sx={{
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        '&:first-of-type': { borderTop: 'none' },
      }}
    >
      {/* Clickable Header */}
      <Box
        onClick={() => setExpanded((prev) => !prev)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          py: 1.5,
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'background-color 0.12s',
          borderRadius: 1,
          mx: -0.5,
          px: 0.5,
          '&:hover': {
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.03)'
              : 'rgba(0,0,0,0.02)',
          },
        }}
      >
        {/* Chevron indicator */}
        <ChevronIcon
          sx={{
            fontSize: 18,
            color: 'text.disabled',
            transition: 'transform 0.2s ease',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
            flexShrink: 0,
          }}
        />

        {/* Icon */}
        {icon && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              color: 'text.secondary',
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        )}

        {/* Title */}
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 700,
            fontSize: '0.82rem',
            lineHeight: 1.3,
            color: 'text.primary',
          }}
        >
          {title}
        </Typography>

        {/* Badge */}
        {badge}

        {/* Spacer */}
        <Box sx={{ flex: 1 }} />

        {/* Actions — stop propagation so clicks don't toggle collapse */}
        {actions && (!hideActionsOnCollapse || expanded) && (
          <Box
            onClick={(e) => e.stopPropagation()}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
          >
            {actions}
          </Box>
        )}
      </Box>

      {/* Collapsible Content */}
      <Collapse in={expanded} timeout={200} unmountOnExit>
        <Box sx={{ pb: 2.5, pt: 0.5, pl: 3.5 }}>{children}</Box>
      </Collapse>
    </Box>
  );
};

export default React.memo(CollapsibleSection);
