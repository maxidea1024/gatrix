import React, { useMemo, useCallback } from 'react';
import { formatWith } from '@/utils/dateFormat';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Switch,
  Chip,
  Tooltip,
  Checkbox,
  Button,
  TextField,
  InputAdornment,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as TestIcon,
  ContentCopy as DuplicateIcon,
  VolumeOff as MuteIcon,
  ArrowForward as ArrowIcon,
  Search as SearchIcon,
  LocalOffer as TagIcon,
} from '@mui/icons-material';
import { Line } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import {
  ArgusAlertRule,
  ArgusAlertCondition,
  ArgusAlertAction,
} from '@/services/argusService';
import { getConditionTypes, getActionTypes } from './alertRuleConfigs';
import { BulkActionBar, RuleCard } from './AlertRuleList.styles';
import { ARGUS_SEMANTIC } from '../argusThemeTokens';

interface AlertRuleListProps {
  rules: ArgusAlertRule[];
  filteredRules: ArgusAlertRule[];
  stats: { rule_id: number; bucket: string; count: number }[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedRules: Set<number>;
  onToggleSelectRule: (id: number) => void;
  onToggleSelectAll: () => void;
  onToggle: (rule: ArgusAlertRule) => void;
  onEdit: (rule: ArgusAlertRule) => void;
  onDuplicate: (rule: ArgusAlertRule) => void;
  onTest: (ruleId: number) => void;
  onDelete: (ruleId: number) => void;
  onMute: (rule: ArgusAlertRule) => void;
  onBulkToggle: (enable: boolean) => void;
  onBulkDelete: () => void;
}

const AlertRuleList: React.FC<AlertRuleListProps> = ({
  rules,
  filteredRules,
  stats,
  searchQuery,
  onSearchChange,
  selectedRules,
  onToggleSelectRule,
  onToggleSelectAll,
  onToggle,
  onEdit,
  onDuplicate,
  onTest,
  onDelete,
  onMute,
  onBulkToggle,
  onBulkDelete,
}) => {
  const { t } = useTranslation();
  const isDark = useTheme().palette.mode === 'dark';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Search Bar */}
      {rules.length > 3 && (
        <TextField
          size="small"
          fullWidth
          placeholder={t('argus.alerts.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            mb: 0.5,
            '& .MuiOutlinedInput-root': {
              fontSize: '0.82rem',
              borderRadius: 1.5,
            },
          }}
        />
      )}

