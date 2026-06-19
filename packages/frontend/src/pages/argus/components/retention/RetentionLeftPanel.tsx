import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  useTheme,
  Divider,
  IconButton,
  CircularProgress,
  Collapse,
  Menu,
  MenuItem,
} from '@mui/material';
import {
  PlayArrow as RunIcon,
  Close as CloseIcon,
  KeyboardArrowDown as ArrowDownIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  useRetentionStore,
  type EventCondition,
} from '@/hooks/useAnalyticsStore';
import { useSharedEventCatalog } from '@/pages/argus/hooks/useSharedEventCatalog';
import { renderLexiconIcon } from '@/utils/lexiconIcons';
import { useLocalizedLexicon } from '@/pages/argus/hooks/useLocalizedLexicon';
import { useLocalStorage } from '@/hooks/useLocalStorage';

import EventBlock from '../analytics/EventBlock';
import InlineSelect from '../analytics/InlineSelect';
import PropertyPicker from '../analytics/PropertyPicker';
import BreakdownSection from '../analytics/BreakdownSection';
import PropertyValueInput from '../analytics/PropertyValueInput';

interface RetentionLeftPanelProps {
  projectId: string;
  queryLoading: boolean;
  onRunQuery: () => void;
  onEditOption: (eventName: string, anchor: HTMLElement) => void;
}

