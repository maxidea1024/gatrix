import React from 'react';
import {
  Box,
  Typography,
  Chip,
  Button,
  IconButton,
  Skeleton,
  Drawer,
  Tabs,
  Tab,
  Divider,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  PlayArrow as TestIcon,
  Error as ErrorIcon,
  Code as CodeIcon,
  History as HistoryIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import {
  DrawerHeader,
  SummaryStrip,
  CodeBlockContainer,
  SectionLabel,
  EmptyCheckinBox,
  StatusValuesBox,
} from './CronsDetailDrawer.styles';
import { ARGUS_SEMANTIC } from '../argusThemeTokens';

// Types
interface CronMonitor {
  id: string;
  name: string;
  slug: string;
  schedule_type: string;
  schedule_value: string;
  status: string;
  last_checkin_at: string | null;
  next_checkin_at: string | null;
  last_status: string | null;
  environment: string;
  checkin_margin: number;
  max_runtime: number;
  timezone?: string;
  failure_issue_threshold?: number;
  recovery_threshold?: number;
  is_muted?: boolean;
  created_at: string;
}

interface CronCheckin {
  id: number;
  checkin_id: string;
  status: string;
  duration: number | null;
  environment: string;
  created_at: string;
  expected_time: string | null;
}

export type { CronMonitor, CronCheckin };

function formatRelativeTime(isoStr: string | null, t: any): string {
  if (!isoStr) return '-';
  const diff = Date.now() - new Date(isoStr).getTime();
  const absDiff = Math.abs(diff);
  const prefix = diff < 0 ? t('common.time.in', 'in ') : '';
  const suffix = diff >= 0 ? t('common.time.ago', ' ago') : '';
  if (absDiff < 60000)
    return `${prefix}${Math.floor(absDiff / 1000)}${t('common.time.s', 's')}${suffix}`;
  if (absDiff < 3600000)
    return `${prefix}${Math.floor(absDiff / 60000)}${t('common.time.m', 'm')}${suffix}`;
  if (absDiff < 86400000)
    return `${prefix}${Math.floor(absDiff / 3600000)}${t('common.time.h', 'h')}${suffix}`;
  return `${prefix}${Math.floor(absDiff / 86400000)}${t('common.time.d', 'd')}${suffix}`;
}

function formatDateTime(isoStr: string | null): string {
  if (!isoStr) return '-';
  return new Date(isoStr).toLocaleString();
}

/** Reusable code block with copy button */
function CodeBlock({
  code,
  onCopy,
  isDark,
}: {
  code: string;
  onCopy: (text: string) => void;
  isDark: boolean;
}) {
  return (
    <CodeBlockContainer isDark={isDark}>
      <IconButton
        size="small"
        onClick={() => onCopy(code)}
        sx={{
          position: 'absolute',
          top: 4,
          right: 4,
          color: 'rgba(255,255,255,0.4)',
          '&:hover': { color: 'rgba(255,255,255,0.8)' },
        }}
      >
        <CopyIcon sx={{ fontSize: 14 }} />
      </IconButton>
      {code}
    </CodeBlockContainer>
  );
}

// ─── CronsDetailDrawer ───

interface CronsDetailDrawerProps {
  monitor: CronMonitor | null;
  onClose: () => void;
  detailTab: number;
  onTabChange: (tab: number) => void;
  checkins: CronCheckin[];
  checkinsLoading: boolean;
  checkinsTotal: number;
  testingSending: boolean;
  onSendTest: (status: 'ok' | 'error') => void;
  projectId: string;
  statusConfig: Record<
    string,
    { color: string; icon: React.ReactElement; label: string }
  >;
  onCopy: (text: string) => void;
}

export const CronsDetailDrawer: React.FC<CronsDetailDrawerProps> = ({
  monitor,
  onClose,
  detailTab,
  onTabChange,
  checkins,
  checkinsLoading,
  checkinsTotal,
  testingSending,
  onSendTest,
  projectId,
  statusConfig,
  onCopy,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const argusApiBase = `${window.location.origin}/argus/api`;

  return (
    <Drawer
      anchor="right"
      open={!!monitor}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 560 },
          borderLeft: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        },
      }}
    >
      {monitor && (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Drawer Header */}
          <DrawerHeader isDark={isDark}>
            <Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 700 }}>
                {monitor.name}
              </Typography>
              <Typography
                sx={{
                  fontSize: '0.72rem',
                  color: 'text.disabled',
                  fontFamily: 'monospace',
                }}
              >
                {monitor.slug}
              </Typography>
            </Box>
            <IconButton onClick={onClose} size="small">
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </DrawerHeader>

          {/* Monitor Summary */}
          <SummaryStrip isDark={isDark}>
            {(() => {
              const s = monitor.last_status || monitor.status || 'active';
              const cfg = statusConfig[s] || statusConfig.active;
              return (
                <Chip
                  icon={cfg.icon}
                  label={cfg.label}
                  size="small"
                  sx={{
                    height: 22,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    backgroundColor: alpha(cfg.color, 0.1),
                    color: cfg.color,
                    '& .MuiChip-icon': { color: cfg.color },
                  }}
                />
              );
            })()}
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {t('argus.crons.schedule', 'Schedule')}:{' '}
              <strong>{monitor.schedule_value}</strong>
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {t('argus.crons.lastCheckin', 'Last')}:{' '}
              <strong>{formatRelativeTime(monitor.last_checkin_at, t)}</strong>
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {t('argus.crons.nextExpected', 'Next')}:{' '}
              <strong>{formatRelativeTime(monitor.next_checkin_at, t)}</strong>
            </Typography>
          </SummaryStrip>

          {/* Tabs */}
          <Tabs
            value={detailTab}
            onChange={(_, v) => onTabChange(v)}
            sx={{
              px: 2.5,
              minHeight: 36,
              '& .MuiTab-root': {
                minHeight: 36,
                fontSize: '0.75rem',
                textTransform: 'none',
                fontWeight: 600,
              },
            }}
          >
            <Tab
              icon={<HistoryIcon sx={{ fontSize: 16 }} />}
              iconPosition="start"
              label={t('argus.crons.checkinHistory', 'Check-in History')}
            />
            <Tab
              icon={<CodeIcon sx={{ fontSize: 16 }} />}
              iconPosition="start"
              label={t('argus.crons.sdkGuide', 'SDK Guide')}
            />
          </Tabs>
          <Divider />

          {/* Tab Content */}
          <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, py: 2 }}>
            {detailTab === 0 && (
              <Box>
                {/* Test Checkin Buttons */}
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Button
                    variant="outlined"
                    size="small"
                    color="success"
                    startIcon={<TestIcon />}
                    onClick={() => onSendTest('ok')}
                    disabled={testingSending}
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.72rem',
                      borderRadius: '8px',
                    }}
                  >
                    {t('argus.crons.sendTestOk', 'Send OK')}
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    startIcon={<ErrorIcon sx={{ fontSize: 14 }} />}
                    onClick={() => onSendTest('error')}
                    disabled={testingSending}
                    sx={{
                      textTransform: 'none',
                      fontSize: '0.72rem',
                      borderRadius: '8px',
                    }}
                  >
                    {t('argus.crons.sendTestError', 'Send Error')}
                  </Button>
                  <Box sx={{ flex: 1 }} />
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.disabled', alignSelf: 'center' }}
                  >
                    {checkinsTotal}{' '}
                    {t('argus.crons.totalCheckins', 'check-ins')}
                  </Typography>
                </Box>

                {/* Checkin History Table */}
                {checkinsLoading ? (
                  <Box>
                    {[...Array(5)].map((_, i) => (
                      <Skeleton key={i} height={36} sx={{ mb: 0.5 }} />
                    ))}
                  </Box>
                ) : checkins.length === 0 ? (
                  <EmptyCheckinBox isDark={isDark}>
                    <HistoryIcon sx={{ fontSize: 40, mb: 1, opacity: 0.3 }} />
                    <Typography
                      sx={{ fontSize: '0.82rem', fontWeight: 600, mb: 0.5 }}
                    >
                      {t('argus.crons.noCheckins', 'No check-in history')}
                    </Typography>
                    <Typography sx={{ fontSize: '0.72rem' }}>
                      {t(
                        'argus.crons.noCheckinsHint',
                        'Use the SDK Guide tab to learn how to send check-ins from your application.'
                      )}
                    </Typography>
                  </EmptyCheckinBox>
                ) : (
                  <Table
                    size="small"
                    sx={{ '& td, & th': { fontSize: '0.72rem', py: 0.75 } }}
                  >
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {t('argus.crons.status', 'Status')}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {t('argus.crons.duration', 'Duration')}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {t('argus.crons.timestamp', 'Timestamp')}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>
                          {t('argus.crons.environment', 'Env')}
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {checkins.map((ci) => {
                        const ciCfg =
                          statusConfig[ci.status] || statusConfig.active;
                        return (
                          <TableRow key={ci.id}>
                            <TableCell>
                              <Chip
                                icon={ciCfg.icon}
                                label={ciCfg.label}
                                size="small"
                                sx={{
                                  height: 20,
                                  fontSize: '0.62rem',
                                  fontWeight: 700,
                                  backgroundColor: alpha(ciCfg.color, 0.1),
                                  color: ciCfg.color,
                                  '& .MuiChip-icon': {
                                    color: ciCfg.color,
                                    fontSize: 12,
                                  },
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              {ci.duration != null ? `${ci.duration}ms` : '-'}
                            </TableCell>
                            <TableCell>
                              {formatDateTime(ci.created_at)}
                            </TableCell>
                            <TableCell>{ci.environment}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </Box>
            )}

            {detailTab === 1 && (
              <Box>
                {/* SDK Integration Guide */}
                <Typography
                  sx={{ fontSize: '0.85rem', fontWeight: 700, mb: 1.5 }}
                >
                  {t('argus.crons.sdkGuideTitle', 'How to send check-ins')}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    mb: 2,
                    lineHeight: 1.6,
                  }}
                >
                  {t(
                    'argus.crons.sdkGuideDesc',
                    'Your cron job must send HTTP check-ins to Argus at the start and end of each execution. If no check-in arrives by the expected time, the monitor will be marked as "missed" and an issue will be created.'
                  )}
                </Typography>

                {/* Endpoint */}
                <SectionLabel>Endpoint</SectionLabel>
                <CodeBlock
                  code={`POST ${argusApiBase}/projects/${projectId}/crons/${monitor.slug}/checkin`}
                  onCopy={onCopy}
                  isDark={isDark}
                />

                {/* Simple OK checkin */}
                <SectionLabel sx={{ mt: 2.5 }}>
                  {t(
                    'argus.crons.simpleCheckin',
                    '1. Simple Check-in (job completed)'
                  )}
                </SectionLabel>
                <CodeBlock
                  code={`curl -X POST "${argusApiBase}/projects/${projectId}/crons/${monitor.slug}/checkin" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "ok"}'`}
                  onCopy={onCopy}
                  isDark={isDark}
                />

                {/* Wrapping a job */}
                <SectionLabel sx={{ mt: 2.5 }}>
                  {t(
                    'argus.crons.wrappedCheckin',
                    '2. Wrapping a job (start + finish)'
                  )}
                </SectionLabel>
                <CodeBlock
                  code={`# Step 1: Mark job as in_progress (returns check_in_id)
CHECK_IN_ID=$(curl -s -X POST "${argusApiBase}/projects/${projectId}/crons/${monitor.slug}/checkin" \\
  -H "Content-Type: application/json" \\
  -d '{"status": "in_progress"}' | jq -r '.checkin_id')

# Step 2: Run your actual job
./my-backup-script.sh

# Step 3: Report result
if [ $? -eq 0 ]; then
  curl -X POST "${argusApiBase}/projects/${projectId}/crons/${monitor.slug}/checkin" \\
    -H "Content-Type: application/json" \\
    -d "{\\"status\\": \\"ok\\", \\"check_in_id\\": \\"$CHECK_IN_ID\\"}"
else
  curl -X POST "${argusApiBase}/projects/${projectId}/crons/${monitor.slug}/checkin" \\
    -H "Content-Type: application/json" \\
    -d "{\\"status\\": \\"error\\", \\"check_in_id\\": \\"$CHECK_IN_ID\\"}"
fi`}
                  onCopy={onCopy}
                  isDark={isDark}
                />

                {/* Status values */}
                <SectionLabel sx={{ mt: 2.5 }}>
                  {t('argus.crons.statusValues', 'Status Values')}
                </SectionLabel>
                <StatusValuesBox isDark={isDark}>
                  <Box>
                    <code style={{ color: ARGUS_SEMANTIC.positive }}>ok</code> —{' '}
                    {t(
                      'argus.crons.statusOkDesc',
                      'Job completed successfully'
                    )}
                  </Box>
                  <Box>
                    <code style={{ color: ARGUS_SEMANTIC.negative }}>error</code> —{' '}
                    {t('argus.crons.statusErrorDesc', 'Job failed')}
                  </Box>
                  <Box>
                    <code style={{ color: ARGUS_SEMANTIC.info }}>in_progress</code> —{' '}
                    {t(
                      'argus.crons.statusInProgressDesc',
                      'Job started (will timeout if no follow-up)'
                    )}
                  </Box>
                </StatusValuesBox>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Drawer>
  );
};
