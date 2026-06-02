/**
 * FeatureFlagSection — G24: Feature Flag context at event time.
 *
 * Integrates with our existing Feature Flag system (featureFlagService).
 * Shows which flags were evaluated when the error occurred, their values,
 * types (release/experiment/killSwitch/etc), and links to the flag detail page.
 * Highlights suspect flags whose recent changes may correlate with the error.
 */
import React, { useState } from 'react';
import {
  Box, Typography, Paper, Chip, IconButton, Collapse,
  Table, TableHead, TableRow, TableCell, TableBody,
  Tooltip, alpha, useTheme, Link,
} from '@mui/material';
import {
  Flag as FlagIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Warning as SuspectIcon,
  OpenInNew as OpenInNewIcon,
  Science as ExperimentIcon,
  RocketLaunch as ReleaseIcon,
  Build as OperationalIcon,
  PowerSettingsNew as KillSwitchIcon,
  Shield as PermissionIcon,
  Tune as RemoteConfigIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
import type { FlagType } from '@/services/featureFlagService';

/**
 * Evaluation snapshot captured at event time.
 * This is stored in the Argus event's `contexts.feature_flags` field.
 */
export interface FlagEvaluationContext {
  flagName: string;
  displayName?: string;
  flagType: FlagType;
  valueType: 'string' | 'number' | 'boolean' | 'json';
  /** The value that was resolved at the time of the event */
  evaluatedValue: any;
  /** Whether the flag was enabled in the environment where the event occurred */
  isEnabled: boolean;
  /** Environment where the evaluation happened */
  environment: string;
  /** Was this flag recently changed (within 24h before the event)? */
  recentlyChanged?: boolean;
  /** ISO timestamp of the last change to this flag */
  lastChangedAt?: string;
  /** User who last changed this flag */
  lastChangedBy?: string;
  /** Suspect: flag change correlates with error spike */
  suspect?: boolean;
}

interface FeatureFlagSectionProps {
  flags: FlagEvaluationContext[];
  projectSlug?: string;
}

const FLAG_TYPE_CONFIG: Record<FlagType, { icon: React.ReactElement; color: string; label: string }> = {
  release: { icon: <ReleaseIcon sx={{ fontSize: 12 }} />, color: '#4caf50', label: 'Release' },
  experiment: { icon: <ExperimentIcon sx={{ fontSize: 12 }} />, color: '#9c27b0', label: 'Experiment' },
  operational: { icon: <OperationalIcon sx={{ fontSize: 12 }} />, color: '#2196f3', label: 'Operational' },
  killSwitch: { icon: <KillSwitchIcon sx={{ fontSize: 12 }} />, color: '#f44336', label: 'Kill Switch' },
  permission: { icon: <PermissionIcon sx={{ fontSize: 12 }} />, color: '#ff9800', label: 'Permission' },
  remoteConfig: { icon: <RemoteConfigIcon sx={{ fontSize: 12 }} />, color: '#607d8b', label: 'Config' },
};

function formatValue(value: any, valueType: string): string {
  if (value === null || value === undefined) return 'null';
  if (valueType === 'json') {
    try {
      return JSON.stringify(value).slice(0, 50);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

const FeatureFlagSection: React.FC<FeatureFlagSectionProps> = ({ flags, projectSlug }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const [expanded, setExpanded] = useState(true);

  if (!flags || flags.length === 0) return null;

  const suspectFlags = flags.filter(f => f.suspect);
  const recentlyChangedFlags = flags.filter(f => f.recentlyChanged);

  return (
    <Paper
      elevation={0}
      sx={{
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: 2, overflow: 'hidden', mb: 1.5,
      }}
    >
      {/* Header */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 2, py: 1, cursor: 'pointer',
          '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' },
        }}
      >
        <FlagIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, flex: 1 }}>
          {t('argus.featureFlags.title')}
        </Typography>

        {/* Summary chips */}
        <Chip
          label={flags.length}
          size="small"
          sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }}
        />
        {recentlyChangedFlags.length > 0 && (
          <Chip
            label={t('argus.featureFlags.recentlyChanged', { count: recentlyChangedFlags.length })}
            size="small"
            sx={{
              height: 18, fontSize: '0.55rem', fontWeight: 700,
              backgroundColor: alpha('#2196f3', 0.1),
              color: '#2196f3',
            }}
          />
        )}
        {suspectFlags.length > 0 && (
          <Chip
            icon={<SuspectIcon sx={{ fontSize: '12px !important' }} />}
            label={t('argus.featureFlags.suspect', { count: suspectFlags.length })}
            size="small"
            sx={{
              height: 20, fontSize: '0.6rem', fontWeight: 700,
              backgroundColor: alpha('#ff9800', 0.1),
              color: '#ff9800',
              '& .MuiChip-icon': { color: '#ff9800' },
            }}
          />
        )}
        <IconButton size="small" sx={{ width: 20, height: 20 }}>
          {expanded ? <CollapseIcon sx={{ fontSize: 14 }} /> : <ExpandIcon sx={{ fontSize: 14 }} />}
        </IconButton>
      </Box>

      {/* Table */}
      <Collapse in={expanded}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', py: 0.5 }}>
                {t('argus.featureFlags.flag')}
              </TableCell>
              <TableCell sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', py: 0.5 }}>
                {t('argus.featureFlags.type')}
              </TableCell>
              <TableCell sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', py: 0.5 }}>
                {t('argus.featureFlags.value')}
              </TableCell>
              <TableCell sx={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', py: 0.5 }}>
                {t('argus.featureFlags.state')}
              </TableCell>
              <TableCell width={40} sx={{ py: 0.5 }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {flags.map((flag) => {
              const typeCfg = FLAG_TYPE_CONFIG[flag.flagType] || FLAG_TYPE_CONFIG.release;

              return (
                <TableRow
                  key={flag.flagName}
                  sx={{
                    '&:last-child td': { borderBottom: 0 },
                    backgroundColor: flag.suspect
                      ? alpha('#ff9800', 0.04)
                      : flag.recentlyChanged
                        ? alpha('#2196f3', 0.02)
                        : 'transparent',
                  }}
                >
                  {/* Flag Name */}
                  <TableCell sx={{ py: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {flag.suspect && (
                        <Tooltip title={t('argus.featureFlags.suspectTooltip')}>
                          <SuspectIcon sx={{ fontSize: 12, color: '#ff9800' }} />
                        </Tooltip>
                      )}
                      <Link
                        component={RouterLink}
                        to={`/feature-flags/${flag.flagName}`}
                        underline="hover"
                        sx={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: flag.suspect ? 700 : 400 }}
                      >
                        {flag.displayName || flag.flagName}
                      </Link>
                    </Box>
                    {flag.recentlyChanged && flag.lastChangedBy && (
                      <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled', mt: 0.15 }}>
                        {t('argus.featureFlags.changedBy', { user: flag.lastChangedBy })}
                      </Typography>
                    )}
                  </TableCell>

                  {/* Flag Type */}
                  <TableCell sx={{ py: 0.75 }}>
                    <Chip
                      icon={typeCfg.icon}
                      label={typeCfg.label}
                      size="small"
                      sx={{
                        height: 18, fontSize: '0.58rem', fontWeight: 600,
                        backgroundColor: alpha(typeCfg.color, 0.08),
                        color: typeCfg.color,
                        '& .MuiChip-icon': { color: typeCfg.color },
                      }}
                    />
                  </TableCell>

                  {/* Evaluated Value */}
                  <TableCell sx={{ py: 0.75 }}>
                    <Tooltip title={`${flag.valueType}: ${JSON.stringify(flag.evaluatedValue)}`}>
                      <Chip
                        label={formatValue(flag.evaluatedValue, flag.valueType)}
                        size="small"
                        sx={{
                          height: 18, fontSize: '0.62rem', fontFamily: 'monospace', fontWeight: 600,
                          maxWidth: 120,
                          backgroundColor: alpha(theme.palette.primary.main, 0.06),
                          color: theme.palette.primary.main,
                        }}
                      />
                    </Tooltip>
                  </TableCell>

                  {/* Enabled State */}
                  <TableCell sx={{ py: 0.75 }}>
                    <Chip
                      label={flag.isEnabled ? t('argus.featureFlags.enabled') : t('argus.featureFlags.disabled')}
                      size="small"
                      sx={{
                        height: 16, fontSize: '0.55rem', fontWeight: 700,
                        backgroundColor: flag.isEnabled ? alpha('#4caf50', 0.1) : alpha('#9e9e9e', 0.1),
                        color: flag.isEnabled ? '#4caf50' : 'text.secondary',
                      }}
                    />
                  </TableCell>

                  {/* Link to flag detail */}
                  <TableCell sx={{ py: 0.75 }}>
                    <Tooltip title={t('argus.featureFlags.viewFlag')}>
                      <IconButton
                        component={RouterLink}
                        to={`/feature-flags/${flag.flagName}`}
                        size="small"
                        sx={{ width: 20, height: 20 }}
                      >
                        <OpenInNewIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Collapse>
    </Paper>
  );
};

export default FeatureFlagSection;
