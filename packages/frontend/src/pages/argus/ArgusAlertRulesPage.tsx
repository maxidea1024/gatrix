import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Paper, Button, IconButton, Switch, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Select, MenuItem, FormControl, InputLabel,
  useTheme, alpha, Tooltip, Divider, Collapse, InputAdornment,
} from '@mui/material';
import {
  NotificationsActive as AlertIcon, Add as AddIcon, Edit as EditIcon,
  Delete as DeleteIcon, PlayArrow as TestIcon, Webhook as WebhookIcon,
  Email as EmailIcon, History as HistoryIcon, BugReport as BugIcon,
  Speed as FrequencyIcon, People as UsersIcon, Refresh as RegressionIcon,
  Close as CloseIcon, ArrowForward as ArrowIcon, Warning as WarningIcon,
  CheckCircle as ActiveIcon, RemoveCircle as DisabledIcon,
  ExpandMore as ExpandMoreIcon, Feedback as FeedbackIcon,
  LocalOffer as TagIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PageContentLoader from '@/components/common/PageContentLoader';
import { ListSkeleton } from '@/components/argus/ArgusSkeletons';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import argusService, {
  ArgusAlertRule, ArgusAlertCondition, ArgusAlertAction, ArgusAlertHistory,
} from '@/services/argusService';

/* ─── Config ─── */

const CONDITION_TYPES: { value: ArgusAlertCondition['type']; label: string; desc: string; icon: React.ReactElement; color: string }[] = [
  { value: 'new_issue', label: 'New Issue', desc: 'A new issue is created', icon: <BugIcon sx={{ fontSize: 18 }} />, color: '#f44336' },
  { value: 'event_frequency', label: 'Event Frequency', desc: 'Event count exceeds threshold within an interval', icon: <FrequencyIcon sx={{ fontSize: 18 }} />, color: '#ff9800' },
  { value: 'user_count', label: 'User Count', desc: 'Number of affected users exceeds threshold', icon: <UsersIcon sx={{ fontSize: 18 }} />, color: '#2196f3' },
  { value: 'regression', label: 'Regression', desc: 'A resolved issue has re-occurred', icon: <RegressionIcon sx={{ fontSize: 18 }} />, color: '#9c27b0' },
  { value: 'new_feedback', label: 'New Feedback', desc: 'A new user feedback is submitted', icon: <FeedbackIcon sx={{ fontSize: 18 }} />, color: '#00bcd4' },
];

const ACTION_TYPES: { value: ArgusAlertAction['type']; label: string; icon: React.ReactElement; color: string }[] = [
  { value: 'webhook', label: 'Webhook (Slack/Discord)', icon: <WebhookIcon sx={{ fontSize: 18 }} />, color: '#7c4dff' },
  { value: 'email', label: 'Email', icon: <EmailIcon sx={{ fontSize: 18 }} />, color: '#00bcd4' },
];

const INTERVALS = [
  { value: 60, label: '1 minute' }, { value: 300, label: '5 minutes' },
  { value: 900, label: '15 minutes' }, { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' }, { value: 86400, label: '1 day' },
];

const FREQUENCIES = [
  { value: 60, label: '1 min' }, { value: 300, label: '5 min' },
  { value: 900, label: '15 min' }, { value: 3600, label: '1 hour' },
  { value: 86400, label: '1 day' },
];

/* ─── Visual Step Card ─── */

const StepCard: React.FC<{
  step: string; label: string; color: string; isDark: boolean; children: React.ReactNode;
}> = ({ step, label, color, isDark, children }) => (
  <Box sx={{ position: 'relative' }}>
    {/* Step badge */}
    <Box sx={{
      position: 'absolute', top: -10, left: 16, zIndex: 1,
      px: 1.5, py: 0.2, borderRadius: 1,
      background: `linear-gradient(135deg, ${color}, ${alpha(color, 0.7)})`,
      color: '#fff', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.08em',
    }}>
      {step}
    </Box>
    <Paper elevation={0} sx={{
      p: 2, pt: 2.5, borderRadius: 2,
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      borderLeft: `3px solid ${color}`,
    }}>
      <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.68rem', mb: 1.5, display: 'block' }}>
        {label}
      </Typography>
      {children}
    </Paper>
  </Box>
);

/* ─── Connector Arrow ─── */

const StepConnector: React.FC = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
    <Box sx={{ width: 2, height: 16, backgroundColor: 'divider', borderRadius: 1 }} />
  </Box>
);

/* ─── Condition Selector Card ─── */

const ConditionCard: React.FC<{
  cond: ArgusAlertCondition; isDark: boolean;
  onChange: (c: ArgusAlertCondition) => void; onRemove: () => void;
}> = ({ cond, isDark, onChange, onRemove }) => {
  const config = CONDITION_TYPES.find(c => c.value === cond.type);
  const needsThreshold = cond.type === 'event_frequency' || cond.type === 'user_count';

  return (
    <Box sx={{
      display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 1.5, borderRadius: 1.5,
      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
    }}>
      <Box sx={{
        width: 36, height: 36, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: alpha(config?.color || '#9e9e9e', 0.1),
        color: config?.color || '#9e9e9e',
      }}>
        {config?.icon}
      </Box>
      <Box sx={{ flex: 1 }}>
        <FormControl size="small" fullWidth sx={{ mb: needsThreshold ? 1 : 0 }}>
          <Select value={cond.type} onChange={(e) => onChange({ ...cond, type: e.target.value as any })}
            sx={{ fontSize: '0.82rem', fontWeight: 600, '& .MuiSelect-select': { py: 0.6 } }}>
            {CONDITION_TYPES.map(c => (
              <MenuItem key={c.value} value={c.value} sx={{ fontSize: '0.82rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ color: c.color }}>{c.icon}</Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{c.label}</Typography>
                    <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>{c.desc}</Typography>
                  </Box>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {needsThreshold && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField size="small" type="number" label="Threshold"
              value={cond.value || 10}
              onChange={(e) => onChange({ ...cond, value: Number(e.target.value) })}
              sx={{ width: 100, '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } }}
              InputProps={{ startAdornment: <InputAdornment position="start" sx={{ '& .MuiTypography-root': { fontSize: '0.72rem' } }}>≥</InputAdornment> }}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel sx={{ fontSize: '0.75rem' }}>Interval</InputLabel>
              <Select value={cond.interval || 3600} label="Interval"
                onChange={(e) => onChange({ ...cond, interval: Number(e.target.value) })}
                sx={{ fontSize: '0.82rem' }}>
                {INTERVALS.map(i => <MenuItem key={i.value} value={i.value} sx={{ fontSize: '0.82rem' }}>{i.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        )}
      </Box>
      <IconButton size="small" onClick={onRemove} sx={{ mt: 0.5, color: 'text.disabled' }}>
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );
};

/* ─── Action Selector Card ─── */

const ActionCard: React.FC<{
  action: ArgusAlertAction; isDark: boolean;
  onChange: (a: ArgusAlertAction) => void; onRemove: () => void;
}> = ({ action, isDark, onChange, onRemove }) => {
  const config = ACTION_TYPES.find(a => a.value === action.type);

  return (
    <Box sx={{
      display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 1.5, borderRadius: 1.5,
      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
    }}>
      <Box sx={{
        width: 36, height: 36, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: alpha(config?.color || '#9e9e9e', 0.1),
        color: config?.color || '#9e9e9e',
      }}>
        {config?.icon}
      </Box>
      <Box sx={{ flex: 1 }}>
        <FormControl size="small" fullWidth sx={{ mb: action.type === 'webhook' ? 1 : 0 }}>
          <Select value={action.type} onChange={(e) => onChange({ ...action, type: e.target.value as any })}
            sx={{ fontSize: '0.82rem', fontWeight: 600, '& .MuiSelect-select': { py: 0.6 } }}>
            {ACTION_TYPES.map(a => (
              <MenuItem key={a.value} value={a.value} sx={{ fontSize: '0.82rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ color: a.color }}>{a.icon}</Box> {a.label}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {action.type === 'webhook' && (
          <TextField size="small" fullWidth placeholder="https://hooks.slack.com/services/..."
            value={action.target_url || ''} onChange={(e) => onChange({ ...action, target_url: e.target.value })}
            sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.82rem', fontFamily: 'monospace' } }}
          />
        )}
      </Box>
      <IconButton size="small" onClick={onRemove} sx={{ mt: 0.5, color: 'text.disabled' }}>
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );
};

/* ─── Main Component ─── */

interface ArgusAlertRulesPageProps { projectId?: string | number; }

const ArgusAlertRulesPage: React.FC<ArgusAlertRulesPageProps> = ({ projectId: propProjectId }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = propProjectId || currentProject?.id;

  // ─── State ───
  const [rules, setRules] = useState<ArgusAlertRule[]>([]);
  const [history, setHistory] = useState<ArgusAlertHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ArgusAlertRule | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Builder form
  const [formName, setFormName] = useState('');
  const [formConditions, setFormConditions] = useState<ArgusAlertCondition[]>([{ type: 'new_issue' }]);
  const [formActions, setFormActions] = useState<ArgusAlertAction[]>([{ type: 'webhook', target_url: '' }]);
  const [formFrequency, setFormFrequency] = useState(300);
  const [formEnvironment, setFormEnvironment] = useState('');
  const [formLevel, setFormLevel] = useState('');
  const [formTags, setFormTags] = useState<Record<string, string>>({});
  const [newTagKey, setNewTagKey] = useState('');
  const [newTagValue, setNewTagValue] = useState('');

  const fetchRules = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try { setRules(await argusService.listAlertRules(projectId)); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [projectId]);

  const fetchHistory = useCallback(async () => {
    if (!projectId) return;
    try { setHistory(await argusService.getAlertHistory(projectId, { limit: 50 })); }
    catch (e) { console.error(e); }
  }, [projectId]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  // ─── Dialog ───
  const openCreate = () => {
    setEditingRule(null);
    setFormName(''); setFormConditions([{ type: 'new_issue' }]);
    setFormActions([{ type: 'webhook', target_url: '' }]);
    setFormFrequency(300); setFormEnvironment(''); setFormLevel('');
    setFormTags({}); setNewTagKey(''); setNewTagValue('');
    setDialogOpen(true);
  };

  const openEdit = (rule: ArgusAlertRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormConditions(typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions);
    setFormActions(typeof rule.actions === 'string' ? JSON.parse(rule.actions) : rule.actions);
    setFormFrequency(rule.frequency);
    setFormEnvironment(rule.environment || '');
    setFormLevel(rule.level || '');
    setFormTags(typeof rule.tags === 'string' ? JSON.parse(rule.tags) : (rule.tags || {}));
    setNewTagKey(''); setNewTagValue('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!projectId || !formName) return;
    try {
      if (editingRule) {
        await argusService.updateAlertRule(projectId, editingRule.id, {
          name: formName, conditions: formConditions, actions: formActions, frequency: formFrequency,
          environment: formEnvironment || undefined, level: formLevel || undefined,
          tags: Object.keys(formTags).length > 0 ? formTags : undefined,
        } as any);
      } else {
        await argusService.createAlertRule(projectId, {
          name: formName, conditions: formConditions, actions: formActions, frequency: formFrequency,
          project_id: Number(projectId), enabled: true,
          environment: formEnvironment || undefined, level: formLevel || undefined,
          tags: Object.keys(formTags).length > 0 ? formTags : undefined,
        } as any);
      }
      setDialogOpen(false);
      fetchRules();
    } catch (e) { console.error(e); }
  };

  const handleToggle = async (rule: ArgusAlertRule) => {
    if (!projectId) return;
    try { await argusService.updateAlertRule(projectId, rule.id, { enabled: !rule.enabled } as any); fetchRules(); }
    catch (e) { console.error(e); }
  };

  const handleDelete = async (ruleId: number) => {
    if (!projectId) return;
    try { await argusService.deleteAlertRule(projectId, ruleId); setDeleteConfirm(null); fetchRules(); }
    catch (e) { console.error(e); }
  };

  const handleTest = async (ruleId: number) => {
    if (!projectId) return;
    try { await argusService.testAlertRule(projectId, ruleId); }
    catch (e) { console.error(e); }
  };

  /* ═══ RENDER ═══ */
  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <AlertIcon sx={{ fontSize: 24, color: '#ff9800' }} />
          <Typography variant="h6" fontWeight={700} sx={{ fontSize: '1.1rem' }}>
            {t('argus.alerts.title', 'Alert Rules')}
          </Typography>
          {rules.length > 0 && (
            <Chip label={`${rules.filter(r => r.enabled).length}/${rules.length} active`} size="small" sx={{
              height: 20, fontSize: '0.62rem', fontWeight: 700,
              backgroundColor: alpha('#ff9800', 0.08), color: '#ff9800',
            }} />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" size="small" startIcon={<HistoryIcon sx={{ fontSize: 16 }} />}
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchHistory(); }}
            sx={{ textTransform: 'none', fontSize: '0.78rem', borderRadius: 1.5 }}>
            {t('argus.alerts.history', 'History')}
          </Button>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}
            sx={{
              textTransform: 'none', fontSize: '0.78rem', fontWeight: 700, borderRadius: 1.5,
            }}>
            {t('argus.alerts.createRule', 'Create Rule')}
          </Button>
        </Box>
      </Box>

      <PageContentLoader loading={loading} skeleton={<ListSkeleton rows={5} />}>
        {/* Rules List */}
        {rules.length === 0 ? (
          <Paper elevation={0} sx={{
            py: 8, textAlign: 'center', borderRadius: 2,
            border: `1px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          }}>
            <AlertIcon sx={{ fontSize: 48, color: alpha('#ff9800', 0.2), mb: 1 }} />
            <Typography color="text.secondary" sx={{ fontSize: '0.88rem', mb: 0.5 }}>
              {t('argus.alerts.noRules', 'No alert rules configured')}
            </Typography>
            <Typography color="text.disabled" sx={{ fontSize: '0.78rem', mb: 2 }}>
              {t('argus.alerts.noRulesDesc', 'Create an alert rule to get notified when issues occur')}
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}
              sx={{ textTransform: 'none' }}>
              {t('argus.alerts.createFirstRule', 'Create First Rule')}
            </Button>
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {rules.map(rule => {
              const conditions = typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : (rule.conditions || []);
              const actions = typeof rule.actions === 'string' ? JSON.parse(rule.actions) : (rule.actions || []);

              return (
                <Paper key={rule.id} elevation={0} sx={{
                  display: 'flex', alignItems: 'center', gap: 2, px: 2, py: 1.5,
                  borderRadius: 2, transition: 'all 0.15s',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                  borderLeft: `3px solid ${rule.enabled ? '#ff9800' : 'transparent'}`,
                  opacity: rule.enabled ? 1 : 0.55,
                  '&:hover': { borderColor: alpha('#ff9800', 0.3) },
                }}>
                  {/* Toggle */}
                  <Tooltip title={rule.enabled ? t('argus.alerts.disable', 'Disable') : t('argus.alerts.enable', 'Enable')}>
                    <Switch size="small" checked={!!rule.enabled} onChange={() => handleToggle(rule)} color="warning" />
                  </Tooltip>

                  {/* Info */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={700} sx={{ fontSize: '0.88rem' }}>{rule.name}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                      {/* IF conditions */}
                      <Chip label="IF" size="small" sx={{ height: 18, fontSize: '0.58rem', fontWeight: 800, backgroundColor: alpha('#f44336', 0.08), color: '#f44336', border: 'none' }} />
                      {conditions.map((c: ArgusAlertCondition, i: number) => {
                        const cfg = CONDITION_TYPES.find(ct => ct.value === c.type);
                        return (
                          <React.Fragment key={i}>
                            <Chip icon={cfg?.icon} label={cfg?.label || c.type} size="small"
                              sx={{ height: 22, fontSize: '0.68rem', backgroundColor: alpha(cfg?.color || '#9e9e9e', 0.08), color: cfg?.color, border: 'none' }} />
                            {c.value && <Chip label={`≥ ${c.value}`} size="small" sx={{ height: 18, fontSize: '0.62rem', fontFamily: 'monospace' }} />}
                          </React.Fragment>
                        );
                      })}

                      <ArrowIcon sx={{ fontSize: 14, color: 'text.disabled', mx: 0.3 }} />

                      {/* THEN actions */}
                      <Chip label="THEN" size="small" sx={{ height: 18, fontSize: '0.58rem', fontWeight: 800, backgroundColor: alpha('#4caf50', 0.08), color: '#4caf50', border: 'none' }} />
                      {actions.map((a: ArgusAlertAction, i: number) => {
                        const cfg = ACTION_TYPES.find(at => at.value === a.type);
                        return <Chip key={i} icon={cfg?.icon} label={cfg?.label || a.type} size="small"
                          sx={{ height: 22, fontSize: '0.68rem', backgroundColor: alpha(cfg?.color || '#9e9e9e', 0.08), color: cfg?.color, border: 'none' }} />;
                      })}

                      {/* Filters */}
                      {rule.environment && <Chip label={`env:${rule.environment}`} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />}
                      {rule.level && <Chip label={`level:${rule.level}`} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />}
                      {(() => {
                        const tags = typeof rule.tags === 'string' ? JSON.parse(rule.tags || '{}') : (rule.tags || {});
                        return Object.entries(tags).map(([k, v]) => (
                          <Chip key={k} icon={<TagIcon sx={{ fontSize: '10px !important' }} />} label={`${k}:${v}`} size="small"
                            sx={{ height: 18, fontSize: '0.58rem', fontFamily: 'monospace', backgroundColor: alpha('#00bcd4', 0.08), color: '#00bcd4', border: 'none', '& .MuiChip-icon': { color: '#00bcd4' } }} />
                        ));
                      })()}
                    </Box>
                  </Box>

                  {/* Last triggered */}
                  {rule.last_triggered_at && (
                    <Tooltip title={t('argus.alerts.lastTriggered', 'Last triggered')}>
                      <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled', whiteSpace: 'nowrap', fontFamily: 'monospace' }}>
                        {new Date(rule.last_triggered_at).toLocaleString()}
                      </Typography>
                    </Tooltip>
                  )}

                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 0.3 }}>
                    <Tooltip title={t('argus.alerts.test', 'Send test')}>
                      <IconButton size="small" onClick={() => handleTest(rule.id)}><TestIcon sx={{ fontSize: 16 }} /></IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.edit', 'Edit')}>
                      <IconButton size="small" onClick={() => openEdit(rule)}><EditIcon sx={{ fontSize: 16 }} /></IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.delete', 'Delete')}>
                      <IconButton size="small" sx={{ color: 'text.disabled', '&:hover': { color: '#f44336' } }} onClick={() => setDeleteConfirm(rule.id)}>
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}

        {/* History */}
        <Collapse in={showHistory}>
          <Paper elevation={0} sx={{
            mt: 3, p: 2, borderRadius: 2,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <HistoryIcon sx={{ fontSize: 18, color: '#2196f3' }} />
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
                    <WarningIcon sx={{ fontSize: 14, color: '#ff9800' }} />
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
        </Collapse>
      </PageContentLoader>

      {/* ═══ Visual Builder Dialog ═══ */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3, maxHeight: '85vh' } }}>
        <DialogTitle sx={{
          fontWeight: 700, fontSize: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          pb: 1, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        }}>
          {editingRule ? t('argus.alerts.editRule', 'Edit Alert Rule') : t('argus.alerts.createRule', 'Create Alert Rule')}
          <IconButton size="small" onClick={() => setDialogOpen(false)}><CloseIcon fontSize="small" /></IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 2, overflow: 'auto' }}>
          {/* Rule Name */}
          <TextField fullWidth size="small" label={t('argus.alerts.ruleName', 'Rule Name')}
            value={formName} onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g., Critical production errors"
            sx={{ mb: 3, '& .MuiOutlinedInput-root': { fontSize: '0.88rem', fontWeight: 600 } }}
          />

          {/* IF Step */}
          <StepCard step="IF" label={t('argus.alerts.conditionsDesc', 'Any of these conditions are met...')} color="#f44336" isDark={isDark}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {formConditions.map((cond, i) => (
                <ConditionCard key={i} cond={cond} isDark={isDark}
                  onChange={(c) => { const next = [...formConditions]; next[i] = c; setFormConditions(next); }}
                  onRemove={() => setFormConditions(formConditions.filter((_, j) => j !== i))}
                />
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={() => setFormConditions([...formConditions, { type: 'new_issue' }])}
                sx={{ textTransform: 'none', fontSize: '0.75rem', alignSelf: 'flex-start', mt: 0.5 }}>
                {t('argus.alerts.addCondition', 'Add Condition')}
              </Button>
            </Box>
          </StepCard>

          <StepConnector />

          {/* THEN Step */}
          <StepCard step="THEN" label={t('argus.alerts.actionsDesc', 'Perform these actions...')} color="#4caf50" isDark={isDark}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {formActions.map((action, i) => (
                <ActionCard key={i} action={action} isDark={isDark}
                  onChange={(a) => { const next = [...formActions]; next[i] = a; setFormActions(next); }}
                  onRemove={() => setFormActions(formActions.filter((_, j) => j !== i))}
                />
              ))}
              <Button size="small" startIcon={<AddIcon />} onClick={() => setFormActions([...formActions, { type: 'webhook', target_url: '' }])}
                sx={{ textTransform: 'none', fontSize: '0.75rem', alignSelf: 'flex-start', mt: 0.5 }}>
                {t('argus.alerts.addAction', 'Add Action')}
              </Button>
            </Box>
          </StepCard>

          <StepConnector />

          {/* FILTERS Step */}
          <StepCard step="FILTERS" label={t('argus.alerts.filtersDesc', 'Only trigger for...')} color="#7c4dff" isDark={isDark}>
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel sx={{ fontSize: '0.75rem' }}>Alert Frequency</InputLabel>
                <Select value={formFrequency} onChange={(e) => setFormFrequency(Number(e.target.value))} label="Alert Frequency"
                  sx={{ fontSize: '0.82rem' }}>
                  {FREQUENCIES.map(f => <MenuItem key={f.value} value={f.value} sx={{ fontSize: '0.82rem' }}>{f.label}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" label={t('argus.alerts.environment', 'Environment')}
                value={formEnvironment} onChange={(e) => setFormEnvironment(e.target.value)}
                placeholder="production"
                sx={{ minWidth: 130, '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } }}
              />
              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel sx={{ fontSize: '0.75rem' }}>Level</InputLabel>
                <Select value={formLevel} onChange={(e) => setFormLevel(e.target.value)} label="Level"
                  sx={{ fontSize: '0.82rem' }}>
                  <MenuItem value="" sx={{ fontSize: '0.82rem' }}><em>All</em></MenuItem>
                  <MenuItem value="fatal" sx={{ fontSize: '0.82rem' }}>Fatal</MenuItem>
                  <MenuItem value="error" sx={{ fontSize: '0.82rem' }}>Error</MenuItem>
                  <MenuItem value="warning" sx={{ fontSize: '0.82rem' }}>Warning</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {/* Tag Filters */}
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                <TagIcon sx={{ fontSize: 14 }} /> {t('argus.alerts.tagFilters', 'Tag Filters')}
              </Typography>
              {Object.keys(formTags).length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                  {Object.entries(formTags).map(([k, v]) => (
                    <Chip
                      key={k}
                      label={`${k}: ${v}`}
                      size="small"
                      onDelete={() => {
                        const next = { ...formTags };
                        delete next[k];
                        setFormTags(next);
                      }}
                      sx={{
                        height: 22, fontSize: '0.68rem', fontFamily: 'monospace',
                        backgroundColor: alpha('#00bcd4', 0.08), color: '#00bcd4', border: 'none',
                        '& .MuiChip-deleteIcon': { fontSize: 14, color: alpha('#00bcd4', 0.5), '&:hover': { color: '#00bcd4' } },
                      }}
                    />
                  ))}
                </Box>
              )}
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                <TextField size="small" placeholder="key" value={newTagKey}
                  onChange={(e) => setNewTagKey(e.target.value)}
                  sx={{ width: 100, '& .MuiOutlinedInput-root': { fontSize: '0.78rem' } }}
                />
                <Typography sx={{ color: 'text.disabled', fontSize: '0.78rem' }}>:</Typography>
                <TextField size="small" placeholder="value" value={newTagValue}
                  onChange={(e) => setNewTagValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTagKey.trim() && newTagValue.trim()) {
                      setFormTags({ ...formTags, [newTagKey.trim()]: newTagValue.trim() });
                      setNewTagKey(''); setNewTagValue('');
                    }
                  }}
                  sx={{ width: 120, '& .MuiOutlinedInput-root': { fontSize: '0.78rem' } }}
                />
                <Button size="small" disabled={!newTagKey.trim() || !newTagValue.trim()}
                  onClick={() => {
                    setFormTags({ ...formTags, [newTagKey.trim()]: newTagValue.trim() });
                    setNewTagKey(''); setNewTagValue('');
                  }}
                  sx={{ textTransform: 'none', fontSize: '0.72rem', minWidth: 'auto' }}>
                  +
                </Button>
              </Box>
            </Box>
          </StepCard>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, pt: 1, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
          <Button onClick={() => setDialogOpen(false)} sx={{ textTransform: 'none' }}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="contained" onClick={handleSave} disabled={!formName || formConditions.length === 0 || formActions.length === 0}
            sx={{
              textTransform: 'none', fontWeight: 700,
            }}>
            {editingRule ? t('common.save', 'Save') : t('argus.alerts.create', 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirm !== null} onClose={() => setDeleteConfirm(null)} maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{t('argus.alerts.confirmDelete', 'Delete Alert Rule?')}</DialogTitle>
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
