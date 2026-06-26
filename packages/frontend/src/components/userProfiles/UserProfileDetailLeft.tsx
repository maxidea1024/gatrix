import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Tooltip,
  alpha,
  useTheme,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  Public as GlobeIcon,
  Devices as DevicesIcon,
  Search as SearchIcon,
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { ArgusUserProfile, ArgusUserEvent, ArgusUserProperty } from '@/services/argus/argusTypes';
import CohortChip, { type CohortMembership } from '@/components/argus/CohortChip';
import { formatRelativeTime } from '@/utils/dateFormat';

const CopyButton: React.FC<{ value: string }> = ({ value }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 800);
  };
  if (!value) return null;
  return (
    <IconButton
      size="small"
      onClick={handleCopy}
      sx={{ p: 0.25, flexShrink: 0, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
    >
      {copied ? (
        <CheckIcon sx={{ fontSize: 12, color: 'success.main' }} />
      ) : (
        <CopyIcon sx={{ fontSize: 12 }} />
      )}
    </IconButton>
  );
};

interface UserProfileDetailLeftProps {
  profile: ArgusUserProfile;
  userCohorts: CohortMembership[];
  netRevenue: number;
  events: ArgusUserEvent[];
  lifecycleStage: { label: string; bg: string; fg: string } | null;
  churnRisk: { kind: 'purchase' | 'refund'; msg: string } | null;
  properties: ArgusUserProperty[];
  propertiesLoading?: boolean;
}

export const UserProfileDetailLeft: React.FC<UserProfileDetailLeftProps> = ({
  profile,
  userCohorts,
  netRevenue,
  events,
  lifecycleStage,
  churnRisk,
  properties = [],
  propertiesLoading = false,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const [searchQuery, setSearchQuery] = useState('');
  const filteredProperties = useMemo(() => {
    if (!searchQuery.trim()) return properties;
    const query = searchQuery.toLowerCase().trim();
    return properties.filter((p) => p.key.toLowerCase().includes(query));
  }, [properties, searchQuery]);

  // Compute Sparkline Daily Activity trend (last 30 days)
  const dailyActivity = useMemo(() => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      return { dateStr: d.toLocaleDateString(), date: d, count: 0 };
    }).reverse();

    const eventList = events || [];
    eventList.forEach((evt) => {
      const evtDate = new Date(evt.timestamp);
      evtDate.setHours(0, 0, 0, 0);
      const dateStr = evtDate.toLocaleDateString();
      const found = days.find((d) => d.dateStr === dateStr);
      if (found) {
        found.count += 1;
      }
    });

    return days;
  }, [events]);

  const maxDailyCount = useMemo(() => {
    return Math.max(...dailyActivity.map((d) => d.count), 1);
  }, [dailyActivity]);

  // Compute Heatmap
  const heatmap = useMemo(() => {
    const map: Record<string, { dow: number; hour: number; count: number }> = {};
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        map[`${d}-${h}`] = { dow: d, hour: h, count: 0 };
      }
    }
    const eventList = events || [];
    eventList.forEach((e) => {
      const dt = new Date(e.timestamp);
      const k = `${dt.getDay()}-${dt.getHours()}`;
      if (map[k]) map[k].count++;
    });
    return Object.values(map);
  }, [events]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        p: 2,
        gap: 2,
        height: '100%',
        overflowY: 'auto',
      }}
    >
      {/* Profile Header Card */}
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 1.5, borderBottom: `1px solid ${theme.palette.divider}`, mb: 1 }}>
        {profile.avatar_url ? (
          <Box
            component="img"
            src={profile.avatar_url}
            alt={profile.user_id}
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              objectFit: 'cover',
              mb: 1.5,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          />
        ) : (
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              color: '#fff',
              fontSize: 24,
              fontWeight: 700,
              mb: 1.5,
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}
          >
            {profile.user_id?.[0]?.toUpperCase() || 'U'}
          </Box>
        )}
        <Typography variant="subtitle1" fontWeight={700} sx={{ wordBreak: 'break-all', px: 1, fontSize: '0.95rem' }}>
          {profile.user_id}
        </Typography>
        {profile.email && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, wordBreak: 'break-all', px: 1 }}>
            {profile.email}
          </Typography>
        )}
      </Box>

      {/* Identity Summary Card + Lifecycle Badge */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t('argus.userProfiles.identitySummary', 'Identity Summary')}
          </Typography>
          {lifecycleStage && (
            <Chip
              label={lifecycleStage.label}
              size="small"
              sx={{
                height: 20,
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 0.6,
                bgcolor: lifecycleStage.bg,
                color: lifecycleStage.fg,
                border: 'none',
              }}
            />
          )}
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1 }}>
          {[
            {
              icon: <ScheduleIcon fontSize="inherit" />,
              label: t('argus.userProfiles.firstSeenLabel', 'First seen'),
              value: formatRelativeTime(profile.first_seen),
            },
            {
              icon: <ScheduleIcon fontSize="inherit" />,
              label: t('argus.userProfiles.lastSeenLabel', 'Last seen'),
              value: formatRelativeTime(profile.last_seen),
            },
            {
              icon: <GlobeIcon fontSize="inherit" />,
              label: t('argus.userProfiles.countryLabel', 'Country'),
              value: profile.country || '—',
            },
            {
              icon: <DevicesIcon fontSize="inherit" />,
              label: t('argus.userProfiles.platformLabel', 'Platform'),
              value: profile.platform || '—',
            },
          ].map((card) => (
            <Paper
              key={card.label}
              variant="outlined"
              sx={{ p: 1, borderRadius: 1.5, bgcolor: 'background.paper', borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary', mb: 0.2 }}>
                <Box sx={{ display: 'inline-flex', fontSize: 12 }}>{card.icon}</Box>
                <Typography variant="caption" sx={{ fontSize: 9, fontWeight: 500 }}>
                  {card.label}
                </Typography>
              </Box>
              <Typography variant="body2" fontWeight={600} sx={{ fontSize: 11 }}>
                {card.value}
              </Typography>
            </Paper>
          ))}
        </Box>
      </Box>

      {/* Cohorts Membership */}
      <Box>
        <Typography
          variant="caption"
          color="text.secondary"
          fontWeight={700}
          display="block"
          sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}
        >
          {t('argus.userProfiles.cohortsMembership', 'Cohorts Membership')}
        </Typography>
        {userCohorts.length > 0 ? (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {userCohorts.map((c) => (
              <CohortChip key={c.id} cohort={c} />
            ))}
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary">
            {t('argus.userProfiles.noCohortMembership', 'No cohort membership')}
          </Typography>
        )}
      </Box>

      {/* Churn Risk Warning */}
      {churnRisk && (
        <Box
          sx={{
            p: 1.2,
            borderRadius: 1.5,
            border: '1px solid',
            borderColor: churnRisk.kind === 'purchase' ? 'warning.main' : 'error.main',
            bgcolor:
              churnRisk.kind === 'purchase'
                ? isDark
                  ? 'rgba(255,152,0,0.08)'
                  : 'rgba(255,152,0,0.06)'
                : isDark
                  ? 'rgba(244,67,54,0.08)'
                  : 'rgba(244,67,54,0.06)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1,
          }}
        >
          <Typography sx={{ fontSize: 16, lineHeight: 1, mt: 0.1 }}>
            {churnRisk.kind === 'purchase' ? '⚠️' : '🔴'}
          </Typography>
          <Box>
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 700,
                color: churnRisk.kind === 'purchase' ? 'warning.main' : 'error.main',
              }}
            >
              {churnRisk.kind === 'purchase'
                ? t('argus.userProfiles.churnLabelPurchase', 'Churn Risk')
                : t('argus.userProfiles.churnLabelRefund', 'Suspected Payment Issue')}
            </Typography>
            <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.2 }}>
              {churnRisk.kind === 'purchase'
                ? t(
                    'argus.userProfiles.purchaseChurnMsg',
                    'No purchase for {{days}} days — Churn Risk',
                    { days: churnRisk.msg }
                  )
                : t(
                    'argus.userProfiles.refundChurnMsg',
                    'Refund rate {{rate}}% — Suspected payment issue',
                    { rate: churnRisk.msg }
                  )}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Engagement Daily Activity sparkline */}
      <Box sx={{ borderTop: `1px solid ${theme.palette.divider}`, pt: 2 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          fontWeight={700}
          display="block"
          sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}
        >
          {t('argus.userProfiles.engagementTrend', 'Activity — Last 30 Days')}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: '3.5px', height: 32, px: 0.5 }}>
          {dailyActivity.map((d, idx) => (
            <Tooltip key={idx} title={`${d.date.toLocaleDateString()}: ${d.count} events`}>
              <Box
                sx={{
                  flex: 1,
                  height: `${Math.max((d.count / maxDailyCount) * 32, 2)}px`,
                  bgcolor:
                    d.count > 0
                      ? theme.palette.primary.main
                      : isDark
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(0,0,0,0.06)',
                  borderRadius: '1.5px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: theme.palette.primary.light,
                    transform: 'scaleY(1.15)',
                  },
                }}
              />
            </Tooltip>
          ))}
        </Box>
      </Box>

      {/* Hourly activity heatmap */}
      {events.length > 0 && (() => {
        const DAYS = [
          t('argus.userProfiles.daySun', 'Sun'),
          t('argus.userProfiles.dayMon', 'Mon'),
          t('argus.userProfiles.dayTue', 'Tue'),
          t('argus.userProfiles.dayWed', 'Wed'),
          t('argus.userProfiles.dayThu', 'Thu'),
          t('argus.userProfiles.dayFri', 'Fri'),
          t('argus.userProfiles.daySat', 'Sat'),
        ];
        const HOUR_GROUPS = [
          { label: '0–5', hours: [0, 1, 2, 3, 4, 5] },
          { label: '6–11', hours: [6, 7, 8, 9, 10, 11] },
          { label: '12–17', hours: [12, 13, 14, 15, 16, 17] },
          { label: '18–23', hours: [18, 19, 20, 21, 22, 23] },
        ];
        const grouped: Record<string, number> = {};
        heatmap.forEach((c) => {
          const hg = HOUR_GROUPS.findIndex((g) => g.hours.includes(c.hour));
          if (hg < 0) return;
          const k = `${c.dow}-${hg}`;
          grouped[k] = (grouped[k] ?? 0) + c.count;
        });
        const maxVal = Math.max(...Object.values(grouped), 1);
        return (
          <Box sx={{ borderTop: `1px solid ${theme.palette.divider}`, pt: 2, pb: 1 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              fontWeight={700}
              sx={{ textTransform: 'uppercase', letterSpacing: 0.5, mb: 1, display: 'block' }}
            >
              {t('argus.userProfiles.activityHeatmap', 'Hourly Activity Heatmap')}
            </Typography>
            <Box
              sx={{
                mt: 0.8,
                display: 'grid',
                gridTemplateColumns: 'auto repeat(7, 1fr)',
                gap: '2px',
                alignItems: 'center',
              }}
            >
              <Box />
              {DAYS.map((d) => (
                <Typography
                  key={d}
                  sx={{
                    fontSize: 8.5,
                    textAlign: 'center',
                    color: 'text.disabled',
                    fontWeight: 700,
                  }}
                >
                  {d}
                </Typography>
              ))}
              {HOUR_GROUPS.map((hg, hgi) => (
                <React.Fragment key={hg.label}>
                  <Typography
                    sx={{
                      fontSize: 8.5,
                      color: 'text.disabled',
                      pr: 0.5,
                      lineHeight: 1,
                      textAlign: 'right',
                      fontWeight: 500,
                    }}
                  >
                    {hg.label}
                  </Typography>
                  {DAYS.map((_, di) => {
                    const val = grouped[`${di}-${hgi}`] ?? 0;
                    const intensity = val / maxVal;
                    return (
                      <Tooltip
                        key={di}
                        title={t('argus.userProfiles.heatmapTooltip', '{{day}} {{hour}}: {{count}} events', {
                          day: DAYS[di],
                          hour: hg.label,
                          count: val,
                        })}
                      >
                        <Box
                          sx={{
                            height: 10,
                            borderRadius: '1.5px',
                            bgcolor:
                              val === 0
                                ? isDark
                                  ? 'rgba(255,255,255,0.04)'
                                  : 'rgba(0,0,0,0.04)'
                                : alpha(
                                    theme.palette.primary.main,
                                    0.15 + intensity * 0.85
                                  ),
                            cursor: 'default',
                            transition: 'opacity 0.15s',
                            '&:hover': { opacity: 0.7 },
                          }}
                        />
                      </Tooltip>
                    );
                  })}
                </React.Fragment>
              ))}
            </Box>
          </Box>
        );
      })()}

      {/* User Properties Section */}
      <Box sx={{ borderTop: `1px solid ${theme.palette.divider}`, pt: 2, display: 'flex', flexDirection: 'column' }}>
        <Typography
          variant="caption"
          color="text.secondary"
          fontWeight={700}
          display="block"
          sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}
        >
          {t('argus.userProfiles.userProperties', 'User Properties', { count: properties.length })}
        </Typography>

        {properties.length > 5 && (
          <TextField
            placeholder={t('argus.userProfiles.searchPropertiesPlaceholder', 'Search...')}
            size="small"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            sx={{
              mb: 1.5,
              width: '100%',
              '& .MuiInputBase-root': {
                height: 28,
                fontSize: 11,
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 13 }} />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setSearchQuery('')}
                    sx={{ p: 0.25 }}
                  >
                    <CloseIcon sx={{ fontSize: 11 }} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            }}
          />
        )}

        {propertiesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={20} />
          </Box>
        ) : filteredProperties.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {filteredProperties.map((p) => (
              <Box
                key={p.key}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  p: 1,
                  borderRadius: 1,
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                  border: '1px solid',
                  borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                }}
              >
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: 'text.secondary', wordBreak: 'break-all' }}>
                  {p.key}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 0.25 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 500, wordBreak: 'break-all', flex: 1 }}>
                    {p.value}
                  </Typography>
                  <CopyButton value={p.value} />
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', py: 2 }}>
            {t('argus.userProfiles.noPropertiesFound', 'No properties found')}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default UserProfileDetailLeft;
