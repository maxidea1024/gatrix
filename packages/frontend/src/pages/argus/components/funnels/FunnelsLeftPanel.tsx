import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  useTheme,
  alpha,
  Divider,
  IconButton,
  Collapse,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as RunIcon,
  Close as CloseIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  KeyboardArrowDown as ArrowDownIcon,
  MoreVert as MoreVertIcon,
  FilterList as FilterListIcon,
  DeleteOutline as DeleteOutlineIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
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
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

import { useOrgProject } from '@/contexts/OrgProjectContext';
import { useLocalizedLexicon } from '@/pages/argus/hooks/useLocalizedLexicon';
import { renderLexiconIcon } from '@/utils/lexiconIcons';
import {
  useFunnelsStore,
  type EventCondition,
} from '@/hooks/useAnalyticsStore';
import { useGlobalAnalyticsFilter } from '@/hooks/useGlobalAnalyticsFilter';
import { useSharedEventCatalog } from '../../hooks/useSharedEventCatalog';

import EventBlock from '../analytics/EventBlock';
import InlineSelect from '../analytics/InlineSelect';
import PropertyPicker from '../analytics/PropertyPicker';
import BreakdownSection from '../analytics/BreakdownSection';
import PropertyValueInput from '../analytics/PropertyValueInput';
import QuickLexiconEditor from '../analytics/QuickLexiconEditor';

/* ─── Constants ─── */

export const FUNNEL_COLORS = [
  '#6366f1',
  '#818cf8',
  '#a5b4fc',
  '#c7d2fe',
  '#e0e7ff',
  '#eef2ff',
  '#f5f3ff',
  '#faf5ff',
  '#fdf4ff',
  '#fce7f3',
];

export const SEGMENT_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981'];

/* ─── Sortable Wrapper ─── */

const SortableStepWrapper: React.FC<{
  id: string;
  children: (props: {
    dragHandleProps: Record<string, any>;
    isDragging: boolean;
  }) => React.ReactNode;
}> = ({ id, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <Box ref={setNodeRef} style={style}>
      {children({
        dragHandleProps: { ...attributes, ...listeners },
        isDragging,
      })}
    </Box>
  );
};

/* ─── Component ─── */

interface FunnelsLeftPanelProps {
  queryLoading: boolean;
  onRunQuery: () => void;
}

