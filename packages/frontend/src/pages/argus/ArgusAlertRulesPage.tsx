import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Button,
  useTheme,
} from '@mui/material';
import {
  NotificationsActive as AlertIcon,
  Add as AddIcon,
  History as HistoryIcon,
} from '@mui/icons-material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  ChartTooltip,
  Legend,
  Filler
);
import PageContentLoader from '@/components/common/PageContentLoader';
import { ListSkeleton } from '@/components/argus/ArgusSkeletons';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import argusService, {
  ArgusAlertRule,
  ArgusAlertCondition,
  ArgusAlertAction,
  ArgusAlertHistory,
} from '@/services/argusService';
import ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';
import PageHeader from '@/components/common/PageHeader';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import AlertRuleList from './components/AlertRuleList';
import AlertRuleEditorDialog from './components/AlertRuleEditorDialog';
import AlertRuleHistoryPanel from './components/AlertRuleHistoryPanel';
import { DeleteConfirmDialog, MuteDialog } from './components/AlertRuleDialogs';

/* ─── Main Component ─── */

interface ArgusAlertRulesPageProps {
  projectId?: string | number;
}

const ArgusAlertRulesPage: React.FC<ArgusAlertRulesPageProps> = ({
  projectId: propProjectId,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const { enqueueSnackbar } = useSnackbar();
  const projectId = propProjectId || currentProject?.id;

  // ─── State ───
  const [rules, setRules] = useState<ArgusAlertRule[]>([]);
  const [history, setHistory] = useState<ArgusAlertHistory[]>([]);
  const [stats, setStats] = useState<
    { rule_id: number; bucket: string; count: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ArgusAlertRule | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [historyFilterRule, setHistoryFilterRule] = useState<number | ''>('');
  const [availableEnvironments, setAvailableEnvironments] = useState<string[]>(
    []
  );
  const [selectedRules, setSelectedRules] = useState<Set<number>>(new Set());
  const [muteDialogRule, setMuteDialogRule] = useState<ArgusAlertRule | null>(
    null
  );

  // ─── Data Fetch ───
  const fetchRules = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      setRules(await argusService.listAlertRules(projectId));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchHistory = useCallback(async () => {
    if (!projectId) return;
    try {
      const [h, s] = await Promise.all([
        argusService.getAlertHistory(projectId, { limit: 50 }),
        argusService.getAlertStats(projectId, 7),
      ]);
      setHistory(h);
      setStats(s);
    } catch (e) {
      console.error(e);
    }
  }, [projectId]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  useEffect(() => {
    if (!projectId) return;
    argusService
      .getFilterOptions(projectId)
      .then((opts) => setAvailableEnvironments(opts.environments || []))
      .catch(() => {});
  }, [projectId]);

  // ─── Filtered Rules ───
  const filteredRules = useMemo(() => {
    if (!searchQuery.trim()) return rules;
    const q = searchQuery.toLowerCase();
    return rules.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.environment && r.environment.toLowerCase().includes(q))
    );
  }, [rules, searchQuery]);

  // ─── Bulk Actions ───
  const toggleSelectRule = useCallback((id: number) => {
    setSelectedRules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedRules.size === filteredRules.length) {
      setSelectedRules(new Set());
    } else {
      setSelectedRules(new Set(filteredRules.map((r) => r.id)));
    }
  }, [selectedRules.size, filteredRules]);

  const handleBulkToggle = useCallback(
    async (enable: boolean) => {
      if (!projectId) return;
      try {
        await Promise.all(
          Array.from(selectedRules).map((id) =>
            argusService.updateAlertRule(projectId, id, {
              enabled: enable,
            } as any)
          )
        );
        fetchRules();
        setSelectedRules(new Set());
        enqueueSnackbar(t('argus.alerts.bulkUpdated'), { variant: 'success' });
      } catch {
        enqueueSnackbar(t('common.error'), { variant: 'error' });
      }
    },
    [projectId, selectedRules, fetchRules, enqueueSnackbar, t]
  );

  const handleBulkDelete = useCallback(async () => {
    if (!projectId) return;
    try {
      await Promise.all(
        Array.from(selectedRules).map((id) =>
          argusService.deleteAlertRule(projectId, id)
        )
      );
      fetchRules();
      setSelectedRules(new Set());
      enqueueSnackbar(t('argus.alerts.bulkDeleted'), { variant: 'success' });
    } catch {
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  }, [projectId, selectedRules, fetchRules, enqueueSnackbar, t]);

  // ─── CRUD Handlers ───
  const openCreate = useCallback(() => {
    setEditingRule(null);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((rule: ArgusAlertRule) => {
    setEditingRule(rule);
    setDialogOpen(true);
  }, []);

  const openDuplicate = useCallback((rule: ArgusAlertRule) => {
    // Create a fake "editing" rule with modified name but null id
    setEditingRule({
      ...rule,
      id: 0 as any, // signals "create" mode
      name: `${rule.name} (Copy)`,
    });
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(
    async (data: {
      name: string;
      description: string;
      conditions: ArgusAlertCondition[];
      actions: ArgusAlertAction[];
      frequency: number;
      environment: string;
      level: string;
      tags: Record<string, string>;
      conditionLogic: 'any' | 'all';
    }) => {
      if (!projectId) return;
      // Validation
      if (!data.name.trim()) {
        enqueueSnackbar(t('argus.alerts.validationNameRequired'), {
          variant: 'warning',
        });
        return;
      }
      if (data.conditions.length === 0) {
        enqueueSnackbar(t('argus.alerts.validationConditionRequired'), {
          variant: 'warning',
        });
        return;
      }
      if (data.actions.length === 0) {
        enqueueSnackbar(t('argus.alerts.validationActionRequired'), {
          variant: 'warning',
        });
        return;
      }
      const invalidWebhook = data.actions.find(
        (a) =>
          a.type === 'webhook' &&
          (!a.target_url || !a.target_url.startsWith('http'))
      );
      if (invalidWebhook) {
        enqueueSnackbar(
          t('argus.alerts.validationWebhookUrl') || 'Invalid Webhook URL',
          { variant: 'warning' }
        );
        return;
      }
      const invalidSlack = data.actions.find(
        (a) =>
          (a.type === 'slack' || a.type === 'jira' || a.type === 'linear') &&
          !a.channel?.trim()
      );
      if (invalidSlack) {
        enqueueSnackbar('Channel or Project Key is required', {
          variant: 'warning',
        });
        return;
      }
      const invalidEmail = data.actions.find(
        (a) =>
          a.type === 'email' && (!a.target_url || !a.target_url.includes('@'))
      );
      if (invalidEmail) {
        enqueueSnackbar('Valid email address is required', {
          variant: 'warning',
        });
        return;
      }
      const invalidPagerDuty = data.actions.find(
        (a) => a.type === 'pagerduty' && !a.target_url?.trim()
      );
      if (invalidPagerDuty) {
        enqueueSnackbar('Integration Key is required for PagerDuty', {
          variant: 'warning',
        });
        return;
      }
      try {
        if (editingRule && editingRule.id) {
          await argusService.updateAlertRule(projectId, editingRule.id, {
            name: data.name,
            description: data.description || undefined,
            conditions: data.conditions,
            actions: data.actions,
            frequency: data.frequency,
            environment: data.environment || undefined,
            level: data.level || undefined,
            tags:
              Object.keys(data.tags).length > 0 ? data.tags : undefined,
            condition_logic: data.conditionLogic,
          } as any);
        } else {
          await argusService.createAlertRule(projectId, {
            name: data.name,
            description: data.description || undefined,
            conditions: data.conditions,
            actions: data.actions,
            frequency: data.frequency,
            project_id: Number(projectId),
            enabled: true,
            environment: data.environment || undefined,
            level: data.level || undefined,
            tags:
              Object.keys(data.tags).length > 0 ? data.tags : undefined,
            condition_logic: data.conditionLogic,
          } as any);
        }
        setDialogOpen(false);
        fetchRules();
        enqueueSnackbar(t('argus.alerts.saved'), { variant: 'success' });
      } catch (e) {
        console.error(e);
        enqueueSnackbar(t('argus.alerts.saveFailed'), { variant: 'error' });
      }
    },
    [projectId, editingRule, fetchRules, enqueueSnackbar, t]
  );

  const handleToggle = useCallback(
    async (rule: ArgusAlertRule) => {
      if (!projectId) return;
      try {
        await argusService.updateAlertRule(projectId, rule.id, {
          enabled: !rule.enabled,
        } as any);
        fetchRules();
        enqueueSnackbar(
          rule.enabled
            ? t('argus.alerts.disabled')
            : t('argus.alerts.enabled'),
          { variant: 'info' }
        );
      } catch (e) {
        console.error(e);
        enqueueSnackbar(t('common.error'), { variant: 'error' });
      }
    },
    [projectId, fetchRules, enqueueSnackbar, t]
  );

  const handleDelete = useCallback(
    async (ruleId: number) => {
      if (!projectId) return;
      try {
        await argusService.deleteAlertRule(projectId, ruleId);
        setDeleteConfirm(null);
        fetchRules();
        enqueueSnackbar(t('argus.alerts.deleted'), { variant: 'success' });
      } catch (e) {
        console.error(e);
        enqueueSnackbar(t('argus.alerts.deleteFailed'), { variant: 'error' });
      }
    },
    [projectId, fetchRules, enqueueSnackbar, t]
  );

  const handleTest = useCallback(
    async (ruleId: number) => {
      if (!projectId) return;
      try {
        await argusService.testAlertRule(projectId, ruleId);
        enqueueSnackbar(t('argus.alerts.testSent'), { variant: 'success' });
      } catch (e) {
        console.error(e);
        enqueueSnackbar(t('argus.alerts.testFailed'), { variant: 'error' });
      }
    },
    [projectId, enqueueSnackbar, t]
  );

  const handleMute = useCallback(
    async (durationSeconds: number) => {
      if (!projectId || !muteDialogRule) return;
      try {
        const mutedUntil = new Date(
          Date.now() + durationSeconds * 1000
        ).toISOString();
        await argusService.updateAlertRule(projectId, muteDialogRule.id, {
          muted_until: mutedUntil,
        } as any);
        fetchRules();
        setMuteDialogRule(null);
        enqueueSnackbar(t('argus.alerts.muted'), { variant: 'info' });
      } catch {
        enqueueSnackbar(t('common.error'), { variant: 'error' });
      }
    },
    [projectId, muteDialogRule, fetchRules, enqueueSnackbar, t]
  );

  const handleHistoryToggle = useCallback(() => {
    setShowHistory((prev) => {
      if (!prev) fetchHistory();
      return !prev;
    });
  }, [fetchHistory]);

  /* ═══ RENDER ═══ */
  return (
    <Box>
      {/* Header */}
      <PageHeader
        icon={<AlertIcon />}
        title={
          <ArgusBreadcrumbs
            size="title"
            paths={[{ label: t('argus.alerts.title', 'Alerts') }]}
          />
        }
        subtitle={
          rules.length > 0
            ? t('argus.alerts.activeCount', {
                active: rules.filter((r) => r.enabled).length,
                total: rules.length,
              })
            : undefined
        }
        actions={
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<HistoryIcon sx={{ fontSize: 16 }} />}
              onClick={handleHistoryToggle}
              sx={{
                textTransform: 'none',
                fontSize: '0.78rem',
                borderRadius: 1.5,
              }}
            >
              {t('argus.alerts.history')}
            </Button>
            {rules.length > 0 && (
              <Button
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={openCreate}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  borderRadius: 1.5,
                }}
              >
                {t('argus.alerts.createRule')}
              </Button>
            )}
          </Box>
        }
      />

      <PageContentLoader loading={loading} skeleton={<ListSkeleton rows={5} />}>
        {rules.length === 0 ? (
          <EmptyPlaceholder
            message={t('argus.alerts.noRules')}
            description={t('argus.alerts.noRulesDesc')}
            onAddClick={openCreate}
            addButtonLabel={t('argus.alerts.createFirstRule')}
          />
        ) : (
          <AlertRuleList
            rules={rules}
            filteredRules={filteredRules}
            stats={stats}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedRules={selectedRules}
            onToggleSelectRule={toggleSelectRule}
            onToggleSelectAll={toggleSelectAll}
            onToggle={handleToggle}
            onEdit={openEdit}
            onDuplicate={openDuplicate}
            onTest={handleTest}
            onDelete={setDeleteConfirm}
            onMute={setMuteDialogRule}
            onBulkToggle={handleBulkToggle}
            onBulkDelete={handleBulkDelete}
          />
        )}

        {/* History Panel */}
        <AlertRuleHistoryPanel
          show={showHistory}
          history={history}
          stats={stats}
          rules={rules}
          isDark={isDark}
          filterRuleId={historyFilterRule}
          onFilterChange={setHistoryFilterRule}
        />
      </PageContentLoader>

      {/* Editor Dialog */}
      <AlertRuleEditorDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editingRule={editingRule}
        isDark={isDark}
        availableEnvironments={availableEnvironments}
        onSave={handleSave}
      />

      {/* Delete Confirmation */}
      <DeleteConfirmDialog
        open={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
      />

      {/* Mute Dialog */}
      <MuteDialog
        open={muteDialogRule !== null}
        ruleName={muteDialogRule?.name || ''}
        onClose={() => setMuteDialogRule(null)}
        onConfirm={handleMute}
      />
    </Box>
  );
};

export default ArgusAlertRulesPage;
