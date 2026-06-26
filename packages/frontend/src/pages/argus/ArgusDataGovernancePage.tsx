import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  useTheme,
  alpha,
  Paper,
  Chip,
  LinearProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Tooltip,
} from '@mui/material';
import {
  VerifiedUser as QualityIcon,
  Warning as DupIcon,
  Storage as EventIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/common/PageHeader';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import PageContentLoader from '@/components/common/PageContentLoader';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import {
  getDataGovernance,
  type DataGovernanceData,
} from '@/services/argus/argusAnalytics';
import { ARGUS_SEMANTIC } from './argusThemeTokens';

// ─── Sparkline ──────────────────────────────────────────────────────────────

const Sparkline: React.FC<{
  data: { day: string; count: number }[];
  color: string;
}> = ({ data, color }) => {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: '1px',
        height: 24,
        width: 60,
      }}
    >
      {data.map((d, i) => (
        <Tooltip
          key={i}
          title={`${new Date(d.day).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}: ${d.count}`}
        >
          <Box
            sx={{
              flex: 1,
              height: `${Math.max((d.count / max) * 100, 5)}%`,
              bgcolor: alpha(color, 0.6),
              borderRadius: '1px 1px 0 0',
              minWidth: 3,
              '&:hover': { bgcolor: color },
            }}
          />
        </Tooltip>
      ))}
    </Box>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const ArgusDataGovernancePage: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();
  const { currentProject } = useOrgProject();
  const projectId = String(currentProject?.id || '1');

  const [data, setData] = useState<DataGovernanceData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getDataGovernance(projectId));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const scoreColor =
    (data?.quality_score || 0) >= 80
      ? ARGUS_SEMANTIC.positive
      : (data?.quality_score || 0) >= 50
        ? ARGUS_SEMANTIC.warning
        : ARGUS_SEMANTIC.negative;

  return (
    <Box>
      <PageHeader
        title={
          <ArgusBreadcrumbs
            paths={[
              {
                label: t('argus.analytics.title', 'Analytics'),
                to: '/argus/analytics',
              },
              { label: t('argus.dataGovernance') },
            ]}
            size="title"
          />
        }
        subtitle={t('argus.dataGovernance.subtitle')}
      />

      <PageContentLoader loading={loading}>
        {data ? (
          <>
            {/* KPI Row */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 2,
                mb: 3,
              }}
            >
              <Paper
                variant="outlined"
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  textAlign: 'center',
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                  borderColor: alpha(scoreColor, 0.3),
                }}
              >
                <QualityIcon
                  sx={{ fontSize: 32, color: scoreColor, mb: 0.5 }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  {t('argus.dataGovernance.qualityScore')}
                </Typography>
                <Typography
                  variant="h3"
                  fontWeight={800}
                  sx={{ color: scoreColor }}
                >
                  {data.quality_score}%
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {data.active_events} / {data.total_events}{' '}
                  {t('argus.dataGovernance.activeOf')}
                </Typography>
              </Paper>

              <Paper
                variant="outlined"
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  textAlign: 'center',
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                }}
              >
                <EventIcon
                  sx={{
                    fontSize: 32,
                    color: theme.palette.primary.main,
                    mb: 0.5,
                  }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  {t('argus.dataGovernance.totalEvents')}
                </Typography>
                <Typography variant="h3" fontWeight={800}>
                  {data.total_events}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('argus.dataGovernance.distinctEvents')}
                </Typography>
              </Paper>

              <Paper
                variant="outlined"
                sx={{
                  p: 2.5,
                  borderRadius: 3,
                  textAlign: 'center',
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                }}
              >
                <DupIcon
                  sx={{
                    fontSize: 32,
                    color:
                      data.duplicates.length > 0
                        ? ARGUS_SEMANTIC.warning
                        : ARGUS_SEMANTIC.positive,
                    mb: 0.5,
                  }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  display="block"
                >
                  {t('argus.dataGovernance.duplicates')}
                </Typography>
                <Typography
                  variant="h3"
                  fontWeight={800}
                  sx={{
                    color:
                      data.duplicates.length > 0
                        ? ARGUS_SEMANTIC.warning
                        : ARGUS_SEMANTIC.positive,
                  }}
                >
                  {data.duplicates.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('argus.dataGovernance.similarPairs')}
                </Typography>
              </Paper>
            </Box>

            {/* Duplicates Warning */}
            {data.duplicates.length > 0 && (
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 2,
                  mb: 3,
                  borderColor: alpha(ARGUS_SEMANTIC.warning, 0.3),
                  bgcolor: alpha(ARGUS_SEMANTIC.warning, 0.04),
                }}
              >
                <Typography
                  variant="subtitle2"
                  fontWeight={700}
                  sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <DupIcon fontSize="small" color="warning" />{' '}
                  {t('argus.dataGovernance.potentialDuplicates')}
                </Typography>
                {data.duplicates.map((d, i) => (
                  <Box
                    key={i}
                    sx={{
                      display: 'flex',
                      gap: 1,
                      mb: 0.5,
                      alignItems: 'center',
                    }}
                  >
                    {d.group.map((name) => (
                      <Chip
                        key={name}
                        label={name}
                        size="small"
                        variant="outlined"
                        sx={{ fontSize: 11 }}
                      />
                    ))}
                    <Typography variant="caption" color="text.secondary">
                      — {d.suggestion}
                    </Typography>
                  </Box>
                ))}
              </Paper>
            )}

            {/* Event Catalog */}
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 3,
                mb: 3,
                bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
              }}
            >
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
                {t('argus.dataGovernance.eventCatalog')}
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>
                        {t('argus.dataGovernance.eventName')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">
                        {t('argus.dataGovernance.volume')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">
                        {t('argus.dataGovernance.uniqueUsers')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        {t('argus.dataGovernance.trend7d')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">
                        {t('argus.dataGovernance.activeDays')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        {t('argus.dataGovernance.lastSeen')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.events.map((evt) => (
                      <TableRow key={evt.name} hover>
                        <TableCell>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            fontFamily="monospace"
                            fontSize={12}
                          >
                            {evt.name}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          {evt.total_count.toLocaleString()}
                        </TableCell>
                        <TableCell align="right">
                          {evt.unique_users.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {data.volume_trends[evt.name] ? (
                            <Sparkline
                              data={data.volume_trends[evt.name]}
                              color={theme.palette.primary.main}
                            />
                          ) : (
                            <Typography variant="caption" color="text.disabled">
                              —
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">{evt.active_days}</TableCell>
                        <TableCell>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(evt.last_seen).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {/* Property Coverage */}
            {Object.keys(data.property_coverage).length > 0 && (
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  borderRadius: 3,
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
                }}
              >
                <Typography
                  variant="subtitle2"
                  fontWeight={700}
                  sx={{ mb: 1.5 }}
                >
                  {t('argus.dataGovernance.propertyCoverage')}
                </Typography>
                {Object.entries(data.property_coverage).map(
                  ([eventName, props]) => (
                    <Box key={eventName} sx={{ mb: 2 }}>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        fontFamily="monospace"
                        fontSize={12}
                        sx={{ mb: 0.5 }}
                      >
                        {eventName}
                      </Typography>
                      {props.map((p) => (
                        <Box
                          key={p.property}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mb: 0.3,
                          }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              width: 140,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {p.property}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={p.coverage}
                            sx={{
                              flex: 1,
                              height: 8,
                              borderRadius: 1,
                              bgcolor: isDark
                                ? 'rgba(255,255,255,0.04)'
                                : 'rgba(0,0,0,0.04)',
                              '& .MuiLinearProgress-bar': {
                                bgcolor:
                                  p.coverage >= 80
                                    ? ARGUS_SEMANTIC.positive
                                    : p.coverage >= 50
                                      ? ARGUS_SEMANTIC.warning
                                      : ARGUS_SEMANTIC.negative,
                                borderRadius: 1,
                              },
                            }}
                          />
                          <Typography
                            variant="caption"
                            fontWeight={600}
                            sx={{ minWidth: 40, textAlign: 'right' }}
                          >
                            {p.coverage}%
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  )
                )}
              </Paper>
            )}
          </>
        ) : (
          <EmptyPagePlaceholder
            icon={<QualityIcon sx={{ fontSize: 48 }} />}
            message={t('argus.dataGovernance.noData')}
          />
        )}
      </PageContentLoader>
    </Box>
  );
};

export default ArgusDataGovernancePage;
