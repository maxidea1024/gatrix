import React from 'react';
import { Box, Typography, IconButton, useTheme } from '@mui/material';
import {
  FilterList as FilterIcon,
  Block as ExcludeIcon,
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import SafeTooltip from '@/components/common/SafeTooltip';
import { CopyButton } from '@/components/common/CopyButton';
import { useTranslation } from 'react-i18next';
import {
  getFieldLink,
  getFieldNavTooltip,
} from '@/components/argus/FieldDefinitions';
import { useOrgProject } from '@/contexts/OrgProjectContext';

export const AttrRow: React.FC<{
  label: string;
  value: string;
  isDark: boolean;
  color?: string;
  bold?: boolean;
  /** When true, suppress hyperlink rendering even if a navigation mapping exists. */
  disableLink?: boolean;
  onFilter?: (key: string, value: string, exclude: boolean) => void;
}> = ({ label, value, isDark, color, bold, disableLink, onFilter }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { currentProject } = useOrgProject();
  const projectId = String(currentProject?.id || '1');
  const fieldLink =
    !disableLink && value ? getFieldLink(label, value, projectId) : null;
  const tooltipKey = fieldLink ? getFieldNavTooltip(label) : null;
  const isMonoField =
    label === 'trace_id' || label === 'span_id' || label === 'log_id';

  const linkContent = fieldLink ? (
    <Typography
      component={Link}
      to={fieldLink}
      sx={{
        fontSize: '0.72rem',
        wordBreak: 'break-all',
        pt: 0.15,
        color: color || theme.palette.info.main,
        fontWeight: bold ? 700 : 400,
        fontFamily: isMonoField ? 'monospace' : undefined,
        textDecoration: 'none',
        '&:hover': { textDecoration: 'underline' },
      }}
    >
      {value}
    </Typography>
  ) : null;

  return (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        py: 0.6,
        px: 2,
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
        alignItems: 'flex-start',
        '&:hover .attr-actions': { opacity: 1 },
        '&:hover': {
          backgroundColor: isDark
            ? 'rgba(255,255,255,0.015)'
            : 'rgba(0,0,0,0.01)',
        },
      }}
    >
      <Typography
        sx={{
          fontSize: '0.7rem',
          color: 'text.disabled',
          minWidth: 120,
          flexShrink: 0,
          fontWeight: 500,
          pt: 0.15,
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          minWidth: 0,
        }}
      >
        {linkContent ? (
          tooltipKey ? (
            <SafeTooltip title={t(tooltipKey)}>{linkContent}</SafeTooltip>
          ) : (
            linkContent
          )
        ) : (
          <Typography
            sx={{
              fontSize: '0.72rem',
              wordBreak: 'break-all',
              pt: 0.15,
              color: color || 'text.primary',
              fontWeight: bold ? 700 : 400,
              fontFamily: isMonoField ? 'monospace' : undefined,
            }}
          >
            {value || '—'}
          </Typography>
        )}
        <Box
          className="attr-actions"
          sx={{
            opacity: 0,
            transition: 'opacity 0.15s',
            display: 'flex',
            gap: 0.3,
            flexShrink: 0,
            ml: 1,
          }}
        >
          <CopyButton text={value} size={12} sx={{ p: 0.2 }} />
          {onFilter && value && (
            <>
              <SafeTooltip
                title={t(
                  'argus.logs.panel.includeInFilter',
                  'Include in filter'
                )}
              >
                <IconButton
                  size="small"
                  onClick={() => onFilter(label, value, false)}
                  sx={{ p: 0.2, color: theme.palette.primary.main }}
                >
                  <FilterIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </SafeTooltip>
              <SafeTooltip
                title={t(
                  'argus.logs.panel.excludeFromFilter',
                  'Exclude from filter'
                )}
              >
                <IconButton
                  size="small"
                  onClick={() => onFilter(label, value, true)}
                  sx={{ p: 0.2, color: theme.palette.error.main }}
                >
                  <ExcludeIcon sx={{ fontSize: 12 }} />
                </IconButton>
              </SafeTooltip>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
};