export const FunnelsLeftPanel: React.FC<FunnelsLeftPanelProps> = ({
  queryLoading,
  onRunQuery,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

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

  const CONVERSION_WINDOWS = [
    { value: 300, label: t('argus.analytics.window5min', '5 minutes') },
    { value: 3600, label: t('argus.analytics.window1hour', '1 hour') },
    { value: 86400, label: t('argus.analytics.window1day', '1 day') },
    { value: 604800, label: t('argus.analytics.window7days', '7 days') },
    { value: 2592000, label: t('argus.analytics.window30days', '30 days') },
  ];

  // ── Persisted State (survives refresh) ──
  const steps = useFunnelsStore((s) => s.steps);
  const setSteps = useFunnelsStore((s) => s.setSteps);
  const conversionWindow = useFunnelsStore((s) => s.conversionWindow);
  const setConversionWindow = useFunnelsStore((s) => s.setConversionWindow);
  const ordering = useFunnelsStore((s) => s.ordering);
  const setOrdering = useFunnelsStore((s) => s.setOrdering);
  const counting = useFunnelsStore((s) => s.counting);
  const setCounting = useFunnelsStore((s) => s.setCounting);
  const holdConstant = useFunnelsStore((s) => s.holdConstant);
  const setHoldConstant = useFunnelsStore((s) => s.setHoldConstant);
  const breakdownProperties = useFunnelsStore((s) => s.breakdownProperties);
  const setBreakdownProperties = useFunnelsStore(
    (s) => s.setBreakdownProperties
  );
  const exclusionSteps = useFunnelsStore((s) => s.exclusionSteps);
  const setExclusionSteps = useFunnelsStore((s) => s.setExclusionSteps);
  const segments = useFunnelsStore((s) => s.segments);
  const setSegments = useFunnelsStore((s) => s.setSegments);
  const compareMode = useFunnelsStore((s) => s.compareMode);
  const setCompareMode = useFunnelsStore((s) => s.setCompareMode);

  // ── Shared Event Catalog ──
  const { availableEvents, refetch: refetchEvents } =
    useSharedEventCatalog(projectId);

  // ── Transient State ──
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{
    el: HTMLElement;
    idx: number;
  } | null>(null);

  const handleOpenMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>, idx: number) => {
      setMenuAnchor({ el: e.currentTarget, idx });
    },
    []
  );

  const handleCloseMenu = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  // Quick lexicon editor state
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickEditAnchor, setQuickEditAnchor] = useState<HTMLElement | null>(
    null
  );
  const [quickEditEventName, setQuickEditEventName] = useState('');

  // ── Event handlers ──
  const handleAddStep = useCallback(() => {
    if (steps.length < 10) setSteps([...steps, { name: '' }]);
  }, [steps, setSteps]);

  const handleRemoveStep = useCallback(
    (index: number) => {
      setSteps(steps.filter((_, i) => i !== index));
    },
    [steps, setSteps]
  );

  const handleStepChange = useCallback(
    (index: number, value: string) => {
      setSteps(steps.map((s, i) => (i === index ? { ...s, name: value } : s)));
    },
    [steps, setSteps]
  );

  // ── DnD ──
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const stepIds = useMemo(() => steps.map((_, i) => `step-${i}`), [steps]);
  const handleStepDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = stepIds.indexOf(String(active.id));
        const newIndex = stepIds.indexOf(String(over.id));
        setSteps(arrayMove(steps, oldIndex, newIndex));
      }
    },
    [steps, stepIds, setSteps]
  );

  const handleAddCondition = useCallback(
    (stepIndex: number) => {
      setSteps(
        steps.map((s, i) => {
          if (i === stepIndex) {
            const conditions = s.conditions || [];
            return {
              ...s,
              conditions: [
                ...conditions,
                { property: '', operator: 'is', value: '' },
              ],
            };
          }
          return s;
        })
      );
    },
    [steps, setSteps]
  );

  const handleConditionChange = useCallback(
    (
      stepIndex: number,
      condIndex: number,
      field: keyof EventCondition,
      value: string
    ) => {
      setSteps(
        steps.map((s, i) => {
          if (i === stepIndex && s.conditions) {
            const newConds = [...s.conditions];
            newConds[condIndex] = { ...newConds[condIndex], [field]: value };
            return { ...s, conditions: newConds };
          }
          return s;
        })
      );
    },
    [steps, setSteps]
  );

  const handleRemoveCondition = useCallback(
    (stepIndex: number, condIndex: number) => {
      setSteps(
        steps.map((s, i) => {
          if (i === stepIndex && s.conditions) {
            return {
              ...s,
              conditions: s.conditions.filter((_, ci) => ci !== condIndex),
            };
          }
          return s;
        })
      );
    },
    [steps, setSteps]
  );

  const handleAddHoldConstant = useCallback(() => {
    if (holdConstant.length < 3) {
      setHoldConstant([...holdConstant, '']);
    }
  }, [holdConstant, setHoldConstant]);

  const handleRemoveHoldConstant = useCallback(
    (index: number) => {
      setHoldConstant(holdConstant.filter((_, i) => i !== index));
    },
    [holdConstant, setHoldConstant]
  );

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

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Steps */}
      <Box>
        <Typography
          variant="overline"
          sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}
        >
          {t('argus.analytics.funnelSteps', 'Funnel Steps')}
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column' }}>
          <DndContext
            sensors={dndSensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleStepDragEnd}
          >
            <SortableContext
              items={stepIds}
              strategy={verticalListSortingStrategy}
            >
              {steps.map((step, idx) => (
                <SortableStepWrapper key={stepIds[idx]} id={stepIds[idx]}>
                  {({ dragHandleProps, isDragging }) => (
                    <>
                      {/* Connector: rendered above step (except first) */}
                      {idx > 0 && (
                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            pointerEvents: 'none',
                          }}
                        >
                          <Box
                            sx={{
                              width: 0,
                              height: 14,
                              borderLeft: `2px dashed ${isDark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)'}`,
                            }}
                          />
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
                          <Box
                            sx={{
                              width: 0,
                              height: 14,
                              borderLeft: `2px dashed ${isDark ? 'rgba(99,102,241,0.4)' : 'rgba(99,102,241,0.3)'}`,
                            }}
                          />
                        </Box>
                      )}

                      <EventBlock
                        indexLabel={String(idx + 1)}
                        color={FUNNEL_COLORS[idx % FUNNEL_COLORS.length]}
                        dragHandleProps={dragHandleProps}
                        isDragging={isDragging}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                          }}
                        >
                          <InlineSelect
                            value={step.name}
                            onChange={(val) => handleStepChange(idx, val)}
                            options={eventOptions}
                            emptyLabel={t(
                              'argus.analytics.selectEvent',
                              'Select Event'
                            )}
                            highlightEmpty
                            onEditOption={(val, anchor) => {
                              setQuickEditEventName(val);
                              setQuickEditAnchor(anchor);
                              setQuickEditOpen(true);
                            }}
                          />
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenMenu(e, idx);
                            }}
                            sx={{
                              opacity: 0.6,
                              '&:hover': { opacity: 1 },
                              p: 0.25,
                            }}
                          >
                            <MoreVertIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>

                        {/* Conditions */}
                        {step.conditions && step.conditions.length > 0 && (
                          <Box
                            sx={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 0.5,
                            }}
                          >
                            {step.conditions.map((cond, cIdx) => (
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
                                  eventName={step.name}
                                  value={cond.property ? [cond.property] : []}
                                  onChange={(val) =>
                                    handleConditionChange(
                                      idx,
                                      cIdx,
                                      'property',
                                      val[0] || ''
                                    )
                                  }
                                  emptyLabel={t(
                                    'argus.analytics.property',
                                    'Property'
                                  )}
                                  highlightEmpty
                                  maxItems={1}
                                  variant="text"
                                />
                                <InlineSelect
                                  value={cond.operator}
                                  onChange={(val) =>
                                    handleConditionChange(
                                      idx,
                                      cIdx,
                                      'operator',
                                      val
                                    )
                                  }
                                  options={OPERATORS}
                                />
                                {!['set', 'not_set'].includes(
                                  cond.operator
                                ) && (
                                  <Box sx={{ flex: 1, minWidth: 60 }}>
                                    <PropertyValueInput
                                      projectId={projectId}
                                      property={cond.property}
                                      value={cond.value}
                                      onChange={(val) =>
                                        handleConditionChange(
                                          idx,
                                          cIdx,
                                          'value',
                                          val
                                        )
                                      }
                                    />
                                  </Box>
                                )}
                                <IconButton
                                  size="small"
                                  onClick={() =>
                                    handleRemoveCondition(idx, cIdx)
                                  }
                                  sx={{
                                    p: 0.25,
                                    ml: 0.5,
                                    opacity: 0.6,
                                    '&:hover': { opacity: 1 },
                                  }}
                                >
                                  <CloseIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Box>
                            ))}
                            <Button
                              size="small"
                              onClick={() => handleAddCondition(idx)}
                              sx={{
                                alignSelf: 'flex-start',
                                textTransform: 'none',
                                opacity: 0.7,
                                pl: 0.5,
                                minWidth: 0,
                                fontSize: '0.75rem',
                                py: 0,
                              }}
                            >
                              {t('argus.analytics.filter', '+ Filter')}
                            </Button>
                          </Box>
                        )}
                      </EventBlock>
                    </>
                  )}
                </SortableStepWrapper>
              ))}
            </SortableContext>
          </DndContext>
          {steps.length < 10 && (
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddStep}
              sx={{
                alignSelf: 'flex-start',
                mt: 1,
                textTransform: 'none',
                borderRadius: 1.5,
              }}
            >
              {t('argus.analytics.addStep', 'Add Step')}
            </Button>
          )}
        </Box>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Advanced Settings (collapsible) */}
      <Box>
        <Button
          size="small"
          onClick={() => setShowAdvanced(!showAdvanced)}
          endIcon={showAdvanced ? <CollapseIcon /> : <ExpandIcon />}
          sx={{
            textTransform: 'none',
            color: 'text.secondary',
            fontWeight: 600,
            fontSize: '0.75rem',
            px: 0.5,
          }}
        >
          {t('argus.analytics.conversionCriteria', 'Conversion Criteria')}
        </Button>
        <Collapse in={showAdvanced}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              mt: 1,
              pl: 1.5,
            }}
          >
            {/* Conversion Window */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ minWidth: 60 }}
              >
                {t('argus.analytics.conversionWindow', 'Window')}
              </Typography>
              <InlineSelect
                value={String(conversionWindow)}
                onChange={(val) => setConversionWindow(Number(val))}
                options={CONVERSION_WINDOWS.map((w) => ({
                  value: String(w.value),
                  label: w.label,
                }))}
              />
            </Box>

            {/* Ordering */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ minWidth: 60 }}
              >
                {t('argus.analytics.ordering', 'Order')}
              </Typography>
              <InlineSelect
                value={ordering}
                onChange={(val) => setOrdering(val as any)}
                options={[
                  {
                    value: 'specific',
                    label: t('argus.analytics.specificOrder', 'Specific Order'),
                  },
                  {
                    value: 'any',
                    label: t('argus.analytics.anyOrder', 'Any Order'),
                  },
                ]}
              />
            </Box>

            {/* Counting */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ minWidth: 60 }}
              >
                {t('argus.analytics.counting', 'Count')}
              </Typography>
              <InlineSelect
                value={counting}
                onChange={(val) => setCounting(val as any)}
                options={[
                  {
                    value: 'uniques',
                    label: t('argus.analytics.uniques', 'Uniques'),
                  },
                  {
                    value: 'totals',
                    label: t('argus.analytics.totals', 'Totals'),
                  },
                ]}
              />
            </Box>

            {/* Hold Constant */}
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('argus.analytics.holdConstant', 'Hold Constant')}
              </Typography>
              {holdConstant.map((prop, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mt: 0.5,
                  }}
                >
                  <PropertyPicker
                    projectId={projectId}
                    value={prop ? [prop] : []}
                    onChange={(val) => {
                      setHoldConstant(
                        holdConstant.map((p, i) =>
                          i === idx ? val[0] || '' : p
                        )
                      );
                    }}
                    emptyLabel={t('argus.analytics.property', 'Property')}
                    highlightEmpty
                    maxItems={1}
                  />
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveHoldConstant(idx)}
                    sx={{ p: 0.25, opacity: 0.6 }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              ))}
              {holdConstant.length < 3 && (
                <Button
                  size="small"
                  onClick={handleAddHoldConstant}
                  sx={{
                    textTransform: 'none',
                    opacity: 0.7,
                    fontSize: '0.7rem',
                    py: 0,
                    mt: 0.5,
                  }}
                >
                  {t('argus.analytics.addProperty', '+ Add Property')}
                </Button>
              )}
            </Box>

            {/* Exclusion Steps */}
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('argus.analytics.excludeUsers', 'Exclude users who did')}
              </Typography>
              {exclusionSteps.map((es, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mt: 0.5,
                    flexWrap: 'wrap',
                  }}
                >
                  <InlineSelect
                    value={es.event_name}
                    onChange={(val) => {
                      setExclusionSteps(
                        exclusionSteps.map((e, i) =>
                          i === idx ? { ...e, event_name: val } : e
                        )
                      );
                    }}
                    options={availableEvents.map((e) => ({
                      value: e.name,
                      label: lfn(e.name, e.display_name, e.is_reserved),
                      icon: renderLexiconIcon(
                        e.icon,
                        18,
                        e.icon_color || undefined
                      ),
                      meta: {
                        eventKey: e.name,
                        description:
                          lfd(e.name, e.description, e.is_reserved) ||
                          undefined,
                        category: e.category || undefined,
                        count: e.count,
                        isReserved: e.is_reserved,
                      },
                    }))}
                    emptyLabel={t(
                      'argus.analytics.selectEvent',
                      'Select Event'
                    )}
                    highlightEmpty
                  />
                  <Typography variant="caption" color="text.secondary">
                    {t('argus.analytics.betweenSteps', 'between step')}
                  </Typography>
                  <InlineSelect
                    value={String(es.between[0])}
                    onChange={(val) => {
                      setExclusionSteps(
                        exclusionSteps.map((e, i) =>
                          i === idx
                            ? { ...e, between: [Number(val), e.between[1]] }
                            : e
                        )
                      );
                    }}
                    options={steps.map((s, si) => ({
                      value: String(si),
                      label: `${si + 1}. ${s.name || '...'}`,
                    }))}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {t('argus.analytics.and', 'and')}
                  </Typography>
                  <InlineSelect
                    value={String(es.between[1])}
                    onChange={(val) => {
                      setExclusionSteps(
                        exclusionSteps.map((e, i) =>
                          i === idx
                            ? { ...e, between: [e.between[0], Number(val)] }
                            : e
                        )
                      );
                    }}
                    options={steps.map((s, si) => ({
                      value: String(si),
                      label: `${si + 1}. ${s.name || '...'}`,
                    }))}
                  />
                  <IconButton
                    size="small"
                    onClick={() =>
                      setExclusionSteps(
                        exclusionSteps.filter((_, i) => i !== idx)
                      )
                    }
                    sx={{ p: 0.25, opacity: 0.6 }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              ))}
              {exclusionSteps.length < 5 && (
                <Button
                  size="small"
                  onClick={() =>
                    setExclusionSteps([
                      ...exclusionSteps,
                      {
                        event_name: '',
                        between: [0, Math.min(1, steps.length - 1)],
                      },
                    ])
                  }
                  sx={{
                    textTransform: 'none',
                    opacity: 0.7,
                    fontSize: '0.7rem',
                    py: 0,
                    mt: 0.5,
                  }}
                >
                  {t('argus.analytics.addExclusion', '+ Add Exclusion')}
                </Button>
              )}
            </Box>
          </Box>
        </Collapse>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Breakdown */}
      <BreakdownSection
        projectId={projectId}
        eventName={steps[0]?.name}
        value={breakdownProperties}
        onChange={setBreakdownProperties}
      />

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Segment Comparison */}
      <Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography
            variant="overline"
            sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}
          >
            {t('argus.analytics.compareSegments', 'Compare Segments')}
          </Typography>
          <Button
            size="small"
            onClick={() => setCompareMode(!compareMode)}
            sx={{
              textTransform: 'none',
              fontSize: '0.68rem',
              fontWeight: 600,
              color: compareMode ? 'primary.main' : 'text.disabled',
            }}
          >
            {compareMode ? t('common.on', 'ON') : t('common.off', 'OFF')}
          </Button>
        </Box>
        {compareMode && (
          <Box
            sx={{
              mt: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              pl: 1.5,
            }}
          >
            {segments.map((seg, idx) => (
              <Box
                key={seg.id}
                sx={{
                  p: 1,
                  borderRadius: 1.5,
                  border: `1px solid ${seg.color}33`,
                  bgcolor: `${seg.color}08`,
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mb: 0.5,
                  }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: seg.color,
                      flexShrink: 0,
                    }}
                  />
                  <input
                    value={seg.name}
                    onChange={(e) =>
                      setSegments(
                        segments.map((s, i) =>
                          i === idx ? { ...s, name: e.target.value } : s
                        )
                      )
                    }
                    placeholder={`Segment ${idx + 1}`}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'}`,
                      color: 'inherit',
                      outline: 'none',
                      width: '100%',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      fontFamily: 'inherit',
                    }}
                  />
                  <IconButton
                    size="small"
                    onClick={() =>
                      setSegments(segments.filter((_, i) => i !== idx))
                    }
                    sx={{ p: 0.25, opacity: 0.6 }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
                {seg.filters.map((f, fIdx) => (
                  <Box
                    key={fIdx}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      mt: 0.5,
                      flexWrap: 'wrap',
                    }}
                  >
                    <PropertyPicker
                      projectId={projectId}
                      value={f.property ? [f.property] : []}
                      onChange={(val) => {
                        const newFilters = [...seg.filters];
                        newFilters[fIdx] = { ...f, property: val[0] || '' };
                        setSegments(
                          segments.map((s, i) =>
                            i === idx ? { ...s, filters: newFilters } : s
                          )
                        );
                      }}
                      emptyLabel={t('argus.analytics.property', 'Property')}
                      highlightEmpty
                      maxItems={1}
                    />
                    <InlineSelect
                      value={f.operator}
                      onChange={(val) => {
                        const newFilters = [...seg.filters];
                        newFilters[fIdx] = { ...f, operator: val };
                        setSegments(
                          segments.map((s, i) =>
                            i === idx ? { ...s, filters: newFilters } : s
                          )
                        );
                      }}
                      options={[
                        { value: 'is', label: 'is' },
                        { value: 'is_not', label: 'is not' },
                        { value: 'contains', label: 'contains' },
                      ]}
                    />
                    <PropertyValueInput
                      projectId={projectId}
                      property={f.property}
                      value={f.value}
                      onChange={(val) => {
                        const newFilters = [...seg.filters];
                        newFilters[fIdx] = { ...f, value: val };
                        setSegments(
                          segments.map((s, i) =>
                            i === idx ? { ...s, filters: newFilters } : s
                          )
                        );
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={() => {
                        const newFilters = seg.filters.filter(
                          (_, i) => i !== fIdx
                        );
                        setSegments(
                          segments.map((s, i) =>
                            i === idx ? { ...s, filters: newFilters } : s
                          )
                        );
                      }}
                      sx={{ p: 0.25, opacity: 0.5 }}
                    >
                      <CloseIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </Box>
                ))}
                <Button
                  size="small"
                  onClick={() => {
                    const newFilters = [
                      ...seg.filters,
                      { property: '', operator: 'is', value: '' },
                    ];
                    setSegments(
                      segments.map((s, i) =>
                        i === idx ? { ...s, filters: newFilters } : s
                      )
                    );
                  }}
                  sx={{
                    textTransform: 'none',
                    fontSize: '0.68rem',
                    py: 0,
                    mt: 0.5,
                    opacity: 0.7,
                  }}
                >
                  + Filter
                </Button>
              </Box>
            ))}
            {segments.length < 4 && (
              <Button
                size="small"
                onClick={() =>
                  setSegments([
                    ...segments,
                    {
                      id: `seg_${Date.now()}`,
                      name: '',
                      filters: [{ property: '', operator: 'is', value: '' }],
                      color:
                        SEGMENT_COLORS[segments.length % SEGMENT_COLORS.length],
                    },
                  ])
                }
                sx={{
                  textTransform: 'none',
                  fontSize: '0.72rem',
                  borderRadius: 1.5,
                  mt: 0.5,
                }}
              >
                {t('argus.analytics.addSegment', '+ Add Segment')}
              </Button>
            )}
          </Box>
        )}
      </Box>

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
          disabled={queryLoading || steps.filter((s) => s.name).length < 2}
          sx={{ borderRadius: 1.5, textTransform: 'none', px: 2 }}
        >
          {t('argus.analytics.runQuery', 'Run Query')}
        </Button>
      </Box>

      <QuickLexiconEditor
        open={quickEditOpen}
        anchorEl={quickEditAnchor}
        eventName={quickEditEventName}
        projectId={projectId}
        onClose={() => setQuickEditOpen(false)}
        onSaved={refetchEvents}
      />

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
              handleAddCondition(menuAnchor.idx);
              handleCloseMenu();
            }}
            sx={{ fontSize: '0.8rem', py: 0.75 }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              <FilterListIcon sx={{ fontSize: 16 }} />
            </ListItemIcon>
            {t('argus.analytics.addFilter', 'Add Filter')}
          </MenuItem>
          <MenuItem
            onClick={() => {
              handleRemoveStep(menuAnchor.idx);
              handleCloseMenu();
            }}
            disabled={steps.length <= 2}
            sx={{
              fontSize: '0.8rem',
              py: 0.75,
              color: steps.length > 2 ? 'error.main' : 'text.disabled',
            }}
          >
            <ListItemIcon sx={{ minWidth: 28, color: 'inherit' }}>
              <DeleteOutlineIcon sx={{ fontSize: 16 }} />
            </ListItemIcon>
            {t('argus.analytics.removeStep', 'Delete Step')}
          </MenuItem>
        </Menu>
      )}
    </Box>
  );
};
