import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  alpha,
  Chip,
  InputAdornment,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  DragIndicator as DragIcon,
  LocalOffer as TagIcon,
} from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import {
  ArgusAlertRule,
  ArgusAlertCondition,
  ArgusAlertAction,
} from '@/services/argusService';
import {
  getConditionTypes,
  getActionTypes,
  getIntervals,
  getFrequencies,
} from './alertRuleConfigs';
import {
  StepBadge,
  StepPaper,
  StepLabel,
  ConnectorLine,
  CardRow,
  DragHandle,
  CardIconBox,
  EditorDialogTitle,
  EditorDialogActions,
  LogicToggleGroup,
  LogicToggleButton,
  AddItemButton,
  TagFilterChip,
} from './AlertRuleEditorDialog.styles';

// ─── Step Card ───

const StepCard: React.FC<{
  step: string;
  label: string;
  color: string;
  isDark: boolean;
  children: React.ReactNode;
}> = ({ step, label, color, isDark, children }) => (
  <Box sx={{ position: 'relative' }}>
    <StepBadge badgeColor={color}>{step}</StepBadge>
    <StepPaper elevation={0} isDark={isDark} accentColor={color}>
      <StepLabel variant="caption">{label}</StepLabel>
      {children}
    </StepPaper>
  </Box>
);

// ─── Step Connector ───

const StepConnector: React.FC = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
    <ConnectorLine />
  </Box>
);

// ─── Condition Card ───

