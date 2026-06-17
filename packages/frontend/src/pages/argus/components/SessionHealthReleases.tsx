import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import { InfoOutlined as InfoIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import { formatCompactNumber } from '@/utils/numberFormat';
import { ArgusSessionHealth } from '@/services/argusService';
import { RELEASE_COLORS } from './sessionHealthHelpers';
import {
  SectionPaper,
  SectionAccent,
  StackedBarContainer,
  LegendItem,
  LegendDot,
  ReleaseRow,
  ReleaseChip,
  ProgressTrack,
  TableSectionHeader,
} from './SessionHealthReleases.styles';

interface SessionHealthReleasesProps {
  data: ArgusSessionHealth | null;
  projectId: string | number;
}

const SessionHealthReleases: React.FC<SessionHealthReleasesProps> = ({
  data,
  projectId,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const navigate = useNavigate();

  const adoptionData = useMemo(() => {
    if (!data?.by_release?.length) return [];
    const totalAll = data.by_release.reduce(
      (sum, r) => sum + Number(r.total),
      0
    );
    if (totalAll === 0) return [];
    return data.by_release.map((r) => ({
      release: r.release,
      sessions: Number(r.total),
      pct: (Number(r.total) / totalAll) * 100,
    }));
  }, [data]);

  return (
    <>
      {/* Release Adoption + Comparison */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
          mb: 2.5,
        }}
      >
        {/* Release Adoption */}
        {!data?.by_release?.length ? (
          <EmptyPlaceholder
            message={t('argus.sessions.noData')}
            minHeight={100}
          />
        ) : (
          <SectionPaper elevation={0} isDark={isDark}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}
            >
              <Typography
                variant="subtitle2"
                fontWeight={600}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <SectionAccent gradient="linear-gradient(180deg, #7c4dff, #448aff)" />
                {t('argus.sessions.adoptionChart')}
              </Typography>
              <Tooltip title={t('argus.sessions.adoptionChartDesc')} arrow>
                <InfoIcon
                  sx={{
                    fontSize: 14,
                    color: 'text.disabled',
                    cursor: 'help',
                  }}
                />
              </Tooltip>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {/* Stacked bar */}
              <StackedBarContainer isDark={isDark}>
                {adoptionData.map((item, idx) => (
                  <Tooltip
                    key={idx}
                    title={`${item.release}: ${formatCompactNumber(item.sessions)} ${t('argus.sessions.sessions')} (${item.pct.toFixed(1)}%)`}
                    arrow
                  >
                    <Box
                      sx={{
                        width: `${item.pct}%`,
                        minWidth: item.pct > 2 ? 16 : 4,
                        backgroundColor:
                          RELEASE_COLORS[idx % RELEASE_COLORS.length],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s',
                        cursor: 'pointer',
                        '&:hover': {
                          filter: 'brightness(1.2)',
                          transform: 'scaleY(1.1)',
                        },
                      }}
                      onClick={() =>
                        navigate(
                          `/argus/releases/${projectId}/${encodeURIComponent(item.release)}`
                        )
                      }
                    >
                      {item.pct > 8 && (
                        <Typography
                          sx={{
                            fontSize: '0.58rem',
                            fontWeight: 700,
                            color: '#fff',
                            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                          }}
                        >
                          {item.pct.toFixed(0)}%
                        </Typography>
                      )}
                    </Box>
                  </Tooltip>
                ))}
              </StackedBarContainer>
              {/* Legend */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {adoptionData.map((item, idx) => (
                  <LegendItem
                    key={idx}
                    isDark={isDark}
                    onClick={() =>
                      navigate(
                        `/argus/releases/${projectId}/${encodeURIComponent(item.release)}`
                      )
                    }
                  >
                    <LegendDot
                      dotColor={RELEASE_COLORS[idx % RELEASE_COLORS.length]}
                    />
                    <Typography
                      variant="caption"
                      sx={{ fontSize: '0.64rem', fontWeight: 500 }}
                      noWrap
                    >
                      {item.release}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.62rem',
                        color: 'text.disabled',
                        ml: 0.2,
                      }}
                    >
                      {item.pct.toFixed(1)}%
                    </Typography>
                  </LegendItem>
                ))}
              </Box>
            </Box>
          </SectionPaper>
        )}

        {/* Release Comparison */}
        {!data?.by_release?.length ? (
          <EmptyPlaceholder
            message={t('argus.sessions.noData')}
            minHeight={100}
          />
        ) : (
          <SectionPaper elevation={0} isDark={isDark}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}
            >
              <Typography
                variant="subtitle2"
                fontWeight={600}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <Box
                  sx={{
                    width: 3,
                    height: 16,
                    borderRadius: 1,
                    background: 'linear-gradient(180deg, #4caf50, #ff9800)',
                    mr: 0.5,
                  }}
                />
                {t('argus.sessions.releaseComparison')}
              </Typography>
              <Tooltip title={t('argus.sessions.releaseComparisonDesc')} arrow>
                <InfoIcon
                  sx={{
                    fontSize: 14,
                    color: 'text.disabled',
                    cursor: 'help',
                  }}
                />
              </Tooltip>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: `100px repeat(${Math.min(data.by_release.length, 5)}, 1fr)`,
                  gap: 0,
                  fontSize: '0.68rem',
                }}
              >
                {/* Header */}
                <Box sx={{ py: 0.5, px: 0.8 }} />
                {data.by_release.slice(0, 5).map((r, idx) => (
                  <Box key={idx} sx={{ py: 0.5, px: 0.5, textAlign: 'center' }}>
                    <Chip
                      label={r.release}
                      size="small"
                      onClick={() =>
                        navigate(
                          `/argus/releases/${projectId}/${encodeURIComponent(r.release)}`
                        )
                      }
                      sx={{
                        fontSize: '0.58rem',
                        height: 18,
                        fontWeight: 600,
                        cursor: 'pointer',
                        maxWidth: '100%',
                        backgroundColor: alpha(
                          RELEASE_COLORS[idx % RELEASE_COLORS.length],
                          0.15
                        ),
                        color: RELEASE_COLORS[idx % RELEASE_COLORS.length],
                        border: 'none',
                      }}
                    />
                  </Box>
                ))}
                {/* Data rows */}
                {[
                  {
                    label: t('argus.sessions.crashFree'),
                    key: 'crash_free_rate',
                    format: (v: number) => `${Number(v).toFixed(1)}%`,
                    colorFn: (v: number) =>
                      Number(v) >= 99
                        ? '#4caf50'
                        : Number(v) >= 95
                          ? '#ff9800'
                          : '#f44336',
                  },
                  {
                    label: t('argus.sessions.sessions'),
                    key: 'total',
                    format: (v: number) => formatCompactNumber(Number(v)),
                    colorFn: () => 'text.primary',
                  },
                  {
                    label: t('argus.sessions.users'),
                    key: 'users',
                    format: (v: number) => formatCompactNumber(Number(v)),
                    colorFn: () => 'text.primary',
                  },
                  {
                    label: t('argus.sessions.crashed'),
                    key: 'crashed',
                    format: (v: number) => formatCompactNumber(Number(v)),
                    colorFn: (v: number) =>
                      Number(v) > 0 ? '#f44336' : '#4caf50',
                  },
                ].map((row) => (
                  <React.Fragment key={row.key}>
                    <Box
                      sx={{
                        py: 0.8,
                        px: 0.8,
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          fontSize: '0.66rem',
                          color: 'text.secondary',
                          fontWeight: 500,
                        }}
                      >
                        {row.label}
                      </Typography>
                    </Box>
                    {data.by_release.slice(0, 5).map((r, idx) => {
                      const val = (r as any)[row.key];
                      const maxVal = Math.max(
                        ...data.by_release
                          .slice(0, 5)
                          .map((x) => Number((x as any)[row.key]))
                      );
                      const barPct =
                        row.key === 'crash_free_rate'
                          ? Number(val)
                          : maxVal > 0
                            ? (Number(val) / maxVal) * 100
                            : 0;
                      return (
                        <Box
                          key={idx}
                          sx={{
                            py: 0.8,
                            px: 0.5,
                            textAlign: 'center',
                            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                            position: 'relative',
                          }}
                        >
                          <Box
                            sx={{
                              position: 'absolute',
                              bottom: 0,
                              left: 2,
                              right: 2,
                              height: `${Math.min(barPct, 100) * 0.6}%`,
                              backgroundColor: alpha(
                                RELEASE_COLORS[idx % RELEASE_COLORS.length],
                                0.06
                              ),
                              borderRadius: '4px 4px 0 0',
                              transition: 'height 0.3s',
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              position: 'relative',
                              color: row.colorFn(val),
                            }}
                          >
                            {row.format(val)}
                          </Typography>
                        </Box>
                      );
                    })}
                  </React.Fragment>
                ))}
              </Box>
            </Box>
          </SectionPaper>
        )}
      </Box>

      {/* By Release Table */}
      {!data?.by_release?.length ? (
        <Box sx={{ mb: 2.5 }}>
          <EmptyPlaceholder
            message={t('argus.sessions.noData')}
            minHeight={150}
          />
        </Box>
      ) : (
        <Paper
          elevation={0}
          sx={{
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <TableSectionHeader isDark={isDark}>
            <Typography variant="subtitle2" fontWeight={600}>
              {t('argus.sessions.byRelease')}
            </Typography>
            <Tooltip title={t('argus.sessions.byReleaseDesc')} arrow>
              <InfoIcon
                sx={{ fontSize: 14, color: 'text.disabled', cursor: 'help' }}
              />
            </Tooltip>
          </TableSectionHeader>
          {data.by_release.map((r, idx) => {
            const rate = Number(r.crash_free_rate);
            const barColor =
              rate >= 99 ? '#4caf50' : rate >= 95 ? '#ff9800' : '#f44336';
            return (
              <ReleaseRow
                key={`${r.release}-${idx}`}
                isDark={isDark}
                isLast={idx >= data.by_release.length - 1}
                onClick={() =>
                  navigate(
                    `/argus/releases/${projectId}/${encodeURIComponent(r.release)}`
                  )
                }
              >
                <ReleaseChip label={r.release} size="small" />
                <Box sx={{ flex: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      mb: 0.3,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        color: isDark ? '#777' : '#999',
                        fontSize: '0.68rem',
                      }}
                    >
                      {formatCompactNumber(Number(r.total))}{' '}
                      {t('argus.sessions.sessions')} ·{' '}
                      {formatCompactNumber(Number(r.users))}{' '}
                      {t('argus.sessions.users')}
                    </Typography>
                    <Typography
                      variant="caption"
                      fontWeight={700}
                      sx={{ color: barColor, fontSize: '0.72rem' }}
                    >
                      {rate.toFixed(1)}%
                    </Typography>
                  </Box>
                  <ProgressTrack isDark={isDark}>
                    <Box
                      sx={{
                        minWidth: 0,
                        height: '100%',
                        borderRadius: 3,
                        width: `${rate}%`,
                        background: `linear-gradient(90deg, ${barColor}, ${alpha(barColor, 0.6)})`,
                        transition: 'width 0.5s',
                      }}
                    />
                  </ProgressTrack>
                </Box>
                <Chip
                  label={`${Number(r.crashed)} ${t('argus.sessions.crashes')}`}
                  size="small"
                  sx={{
                    height: 20,
                    fontSize: '0.62rem',
                    cursor: 'pointer',
                    backgroundColor:
                      Number(r.crashed) > 0
                        ? alpha('#f44336', 0.1)
                        : alpha('#4caf50', 0.1),
                    color: Number(r.crashed) > 0 ? '#f44336' : '#4caf50',
                    border: 'none',
                  }}
                />
              </ReleaseRow>
            );
          })}
        </Paper>
      )}
    </>
  );
};

export default React.memo(SessionHealthReleases);
