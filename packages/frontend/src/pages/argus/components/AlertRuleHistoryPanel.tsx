import React from 'react';
import { formatWith } from '@/utils/dateFormat';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Tooltip,
  Select,
  MenuItem,
  FormControl,
  Collapse,
  alpha,
} from '@mui/material';
import {
  History as HistoryIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ArgusAlertRule, ArgusAlertHistory } from '@/services/argusService';
import InteractiveTimeSeriesChart from '@/components/argus/InteractiveTimeSeriesChart';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import { ARGUS_SEMANTIC } from '../argusThemeTokens';

interface AlertRuleHistoryPanelProps {
  show: boolean;
  history: ArgusAlertHistory[];
  stats: { rule_id: number; bucket: string; count: number }[];
  rules: ArgusAlertRule[];
  isDark: boolean;
  filterRuleId: number | '';
  onFilterChange: (ruleId: number | '') => void;
}

const AlertRuleHistoryPanel: React.FC<AlertRuleHistoryPanelProps> = ({
  show,
  history,
  stats,
  rules,
  isDark,
  filterRuleId,
  onFilterChange,
}) => {
  const { t } = useTranslation();

  return (
    <Collapse in={show}>
      {history.length === 0 ? (
        <Box sx={{ mt: 3 }}>
          <EmptyPlaceholder
            icon={<HistoryIcon sx={{ fontSize: 48 }} />}
            message={t('argus.alerts.noHistory')}
            minHeight={250}
          />
        </Box>
      ) : (
        <Paper
          elevation={0}
          sx={{
            mt: 3,
            p: 2,
            borderRadius: 2,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1.5,
            }}
          >
            <Typography
              variant="subtitle2"
              fontWeight={700}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
            >
              <HistoryIcon sx={{ fontSize: 18, color: ARGUS_SEMANTIC.info }} />
              {t('argus.alerts.recentHistory')}
            </Typography>
            {rules.length > 0 && (
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <Select
                  value={filterRuleId}
                  onChange={(e) =>
                    onFilterChange(e.target.value as number | '')
                  }
                  displayEmpty
                  sx={{ fontSize: '0.72rem', height: 28 }}
                >
                  <MenuItem value="" sx={{ fontSize: '0.72rem' }}>
                    <em>{t('argus.alerts.allRules')}</em>
                  </MenuItem>
                  {rules.map((r) => (
                    <MenuItem
                      key={r.id}
                      value={r.id}
                      sx={{ fontSize: '0.72rem' }}
                    >
                      {r.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </Box>

          {/* Timeline Chart */}
          {stats.length > 0 && (
            <Box sx={{ height: 120, mb: 3 }}>
              {(() => {
                const filteredStats =
                  filterRuleId === ''
                    ? stats
                    : stats.filter((s) => s.rule_id === filterRuleId);
                const dateMap = new Map<string, number>();
                filteredStats.forEach((s) =>
                  dateMap.set(s.bucket, (dateMap.get(s.bucket) || 0) + s.count)
                );
                const dates = Array.from(dateMap.keys()).sort();
                const chartData = dates.map((d) => {
                  const bucket = d + (d.length === 10 ? 'T00:00:00Z' : 'Z');
                  const label =
                    d.length > 10
                      ? formatWith(bucket, 'M/D HH:mm')
                      : formatWith(bucket, 'M/D');
                  return { label, count: dateMap.get(d) || 0 };
                });

                return (
                  <InteractiveTimeSeriesChart
                    data={chartData}
                    type="bar"
                    height={120}
                  />
                );
              })()}
            </Box>
          )}

          <Box>
            {history
              .filter((h) => filterRuleId === '' || h.rule_id === filterRuleId)
              .map((h) => (
                <Box
                  key={h.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    py: 0.8,
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                  }}
                >
                  <WarningIcon
                    sx={{ fontSize: 14, color: ARGUS_SEMANTIC.warning }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 500 }}>
                      {h.rule_name ||
                        t('argus.alerts.ruleNumber', { id: h.rule_id })}
                    </Typography>
                    {h.message && (
                      <Typography
                        sx={{
                          fontSize: '0.72rem',
                          color: 'text.secondary',
                        }}
                      >
                        {h.message}
                      </Typography>
                    )}
                  </Box>
                  {h.status && (
                    <Tooltip title={h.response_body || 'No details'}>
                      <Chip
                        size="small"
                        label={h.status.toUpperCase()}
                        sx={{
                          height: 18,
                          fontSize: '0.58rem',
                          fontWeight: 700,
                          border: 'none',
                          backgroundColor:
                            h.status === 'success'
                              ? alpha(ARGUS_SEMANTIC.positive, 0.1)
                              : alpha(ARGUS_SEMANTIC.negative, 0.1),
                          color:
                            h.status === 'success'
                              ? ARGUS_SEMANTIC.positive
                              : ARGUS_SEMANTIC.negative,
                        }}
                      />
                    </Tooltip>
                  )}
                  <Typography
                    sx={{ fontSize: '0.68rem', color: 'text.disabled' }}
                  >
                    {new Date(h.triggered_at).toLocaleString()}
                  </Typography>
                </Box>
              ))}
          </Box>
        </Paper>
      )}
    </Collapse>
  );
};

export default React.memo(AlertRuleHistoryPanel);
