import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Table,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  useTheme,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { ArgusUserEvent } from '@/services/argus/argusTypes';

const CopyValue: React.FC<{ value: string }> = ({ value }) => {
  const [copied, setCopied] = React.useState(false);
  return (
    <IconButton
      size="small"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 800);
      }}
      sx={{ p: 0.25, color: 'text.secondary', '&:hover': { color: 'text.primary' } }}
    >
      {copied ? <CheckIcon sx={{ fontSize: 12, color: 'success.main' }} /> : <CopyIcon sx={{ fontSize: 12 }} />}
    </IconButton>
  );
};

interface UserProfileEventDetailPanelProps {
  event: ArgusUserEvent;
}

export const UserProfileEventDetailPanel: React.FC<UserProfileEventDetailPanelProps> = ({
  event,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const stringProps = Object.entries(event.properties || {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== ''
  );
  const numericProps = Object.entries(event.numeric_properties || {}).filter(
    ([, v]) => v !== null && v !== undefined
  );
  const allProps = [
    ...stringProps.map(([k, v]) => ({ key: k, value: String(v), type: 'string' as const })),
    ...numericProps.map(([k, v]) => ({ key: k, value: String(v), type: 'number' as const })),
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.paper',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="subtitle2"
            fontWeight={700}
            sx={{ fontSize: '0.9rem', wordBreak: 'break-all' }}
          >
            {event.event_name}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {new Date(event.timestamp).toLocaleString()}
          </Typography>
          {event.session_id && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              <Typography
                variant="caption"
                fontFamily="monospace"
                color="text.secondary"
                sx={{ fontSize: 11 }}
              >
                {event.session_id}
              </Typography>
              <CopyValue value={event.session_id} />
            </Box>
          )}
          <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
            {event.platform && (
              <Chip label={event.platform} size="small" sx={{ height: 20, fontSize: 10 }} />
            )}
            {event.country && (
              <Chip
                label={event.country}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: 10 }}
              />
            )}
            {event.os && (
              <Chip
                label={event.os}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: 10 }}
              />
            )}
          </Box>
        </Box>
      </Box>

      {/* Properties */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 0 }}>
        {allProps.length > 0 ? (
          <>
            <Box
              sx={{
                px: 2,
                py: 1,
                bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                borderBottom: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Typography
                variant="caption"
                fontWeight={700}
                color="text.secondary"
                sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
              >
                {t('argus.userProfiles.eventProperties', 'Properties')} ({allProps.length})
              </Typography>
            </Box>
            <Table size="small">
              <TableBody>
                {allProps.map((p) => (
                  <TableRow
                    key={p.key}
                    sx={{
                      '&:last-child td': { borderBottom: 'none' },
                      '&:hover .copy-btn': { opacity: 1 },
                    }}
                  >
                    <TableCell
                      sx={{
                        width: '40%',
                        fontWeight: 600,
                        fontSize: 12,
                        color: 'text.secondary',
                        wordBreak: 'break-all',
                        py: 0.8,
                        verticalAlign: 'top',
                      }}
                    >
                      {p.key}
                    </TableCell>
                    <TableCell
                      sx={{
                        fontSize: 12,
                        fontFamily: p.type === 'number' ? 'monospace' : 'inherit',
                        wordBreak: 'break-all',
                        py: 0.8,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <span>{p.value}</span>
                        <Box
                          className="copy-btn"
                          sx={{ opacity: 0.3, transition: 'opacity 0.15s', display: 'inline-flex' }}
                        >
                          <CopyValue value={p.value} />
                        </Box>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        ) : (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            <Typography fontSize={13}>
              {t('argus.userProfiles.noEventProperties', 'No properties for this event')}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default UserProfileEventDetailPanel;
