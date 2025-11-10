import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Stack,
  Divider,
  Alert,
  Tabs,
  Tab,
  TextField,
  Button,
  CircularProgress,
  Collapse,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  ContentCopy as ContentCopyIcon,
  PlayArrow as PlayArrowIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material/styles';
import Editor from '@monaco-editor/react';
import { useSnackbar } from 'notistack';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import ResizableDrawer from '../common/ResizableDrawer';

interface IngamePopupNoticeGuideDrawerProps {
  open: boolean;
  onClose: () => void;
}

const IngamePopupNoticeGuideDrawer: React.FC<IngamePopupNoticeGuideDrawerProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { enqueueSnackbar } = useSnackbar();

  const [mainTabValue, setMainTabValue] = useState(0);
  const [errorTabValue, setErrorTabValue] = useState(0);
  const [apiToken, setApiToken] = useState('gatrix-unsecured-server-api-token'); // Default to unsecured server token
  const [applicationName, setApplicationName] = useState('MyGameServer');
  const [testResponse, setTestResponse] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testDuration, setTestDuration] = useState<number | null>(null);
  const [testStatus, setTestStatus] = useState<number | null>(null);
  const [requestHeaders, setRequestHeaders] = useState<Record<string, string>>({});
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [expandedRequestHeaders, setExpandedRequestHeaders] = useState(false);
  const [expandedResponseHeaders, setExpandedResponseHeaders] = useState(false);
  const [expandedRequestHeadersDetail, setExpandedRequestHeadersDetail] = useState(false);
  const [expandedResponseHeadersDetail, setExpandedResponseHeadersDetail] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ingamePopupNoticeGuideDrawer_testInputs');
      if (saved) {
        const { apiToken: savedToken, applicationName: savedAppName } = JSON.parse(saved);
        if (savedToken) setApiToken(savedToken);
        if (savedAppName) setApplicationName(savedAppName);
      }
    } catch (error) {
      // Silently ignore localStorage errors
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('ingamePopupNoticeGuideDrawer_testInputs', JSON.stringify({ apiToken, applicationName }));
    } catch (error) {
      // Silently ignore localStorage errors
    }
  }, [apiToken, applicationName]);

  const handleCopyCode = (code: string) => {
    copyToClipboardWithNotification(
      code,
      () => enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
  };

  const handleTestAPI = async () => {
    if (!applicationName.trim()) {
      setTestError(t('ingamePopupNotices.sdkGuideDrawer.headerAppName') + ' ' + (t('common.isRequired') || 'is required'));
      setExpandedResponseHeaders(true);
      return;
    }

    setTestLoading(true);
    setTestError(null);
    setTestResponse(null);
    setTestStatus(null);
    setTestDuration(null);
    setRequestHeaders({});
    setResponseHeaders({});
    setExpandedRequestHeaders(false);
    setExpandedResponseHeaders(false);

    try {
      const startTime = performance.now();

      const headers = {
        'Content-Type': 'application/json',
        'X-Application-Name': applicationName,
        'X-API-Token': apiToken,
      };

      setRequestHeaders(headers);

      const response = await fetch('/api/v1/server/ingame-popup-notices', {
        method: 'GET',
        headers,
      });

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      setTestDuration(duration);
      setTestStatus(response.status);

      const resHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        resHeaders[key] = value;
      });
      setResponseHeaders(resHeaders);

      const data = await response.json();
      setTestResponse(data);
      setExpandedResponseHeaders(true);

      if (!response.ok) {
        setTestError(`HTTP ${response.status}: ${data.message || 'Request failed'}`);
      } else {
        setTestError(null);
      }
    } catch (error) {
      setTestError(error instanceof Error ? error.message : 'Unknown error occurred');
      setExpandedResponseHeaders(true);
    } finally {
      setTestLoading(false);
    }
  };

  const CodeBlock: React.FC<{ code: string; language: string; title?: string }> = ({
    code,
    language,
    title,
  }) => (
    <Box sx={{ mb: 2 }}>
      {title && (
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          {title}
        </Typography>
      )}
      <Box
        sx={{
          position: 'relative',
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            p: 0.5,
            backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Tooltip title={t('common.copy') || 'Copy'}>
            <IconButton
              size="small"
              onClick={() => handleCopyCode(code)}
              sx={{ color: 'primary.main' }}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ height: 200, overflow: 'hidden' }}>
          <Editor
            height="100%"
            language={language}
            value={code}
            theme={isDark ? 'vs-dark' : 'light'}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              automaticLayout: true,
              fontSize: 12,
              lineNumbers: 'on',
              folding: true,
              padding: { top: 8, bottom: 8 },
            }}
          />
        </Box>
      </Box>
    </Box>
  );

  const curlExample = `# Ingame Popup Notice Server SDK API Example
curl -X GET "http://localhost:5000/api/v1/server/ingame-popup-notices" \\
  -H "Content-Type: application/json" \\
  -H "X-Application-Name: MyGameServer" \\
  -H "X-API-Token: your-server-api-token-here"`;

  const jsonResponse = `{
  "success": true,
  "data": [
    {
      "id": 1,
      "content": "Game update notice",
      "displayPriority": 100,
      "startDate": "2025-01-01T00:00:00Z",
      "endDate": "2025-12-31T23:59:59Z",
      "showOnce": false
    },
    {
      "id": 2,
      "content": "New event started",
      "displayPriority": 90,
      "startDate": "2025-01-15T00:00:00Z",
      "endDate": "2025-01-31T23:59:59Z",
      "showOnce": true
    }
  ]
}`;

  const errorUnauthorized = `{
  "success": false,
  "message": "X-API-Token header is required"
}`;

  const errorInvalidToken = `{
  "success": false,
  "message": "Invalid or expired API token"
}`;

  const errorServerError = `{
  "success": false,
  "message": "Internal server error"
}`;

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={t('ingamePopupNotices.sdkGuideDrawer.title')}
      subtitle={t('ingamePopupNotices.sdkGuideDrawer.subtitle')}
      defaultWidth={600}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 2 }}>
          <Tabs value={mainTabValue} onChange={(e, newValue) => setMainTabValue(newValue)}>
            <Tab label={t('ingamePopupNotices.sdkGuideDrawer.tabGuide')} />
            <Tab label={t('ingamePopupNotices.sdkGuideDrawer.tabTest')} />
          </Tabs>
        </Box>

        <Box sx={{ p: 3, overflow: 'auto', flex: 1 }}>
          {mainTabValue === 0 && (
            <>
              <Alert severity="info" sx={{ mb: 3 }}>
                {t('ingamePopupNotices.sdkGuideDrawer.description')}
              </Alert>

              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {t('ingamePopupNotices.sdkGuideDrawer.endpoint')}
              </Typography>
              <Box
                sx={{
                  p: 2,
                  mb: 3,
                  backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#f5f5f5',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  borderRadius: 1,
                }}
              >
                <Typography component="div" sx={{ mb: 1 }}>
                  <strong>{t('ingamePopupNotices.sdkGuideDrawer.method')}:</strong> GET
                </Typography>
                <Typography component="div" sx={{ wordBreak: 'break-all' }}>
                  /api/v1/server/ingame-popup-notices
                </Typography>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {t('ingamePopupNotices.sdkGuideDrawer.requiredHeaders')}
              </Typography>
              <Stack spacing={1} sx={{ mb: 3 }}>
                <Typography variant="body2">
                  • <strong>X-API-Token</strong>: {t('ingamePopupNotices.sdkGuideDrawer.headerApiToken')}
                </Typography>
                <Typography variant="body2">
                  • <strong>X-Application-Name</strong>: {t('ingamePopupNotices.sdkGuideDrawer.headerAppName')}
                </Typography>
                <Typography variant="body2">
                  • <strong>Content-Type</strong>: {t('ingamePopupNotices.sdkGuideDrawer.headerContentType')}
                </Typography>
              </Stack>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                curl {t('common.example') || 'Example'}
              </Typography>
              <CodeBlock code={curlExample} language="bash" />

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {t('ingamePopupNotices.sdkGuideDrawer.responseExample')}
              </Typography>
              <CodeBlock code={jsonResponse} language="json" />

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {t('ingamePopupNotices.sdkGuideDrawer.responseFields')}
              </Typography>
              <TableContainer sx={{ mb: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#f5f5f5' }}>
                      <TableCell sx={{ fontWeight: 600, width: '20%' }}>{t('common.fieldName') || 'Field'}</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: '30%' }}>{t('common.type') || 'Type'}</TableCell>
                      <TableCell sx={{ fontWeight: 600, width: '50%' }}>{t('common.description') || 'Description'}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>id</Typography></TableCell>
                      <TableCell><Typography variant="body2">number</Typography></TableCell>
                      <TableCell><Typography variant="body2">{t('ingamePopupNotices.sdkGuideDrawer.fieldId')}</Typography></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>content</Typography></TableCell>
                      <TableCell><Typography variant="body2">string</Typography></TableCell>
                      <TableCell><Typography variant="body2">{t('ingamePopupNotices.sdkGuideDrawer.fieldContent')}</Typography></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>displayPriority</Typography></TableCell>
                      <TableCell><Typography variant="body2">number</Typography></TableCell>
                      <TableCell><Typography variant="body2">{t('ingamePopupNotices.sdkGuideDrawer.fieldDisplayPriority')}</Typography></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>startDate</Typography></TableCell>
                      <TableCell><Typography variant="body2">string</Typography></TableCell>
                      <TableCell><Typography variant="body2">{t('ingamePopupNotices.sdkGuideDrawer.fieldStartDate')}</Typography></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>endDate</Typography></TableCell>
                      <TableCell><Typography variant="body2">string</Typography></TableCell>
                      <TableCell><Typography variant="body2">{t('ingamePopupNotices.sdkGuideDrawer.fieldEndDate')}</Typography></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Typography variant="body2" sx={{ fontWeight: 600 }}>showOnce</Typography></TableCell>
                      <TableCell><Typography variant="body2">boolean</Typography></TableCell>
                      <TableCell><Typography variant="body2">{t('ingamePopupNotices.sdkGuideDrawer.fieldShowOnce')}</Typography></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {t('clientVersions.sdkGuideDrawer.errorResponses')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                {t('ingamePopupNotices.sdkGuideDrawer.errorResponsesDesc')}
              </Typography>

              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={errorTabValue} onChange={(e, newValue) => setErrorTabValue(newValue)} variant="scrollable" scrollButtons="auto">
                  <Tab label="401 - Missing Headers" />
                  <Tab label="401 - Invalid Token" />
                  <Tab label="500 - Server Error" />
                </Tabs>
              </Box>

              {errorTabValue === 0 && <CodeBlock code={errorUnauthorized} language="json" />}
              {errorTabValue === 1 && <CodeBlock code={errorInvalidToken} language="json" />}
              {errorTabValue === 2 && <CodeBlock code={errorServerError} language="json" />}
            </>
          )}

          {mainTabValue === 1 && (
            <>
              <Box sx={{ mb: 3 }}>
                <Box
                  onClick={() => setExpandedRequestHeaders(!expandedRequestHeaders)}
                  sx={{
                    p: 1.5,
                    backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#e3f2fd',
                    borderRadius: 1,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: `2px solid ${theme.palette.primary.main}`,
                    '&:hover': { backgroundColor: theme.palette.mode === 'dark' ? '#252525' : '#bbdefb' },
                  }}
                >
                  <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
                    {t('ingamePopupNotices.sdkGuideDrawer.request')}
                  </Typography>
                  <Box sx={{ transform: expandedRequestHeaders ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s', color: theme.palette.primary.main }}>
                    ▼
                  </Box>
                </Box>
                <Collapse in={expandedRequestHeaders}>
                  <Box sx={{ p: 2, backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#fafafa', borderRadius: 1, mt: 0.5 }}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                        {t('ingamePopupNotices.sdkGuideDrawer.parameters')}
                      </Typography>
                      <Box sx={{
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        overflow: 'hidden'
                      }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 0 }}>
                          {/* Application Name */}
                          <Box sx={{
                            p: 1.5,
                            backgroundColor: theme.palette.mode === 'dark' ? '#2a2a2a' : '#f5f5f5',
                            display: 'flex',
                            alignItems: 'center',
                            fontWeight: 500,
                            fontSize: '0.875rem'
                          }}>
                            X-Application-Name *
                          </Box>
                          <Box sx={{
                            p: 1,
                            borderLeft: `1px solid ${theme.palette.divider}`
                          }}>
                            <TextField
                              value={applicationName}
                              onChange={(e) => setApplicationName(e.target.value)}
                              size="small"
                              fullWidth
                              placeholder="e.g., MyGameServer"
                              sx={{ '& .MuiInputBase-root': { fontSize: '0.875rem' } }}
                            />
                          </Box>
                        </Box>
                      </Box>
                    </Box>

                    {Object.keys(requestHeaders).length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Box
                          onClick={() => setExpandedRequestHeadersDetail(!expandedRequestHeadersDetail)}
                          sx={{
                            p: 1,
                            backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#f0f0f0',
                            borderRadius: 0.5,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            '&:hover': { backgroundColor: theme.palette.mode === 'dark' ? '#252525' : '#e8e8e8' },
                          }}
                        >
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {t('ingamePopupNotices.sdkGuideDrawer.headers')} ({Object.keys(requestHeaders).length})
                          </Typography>
                          <Box sx={{ transform: expandedRequestHeadersDetail ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s', fontSize: '0.8rem' }}>
                            ▼
                          </Box>
                        </Box>
                        <Collapse in={expandedRequestHeadersDetail}>
                          <Stack spacing={0.5} sx={{ pl: 1, pt: 1 }}>
                            {Object.entries(requestHeaders).map(([key, value]) => (
                              <Box key={key} sx={{ display: 'flex', gap: 1 }}>
                                <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 150, color: 'primary.main' }}>
                                  {key}:
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
                                  {String(value)}
                                </Typography>
                              </Box>
                            ))}
                          </Stack>
                        </Collapse>
                      </Box>
                    )}

                    <Button
                      variant="contained"
                      startIcon={testLoading ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <PlayArrowIcon />}
                      onClick={handleTestAPI}
                      disabled={testLoading}
                      fullWidth
                    >
                      {t('ingamePopupNotices.sdkGuideDrawer.apiTest')}
                    </Button>
                  </Box>
                </Collapse>
              </Box>

              {testResponse && (
                <Box sx={{ mb: 3 }}>
                  <Box
                    onClick={() => setExpandedResponseHeaders(!expandedResponseHeaders)}
                    sx={{
                      p: 1.5,
                      backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#e3f2fd',
                      borderRadius: 1,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: `2px solid ${theme.palette.primary.main}`,
                      '&:hover': { backgroundColor: theme.palette.mode === 'dark' ? '#252525' : '#bbdefb' },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, color: theme.palette.primary.main }}>
                        {t('ingamePopupNotices.sdkGuideDrawer.response')}
                      </Typography>
                      {testStatus && (
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('ingamePopupNotices.sdkGuideDrawer.status')}</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {testStatus === 200 ? <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} /> : <ErrorIcon sx={{ fontSize: 16, color: 'error.main' }} />}
                              {testStatus} {testStatus === 200 ? 'OK' : 'Error'}
                            </Typography>
                          </Box>
                          {testDuration !== null && (
                            <Box>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('ingamePopupNotices.sdkGuideDrawer.time')}</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{testDuration}ms</Typography>
                            </Box>
                          )}
                          {Object.keys(responseHeaders).length > 0 && (
                            <Box>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('ingamePopupNotices.sdkGuideDrawer.size')}</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {new Blob([JSON.stringify(testResponse)]).size} bytes
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ transform: expandedResponseHeaders ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s', color: theme.palette.primary.main }}>
                      ▼
                    </Box>
                  </Box>
                  <Collapse in={expandedResponseHeaders}>
                    <Box sx={{ p: 2, backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#fafafa', borderRadius: 1, mt: 0.5 }}>
                      {testError && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                          {testError}
                        </Alert>
                      )}

                      {Object.keys(responseHeaders).length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Box
                            onClick={() => setExpandedResponseHeadersDetail(!expandedResponseHeadersDetail)}
                            sx={{
                              p: 1,
                              backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#f0f0f0',
                              borderRadius: 0.5,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              '&:hover': { backgroundColor: theme.palette.mode === 'dark' ? '#252525' : '#e8e8e8' },
                            }}
                          >
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                              {t('ingamePopupNotices.sdkGuideDrawer.headers')} ({Object.keys(responseHeaders).length})
                            </Typography>
                            <Box sx={{ transform: expandedResponseHeadersDetail ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s', fontSize: '0.8rem' }}>
                              ▼
                            </Box>
                          </Box>
                          <Collapse in={expandedResponseHeadersDetail}>
                            <Stack spacing={0.5} sx={{ pl: 1, pt: 1 }}>
                              {Object.entries(responseHeaders).map(([key, value]) => (
                                <Box key={key} sx={{ display: 'flex', gap: 1 }}>
                                  <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 150, color: 'primary.main' }}>
                                    {key}:
                                  </Typography>
                                  <Typography variant="caption" sx={{ color: 'text.secondary', wordBreak: 'break-all' }}>
                                    {String(value)}
                                  </Typography>
                                </Box>
                              ))}
                            </Stack>
                          </Collapse>
                        </Box>
                      )}

                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                          {t('ingamePopupNotices.sdkGuideDrawer.body')}
                        </Typography>
                        <Box
                          sx={{
                            position: 'relative',
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 1,
                            overflow: 'hidden',
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'flex-end',
                              p: 0.5,
                              backgroundColor: theme.palette.mode === 'dark' ? '#0e0e0e' : '#f0f0f0',
                              borderBottom: `1px solid ${theme.palette.divider}`,
                            }}
                          >
                            <Tooltip title={t('common.copy') || 'Copy'}>
                              <IconButton
                                size="small"
                                onClick={() => {
                                  handleCopyCode(JSON.stringify(testResponse, null, 2));
                                }}
                                sx={{ color: 'primary.main' }}
                              >
                                <ContentCopyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                          <Box sx={{ height: 600, overflow: 'hidden' }}>
                            <Editor
                              height="100%"
                              language="json"
                              value={JSON.stringify(testResponse, null, 2)}
                              theme={isDark ? 'vs-dark' : 'light'}
                              options={{
                                readOnly: true,
                                minimap: { enabled: false },
                                scrollBeyondLastLine: false,
                                wordWrap: 'on',
                                automaticLayout: true,
                                fontSize: 12,
                                lineNumbers: 'on',
                                folding: true,
                                padding: { top: 8, bottom: 8 },
                              }}
                            />
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </Collapse>
                </Box>
              )}
            </>
          )}
        </Box>
      </Box>
    </ResizableDrawer>
  );
};

export default IngamePopupNoticeGuideDrawer;