const ConditionCard: React.FC<{
  id: string;
  cond: ArgusAlertCondition;
  isDark: boolean;
  onChange: (c: ArgusAlertCondition) => void;
  onRemove: () => void;
}> = ({ id, cond, isDark, onChange, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const { t } = useTranslation();
  const conditionTypes = getConditionTypes(t);
  const intervals = getIntervals(t);
  const config = conditionTypes.find((c) => c.value === cond.type);
  const isMetric = ['project_error_rate'].includes(cond.type);
  const needsThreshold = [
    'event_frequency',
    'user_count',
    'project_error_rate',
  ].includes(cond.type);

  return (
    <CardRow
      ref={setNodeRef}
      style={style}
      isDark={isDark}
    >
      <DragHandle {...attributes} {...listeners}>
        <DragIcon sx={{ fontSize: 18 }} />
      </DragHandle>
      <CardIconBox accentColor={config?.color || '#9e9e9e'}>
        {config?.icon}
      </CardIconBox>
      <Box sx={{ flex: 1 }}>
        <FormControl size="small" fullWidth sx={{ mb: needsThreshold ? 1 : 0 }}>
          <Select
            value={cond.type}
            onChange={(e) => onChange({ ...cond, type: e.target.value as any })}
            sx={{
              fontSize: '0.82rem',
              fontWeight: 600,
              '& .MuiSelect-select': { py: 0.6 },
            }}
          >
            {conditionTypes.map((c) => (
              <MenuItem key={c.value} value={c.value} sx={{ fontSize: '0.82rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ color: c.color }}>{c.icon}</Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                      {c.label}
                    </Typography>
                    <Typography sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>
                      {c.desc}
                    </Typography>
                  </Box>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {needsThreshold && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              type="number"
              label={t('argus.alerts.threshold')}
              value={cond.value || 10}
              onChange={(e) =>
                onChange({ ...cond, value: Number(e.target.value) })
              }
              sx={{
                width: 100,
                '& .MuiOutlinedInput-root': { fontSize: '0.82rem' },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment
                    position="start"
                    sx={{ '& .MuiTypography-root': { fontSize: '0.72rem' } }}
                  >
                    {isMetric ? '%' : '≥'}
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel sx={{ fontSize: '0.75rem' }}>
                {t('argus.alerts.interval')}
              </InputLabel>
              <Select
                value={cond.interval || 3600}
                label={t('argus.alerts.interval')}
                onChange={(e) =>
                  onChange({ ...cond, interval: Number(e.target.value) })
                }
                sx={{ fontSize: '0.82rem' }}
              >
                {intervals.map((i) => (
                  <MenuItem key={i.value} value={i.value} sx={{ fontSize: '0.82rem' }}>
                    {i.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}

        {cond.type === 'property_match' && (
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <Select
                value={cond.property || 'platform'}
                onChange={(e) => onChange({ ...cond, property: e.target.value })}
                sx={{ fontSize: '0.82rem', '& .MuiSelect-select': { py: 0.6 } }}
              >
                <MenuItem value="platform" sx={{ fontSize: '0.82rem' }}>Platform</MenuItem>
                <MenuItem value="url" sx={{ fontSize: '0.82rem' }}>URL</MenuItem>
                <MenuItem value="release" sx={{ fontSize: '0.82rem' }}>Release</MenuItem>
                <MenuItem value="environment" sx={{ fontSize: '0.82rem' }}>Environment</MenuItem>
                <MenuItem value="level" sx={{ fontSize: '0.82rem' }}>Level</MenuItem>
                <MenuItem value="transaction" sx={{ fontSize: '0.82rem' }}>Transaction</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <Select
                value={cond.operator || 'equals'}
                onChange={(e) => onChange({ ...cond, operator: e.target.value })}
                sx={{ fontSize: '0.82rem', '& .MuiSelect-select': { py: 0.6 } }}
              >
                <MenuItem value="equals" sx={{ fontSize: '0.82rem' }}>Equals</MenuItem>
                <MenuItem value="not_equals" sx={{ fontSize: '0.82rem' }}>Not Equals</MenuItem>
                <MenuItem value="contains" sx={{ fontSize: '0.82rem' }}>Contains</MenuItem>
                <MenuItem value="starts_with" sx={{ fontSize: '0.82rem' }}>Starts with</MenuItem>
                <MenuItem value="ends_with" sx={{ fontSize: '0.82rem' }}>Ends with</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              sx={{
                flex: 1,
                '& .MuiOutlinedInput-root': { fontSize: '0.82rem' },
              }}
              placeholder="Value"
              value={cond.value || ''}
              onChange={(e) => onChange({ ...cond, value: e.target.value })}
            />
          </Box>
        )}
      </Box>
      <IconButton
        size="small"
        onClick={onRemove}
        sx={{ mt: 0.5, color: 'text.disabled' }}
      >
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </CardRow>
  );
};

const ActionCard: React.FC<{
  id: string;
  action: ArgusAlertAction;
  isDark: boolean;
  onChange: (a: ArgusAlertAction) => void;
  onRemove: () => void;
}> = ({ id, action, isDark, onChange, onRemove }) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const { t } = useTranslation();
  const actionTypes = getActionTypes(t);
  const config = actionTypes.find((a) => a.value === action.type);

  return (
    <CardRow
      ref={setNodeRef}
      style={style}
      isDark={isDark}
    >
      <DragHandle {...attributes} {...listeners}>
        <DragIcon sx={{ fontSize: 18 }} />
      </DragHandle>
      <CardIconBox accentColor={config?.color || '#9e9e9e'}>
        {config?.icon}
      </CardIconBox>
      <Box sx={{ flex: 1 }}>
        <FormControl
          size="small"
          fullWidth
          sx={{ mb: action.type !== 'slack' ? 1 : 0 }}
        >
          <Select
            value={action.type}
            onChange={(e) =>
              onChange({ ...action, type: e.target.value as any })
            }
            sx={{
              fontSize: '0.82rem',
              fontWeight: 600,
              '& .MuiSelect-select': { py: 0.6 },
            }}
          >
            {actionTypes.map((a) => (
              <MenuItem key={a.value} value={a.value} sx={{ fontSize: '0.82rem' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ color: a.color }}>{a.icon}</Box> {a.label}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {(action.type === 'webhook' ||
          action.type === 'email' ||
          action.type === 'slack' ||
          action.type === 'jira' ||
          action.type === 'linear' ||
          action.type === 'pagerduty') &&
          (action.type === 'slack' ? (
            <TextField
              size="small"
              fullWidth
              placeholder="e.g. #general, #alerts"
              value={action.channel || ''}
              onChange={(e) => onChange({ ...action, channel: e.target.value })}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } }}
            />
          ) : action.type === 'jira' || action.type === 'linear' ? (
            <TextField
              size="small"
              fullWidth
              placeholder="Project Key (e.g. ENG, GAT)"
              value={action.channel || ''}
              onChange={(e) => onChange({ ...action, channel: e.target.value })}
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } }}
            />
          ) : action.type === 'pagerduty' ? (
            <TextField
              size="small"
              fullWidth
              placeholder="Integration Key"
              value={action.target_url || ''}
              onChange={(e) =>
                onChange({ ...action, target_url: e.target.value })
              }
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } }}
            />
          ) : (
            <TextField
              size="small"
              fullWidth
              placeholder={
                action.type === 'webhook'
                  ? 'https://hooks.slack.com/services/...'
                  : 'admin@example.com'
              }
              value={action.target_url || ''}
              onChange={(e) =>
                onChange({ ...action, target_url: e.target.value })
              }
              sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } }}
            />
          ))}
      </Box>
      <IconButton
        size="small"
        onClick={onRemove}
        sx={{ mt: 0.5, color: 'text.disabled' }}
      >
        <CloseIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </CardRow>
  );
};

// ─── Editor Dialog ───

interface AlertRuleEditorDialogProps {
  open: boolean;
  onClose: () => void;
  editingRule: ArgusAlertRule | null;
  isDark: boolean;
  availableEnvironments: string[];
  onSave: (data: {
    name: string;
    description: string;
    conditions: ArgusAlertCondition[];
    actions: ArgusAlertAction[];
    frequency: number;
    environment: string;
    level: string;
    tags: Record<string, string>;
    conditionLogic: 'any' | 'all';
  }) => void;
}

const AlertRuleEditorDialog: React.FC<AlertRuleEditorDialogProps> = ({
  open,
  onClose,
  editingRule,
  isDark,
  availableEnvironments,
  onSave,
}) => {
  const { t } = useTranslation();

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formConditions, setFormConditions] = useState<ArgusAlertCondition[]>([
    { type: 'new_issue' },
  ]);
  const [formActions, setFormActions] = useState<ArgusAlertAction[]>([
    { type: 'webhook', target_url: '' },
  ]);
  const [formFrequency, setFormFrequency] = useState(300);
  const [formEnvironment, setFormEnvironment] = useState('');
  const [formLevel, setFormLevel] = useState('');
  const [formTags, setFormTags] = useState<Record<string, string>>({});
  const [formConditionLogic, setFormConditionLogic] = useState<'any' | 'all'>(
    'any'
  );
  const [newTagKey, setNewTagKey] = useState('');
  const [newTagValue, setNewTagValue] = useState('');

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Reset form on open
  React.useEffect(() => {
    if (!open) return;
    if (editingRule) {
      setFormName(editingRule.name);
      setFormDescription(editingRule.description || '');
      setFormConditions(
        typeof editingRule.conditions === 'string'
          ? JSON.parse(editingRule.conditions)
          : editingRule.conditions
      );
      setFormActions(
        typeof editingRule.actions === 'string'
          ? JSON.parse(editingRule.actions)
          : editingRule.actions
      );
      setFormFrequency(editingRule.frequency);
      setFormEnvironment(editingRule.environment || '');
      setFormLevel(editingRule.level || '');
      setFormTags(
        typeof editingRule.tags === 'string'
          ? JSON.parse(editingRule.tags)
          : editingRule.tags || {}
      );
      setFormConditionLogic(
        (editingRule as any).condition_logic || 'any'
      );
    } else {
      setFormName('');
      setFormDescription('');
      setFormConditions([{ type: 'new_issue' }]);
      setFormActions([{ type: 'webhook', target_url: '' }]);
      setFormFrequency(300);
      setFormEnvironment('');
      setFormLevel('');
      setFormTags({});
      setFormConditionLogic('any');
    }
    setNewTagKey('');
    setNewTagValue('');
  }, [open, editingRule]);

  const handleConditionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = formConditions.findIndex(
      (_, i) => `cond-${i}` === active.id
    );
    const newIndex = formConditions.findIndex(
      (_, i) => `cond-${i}` === over.id
    );
    if (oldIndex !== -1 && newIndex !== -1) {
      setFormConditions(arrayMove(formConditions, oldIndex, newIndex));
    }
  };

  const handleActionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = formActions.findIndex((_, i) => `act-${i}` === active.id);
    const newIndex = formActions.findIndex((_, i) => `act-${i}` === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      setFormActions(arrayMove(formActions, oldIndex, newIndex));
    }
  };

  const handleSave = () => {
    onSave({
      name: formName,
      description: formDescription,
      conditions: formConditions,
      actions: formActions,
      frequency: formFrequency,
      environment: formEnvironment,
      level: formLevel,
      tags: formTags,
      conditionLogic: formConditionLogic,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, maxHeight: '85vh' } }}
    >
      <EditorDialogTitle isDark={isDark}>
        <Box>
          {editingRule
            ? t('argus.alerts.editRule')
            : t('argus.alerts.createRule')}
          <Typography
            variant="body2"
            sx={{
              fontSize: '0.75rem',
              color: 'text.secondary',
              fontWeight: 400,
              mt: 1,
            }}
          >
            {t('argus.alerts.createRuleSubtitle')}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </EditorDialogTitle>

      <DialogContent sx={{ pt: '24px !important', overflow: 'auto' }}>
        {/* Rule Name */}
        <TextField
          fullWidth
          size="small"
          label={t('argus.alerts.ruleName')}
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder={t('argus.alerts.ruleNamePlaceholder')}
          sx={{
            mb: 1.5,
            '& .MuiOutlinedInput-root': {
              fontSize: '0.88rem',
              fontWeight: 600,
            },
          }}
        />

        {/* Description */}
        <TextField
          fullWidth
          size="small"
          label={t('argus.alerts.ruleDescription')}
          value={formDescription}
          onChange={(e) => setFormDescription(e.target.value)}
          placeholder={t('argus.alerts.ruleDescriptionPlaceholder')}
          multiline
          minRows={2}
          maxRows={4}
          sx={{ mb: 3, '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } }}
        />

        {/* IF Step */}
        <StepCard
          step={t('argus.alerts.stepIf')}
          label={t('argus.alerts.conditionsDesc')}
          color="#f44336"
          isDark={isDark}
        >
          {formConditions.length > 1 && (
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}
            >
              <Typography
                sx={{ fontSize: '0.72rem', color: 'text.secondary' }}
              >
                {t('argus.alerts.conditionMatchLabel')}
              </Typography>
              <LogicToggleGroup isDark={isDark}>
                {(['any', 'all'] as const).map((logic) => (
                  <LogicToggleButton
                    key={logic}
                    size="small"
                    variant={
                      formConditionLogic === logic ? 'contained' : 'text'
                    }
                    isActive={formConditionLogic === logic}
                    onClick={() => setFormConditionLogic(logic)}
                  >
                    {t(
                      `argus.alerts.conditionLogic${logic === 'any' ? 'Any' : 'All'}`
                    )}
                  </LogicToggleButton>
                ))}
              </LogicToggleGroup>
            </Box>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleConditionDragEnd}
            >
              <SortableContext
                items={formConditions.map((_, i) => `cond-${i}`)}
                strategy={verticalListSortingStrategy}
              >
                {formConditions.map((cond, i) => (
                  <ConditionCard
                    key={`cond-${i}`}
                    id={`cond-${i}`}
                    cond={cond}
                    isDark={isDark}
                    onChange={(c) => {
                      const next = [...formConditions];
                      next[i] = c;
                      setFormConditions(next);
                    }}
                    onRemove={() =>
                      setFormConditions(
                        formConditions.filter((_, j) => j !== i)
                      )
                    }
                  />
                ))}
              </SortableContext>
            </DndContext>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() =>
                setFormConditions([...formConditions, { type: 'new_issue' }])
              }
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                alignSelf: 'flex-start',
                mt: 0.5,
              }}
            >
              {t('argus.alerts.addCondition')}
            </Button>
          </Box>
        </StepCard>

        <StepConnector />

        {/* THEN Step */}
        <StepCard
          step={t('argus.alerts.stepThen')}
          label={t('argus.alerts.actionsDesc')}
          color="#4caf50"
          isDark={isDark}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleActionDragEnd}
            >
              <SortableContext
                items={formActions.map((_, i) => `act-${i}`)}
                strategy={verticalListSortingStrategy}
              >
                {formActions.map((action, i) => (
                  <ActionCard
                    key={`act-${i}`}
                    id={`act-${i}`}
                    action={action}
                    isDark={isDark}
                    onChange={(a) => {
                      const next = [...formActions];
                      next[i] = a;
                      setFormActions(next);
                    }}
                    onRemove={() =>
                      setFormActions(formActions.filter((_, j) => j !== i))
                    }
                  />
                ))}
              </SortableContext>
            </DndContext>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() =>
                setFormActions([
                  ...formActions,
                  { type: 'webhook', target_url: '' },
                ])
              }
              sx={{
                textTransform: 'none',
                fontSize: '0.75rem',
                alignSelf: 'flex-start',
                mt: 0.5,
              }}
            >
              {t('argus.alerts.addAction')}
            </Button>
          </Box>
        </StepCard>

        <StepConnector />

        {/* FILTERS Step */}
        <StepCard
          step={t('argus.alerts.stepFilters')}
          label={t('argus.alerts.filtersDesc')}
          color="#7c4dff"
          isDark={isDark}
        >
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel sx={{ fontSize: '0.75rem' }}>
                {t('argus.alerts.alertFreq')}
              </InputLabel>
              <Select
                value={formFrequency}
                onChange={(e) => setFormFrequency(Number(e.target.value))}
                label={t('argus.alerts.alertFreq')}
                sx={{ fontSize: '0.82rem' }}
              >
                {getFrequencies(t).map((f) => (
                  <MenuItem
                    key={f.value}
                    value={f.value}
                    sx={{ fontSize: '0.82rem' }}
                  >
                    {f.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Autocomplete
              size="small"
              freeSolo
              options={availableEnvironments}
              value={formEnvironment || null}
              onChange={(_, v) =>
                setFormEnvironment(typeof v === 'string' ? v : v || '')
              }
              onInputChange={(_, v) => setFormEnvironment(v)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('argus.alerts.environment')}
                  placeholder={t('argus.alerts.environmentPlaceholder')}
                  sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.82rem' } }}
                />
              )}
              sx={{ minWidth: 160 }}
            />
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel sx={{ fontSize: '0.75rem' }}>
                {t('argus.alerts.level')}
              </InputLabel>
              <Select
                value={formLevel}
                onChange={(e) => setFormLevel(e.target.value)}
                label={t('argus.alerts.level')}
                sx={{ fontSize: '0.82rem' }}
              >
                <MenuItem value="" sx={{ fontSize: '0.82rem' }}>
                  <em>{t('argus.alerts.allLevels')}</em>
                </MenuItem>
                <MenuItem value="fatal" sx={{ fontSize: '0.82rem' }}>
                  {t('argus.common.fatal')}
                </MenuItem>
                <MenuItem value="error" sx={{ fontSize: '0.82rem' }}>
                  {t('argus.common.error')}
                </MenuItem>
                <MenuItem value="warning" sx={{ fontSize: '0.82rem' }}>
                  {t('argus.common.warning')}
                </MenuItem>
              </Select>
            </FormControl>
          </Box>

          {/* Tag Filters */}
          <Box sx={{ mt: 2 }}>
            <Typography
              variant="caption"
              sx={{
                color: 'text.secondary',
                fontSize: '0.72rem',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                mb: 1,
              }}
            >
              <TagIcon sx={{ fontSize: 14 }} /> {t('argus.alerts.tagFilters')}
            </Typography>
            {Object.keys(formTags).length > 0 && (
              <Box
                sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}
              >
                {Object.entries(formTags).map(([k, v]) => (
                  <TagFilterChip
                    key={k}
                    label={`${k}: ${v}`}
                    size="small"
                    onDelete={() => {
                      const next = { ...formTags };
                      delete next[k];
                      setFormTags(next);
                    }}
                  />
                ))}
              </Box>
            )}
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <TextField
                size="small"
                placeholder={t('argus.alerts.tagKey')}
                value={newTagKey}
                onChange={(e) => setNewTagKey(e.target.value)}
                sx={{
                  width: 100,
                  '& .MuiOutlinedInput-root': { fontSize: '0.78rem' },
                }}
              />
              <Typography
                sx={{ color: 'text.disabled', fontSize: '0.78rem' }}
              >
                :
              </Typography>
              <TextField
                size="small"
                placeholder={t('argus.alerts.tagValue')}
                value={newTagValue}
                onChange={(e) => setNewTagValue(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    newTagKey.trim() &&
                    newTagValue.trim()
                  ) {
                    setFormTags({
                      ...formTags,
                      [newTagKey.trim()]: newTagValue.trim(),
                    });
                    setNewTagKey('');
                    setNewTagValue('');
                  }
                }}
                sx={{
                  width: 120,
                  '& .MuiOutlinedInput-root': { fontSize: '0.78rem' },
                }}
              />
              <Button
                size="small"
                disabled={!newTagKey.trim() || !newTagValue.trim()}
                onClick={() => {
                  setFormTags({
                    ...formTags,
                    [newTagKey.trim()]: newTagValue.trim(),
                  });
                  setNewTagKey('');
                  setNewTagValue('');
                }}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.72rem',
                  minWidth: 'auto',
                }}
              >
                +
              </Button>
            </Box>
          </Box>
        </StepCard>
      </DialogContent>

      <EditorDialogActions isDark={isDark}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={
            !formName ||
            formConditions.length === 0 ||
            formActions.length === 0
          }
          sx={{
            textTransform: 'none',
            fontWeight: 700,
          }}
        >
          {editingRule ? t('common.save') : t('argus.alerts.create')}
        </Button>
      </EditorDialogActions>
    </Dialog>
  );
};

export default AlertRuleEditorDialog;
