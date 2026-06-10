import React from 'react';
import {
  Box,
  Typography,
  Chip,
  CircularProgress,
  useTheme,
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import { formatRelativeTime } from '@/utils/dateFormat';

export interface PatternEntry {
  pattern: string;
  count: number;
  level: string;
  service: string;
  first_seen: string;
  last_seen: string;
  sample_message: string;
}

export interface LogsPatternsPanelProps {
  patterns: PatternEntry[];
  loading: boolean;
  isDark: boolean;
}

const LogsPatternsPanel: React.FC<LogsPatternsPanelProps> = ({
  patterns,
  loading,
  isDark,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Box
      sx={{ px: 1, py: 1, flex: 1, display: 'flex', flexDirection: 'column' }}
    >
      {loading ? (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            py: 8,
          }}
        >
          <CircularProgress size={24} sx={{ mr: 1 }} />
          <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
            {t('argus.logs.patterns.loading', 'Analyzing patterns...')}
          </Typography>
        </Box>
      ) : patterns.length === 0 ? (
        <EmptyPlaceholder
          variant="text"
          icon={<SearchIcon sx={{ fontSize: 48 }} />}
          message={t('argus.logs.patterns.noPatterns', 'No patterns found')}
          description={t(
            'argus.logs.patterns.noPatternsDesc',
            'Try adjusting your search or time range.'
          )}
          sx={{ flex: 1 }}
        />
      ) : (
        <Box sx={{ overflow: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.73rem',
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                }}
              >
                <th
                  style={{
                    textAlign: 'right',
                    padding: '6px 10px',
                    fontWeight: 700,
                    width: 70,
                  }}
                >
                  {t('argus.logs.patterns.count', 'Count')}
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '6px 10px',
                    fontWeight: 700,
                  }}
                >
                  {t('argus.logs.patterns.pattern', 'Pattern')}
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '6px 10px',
                    fontWeight: 700,
                    width: 80,
                  }}
                >
                  {t('argus.logs.patterns.service', 'Service')}
                </th>
                <th
                  style={{
                    textAlign: 'left',
                    padding: '6px 10px',
                    fontWeight: 700,
                    width: 140,
                  }}
                >
                  {t('argus.logs.patterns.lastSeen', 'Last Seen')}
                </th>
              </tr>
            </thead>
            <tbody>
              {patterns.map((p, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                  }}
                >
                  <td
                    style={{
                      textAlign: 'right',
                      padding: '6px 10px',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                      color: theme.palette.primary.main,
                    }}
                  >
                    {Number(p.count).toLocaleString()}
                  </td>
                  <td
                    style={{
                      padding: '6px 10px',
                      fontSize: '0.70rem',
                      wordBreak: 'break-all',
                      opacity: 0.85,
                    }}
                  >
                    {p.pattern}
                    <br />
                    <span
                      style={{
                        fontSize: '0.65rem',
                        color: isDark
                          ? 'rgba(255,255,255,0.35)'
                          : 'rgba(0,0,0,0.35)',
                      }}
                    >
                      {p.sample_message?.slice(0, 120)}
                    </span>
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <Chip
                      label={p.service || '-'}
                      size="small"
                      variant="outlined"
                      sx={{ height: 18, fontSize: '0.62rem' }}
                    />
                  </td>
                  <td
                    style={{
                      padding: '6px 10px',
                      fontSize: '0.68rem',
                      color: 'text.secondary',
                    }}
                  >
                    {p.last_seen ? formatRelativeTime(p.last_seen) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}
    </Box>
  );
};

export default LogsPatternsPanel;