      {/* Bulk Actions Bar */}
      {selectedRules.size > 0 && (
        <BulkActionBar elevation={0}>
          <Checkbox
            size="small"
            checked={selectedRules.size === filteredRules.length}
            indeterminate={
              selectedRules.size > 0 &&
              selectedRules.size < filteredRules.length
            }
            onChange={onToggleSelectAll}
            color="warning"
          />
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, flex: 1 }}>
            {t('argus.alerts.selectedCount', {
              count: selectedRules.size,
            })}
          </Typography>
          <Button
            size="small"
            onClick={() => onBulkToggle(true)}
            sx={{ textTransform: 'none', fontSize: '0.72rem' }}
          >
            {t('argus.alerts.enableAll')}
          </Button>
          <Button
            size="small"
            onClick={() => onBulkToggle(false)}
            sx={{ textTransform: 'none', fontSize: '0.72rem' }}
          >
            {t('argus.alerts.disableAll')}
          </Button>
          <Button
            size="small"
            color="error"
            onClick={onBulkDelete}
            sx={{ textTransform: 'none', fontSize: '0.72rem' }}
          >
            {t('common.delete')}
          </Button>
        </BulkActionBar>
      )}

      {filteredRules.map((rule) => {
        const conditions: ArgusAlertCondition[] =
          typeof rule.conditions === 'string'
            ? JSON.parse(rule.conditions)
            : rule.conditions || [];
        const actions: ArgusAlertAction[] =
          typeof rule.actions === 'string'
            ? JSON.parse(rule.actions)
            : rule.actions || [];
        const isMuted =
          !!(rule as any).muted_until &&
          new Date((rule as any).muted_until) > new Date();

        return (
          <RuleCard
            key={rule.id}
            elevation={0}
            isDark={isDark}
            accentColor={
              isMuted ? '#9e9e9e' : rule.enabled ? ARGUS_SEMANTIC.warning : 'transparent'
            }
            dimmed={isMuted || !rule.enabled}
          >
            <Checkbox
              size="small"
              checked={selectedRules.has(rule.id)}
              onChange={() => onToggleSelectRule(rule.id)}
              color="warning"
              sx={{ p: 0.3 }}
            />
            <Tooltip
              title={
                rule.enabled
                  ? t('argus.alerts.disable')
                  : t('argus.alerts.enable')
              }
            >
              <Switch
                size="small"
                checked={!!rule.enabled}
                onChange={() => onToggle(rule)}
                color="warning"
              />
            </Tooltip>

            {isMuted && (
              <Chip
                icon={<MuteIcon sx={{ fontSize: '12px !important' }} />}
                label={t('argus.alerts.mutedLabel')}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.58rem',
                  backgroundColor: alpha('#9e9e9e', 0.1),
                  color: '#9e9e9e',
                  border: 'none',
                }}
              />
            )}

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography fontWeight={700} sx={{ fontSize: '0.88rem' }}>
                {rule.name}
              </Typography>
              {rule.description && (
                <Typography
                  sx={{
                    fontSize: '0.72rem',
                    color: 'text.secondary',
                    mt: 0.2,
                    mb: 0.3,
                  }}
                >
                  {rule.description}
                </Typography>
              )}
              <Box
                sx={{
                  display: 'flex',
                  gap: 0.5,
                  mt: 0.5,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <Chip
                  label={t('argus.alerts.stepIf')}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.58rem',
                    fontWeight: 800,
                    backgroundColor: alpha(ARGUS_SEMANTIC.negative, 0.08),
                    color: ARGUS_SEMANTIC.negative,
                    border: 'none',
                  }}
                />
                {conditions.map((c: ArgusAlertCondition, i: number) => {
                  const cfg = getConditionTypes(t).find(
                    (ct) => ct.value === c.type
                  );
                  return (
                    <React.Fragment key={i}>
                      <Chip
                        icon={cfg?.icon}
                        label={cfg?.label || c.type}
                        size="small"
                        sx={{
                          height: 22,
                          fontSize: '0.68rem',
                          backgroundColor: alpha(cfg?.color || '#9e9e9e', 0.08),
                          color: cfg?.color,
                          border: 'none',
                        }}
                      />
                      {c.value && (
                        <Chip
                          label={`≥ ${c.value}`}
                          size="small"
                          sx={{ height: 18, fontSize: '0.62rem' }}
                        />
                      )}
                    </React.Fragment>
                  );
                })}

                <ArrowIcon
                  sx={{ fontSize: 14, color: 'text.disabled', mx: 0.3 }}
                />

                <Chip
                  label={t('argus.alerts.stepThen')}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.58rem',
                    fontWeight: 800,
                    backgroundColor: alpha(ARGUS_SEMANTIC.positive, 0.08),
                    color: ARGUS_SEMANTIC.positive,
                    border: 'none',
                  }}
                />
                {actions.map((a: ArgusAlertAction, i: number) => {
                  const cfg = getActionTypes(t).find(
                    (at) => at.value === a.type
                  );
                  return (
                    <Chip
                      key={i}
                      icon={cfg?.icon}
                      label={cfg?.label || a.type}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.68rem',
                        backgroundColor: alpha(cfg?.color || '#9e9e9e', 0.08),
                        color: cfg?.color,
                        border: 'none',
                      }}
                    />
                  );
                })}

                {rule.environment && (
                  <Chip
                    label={`env:${rule.environment}`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 18, fontSize: '0.6rem' }}
                  />
                )}
                {rule.level && (
                  <Chip
                    label={`level:${rule.level}`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 18, fontSize: '0.6rem' }}
                  />
                )}
                {(() => {
                  const tags =
                    typeof rule.tags === 'string'
                      ? JSON.parse(rule.tags || '{}')
                      : rule.tags || {};
                  return Object.entries(tags).map(([k, v]) => (
                    <Chip
                      key={k}
                      icon={<TagIcon sx={{ fontSize: '10px !important' }} />}
                      label={`${k}:${v}`}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.58rem',
                        backgroundColor: alpha('#00bcd4', 0.08),
                        color: '#00bcd4',
                        border: 'none',
                        '& .MuiChip-icon': { color: '#00bcd4' },
                      }}
                    />
                  ));
                })()}
              </Box>
            </Box>

            {/* Mini Chart */}
            <Box sx={{ width: 100, height: 36, mx: 1 }}>
              {(() => {
                const ruleStats = stats.filter((s) => s.rule_id === rule.id);
                if (ruleStats.length === 0) return null;
                const sortedStats = [...ruleStats].sort((a, b) =>
                  a.bucket.localeCompare(b.bucket)
                );
                const data = {
                  labels: sortedStats.map((s) => {
                    const bucket = s.bucket + (s.bucket.length === 10 ? 'T00:00:00Z' : 'Z');
                    return s.bucket.length > 10
                      ? formatWith(bucket, 'M/D HH:mm')
                      : formatWith(bucket, 'M/D');
                  }),
                  datasets: [
                    {
                      data: sortedStats.map((s) => s.count),
                      borderColor: isDark
                        ? alpha(ARGUS_SEMANTIC.warning, 0.8)
                        : alpha('#f57c00', 0.8),
                      backgroundColor: isDark
                        ? alpha(ARGUS_SEMANTIC.warning, 0.1)
                        : alpha('#f57c00', 0.1),
                      borderWidth: 1.5,
                      pointRadius: 0,
                      fill: true,
                      tension: 0.4,
                    },
                  ],
                };
                const options = {
                  plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false, external: null as any },
                  },
                  scales: {
                    x: { display: false },
                    y: { display: false },
                  },
                  maintainAspectRatio: false,
                  animation: { duration: 0 } as const,
                };
                return <Line data={data} options={options} />;
              })()}
            </Box>

            {/* Last triggered */}
            {rule.last_triggered_at && (
              <Tooltip title={t('argus.alerts.lastTriggered')}>
                <Typography
                  sx={{
                    fontSize: '0.68rem',
                    color: 'text.disabled',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {new Date(rule.last_triggered_at).toLocaleString()}
                </Typography>
              </Tooltip>
            )}

            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 0.3 }}>
              <Tooltip title={t('argus.alerts.test')}>
                <IconButton size="small" onClick={() => onTest(rule.id)}>
                  <TestIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('common.edit')}>
                <IconButton size="small" onClick={() => onEdit(rule)}>
                  <EditIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('common.delete')}>
                <IconButton
                  size="small"
                  sx={{
                    color: 'text.disabled',
                    '&:hover': { color: ARGUS_SEMANTIC.negative },
                  }}
                  onClick={() => onDelete(rule.id)}
                >
                  <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('argus.alerts.mute')}>
                <IconButton
                  size="small"
                  sx={{ color: 'text.disabled' }}
                  onClick={() => onMute(rule)}
                >
                  <MuteIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('argus.alerts.duplicate')}>
                <IconButton
                  size="small"
                  sx={{ color: 'text.disabled' }}
                  onClick={() => onDuplicate(rule)}
                >
                  <DuplicateIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </RuleCard>
        );
      })}
    </Box>
  );
};

export default React.memo(AlertRuleList);
