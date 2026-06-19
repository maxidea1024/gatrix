import React, { useState, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  useTheme,
  Divider,
  IconButton,
  Checkbox,
  CircularProgress,
  Collapse,
} from '@mui/material';
import {
  PlayArrow as RunIcon,
  Add as AddIcon,
  KeyboardArrowDown as ArrowDownIcon,
  KeyboardArrowDown as ArrowDownIconMui,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useFlowsStore } from '@/hooks/useAnalyticsStore';
import { useSharedEventCatalog } from '@/pages/argus/hooks/useSharedEventCatalog';
import { renderLexiconIcon } from '@/utils/lexiconIcons';
import { useLocalizedLexicon } from '@/pages/argus/hooks/useLocalizedLexicon';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import EventLabel from '@/components/argus/EventLabel';

import EventBlock from '../analytics/EventBlock';
import InlineSelect from '../analytics/InlineSelect';
import BreakdownSection from '../analytics/BreakdownSection';

interface FlowsLeftPanelProps {
  projectId: string;
  queryLoading: boolean;
  onRunQuery: () => void;
  onEditOption: (eventName: string, anchor: HTMLElement) => void;
}

export const FlowsLeftPanel: React.FC<FlowsLeftPanelProps> = ({
  projectId,
  queryLoading,
  onRunQuery,
  onEditOption,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  // ── Persisted Store State ──
  const anchorEventA = useFlowsStore((s) => s.anchorEventA);
  const setAnchorEventA = useFlowsStore((s) => s.setAnchorEventA);
  const anchorEventB = useFlowsStore((s) => s.anchorEventB);
  const setAnchorEventB = useFlowsStore((s) => s.setAnchorEventB);
  const showSecondAnchor = useFlowsStore((s) => s.showSecondAnchor);
  const setShowSecondAnchor = useFlowsStore((s) => s.setShowSecondAnchor);
  const direction = useFlowsStore((s) => s.direction);
  const setDirection = useFlowsStore((s) => s.setDirection);
  const stepsBefore = useFlowsStore((s) => s.stepsBefore);
  const setStepsBefore = useFlowsStore((s) => s.setStepsBefore);
  const stepsAfter = useFlowsStore((s) => s.stepsAfter);
  const setStepsAfter = useFlowsStore((s) => s.setStepsAfter);
  const depth = useFlowsStore((s) => s.depth);
  const setDepth = useFlowsStore((s) => s.setDepth);
  const excludeEvents = useFlowsStore((s) => s.excludeEvents);
  const setExcludeEvents = useFlowsStore((s) => s.setExcludeEvents);
  const breakdownProperties = useFlowsStore((s) => s.breakdownProperties);
  const setBreakdownProperties = useFlowsStore((s) => s.setBreakdownProperties);

  // ── Shared Event Catalog ──
  const { availableEvents } = useSharedEventCatalog(projectId);
  const { localizeEventName: lfn, localizeEventDescription: lfd } = useLocalizedLexicon();

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
    'argus_flows_settings_expanded',
    false
  );
  const [excludeListScrolling, setExcludeListScrolling] = useState(false);
  const excludeScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Derived direction ──
  React.useEffect(() => {
    if (showSecondAnchor && anchorEventB) {
      setDirection('between');
    } else if (direction === 'between') {
      setDirection('after');
    }
  }, [showSecondAnchor, anchorEventB, direction, setDirection]);

  // ── Exclude events toggle ──
  const toggleExclude = useCallback(
    (eventName: string) => {
      setExcludeEvents(
        excludeEvents.includes(eventName)
          ? excludeEvents.filter((e) => e !== eventName)
          : [...excludeEvents, eventName]
      );
    },
    [excludeEvents, setExcludeEvents]
  );

  // ── Exclude list scroll — suppress tooltips while scrolling ──
  const handleExcludeListScroll = useCallback(() => {
    setExcludeListScrolling(true);
    if (excludeScrollTimerRef.current) clearTimeout(excludeScrollTimerRef.current);
    excludeScrollTimerRef.current = setTimeout(() => {
      setExcludeListScrolling(false);
    }, 300);
  }, []);

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {/* Anchor Events */}
      <Box>
        <Typography
          variant="overline"
          sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}
        >
          {t('argus.analytics.flowConfiguration', 'Flow Configuration')}
        </Typography>
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* Anchor A */}
          <EventBlock indexLabel="A" color="#ec4899">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 0.5,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {t('argus.analytics.anchor', 'Anchor')}
              </Typography>
              <InlineSelect
                value={anchorEventA}
                onChange={setAnchorEventA}
                options={eventOptions}
                emptyLabel={t('argus.analytics.selectEvent', 'Select Event')}
                highlightEmpty
                onEditOption={onEditOption}
              />
            </Box>
          </EventBlock>

          {/* Anchor B (optional) */}
          {showSecondAnchor && (
            <>
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
                    borderLeft: `2px dashed ${isDark ? 'rgba(236,72,153,0.4)' : 'rgba(236,72,153,0.3)'}`,
                  }}
                />
                {/* Arrow circle */}
                <Box
                  sx={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: `2px solid ${isDark ? 'rgba(236,72,153,0.45)' : 'rgba(236,72,153,0.35)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'background.paper',
                    zIndex: 2,
                  }}
                >
                  <ArrowDownIconMui
                    sx={{
                      fontSize: 14,
                      color: isDark ? 'rgba(236,72,153,0.7)' : 'rgba(236,72,153,0.5)',
                    }}
                  />
                </Box>
                {/* Dotted line bottom */}
                <Box
                  sx={{
                    width: 0,
                    height: 14,
                    borderLeft: `2px dashed ${isDark ? 'rgba(236,72,153,0.4)' : 'rgba(236,72,153,0.3)'}`,
                  }}
                />
              </Box>
              <EventBlock
                indexLabel="B"
                color="#f59e0b"
                onRemove={() => {
                  setShowSecondAnchor(false);
                  setAnchorEventB('');
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 0.5,
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {t('argus.analytics.anchor', 'Anchor')}
                  </Typography>
                  <InlineSelect
                    value={anchorEventB}
                    onChange={setAnchorEventB}
                    options={eventOptions}
                    emptyLabel={t('argus.analytics.selectEvent', 'Select Event')}
                    highlightEmpty
                    onEditOption={onEditOption}
                  />
                </Box>
              </EventBlock>
            </>
          )}

          {!showSecondAnchor && (
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setShowSecondAnchor(true)}
              sx={{
                alignSelf: 'flex-start',
                textTransform: 'none',
                borderRadius: 1.5,
                mt: 0.5,
              }}
            >
              {t('argus.analytics.addSecondAnchor', 'Add 2nd Anchor (Between)')}
            </Button>
          )}
        </Box>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Settings */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 0.5 }}>
            {/* Direction */}
            {!showSecondAnchor && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ minWidth: 70, flexShrink: 0, fontSize: '0.75rem' }}
                >
                  {t('argus.analytics.direction', 'Direction')}
                </Typography>
                <InlineSelect
                  value={direction}
                  onChange={(val) => setDirection(val as any)}
                  options={[
                    { value: 'after', label: t('argus.analytics.after', 'After') },
                    { value: 'before', label: t('argus.analytics.before', 'Before') },
                  ]}
                />
              </Box>
            )}

            {/* Steps before/after */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ minWidth: 70, flexShrink: 0, fontSize: '0.75rem' }}
              >
                {direction === 'before'
                  ? t('argus.analytics.stepsBefore', 'Steps Before')
                  : t('argus.analytics.stepsAfter', 'Steps After')}
              </Typography>
              <InlineSelect
                value={String(direction === 'before' ? stepsBefore : stepsAfter)}
                onChange={(val) => {
                  const n = Number(val);
                  if (direction === 'before') setStepsBefore(n);
                  else setStepsAfter(n);
                }}
                options={[1, 2, 3, 4, 5, 6].map((n) => ({
                  value: String(n),
                  label: String(n),
                }))}
              />
            </Box>

            {/* Depth */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ minWidth: 70, flexShrink: 0, fontSize: '0.75rem' }}
              >
                {t('argus.analytics.depth', 'Depth')}
              </Typography>
              <InlineSelect
                value={String(depth)}
                onChange={(val) => setDepth(Number(val))}
                options={[2, 3, 4, 5, 6, 8].map((n) => ({
                  value: String(n),
                  label: String(n),
                }))}
              />
            </Box>
          </Box>
        </Collapse>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Exclude Events */}
      <Box>
        <Typography
          variant="overline"
          sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}
        >
          {t('argus.analytics.excludeEvents', 'Exclude Events')}
        </Typography>
        <Box
          onScroll={handleExcludeListScroll}
          sx={{
            mt: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.5,
            maxHeight: 150,
            overflowY: 'auto',
          }}
        >
          {availableEvents.slice(0, 20).map((e) => (
            <Box
              key={e.name}
              onClick={() => toggleExclude(e.name)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                px: 1,
                py: 0.25,
                borderRadius: 1,
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: excludeEvents.includes(e.name) ? 'error.main' : 'text.primary',
                textDecoration: excludeEvents.includes(e.name) ? 'line-through' : 'none',
                opacity: excludeEvents.includes(e.name) ? 0.5 : 1,
                '&:hover': {
                  bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                },
              }}
            >
              <Checkbox
                size="small"
                checked={!excludeEvents.includes(e.name)}
                sx={{ p: 0.25, '& .MuiSvgIcon-root': { fontSize: 14 } }}
              />
              <EventLabel
                eventName={e.name}
                displayName={e.display_name}
                icon={e.icon}
                iconColor={e.icon_color}
                isReserved={e.is_reserved}
                size="compact"
                disableTooltip={excludeListScrolling}
              />
            </Box>
          ))}
        </Box>
      </Box>

      <Divider sx={{ opacity: isDark ? 0.05 : 0.5 }} />

      {/* Breakdown */}
      <BreakdownSection
        projectId={projectId}
        eventName={anchorEventA}
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
          disabled={queryLoading || !anchorEventA}
          sx={{ borderRadius: 1.5, textTransform: 'none', px: 2 }}
        >
          {t('argus.analytics.runQuery', 'Run Query')}
        </Button>
      </Box>
    </Box>
  );
};
