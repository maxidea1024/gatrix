import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  useTheme,
  alpha,
  Divider,
  IconButton,
  CircularProgress,
  Menu,
  MenuItem,
  ListSubheader,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as RunIcon,
  Close as CloseIcon,
  MoreVert as MoreVertIcon,
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
  useInsightsStore,
  type InsightsEventEntry,
  type EventCondition,
} from '@/hooks/useAnalyticsStore';
import { useGlobalAnalyticsFilter } from '@/hooks/useGlobalAnalyticsFilter';
import { useSharedEventCatalog } from '../../hooks/useSharedEventCatalog';

import EventBlock from './EventBlock';
import InlineSelect from './InlineSelect';
import PropertyPicker from './PropertyPicker';
import BreakdownSection from './BreakdownSection';
import PropertyValueInput from './PropertyValueInput';
import FormulaInput from './FormulaInput';
import QuickLexiconEditor from './QuickLexiconEditor';

const SortableEventWrapper: React.FC<{
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

const PROPERTY_AGGREGATIONS = new Set([
  'avg',
  'median',
  'sum',
  'p25',
  'p75',
  'p90',
]);

export const SERIES_COLORS = [
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ec4899',
  '#3b82f6',
  '#ef4444',
  '#8b5cf6',
  '#14b8a6',
];

interface InsightsLeftPanelProps {
  queryLoading: boolean;
  onRunQuery: () => void;
}

export const InsightsLeftPanel: React.FC<InsightsLeftPanelProps> = ({
  queryLoading,
  onRunQuery,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const { currentProject } = useOrgProject();
  const projectId = currentProject?.id || '1';

  // ── Persisted Store State ──
  const events = useInsightsStore((s) => s.events);
  const setEvents = useInsightsStore((s) => s.setEvents);
  const breakdownProperties = useInsightsStore((s) => s.breakdownProperties);
  const setBreakdownProperties = useInsightsStore(
    (s) => s.setBreakdownProperties
  );
  const formulas = useInsightsStore((s) => s.formulas);
  const setFormulas = useInsightsStore((s) => s.setFormulas);

  // ── Shared Event Catalog ──
  const { availableEvents, refetch: refetchEvents } =
    useSharedEventCatalog(projectId);

  const AGGREGATIONS = [
    {
      value: 'total',
      label: t('argus.analytics.aggTotalCount', 'Total Count'),
    },
    {
      value: 'unique',
      label: t('argus.analytics.aggUniqueUsers', 'Unique Users'),
    },
    {
      value: 'frequency',
      label: t('argus.analytics.aggFrequency', 'Frequency per User'),
    },
    { value: 'avg', label: t('argus.analytics.aggAverage', 'Average') },
    { value: 'median', label: t('argus.analytics.aggMedian', 'Median') },
    { value: 'sum', label: t('argus.analytics.aggSum', 'Sum') },
    {
      value: 'p25',
      label: t('argus.analytics.aggP25', 'P25 (25th percentile)'),
    },
    {
      value: 'p75',
      label: t('argus.analytics.aggP75', 'P75 (75th percentile)'),
    },
    {
      value: 'p90',
      label: t('argus.analytics.aggP90', 'P90 (90th percentile)'),
    },
  ];

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
    { value: 'gte', label: '≥' },
    { value: 'lte', label: '≤' },
    { value: 'set', label: t('argus.analytics.op.isSet', 'is set') },
    { value: 'not_set', label: t('argus.analytics.op.isNotSet', 'is not set') },
  ];

  const [menuAnchor, setMenuAnchor] = useState<{
    el: HTMLElement;
    idx: number;
  } | null>(null);

  // Quick lexicon editor state
  const [quickEditOpen, setQuickEditOpen] = useState(false);
  const [quickEditAnchor, setQuickEditAnchor] = useState<HTMLElement | null>(
    null
  );
  const [quickEditEventName, setQuickEditEventName] = useState('');

  const { localizeEventName, localizeEventDescription } = useLocalizedLexicon();

  const eventOptions = useMemo(
    () =>
      availableEvents.map((e) => ({
        value: e.name,
        label: localizeEventName(e.name, e.display_name, e.is_reserved),
        icon: renderLexiconIcon(e.icon, 18, e.icon_color || undefined),
        meta: {
          eventKey: e.name,
          description:
            localizeEventDescription(e.name, e.description, e.is_reserved) ||
            undefined,
          category: e.category || undefined,
          count: e.count,
          isReserved: e.is_reserved,
        },
      })),
    [availableEvents, localizeEventName, localizeEventDescription]
  );

  const formulaLabels = useMemo(() => {
    return events
      .filter((e) => e.name)
      .map((_, i) => String.fromCharCode(65 + i));
  }, [events]);

  const handleAddEvent = useCallback(() => {
    setEvents([...events, { name: '', aggregation: 'total' }]);
  }, [events, setEvents]);

  const handleRemoveEvent = useCallback(
    (index: number) => {
      setEvents(events.filter((_, i) => i !== index));
    },
    [events, setEvents]
  );

  const handleEventChange = useCallback(
    (index: number, field: keyof InsightsEventEntry, value: any) => {
      setEvents(
        events.map((e, i) => (i === index ? { ...e, [field]: value } : e))
      );
    },
    [events, setEvents]
  );

  // ── DnD ──
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const eventIds = useMemo(() => events.map((_, i) => `event-${i}`), [events]);
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = eventIds.indexOf(String(active.id));
        const newIndex = eventIds.indexOf(String(over.id));
        setEvents(arrayMove(events, oldIndex, newIndex));
      }
    },
    [events, eventIds, setEvents]
  );

  const handleOpenMenu = useCallback(
    (e: React.MouseEvent<HTMLElement>, idx: number) => {
      setMenuAnchor({ el: e.currentTarget, idx });
    },
    []
  );

  const handleCloseMenu = useCallback(() => {
    setMenuAnchor(null);
  }, []);

  const handleAddCondition = useCallback(
    (eventIndex: number) => {
      setEvents(
        events.map((e, i) => {
          if (i === eventIndex) {
            const conditions = e.conditions || [];
            return {
              ...e,
              conditions: [
                ...conditions,
                { property: '', operator: 'is', value: '' },
              ],
            };
          }
          return e;
        })
      );
    },
    [events, setEvents]
  );

  const handleConditionChange = useCallback(
    (
      eventIndex: number,
      condIndex: number,
      field: keyof EventCondition,
      value: string
    ) => {
      setEvents(
        events.map((e, i) => {
          if (i === eventIndex && e.conditions) {
            const newConds = [...e.conditions];
            newConds[condIndex] = { ...newConds[condIndex], [field]: value };
            return { ...e, conditions: newConds };
          }
          return e;
        })
      );
    },
    [events, setEvents]
  );

  const handleRemoveCondition = useCallback(
    (eventIndex: number, condIndex: number) => {
      setEvents(
        events.map((e, i) => {
          if (i === eventIndex && e.conditions) {
            return {
              ...e,
              conditions: e.conditions.filter((_, ci) => ci !== condIndex),
            };
          }
          return e;
        })
      );
    },
    [events, setEvents]
  );

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Events Section */}
      <Box>
        <Typography
          variant="overline"
          sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}
        >
          {t('argus.analytics.events', 'Events')}
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <DndContext
            sensors={dndSensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={eventIds}
              strategy={verticalListSortingStrategy}
            >
              {events.map((ev, idx) => (
                <SortableEventWrapper key={eventIds[idx]} id={eventIds[idx]}>
                  {({ dragHandleProps, isDragging }) => (
                    <EventBlock
                      indexLabel={String.fromCharCode(65 + idx)}
                      color={SERIES_COLORS[idx % SERIES_COLORS.length]}
                      dragHandleProps={dragHandleProps}
                      isDragging={isDragging}
                    >
                      {/* Event name & Menu */}
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                        }}
                      >
                        <InlineSelect
                          value={ev.name}
                          onChange={(val) =>
                            handleEventChange(idx, 'name', val)
                          }
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

                      {/* Measurement summary text or property selector */}
                      {ev.aggregation !== 'total' && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            pl: 0.5,
                          }}
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ fontSize: '0.7rem' }}
                          >
                            {t('argus.analytics.show', 'show')}:
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                          >
                            {AGGREGATIONS.find(
                              (a) => a.value === ev.aggregation
                            )?.label || ev.aggregation}
                          </Typography>
                          {PROPERTY_AGGREGATIONS.has(ev.aggregation) && (
                            <>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ fontSize: '0.7rem' }}
                              >
                                {t('argus.analytics.of', 'of')}
                              </Typography>
                              <PropertyPicker
                                projectId={projectId}
                                eventName={ev.name}
                                value={ev.property ? [ev.property] : []}
                                onChange={(val) =>
                                  handleEventChange(
                                    idx,
                                    'property',
                                    val[0] || ''
                                  )
                                }
                                emptyLabel={t(
                                  'argus.analytics.selectProperty',
                                  'Select Property'
                                )}
                                highlightEmpty
                                maxItems={1}
                                variant="text"
                              />
                            </>
                          )}
                        </Box>
                      )}

                      {/* Conditions (Filters) */}
                      {ev.conditions && ev.conditions.length > 0 && (
                        <Box
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 0.5,
                          }}
                        >
                          {ev.conditions.map((cond, cIdx) => (
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
                                eventName={ev.name}
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
                              {!['set', 'not_set'].includes(cond.operator) && (
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
                                onClick={() => handleRemoveCondition(idx, cIdx)}
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
                  )}
                </SortableEventWrapper>
              ))}
            </SortableContext>
          </DndContext>
          {events.length < 8 && (
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={handleAddEvent}
              sx={{
                justifyContent: 'flex-start',
                color: 'text.secondary',
                textTransform: 'none',
                borderRadius: 2,
              }}
            >
              {t('argus.analytics.addEvent', 'Add Event')}
            </Button>
          )}
        </Box>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Formula Section */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {formulas.length > 0 && (
          <Typography
            variant="overline"
            sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}
          >
            {t('argus.analytics.formulas', 'Formulas')}
          </Typography>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {formulas.map((form, idx) => (
              <Box
                key={idx}
                sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}
              >
                <Box sx={{ flex: 1 }}>
                  <FormulaInput
                    value={form}
                    onChange={(val) => {
                      const next = [...formulas];
                      next[idx] = val;
                      setFormulas(next);
                    }}
                    availableLabels={formulaLabels}
                  />
                </Box>
                <IconButton
                  size="small"
                  onClick={() => {
                    setFormulas(formulas.filter((_, i) => i !== idx));
                  }}
                  sx={{
                    p: 0.25,
                    opacity: 0.6,
                    '&:hover': { opacity: 1 },
                    mt: '6px',
                  }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            ))}
          </Box>

          {formulas.length < 5 && (
            <Button
              size="small"
              startIcon={<AddIcon sx={{ fontSize: 14 }} />}
              onClick={() => setFormulas([...formulas, ''])}
              sx={{
                justifyContent: 'flex-start',
                color: 'text.secondary',
                textTransform: 'none',
                borderRadius: 2,
              }}
            >
              {t('argus.analytics.addFormula', 'Formula')}
            </Button>
          )}
        </Box>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Breakdown Section */}
      <BreakdownSection
        projectId={projectId}
        eventName={events[0]?.name}
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
          disabled={queryLoading || events.filter((e) => e.name).length === 0}
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
            {t('argus.analytics.addFilter', 'Add Filter')}
          </MenuItem>
          <MenuItem
            onClick={() => {
              handleRemoveEvent(menuAnchor.idx);
              handleCloseMenu();
            }}
            disabled={events.length <= 1}
            sx={{
              fontSize: '0.8rem',
              py: 0.75,
              color: events.length > 1 ? 'error.main' : 'text.disabled',
            }}
          >
            {t('argus.analytics.removeEvent', 'Delete Event')}
          </MenuItem>
          <Divider />
          <ListSubheader
            sx={{
              py: 0.5,
              height: 'auto',
              lineHeight: 'normal',
              fontSize: '0.65rem',
              fontWeight: 700,
            }}
          >
            {t('argus.analytics.show', 'Show')}
          </ListSubheader>
          {AGGREGATIONS.map((agg) => (
            <MenuItem
              key={agg.value}
              selected={events[menuAnchor.idx]?.aggregation === agg.value}
              onClick={() => {
                handleEventChange(menuAnchor.idx, 'aggregation', agg.value);
                handleCloseMenu();
              }}
              sx={{ fontSize: '0.75rem', py: 0.5 }}
            >
              {agg.label}
            </MenuItem>
          ))}
        </Menu>
      )}
    </Box>
  );
};