export const RetentionLeftPanel: React.FC<RetentionLeftPanelProps> = ({
  projectId,
  queryLoading,
  onRunQuery,
  onEditOption,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  const OPERATORS = [
    { value: 'is', label: t('argus.analytics.op.is', 'is') },
    { value: 'is_not', label: t('argus.analytics.op.isNot', 'is not') },
    { value: 'contains', label: t('argus.analytics.op.contains', 'contains') },
    {
      value: 'not_contains',
      label: t('argus.analytics.op.notContains', 'does not contain'),
    },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'set', label: t('argus.analytics.op.isSet', 'is set') },
    { value: 'not_set', label: t('argus.analytics.op.isNotSet', 'is not set') },
  ];

  // ── Persisted Store State ──
  const cohortEvent = useRetentionStore((s) => s.cohortEvent);
  const setCohortEvent = useRetentionStore((s) => s.setCohortEvent);
  const returnEvent = useRetentionStore((s) => s.returnEvent);
  const setReturnEvent = useRetentionStore((s) => s.setReturnEvent);
  const retentionType = useRetentionStore((s) => s.retentionType);
  const setRetentionType = useRetentionStore((s) => s.setRetentionType);
  const criteria = useRetentionStore((s) => s.criteria);
  const setCriteria = useRetentionStore((s) => s.setCriteria);
  const measurement = useRetentionStore((s) => s.measurement);
  const setMeasurement = useRetentionStore((s) => s.setMeasurement);
  const measurementProperty = useRetentionStore((s) => s.measurementProperty);
  const setMeasurementProperty = useRetentionStore(
    (s) => s.setMeasurementProperty
  );
  const minFrequency = useRetentionStore((s) => s.minFrequency);
  const setMinFrequency = useRetentionStore((s) => s.setMinFrequency);
  const breakdownProperties = useRetentionStore((s) => s.breakdownProperties);
  const setBreakdownProperties = useRetentionStore(
    (s) => s.setBreakdownProperties
  );

  // ── Catalog & Localization ──
  const { availableEvents } = useSharedEventCatalog(projectId);
  const { localizeEventName: lfn, localizeEventDescription: lfd } =
    useLocalizedLexicon();

  const eventOptions = useMemo(
    () =>
      availableEvents.map((e) => ({
        value: e.name,
        label: lfn(e.name, e.display_name, e.is_reserved),
        icon: renderLexiconIcon(e.icon, 18, e.icon_color || undefined),
        meta: {
          eventKey: e.name,
          description: lfd(e.name, e.description, e.is_reserved) || undefined,
          category: e.category || undefined,
          count: e.count,
          isReserved: e.is_reserved,
        },
      })),
    [availableEvents, lfn, lfd]
  );

  const [settingsExpanded, setSettingsExpanded] = useLocalStorage<boolean>(
    'argus_retention_settings_expanded',
    false
  );

  const [menuAnchor, setMenuAnchor] = useState<{
    el: HTMLElement;
    target: 'cohort' | 'return';
  } | null>(null);

  const handleOpenMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>, target: 'cohort' | 'return') => {
      setMenuAnchor({ el: e.currentTarget, target });
    },
    []
  );
  const handleCloseMenu = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  // ── Condition handlers ──
  const handleAddCondition = useCallback(
    (target: 'cohort' | 'return') => {
      const event = target === 'cohort' ? cohortEvent : returnEvent;
      const setter = target === 'cohort' ? setCohortEvent : setReturnEvent;
      setter({
        ...event,
        conditions: [
          ...(event.conditions || []),
          { property: '', operator: 'is', value: '' },
        ],
      });
    },
    [cohortEvent, returnEvent, setCohortEvent, setReturnEvent]
  );

  const handleConditionChange = useCallback(
    (
      target: 'cohort' | 'return',
      condIndex: number,
      field: keyof EventCondition,
      value: string
    ) => {
      const event = target === 'cohort' ? cohortEvent : returnEvent;
      const setter = target === 'cohort' ? setCohortEvent : setReturnEvent;
      setter({
        ...event,
        conditions: event.conditions?.map((c, i) =>
          i === condIndex ? { ...c, [field]: value } : c
        ),
      });
    },
    [cohortEvent, returnEvent, setCohortEvent, setReturnEvent]
  );

  const handleRemoveCondition = useCallback(
    (target: 'cohort' | 'return', condIndex: number) => {
      const event = target === 'cohort' ? cohortEvent : returnEvent;
      const setter = target === 'cohort' ? setCohortEvent : setReturnEvent;
      setter({
        ...event,
        conditions: event.conditions?.filter((_, i) => i !== condIndex),
      });
    },
    [cohortEvent, returnEvent, setCohortEvent, setReturnEvent]
  );

  const renderConditions = (
    target: 'cohort' | 'return',
    event: typeof cohortEvent | typeof returnEvent
  ) => {
    if (!event.conditions || event.conditions.length === 0) return null;
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {event.conditions.map((cond, cIdx) => (
          <Box
            key={cIdx}
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 0.5,
              pl: 0.5,
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontSize: '0.7rem' }}
            >
              {t('argus.analytics.where', 'where')}
            </Typography>
            <PropertyPicker
              projectId={projectId}
              eventName={event.name}
              value={cond.property ? [cond.property] : []}
              onChange={(val) =>
                handleConditionChange(target, cIdx, 'property', val[0] || '')
              }
              emptyLabel={t('argus.analytics.property', 'Property')}
              highlightEmpty
              maxItems={1}
              variant="text"
            />
            <InlineSelect
              value={cond.operator}
              onChange={(val) =>
                handleConditionChange(target, cIdx, 'operator', val)
              }
              options={OPERATORS}
            />
            {!['set', 'not_set'].includes(cond.operator) && (
              <Box sx={{ flex: 1, minWidth: 60 }}>
                <PropertyValueInput
                  projectId={projectId}
                  property={cond.property}
                  value={cond.value}
                  onChange={(val) =>
                    handleConditionChange(target, cIdx, 'value', val)
                  }
                />
              </Box>
            )}
            <IconButton
              size="small"
              onClick={() => handleRemoveCondition(target, cIdx)}
              sx={{ p: 0.25, ml: 0.5, opacity: 0.6, '&:hover': { opacity: 1 } }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        ))}
        <Button
          size="small"
          onClick={() => handleAddCondition(target)}
          sx={{
            alignSelf: 'flex-start',
            textTransform: 'none',
            opacity: 0.7,
            pl: 0.5,
            py: 0,
            minWidth: 0,
            fontSize: '0.75rem',
          }}
        >
          {t('argus.analytics.filter', '+ Filter')}
        </Button>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Events */}
      <Box>
        <Typography
          variant="overline"
          sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}
        >
          {t('argus.analytics.cohortDefinition', 'Retention Behavior')}
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* Cohort Event */}
          <EventBlock indexLabel="A" color="#6366f1">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  minWidth: 0,
                  overflow: 'hidden',
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ minWidth: 48 }}
                >
                  {t('argus.analytics.first', 'First')}
                </Typography>
                <InlineSelect
                  value={cohortEvent.name}
                  onChange={(val) =>
                    setCohortEvent({ ...cohortEvent, name: val })
                  }
                  options={eventOptions}
                  emptyLabel={t('argus.analytics.selectEvent', 'Select Event')}
                  highlightEmpty
                  onEditOption={onEditOption}
                />
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenMenu(e, 'cohort');
                }}
                sx={{ opacity: 0.6, '&:hover': { opacity: 1 }, p: 0.25 }}
              >
                <MoreVertIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
            {renderConditions('cohort', cohortEvent)}
          </EventBlock>

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              my: -1,
            }}
          >
            {/* Dotted line top */}
            <Box
              sx={{
                width: 0,
                height: 14,
                borderLeft: `2px dashed ${isDark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)'}`,
              }}
            />
            {/* Arrow circle */}
            <Box
              sx={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: `2px solid ${isDark ? 'rgba(99,102,241,0.45)' : 'rgba(99,102,241,0.35)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'background.paper',
                zIndex: 2,
              }}
            >
              <ArrowDownIcon
                sx={{
                  fontSize: 14,
                  color: isDark
                    ? 'rgba(99,102,241,0.7)'
                    : 'rgba(99,102,241,0.5)',
                }}
              />
            </Box>
            {/* Dotted line bottom */}
            <Box
              sx={{
                width: 0,
                height: 14,
                borderLeft: `2px dashed ${isDark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)'}`,
              }}
            />
          </Box>

          {/* Return Event */}
          <EventBlock indexLabel="B" color="#10b981">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  minWidth: 0,
                  overflow: 'hidden',
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ minWidth: 48 }}
                >
                  {t('argus.analytics.return', 'Return')}
                </Typography>
                <InlineSelect
                  value={returnEvent.name}
                  onChange={(val) =>
                    setReturnEvent({ ...returnEvent, name: val })
                  }
                  options={eventOptions}
                  emptyLabel={t('argus.analytics.selectEvent', 'Select Event')}
                  highlightEmpty
                  onEditOption={onEditOption}
                />
              </Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenMenu(e, 'return');
                }}
                sx={{ opacity: 0.6, '&:hover': { opacity: 1 }, p: 0.25 }}
              >
                <MoreVertIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
            {renderConditions('return', returnEvent)}
          </EventBlock>
        </Box>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Settings */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Box
          onClick={() => setSettingsExpanded(!settingsExpanded)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            userSelect: 'none',
            '&:hover': { opacity: 0.8 },
            ml: 0.5,
          }}
        >
          <Typography
            variant="overline"
            sx={{ fontWeight: 700, color: 'text.secondary', mb: 0 }}
          >
            {t('argus.analytics.settings', 'Settings')}
          </Typography>
          <ArrowDownIcon
            sx={{
              fontSize: 16,
              color: 'text.secondary',
              transition: 'transform 0.2s',
              transform: settingsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            }}
          />
        </Box>

        <Collapse in={settingsExpanded} timeout={200}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              pt: 0.5,
            }}
          >
            {/* Retention Type */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ minWidth: 70, flexShrink: 0, fontSize: '0.75rem' }}
              >
                {t('argus.analytics.retentionType', 'Period')}
              </Typography>
              <InlineSelect
                value={retentionType}
                onChange={(val) => setRetentionType(val as any)}
                options={[
                  { value: 'day', label: t('argus.analytics.day', 'Day') },
                  { value: 'week', label: t('argus.analytics.week', 'Week') },
                  {
                    value: 'month',
                    label: t('argus.analytics.month', 'Month'),
                  },
                ]}
              />
            </Box>

            {/* Criteria */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ minWidth: 70, flexShrink: 0, fontSize: '0.75rem' }}
              >
                {t('argus.analytics.criteria', 'Criteria')}
              </Typography>
              <InlineSelect
                value={criteria}
                onChange={(val) => setCriteria(val as any)}
                options={[
                  {
                    value: 'on',
                    label: t('argus.analytics.criteriaOn', 'On (N-Day)'),
                  },
                  {
                    value: 'on_or_after',
                    label: t(
                      'argus.analytics.criteriaOnOrAfter',
                      'On or After'
                    ),
                  },
                ]}
              />
            </Box>

            {/* Measurement */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ minWidth: 70, flexShrink: 0, fontSize: '0.75rem' }}
              >
                {t('argus.analytics.measure', 'Measure')}
              </Typography>
              <InlineSelect
                value={measurement}
                onChange={(val) => setMeasurement(val as any)}
                options={[
                  {
                    value: 'retention_rate',
                    label: t('argus.analytics.retentionRate', 'Retention Rate'),
                  },
                  {
                    value: 'unique_users',
                    label: t('argus.analytics.uniqueUsers', 'Unique Users'),
                  },
                  {
                    value: 'property_sum',
                    label: t('argus.analytics.propertySum', 'Property Sum'),
                  },
                  {
                    value: 'property_avg',
                    label: t('argus.analytics.propertyAvg', 'Property Avg'),
                  },
                ]}
              />
            </Box>

            {/* Measurement property */}
            {['property_sum', 'property_avg'].includes(measurement) && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ minWidth: 70, flexShrink: 0, fontSize: '0.75rem' }}
                >
                  {t('argus.analytics.property', 'Property')}
                </Typography>
                <PropertyPicker
                  projectId={projectId}
                  eventName={returnEvent.name}
                  value={measurementProperty ? [measurementProperty] : []}
                  onChange={(val) => setMeasurementProperty(val[0] || '')}
                  emptyLabel={t(
                    'argus.analytics.selectProperty',
                    'Select Property'
                  )}
                  highlightEmpty
                  maxItems={1}
                />
              </Box>
            )}

            {/* Frequency */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ minWidth: 70, flexShrink: 0, fontSize: '0.75rem' }}
              >
                {t('argus.analytics.atLeast', 'At least')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <input
                  type="number"
                  value={minFrequency}
                  onChange={(e) =>
                    setMinFrequency(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  min={1}
                  max={100}
                  style={{
                    background: 'transparent',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                    borderRadius: 4,
                    color: 'inherit',
                    outline: 'none',
                    width: 48,
                    fontSize: '0.8rem',
                    fontFamily: 'inherit',
                    padding: '2px 6px',
                    textAlign: 'center',
                  }}
                />
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontSize: '0.75rem' }}
                >
                  {t('argus.analytics.times', 'times')}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Collapse>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Breakdown */}
      <BreakdownSection
        projectId={projectId}
        eventName={cohortEvent.name}
        value={breakdownProperties}
        onChange={setBreakdownProperties}
      />

      <Box sx={{ mt: 'auto', pt: 2 }}>
        <Button
          fullWidth
          variant="contained"
          size="small"
          startIcon={
            queryLoading ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <RunIcon />
            )
          }
          onClick={onRunQuery}
          disabled={queryLoading || !cohortEvent.name || !returnEvent.name}
          sx={{ borderRadius: 1.5, textTransform: 'none', px: 2 }}
        >
          {t('argus.analytics.runQuery', 'Run Query')}
        </Button>
      </Box>

      {menuAnchor && (
        <Menu
          anchorEl={menuAnchor.el}
          open={Boolean(menuAnchor)}
          onClose={handleCloseMenu}
          PaperProps={{
            sx: {
              maxHeight: 320,
              width: '24ch',
            },
          }}
        >
          <MenuItem
            onClick={() => {
              handleAddCondition(menuAnchor.target);
              handleCloseMenu();
            }}
            sx={{ fontSize: '0.8rem', py: 0.75 }}
          >
            {t('argus.analytics.addFilter', 'Add Filter')}
          </MenuItem>
        </Menu>
      )}
    </Box>
  );
};
