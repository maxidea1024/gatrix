import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Switch,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  useTheme,
  alpha,
  Tooltip,
  Divider,
} from '@mui/material';
import {
  NotificationsActive as AlertIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as TestIcon,
  Webhook as WebhookIcon,
  Email as EmailIcon,
  History as HistoryIcon,
  BugReport as BugIcon,
  Speed as FrequencyIcon,
  People as UsersIcon,
  Refresh as RegressionIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageContentLoader from '@/components/common/PageContentLoader';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import argusService, {
  ArgusAlertRule,
  ArgusAlertCondition,
  ArgusAlertAction,
  ArgusAlertHistory,
} from '@/services/argusService';

const CONDITION_TYPES: { value: ArgusAlertCondition['type']; labelKey: string; fallback: string; icon: React.ReactElement }[] = [
  { value: 'new_issue', labelKey: 'argus.alerts.condNewIssue', fallback: 'New issue created', icon: <BugIcon sx={{ fontSize: 16 }} /> },
  { value: 'event_frequency', labelKey: 'argus.alerts.condEventFreq', fallback: 'Event frequency exceeds threshold', icon: <FrequencyIcon sx={{ fontSize: 16 }} /> },
  { value: 'user_count', labelKey: 'argus.alerts.condUserCount', fallback: 'Affected users exceed threshold', icon: <UsersIcon sx={{ fontSize: 16 }} /> },
  { value: 'regression', labelKey: 'argus.alerts.condRegression', fallback: 'Resolved issue regressed', icon: <RegressionIcon sx={{ fontSize: 16 }} /> },
];

const ACTION_TYPES: { value: ArgusAlertAction['type']; label: string; icon: React.ReactElement }[] = [
  { value: 'webhook', label: 'Webhook (Slack/Discord)', icon: <WebhookIcon sx={{ fontSize: 16 }} /> },
  { value: 'email', label: 'Email', icon: <EmailIcon sx={{ fontSize: 16 }} /> },
];

interface ArgusAlertRulesPageProps {
  projectId?: string | number;
}

const ArgusAlertRulesPage: React.FC<ArgusAlertRulesPageProps> = ({ projectId: propProjectId }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = propProjectId || currentProject?.id;

  const [rules, setRules] = useState<ArgusAlertRule[]>([]);
  const [history, setHistory] = useState<ArgusAlertHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ArgusAlertRule | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCondType, setFormCondType] = useState<ArgusAlertCondition['type']>('new_issue');
  const [formCondValue, setFormCondValue] = useState(10);
  const [formCondInterval, setFormCondInterval] = useState(3600);
  const [formActionType, setFormActionType] = useState<ArgusAlertAction['type']>('webhook');
  const [formActionUrl, setFormActionUrl] = useState('');
  const [formFrequency, setFormFrequency] = useState(300);
  const [formEnvironment, setFormEnvironment] = useState('');
  const [formLevel, setFormLevel] = useState('');

  const fetchRules = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await argusService.listAlertRules(projectId);
      setRules(data);
    } catch (e) {
      console.error('Failed to fetch alert rules:', e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchHistory = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await argusService.getAlertHistory(projectId, { limit: 50 });
      setHistory(data);
    } catch (e) {
      console.error('Failed to fetch alert history:', e);
    }
  }, [projectId]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const openCreate = () => {
    setEditingRule(null);
    setFormName('');
    setFormCondType('new_issue');
    setFormCondValue(10);
    setFormCondInterval(3600);
    setFormActionType('webhook');
    setFormActionUrl('');
    setFormFrequency(300);
    setFormEnvironment('');
    setFormLevel('');
    setDialogOpen(true);
  };

  const openEdit = (rule: ArgusAlertRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    const cond = (typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions)[0] || {};
    setFormCondType(cond.type || 'new_issue');
    setFormCondValue(cond.value || 10);
    setFormCondInterval(cond.interval || 3600);
    const action = (typeof rule.actions === 'string' ? JSON.parse(rule.actions) : rule.actions)[0] || {};
    setFormActionType(action.type || 'webhook');
    setFormActionUrl(action.target_url || '');
    setFormFrequency(rule.frequency);
    setFormEnvironment(rule.environment || '');
    setFormLevel(rule.level || '');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!projectId || !formName) return;
    const conditions: ArgusAlertCondition[] = [{
      type: formCondType,
      ...(formCondType !== 'new_issue' && formCondType !== 'regression' ? { value: formCondValue, interval: formCondInterval } : {}),
    }];
    const actions: ArgusAlertAction[] = [{
      type: formActionType,
      ...(formActionType === 'webhook' ? { target_url: formActionUrl } : {}),
    }];

    try {
      if (editingRule) {
        await argusService.updateAlertRule(projectId, editingRule.id, {
          name: formName, conditions, actions, frequency: formFrequency,
          environment: formEnvironment || undefined, level: formLevel || undefined,
        } as any);
      } else {
        await argusService.createAlertRule(projectId, {
          name: formName, conditions, actions, frequency: formFrequency,
          project_id: Number(projectId), enabled: true,
          environment: formEnvironment || undefined, level: formLevel || undefined,
        } as any);
      }
      setDialogOpen(false);
      fetchRules();
    } catch (e) {
      console.error('Failed to save alert rule:', e);
    }
  };

  const handleToggle = async (rule: ArgusAlertRule) => {
    if (!projectId) return;
    try {
      await argusService.updateAlertRule(projectId, rule.id, { enabled: !rule.enabled } as any);
      fetchRules();
    } catch (e) {
      console.error('Failed to toggle rule:', e);
    }
  };

  const handleDelete = async (ruleId: number) => {
    if (!projectId) return;
    try {
      await argusService.deleteAlertRule(projectId, ruleId);
      setDeleteConfirm(null);
      fetchRules();
    } catch (e) {
      console.error('Failed to delete rule:', e);
    }
  };

  const handleTest = async (ruleId: number) => {
    if (!projectId) return;
    try {
      await argusService.testAlertRule(projectId, ruleId);
    } catch (e) {
      console.error('Failed to test rule:', e);
    }
  };

  const needsThreshold = formCondType === 'event_frequency' || formCondType === 'user_count';

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AlertIcon sx={{ fontSize: 28, color: theme.palette.warning.main }} />
          <Typography variant="h5" fontWeight={700}>
            {t('argus.alerts.title', 'Alert Rules')}
          </Typography>
          <Chip label={rules.length} size="small" sx={{ height: 22, fontSize: '0.72rem', fontWeight: 700 }} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<HistoryIcon />}
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory(); }}
            sx={{ textTransform: 'none', borderRadius: '8px', fontSize: '0.78rem' }}
          >
            {t('argus.alerts.history', 'History')}
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={openCreate}
            sx={{ textTransform: 'none', borderRadius: '8px', fontSize: '0.78rem' }}
          >
            {t('argus.alerts.createRule', 'Create Rule')}
          </Button>
        </Box>
      </Box>

      <PageContentLoader loading={loading}>
        {/* Rules List */}
        {rules.length === 0 ? (
          <Paper elevation={0} sx={{
            p: 6, textAlign: 'center',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: 2,
          }}>
            <AlertIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body1" color="text.secondary" fontWeight={500}>
              {t('argus.alerts.noRules', 'No alert rules configured')}
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mb: 2, fontSize: '0.82rem' }}>
              {t('argus.alerts.noRulesDesc', 'Create an alert rule to get notified when issues occur')}
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ textTransform: 'none' }}>
              {t('argus.alerts.createFirstRule', 'Create First Rule')}
            </Button>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {rules.map(rule => {
              const conditions = typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions;
              const actions = typeof rule.actions === 'string' ? JSON.parse(rule.actions) : rule.actions;
              const condConfig = CONDITION_TYPES.find(c => c.value === conditions?.[0]?.type);
              const actionConfig = ACTION_TYPES.find(a => a.value === actions?.[0]?.type);

              return (
                <Paper
                  key={rule.id}
                  elevation={0}
                  sx={{
                    p: 2, display: 'flex', alignItems: 'center', gap: 2,
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    borderRadius: 2,
                    opacity: rule.enabled ? 1 : 0.5,
                    borderLeft: `3px solid ${rule.enabled ? theme.palette.warning.main : 'transparent'}`,
                    transition: 'all 0.15s',
                    '&:hover': { borderColor: theme.palette.warning.main },
                  }}
                >
                  <Switch
                    size="small"
                    checked={!!rule.enabled}
                    onChange={() => handleToggle(rule)}
                    color="warning"
                  />

                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={700} sx={{ fontSize: '0.88rem' }}>{rule.name}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                      {condConfig && (
                        <Chip
                          icon={condConfig.icon}
                          label={t(condConfig.labelKey, { defaultValue: condConfig.fallback })}
                          size="small"
                          sx={{
                            height: 22, fontSize: '0.68rem',
                            backgroundColor: alpha(theme.palette.info.main, 0.08),
                            color: theme.palette.info.main,
                            border: 'none',
                          }}
                        />
                      )}
                      {conditions?.[0]?.value && (
                        <Chip
                          label={`≥ ${conditions[0].value} / ${Math.round((conditions[0].interval || 3600) / 60)}min`}
                          size="small"
                          sx={{ height: 20, fontSize: '0.65rem', fontFamily: 'monospace' }}
                        />
                      )}
                      <Typography sx={{ color: 'text.disabled', fontSize: '0.7rem', mx: 0.3 }}>→</Typography>
                      {actionConfig && (
                        <Chip
                          icon={actionConfig.icon}
                          label={actionConfig.label}
                          size="small"
                          sx={{
                            height: 22, fontSize: '0.68rem',
                            backgroundColor: alpha(theme.palette.success.main, 0.08),
                            color: theme.palette.success.main,
                            border: 'none',
                          }}
                        />
                      )}
                      {rule.environment && (
                        <Chip label={`env: ${rule.environment}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.62rem' }} />
                      )}
                    </Box>
                  </Box>

                  {rule.last_triggered_at && (
                    <Tooltip title={t('argus.alerts.lastTriggered', 'Last triggered')}>
                      <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', whiteSpace: 'nowrap' }}>
                        {new Date(rule.last_triggered_at).toLocaleString()}
                      </Typography>
                    </Tooltip>
                  )}

                  <Box sx={{ display: 'flex', gap: 0.3 }}>
                    <Tooltip title={t('argus.alerts.test', 'Send test')}>
                      <IconButton size="small" onClick={() => handleTest(rule.id)}><TestIcon sx={{ fontSize: 16 }} /></IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.edit', 'Edit')}>
                      <IconButton size="small" onClick={() => openEdit(rule)}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.delete', 'Delete')}>
                      <IconButton size="small" color="error" onClick={() => setDeleteConfirm(rule.id)}><DeleteIcon sx={{ fontSize: 16 }} /></IconButton>
                    </Tooltip>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}

        {/* Alert History */}
        {showHistory && (
          <Paper elevation={0} sx={{
            mt: 3, p: 2,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            borderRadius: 2,
          }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <HistoryIcon sx={{ fontSize: 18, color: theme.palette.info.main }} />
              {t('argus.alerts.recentHistory', 'Recent Alert History')}
            </Typography>
            {history.length === 0 ? (
              <Typography variant="body2" color="text.disabled" textAlign="center" py={3}>
                {t('argus.alerts.noHistory', 'No alerts triggered yet')}
              </Typography>
            ) : (
              <Box>
                {history.map(h => (
                  <Box key={h.id} sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, py: 0.8,
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                  }}>
                    <AlertIcon sx={{ fontSize: 14, color: theme.palette.warning.main }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontSize: '0.78rem', fontWeight: 500 }}>{h.rule_name || `Rule #${h.rule_id}`}</Typography>
                      {h.message && <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{h.message}</Typography>}
                    </Box>
                    <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', fontFamily: 'monospace' }}>
                      {new Date(h.triggered_at).toLocaleString()}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        )}
      </PageContentLoader>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingRule ? t('argus.alerts.editRule', 'Edit Alert Rule') : t('argus.alerts.createRule', 'Create Alert Rule')}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label={t('argus.alerts.ruleName', 'Rule Name')}
              value={formName}
              onChange={e => setFormName(e.target.value)}
              size="small"
              fullWidth
              placeholder="e.g., Critical errors alert"
            />

            <Divider />
            <Typography variant="caption" fontWeight={600} color="text.secondary">{t('argus.alerts.when', 'WHEN')}</Typography>

            <FormControl size="small" fullWidth>
              <InputLabel>{t('argus.alerts.conditionType', 'Condition')}</InputLabel>
              <Select value={formCondType} onChange={e => setFormCondType(e.target.value as any)} label="Condition">
                {CONDITION_TYPES.map(c => (
                  <MenuItem key={c.value} value={c.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {c.icon}
                      {t(c.labelKey, { defaultValue: c.fallback })}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {needsThreshold && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  label={t('argus.alerts.threshold', 'Threshold')}
                  type="number"
                  value={formCondValue}
                  onChange={e => setFormCondValue(Number(e.target.value))}
                  size="small"
                  sx={{ flex: 1 }}
                />
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>{t('argus.alerts.interval', 'Interval')}</InputLabel>
                  <Select value={formCondInterval} onChange={e => setFormCondInterval(Number(e.target.value))} label="Interval">
                    <MenuItem value={300}>5 min</MenuItem>
                    <MenuItem value={900}>15 min</MenuItem>
                    <MenuItem value={1800}>30 min</MenuItem>
                    <MenuItem value={3600}>1 hour</MenuItem>
                    <MenuItem value={86400}>1 day</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}

            <Divider />
            <Typography variant="caption" fontWeight={600} color="text.secondary">{t('argus.alerts.then', 'THEN')}</Typography>

            <FormControl size="small" fullWidth>
              <InputLabel>{t('argus.alerts.actionType', 'Action')}</InputLabel>
              <Select value={formActionType} onChange={e => setFormActionType(e.target.value as any)} label="Action">
                {ACTION_TYPES.map(a => (
                  <MenuItem key={a.value} value={a.value}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>{a.icon} {a.label}</Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {formActionType === 'webhook' && (
              <TextField
                label={t('argus.alerts.webhookUrl', 'Webhook URL')}
                value={formActionUrl}
                onChange={e => setFormActionUrl(e.target.value)}
                size="small"
                fullWidth
                placeholder="https://hooks.slack.com/services/..."
              />
            )}

            <Divider />
            <Typography variant="caption" fontWeight={600} color="text.secondary">{t('argus.alerts.options', 'OPTIONS')}</Typography>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>{t('argus.alerts.alertFreq', 'Min interval')}</InputLabel>
                <Select value={formFrequency} onChange={e => setFormFrequency(Number(e.target.value))} label="Min interval">
                  <MenuItem value={60}>1 min</MenuItem>
                  <MenuItem value={300}>5 min</MenuItem>
                  <MenuItem value={900}>15 min</MenuItem>
                  <MenuItem value={3600}>1 hour</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label={t('argus.alerts.environment', 'Environment')}
                value={formEnvironment}
                onChange={e => setFormEnvironment(e.target.value)}
                size="small"
                sx={{ flex: 1 }}
                placeholder="production"
              />
              <FormControl size="small" sx={{ flex: 1 }}>
                <InputLabel>{t('argus.alerts.level', 'Level')}</InputLabel>
                <Select value={formLevel} onChange={e => setFormLevel(e.target.value)} label="Level">
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="fatal">Fatal</MenuItem>
                  <MenuItem value="error">Error</MenuItem>
                  <MenuItem value="warning">Warning</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none' }}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={!formName} sx={{ textTransform: 'none' }}>
            {editingRule ? t('common.save', 'Save') : t('argus.alerts.create', 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 700 }}>{t('argus.alerts.confirmDelete', 'Delete Alert Rule?')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t('argus.alerts.confirmDeleteDesc', 'This action cannot be undone. The rule will stop monitoring immediately.')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)} sx={{ textTransform: 'none' }}>{t('common.cancel', 'Cancel')}</Button>
          <Button variant="contained" color="error" onClick={() => deleteConfirm && handleDelete(deleteConfirm)} sx={{ textTransform: 'none' }}>
            {t('common.delete', 'Delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ArgusAlertRulesPage;
