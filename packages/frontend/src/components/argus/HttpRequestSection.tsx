/**
 * HttpRequestSection — G28: Dedicated HTTP request display.
 *
 * Promotes HTTP context data from generic contexts into a dedicated,
 * well-formatted section with method badge, URL, headers, query params,
 * body, and cookies in collapsible sub-sections.
 */
import React, { useState } from 'react';
import {
  Box, Typography, Paper, Chip, IconButton, Collapse,
  Table, TableRow, TableCell, TableBody,
  Tooltip, alpha, useTheme,
} from '@mui/material';
import {
  Http as HttpIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface HttpRequestData {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  query_string?: string | Record<string, string>;
  data?: any;
  cookies?: Record<string, string>;
  env?: Record<string, string>;
  fragment?: string;
}

interface HttpRequestSectionProps {
  request: HttpRequestData;
}

const METHOD_COLORS: Record<string, string> = {
  GET: '#4caf50',
  POST: '#2196f3',
  PUT: '#ff9800',
  PATCH: '#9c27b0',
  DELETE: '#f44336',
  HEAD: '#607d8b',
  OPTIONS: '#795548',
};

const CollapsibleKV: React.FC<{
  title: string;
  data: Record<string, string> | undefined;
  isDark: boolean;
}> = ({ title, data, isDark }) => {
  const [open, setOpen] = useState(false);
  if (!data || Object.keys(data).length === 0) return null;

  return (
    <Box sx={{ mb: 0.5 }}>
      <Box
        onClick={() => setOpen(!open)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 0.5,
          px: 2, py: 0.5, cursor: 'pointer',
          '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' },
        }}
      >
        <IconButton size="small" sx={{ width: 16, height: 16 }}>
          {open ? <CollapseIcon sx={{ fontSize: 12 }} /> : <ExpandIcon sx={{ fontSize: 12 }} />}
        </IconButton>
        <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase' }}>
          {title}
        </Typography>
        <Chip label={Object.keys(data).length} size="small" sx={{ height: 14, fontSize: '0.5rem' }} />
      </Box>
      <Collapse in={open}>
        <Table size="small" sx={{ mx: 2, mb: 1, width: 'calc(100% - 32px)' }}>
          <TableBody>
            {Object.entries(data).map(([key, value]) => (
              <TableRow key={key} sx={{ '&:last-child td': { borderBottom: 0 } }}>
                <TableCell sx={{ py: 0.25, px: 1, width: '30%', verticalAlign: 'top' }}>
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary', fontWeight: 600 }}>
                    {key}
                  </Typography>
                </TableCell>
                <TableCell sx={{ py: 0.25, px: 1 }}>
                  <Typography sx={{
                    fontSize: '0.68rem', wordBreak: 'break-all', whiteSpace: 'pre-wrap',
                  }}>
                    {value}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Collapse>
    </Box>
  );
};

const HttpRequestSection: React.FC<HttpRequestSectionProps> = ({ request }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const [expanded, setExpanded] = useState(true);

  if (!request || (!request.url && !request.method)) return null;

  const method = (request.method || 'GET').toUpperCase();
  const methodColor = METHOD_COLORS[method] || '#607d8b';

  const queryParams = typeof request.query_string === 'string'
    ? Object.fromEntries(new URLSearchParams(request.query_string))
    : request.query_string;

  const handleCopyUrl = () => {
    if (request.url) navigator.clipboard.writeText(request.url);
  };

  return (
    <Paper
      elevation={0}
      sx={{
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: 2, overflow: 'hidden', mb: 1.5,
      }}
    >
      {/* Header */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          px: 2, py: 1, cursor: 'pointer',
          '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' },
        }}
      >
        <HttpIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, flex: 1 }}>
          {t('argus.httpRequest.title')}
        </Typography>
        <IconButton size="small" sx={{ width: 20, height: 20 }}>
          {expanded ? <CollapseIcon sx={{ fontSize: 14 }} /> : <ExpandIcon sx={{ fontSize: 14 }} />}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        {/* Method + URL */}
        <Box sx={{ px: 2, pb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={method}
            size="small"
            sx={{
              height: 22, fontSize: '0.68rem', fontWeight: 800, letterSpacing: 0.5,
              backgroundColor: alpha(methodColor, 0.1),
              color: methodColor,
              borderRadius: '4px',
            }}
          />
          <Typography sx={{
            fontSize: '0.75rem', color: 'text.primary', wordBreak: 'break-all', flex: 1,
          }}>
            {request.url}
          </Typography>
          <Tooltip title={t('argus.httpRequest.copyUrl')}>
            <IconButton size="small" onClick={handleCopyUrl} sx={{ width: 22, height: 22 }}>
              <CopyIcon sx={{ fontSize: 12 }} />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Collapsible sub-sections */}
        <CollapsibleKV title={t('argus.httpRequest.headers')} data={request.headers} isDark={isDark} />
        <CollapsibleKV title={t('argus.httpRequest.queryParams')} data={queryParams} isDark={isDark} />
        <CollapsibleKV title={t('argus.httpRequest.cookies')} data={request.cookies} isDark={isDark} />
        <CollapsibleKV title={t('argus.httpRequest.env')} data={request.env} isDark={isDark} />

        {/* Body */}
        {request.data && (
          <Box sx={{ px: 2, pb: 1.5 }}>
            <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', mb: 0.5 }}>
              {t('argus.httpRequest.body')}
            </Typography>
            <Box sx={{
              p: 1.5, borderRadius: '6px',
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
              fontSize: '0.7rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              maxHeight: 200, overflow: 'auto',
            }}>
              {typeof request.data === 'object'
                ? JSON.stringify(request.data, null, 2)
                : String(request.data)
              }
            </Box>
          </Box>
        )}
      </Collapse>
    </Paper>
  );
};

export default HttpRequestSection;
