import React, { useState } from 'react';
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  useTheme,
} from '@mui/material';
import {
  DeviceHub as DeviceIcon,
  Person as PersonIcon,
  Sell as TagIcon,
  FolderOpen as FolderIcon,
  Schedule as ScheduleIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ArgusErrorEvent, ArgusTraceDetail } from '@/services/argusService';
import ContextGrid from '@/components/argus/ContextGrid';
import TraceWaterfall from '@/components/argus/TraceWaterfall';
import BreadcrumbsTimeline from '@/components/argus/BreadcrumbsTimeline';
import JsonViewer from '@/components/common/JsonViewer';
import { ActionChip } from '@/components/common/ActionChip';

export interface IssueContextSectionProps {
  event: ArgusErrorEvent;
  traceId: string | null;
  traceDetail: ArgusTraceDetail | null;
  loadingTrace: boolean;
  isDark: boolean;
}

const IssueContextSection: React.FC<IssueContextSectionProps> = ({
  event,
  traceId,
  traceDetail,
  loadingTrace,
  isDark,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [showTrace, setShowTrace] = useState(false);

  // Parse tags safely
  const parsedTags = React.useMemo(() => {
    try {
      return typeof event.tags === 'string' ? JSON.parse(event.tags) : (event.tags || {});
    } catch { return {}; }
  }, [event.tags]);

  // Parse extra data safely
  const extraData = React.useMemo(() => {
    if (!event.extra) return null;
    try {
      const d = typeof event.extra === 'string' ? JSON.parse(event.extra) : event.extra;
      return d && Object.keys(d).length > 0 ? d : null;
    } catch { return null; }
  }, [event.extra]);

  // Parse contexts safely
  const ctxData = React.useMemo(() => {
    if (!event.contexts) return null;
    try {
      const d = typeof event.contexts === 'string' ? JSON.parse(event.contexts) : event.contexts;
      return d && Object.keys(d).length > 0 ? d : null;
    } catch { return null; }
  }, [event.contexts]);

  // Parse breadcrumbs
  const breadcrumbsArr = React.useMemo(() => {
    if (!event.breadcrumbs) return [];
    try {
      const arr = typeof event.breadcrumbs === 'string' ? JSON.parse(event.breadcrumbs) : event.breadcrumbs;
      return Array.isArray(arr) ? arr : [];
    } catch { return []; }
  }, [event.breadcrumbs]);

  return (
    <>
      {/* Context & Tags */}
      <Box sx={{ py: 3, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
          {/* Environment Context */}
          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <DeviceIcon fontSize="small" sx={{ color: theme.palette.primary.main }} />
              {t('argus.issues.context')}
            </Typography>
            <ContextGrid items={[
              event.environment && { label: t('argus.issues.environment'), value: event.environment },
              event.release && { label: t('argus.issues.release'), value: event.release },
              event.browser && { label: t('argus.issues.browser'), value: `${event.browser} ${event.browser_version || ''}` },
              event.os && { label: t('argus.issues.os'), value: `${event.os} ${event.os_version || ''}` },
              event.transaction && { label: t('argus.issues.transaction'), value: event.transaction },
            ].filter(Boolean) as { label: string; value: string }[]} isDark={isDark} />
          </Box>

          {/* User Context */}
          <Box>
            {(event.user_email || event.user_ip) && (
              <>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <PersonIcon fontSize="small" sx={{ color: theme.palette.warning.main }} />
                  {t('argus.issues.user')}
                </Typography>
                <ContextGrid items={[
                  event.user_email && { label: t('argus.issues.email'), value: event.user_email },
                  event.user_ip && { label: t('argus.issues.ip'), value: event.user_ip },
                ].filter(Boolean) as { label: string; value: string }[]} isDark={isDark} />
              </>
            )}
          </Box>
        </Box>

        {/* Tags */}
        {Object.keys(parsedTags).length > 0 && (
          <Box sx={{ mt: 3, pt: 3, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <TagIcon fontSize="small" sx={{ color: theme.palette.info.main }} />
              {t('argus.issues.tags', 'Tags')}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {Object.entries(parsedTags).map(([key, val]) => (
                <Chip
                  key={key}
                  label={
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                      <Typography component="span" sx={{ fontSize: '0.68rem', color: 'text.disabled' }}>{key}:</Typography>
                      <Typography component="span" sx={{ fontSize: '0.72rem', fontWeight: 600 }}>{String(val)}</Typography>
                    </Box>
                  }
                  size="small"
                  sx={{
                    height: 26,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    borderRadius: '6px',
                  }}
                />
              ))}
            </Box>
          </Box>
        )}
      </Box>

      {/* Trace Waterfall */}
      {traceId && (
        <Box sx={{ py: 2, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: showTrace ? 2 : 0 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ScheduleIcon fontSize="small" sx={{ color: theme.palette.success.main }} />
              {t('argus.issues.transactionTrace', 'Transaction Trace')}
            </Typography>
            {!showTrace && (
              <ActionChip
                label={t('argus.issues.viewTrace', 'Trace 보기')}
                onClick={() => setShowTrace(true)}
                disabled={loadingTrace}
              />
            )}
          </Box>
          {showTrace && (
            <Box>
              {loadingTrace ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : traceDetail ? (
                <TraceWaterfall trace={traceDetail} isDark={isDark} />
              ) : (
                <Typography variant="body2" color="text.secondary" textAlign="center" py={4}>
                  {t('argus.issues.traceLoadFailed', 'Trace 정보를 불러오지 못했습니다.')}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* Breadcrumbs */}
      {breadcrumbsArr.length > 0 && (
        <Box sx={{ py: 2, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <FolderIcon fontSize="small" sx={{ color: theme.palette.warning.main }} />
            {t('argus.issues.breadcrumbs', 'Breadcrumbs')}
            <Chip label={breadcrumbsArr.length} size="small" sx={{ height: 18, fontSize: '0.65rem', fontWeight: 700, ml: 0.5 }} />
          </Typography>
          <BreadcrumbsTimeline
            breadcrumbs={breadcrumbsArr}
            summaryMode
            summaryCount={5}
            errorEvent={{
              type: event.exception_type,
              value: event.exception_value,
              timestamp: event.timestamp,
            }}
          />
        </Box>
      )}

      {/* Extra Data */}
      {extraData && (
        <Box sx={{ py: 2, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <InfoIcon fontSize="small" sx={{ color: theme.palette.secondary.main }} />
            {t('argus.issues.extraData', 'Additional Data')}
          </Typography>
          <JsonViewer data={extraData} isDark={isDark} />
        </Box>
      )}

      {/* Contexts */}
      {ctxData && (
        <Box sx={{ py: 2 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <DeviceIcon fontSize="small" sx={{ color: theme.palette.primary.main }} />
            {t('argus.issues.contexts', 'Contexts')}
          </Typography>
          {Object.entries(ctxData).map(([ctxKey, ctxVal]: [string, any]) => (
            <Box key={ctxKey} sx={{ mb: 1.5 }}>
              <Typography variant="caption" fontWeight={700} sx={{ color: theme.palette.primary.main, textTransform: 'capitalize', mb: 0.5, display: 'block' }}>
                {ctxKey}
              </Typography>
              {typeof ctxVal === 'object' && ctxVal !== null ? (
                <ContextGrid items={Object.entries(ctxVal).map(([k, v]) => ({
                  label: k,
                  value: String(v),
                }))} isDark={isDark} />
              ) : (
                <Typography variant="body2" sx={{ fontSize: '0.78rem' }}>{String(ctxVal)}</Typography>
              )}
            </Box>
          ))}
        </Box>
      )}
    </>
  );
};

export default React.memo(IssueContextSection);
