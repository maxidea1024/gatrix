import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Stack,
  Divider,
  Alert,
  Paper,
  Tabs,
  Tab,
  TextField,
  Button,
  CircularProgress,
  Collapse,
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as ContentCopyIcon,
  PlayArrow as PlayArrowIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material/styles';
import Editor from '@monaco-editor/react';
import { useSnackbar } from 'notistack';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import ResizableDrawer from '../common/ResizableDrawer';
import { useEnvironment } from '../../contexts/EnvironmentContext';
import { getBackendUrl } from '../../utils/backendUrl';

interface GameWorldSDKGuideDrawerProps {
  open: boolean;
  onClose: () => void;
}

const GameWorldSDKGuideDrawer: React.FC<GameWorldSDKGuideDrawerProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { enqueueSnackbar } = useSnackbar();
  const { currentEnvironmentId } = useEnvironment();
  const backendUrl = getBackendUrl();

  const [mainTabValue, setMainTabValue] = useState(0);
  const [errorTabValue, setErrorTabValue] = useState(0);

  // API test state
  const [apiToken, setApiToken] = useState('gatrix-unsecured-server-api-token'); // Default to unsecured server token
  const [page, setPage] = useState('1');
  const [limit, setLimit] = useState('10');
  const [lang, setLang] = useState(''); // Optional language parameter for maintenance message
  const [testResponse, setTestResponse] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [requestHeaders, setRequestHeaders] = useState<Record<string, string>>({});
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [expandedRequestHeaders, setExpandedRequestHeaders] = useState(true);
  const [expandedResponseHeaders, setExpandedResponseHeaders] = useState(false);
  const [expandedRequestHeadersDetail, setExpandedRequestHeadersDetail] = useState(false);
  const [expandedResponseHeadersDetail, setExpandedResponseHeadersDetail] = useState(false);
  const [testDuration, setTestDuration] = useState<number | null>(null);
  const [testStatus, setTestStatus] = useState<number | null>(null);

  // Load saved values from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gameWorldSDKGuide_testInputs');
      if (saved) {
        const { apiToken: savedToken } = JSON.parse(saved);
        if (savedToken) setApiToken(savedToken);
      }
    } catch (error) {
      // Silently ignore localStorage errors
    }
  }, []);

  // Save values to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('gameWorldSDKGuide_testInputs', JSON.stringify({
        apiToken,
      }));
    } catch (error) {
      // Silently ignore localStorage errors
    }
  }, [apiToken]);

  // curl example code
  const curlExample = `# Get Game Worlds List API Example
curl -X GET "${backendUrl}/api/v1/server/${currentEnvironmentId || 'your-environment'}/game-worlds" \\
  -H "Content-Type: application/json" \\
  -H "X-Application-Name: MyGameApp" \\
  -H "X-API-Token: your-api-token-here"`;

  // JSON response example
  const jsonResponse = `{
  "success": true,
  "data": {
    "worlds": [
      {
        "worldId": "world_001",
        "name": "Main World",
        "isMaintenance": false,
        "worldServerAddress": "https://world-001.example.com",
        "customPayload": {
          "region": "asia",
          "maxPlayers": 1000
        },
        "tags": ["adventure", "pve"]
      },
      {
        "worldId": "world_002",
        "name": "PvP Arena",
        "isMaintenance": true,
        "maintenanceMessage": "Server maintenance in progress. Expected completion: 2025-10-30 14:00 UTC",
        "worldServerAddress": "world-002.example.com:8080",
        "customPayload": null,
        "tags": ["pvp"]
      }
    ]
  }
}`;

  // Error response examples
  const errorMissingHeaders = `{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETERS",
    "message": "Missing required headers",
    "details": {
      "missing": ["X-API-Token", "X-Application-Name"]
    }
  }
}`;

  const errorUnauthorized = `{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid API token",
    "details": {
      "reason": "INVALID_TOKEN"
    }
  }
}`;

  const errorInvalidParams = `{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETERS",
    "message": "Invalid query parameters",
    "details": {
      "reason": "INVALID_PAGE_OR_LIMIT"
    }
  }
}`;

  const handleCopyCode = (code: string) => {
    copyToClipboardWithNotification(
      code,
      () => enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
  };

  const handleTestAPI = async () => {
    // Validation
    if (!apiToken.trim()) {
      setValidationError(t('gameWorlds.sdkGuide.apiTokenRequired') || 'API Token is required');
      return;
    }

    setValidationError(null);
    setTestLoading(true);
    setTestError(null);
    setTestResponse(null);
    setTestStatus(null);
    setTestDuration(null);
    // Keep request section open
    setExpandedResponseHeaders(false);

    const startTime = performance.now();

    try {
      const envPath = currentEnvironmentId || 'default';
      const url = `/api/v1/server/${envPath}/game-worlds`;

      const response = await fetch(
        url,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Application-Name': 'gatrix-frontend-tester',
            'X-API-Token': apiToken,
          },
        }
      );

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      const data = await response.json();
      setTestResponse(data);
      setTestStatus(response.status);
      setTestDuration(duration);

      setRequestHeaders({
        'Content-Type': 'application/json',
        'X-Application-Name': 'gatrix-frontend-tester',
        'X-API-Token': apiToken,
      });

      setResponseHeaders({
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Status': `${response.status} ${response.statusText}`,
      });

      setExpandedResponseHeaders(true);

      if (!response.ok) {
        setTestError(`HTTP ${response.status}: ${data.error?.message || 'Request failed'}`);
      } else {
        setTestError(null);
      }
    } catch (error) {
      setTestError(error instanceof Error ? error.message : 'Unknown error occurred');
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

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={t('gameWorlds.sdkGuide.title')}
      subtitle={t('gameWorlds.sdkGuide.subtitle')}
      defaultWidth={600}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Main Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 2 }}>
          <Tabs value={mainTabValue} onChange={(e, newValue) => setMainTabValue(newValue)}>
            <Tab label={t('gameWorlds.sdkGuide.tabGuide')} />
            <Tab label={t('gameWorlds.sdkGuide.tabApiTest')} />
          </Tabs>
        </Box>

        {/* Content */}
        <Box sx={{ p: 3, overflow: 'auto', flex: 1 }}>
          {/* Tab 1: SDK Guide */}
          {mainTabValue === 0 && (
            <>
              {/* Description */}
              <Alert severity="info" sx={{ mb: 3 }}>
                {t('gameWorlds.sdkGuide.description')}
              </Alert>

              {/* Endpoint */}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {t('gameWorlds.sdkGuide.endpoint')}
              </Typography>
              <Paper
                sx={{
                  p: 2,
                  mb: 3,
                  backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#f5f5f5',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                }}
              >
                <Typography component="div" sx={{ mb: 1 }}>
                  <strong>{t('gameWorlds.sdkGuide.method')}:</strong> GET
                </Typography>
                <Typography component="div" sx={{ wordBreak: 'break-all' }}>
                  /api/v1/server/{'{environment}'}/game-worlds
                </Typography>
              </Paper>

              <Divider sx={{ my: 3 }} />

              {/* Parameters */}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {t('gameWorlds.sdkGuide.parameters')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                {t('gameWorlds.sdkGuide.noParameters')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                {t('gameWorlds.sdkGuide.optionalParameters')}
              </Typography>

              <Divider sx={{ my: 3 }} />

              {/* Required Headers */}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {t('gameWorlds.sdkGuide.requiredHeaders')}
              </Typography>
              <Stack spacing={1} sx={{ mb: 3 }}>
                <Typography variant="body2">
                  • <strong>X-API-Token</strong>: {t('gameWorlds.sdkGuide.headerApiToken')}
                </Typography>
                <Typography variant="body2">
                  • <strong>X-Application-Name</strong>: {t('gameWorlds.sdkGuide.headerAppName')}
                </Typography>
                <Typography variant="body2">
                  • <strong>Content-Type</strong>: {t('gameWorlds.sdkGuide.headerContentType')}
                </Typography>
              </Stack>

              <Divider sx={{ my: 3 }} />

              {/* curl Example */}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                curl {t('common.example') || 'Example'}
              </Typography>
              <CodeBlock code={curlExample} language="bash" />

              <Divider sx={{ my: 3 }} />

              {/* Response Example */}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {t('gameWorlds.sdkGuide.responseExample')}
              </Typography>
              <CodeBlock code={jsonResponse} language="json" />

              <Divider sx={{ my: 3 }} />

              {/* Response Fields Description */}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {t('gameWorlds.sdkGuide.responseFields')}
              </Typography>
              <Box sx={{ overflowX: 'auto', mb: 3 }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.875rem',
                }}>
                  <thead>
                    <tr style={{
                      backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#f5f5f5',
                      borderBottom: `2px solid ${theme.palette.divider}`,
                    }}>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        borderRight: `1px solid ${theme.palette.divider}`,
                      }}>
                        {t('common.fieldName')}
                      </th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontWeight: 600,
                        borderRight: `1px solid ${theme.palette.divider}`,
                      }}>
                        Type
                      </th>
                      <th style={{
                        padding: '12px',
                        textAlign: 'left',
                        fontWeight: 600,
                      }}>
                        {t('common.description')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { field: 'worldId', type: 'string', desc: 'fieldWorldIdDesc' },
                      { field: 'name', type: 'string', desc: 'fieldNameDesc' },
                      { field: 'isMaintenance', type: 'boolean', desc: 'fieldIsMaintenanceDesc' },
                      { field: 'maintenanceMessage', type: 'string', desc: 'fieldMaintenanceMessageDesc' },
                      { field: 'worldServerAddress', type: 'string', desc: 'fieldWorldServerAddressDesc' },
                      { field: 'customPayload', type: 'object', desc: 'fieldCustomPayloadDesc' },
                      { field: 'tags', type: 'array', desc: 'fieldTagsDesc' },
                    ].map((row, idx) => (
                      <tr key={idx} style={{
                        borderBottom: `1px solid ${theme.palette.divider}`,
                      }}>
                        <td style={{
                          padding: '12px',
                          borderRight: `1px solid ${theme.palette.divider}`,
                          fontFamily: 'monospace',
                          fontWeight: 500,
                        }}>
                          {row.field}
                        </td>
                        <td style={{
                          padding: '12px',
                          borderRight: `1px solid ${theme.palette.divider}`,
                          fontFamily: 'monospace',
                          color: theme.palette.mode === 'dark' ? '#64b5f6' : '#1976d2',
                        }}>
                          {row.type}
                        </td>
                        <td style={{
                          padding: '12px',
                          color: theme.palette.mode === 'dark' ? '#b0bec5' : '#666',
                        }}>
                          {t(`gameWorlds.sdkGuide.${row.desc}`)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>

              <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>{t('gameWorlds.sdkGuide.maintenanceMessageNote')}</strong>
                </Typography>
                <Typography variant="body2">
                  {t('gameWorlds.sdkGuide.langParameter')}
                </Typography>
              </Alert>

              <Divider sx={{ my: 3 }} />

              {/* Error Codes - Tabbed */}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {t('gameWorlds.sdkGuide.errorCodes')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                {t('gameWorlds.sdkGuide.errorCodesDesc')}
              </Typography>

              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={errorTabValue} onChange={(e, newValue) => setErrorTabValue(newValue)} variant="scrollable" scrollButtons="auto">
                  <Tab label={`400 - ${t('gameWorlds.sdkGuide.missingHeaders')}`} />
                  <Tab label={`401 - ${t('gameWorlds.sdkGuide.unauthorized')}`} />
                  <Tab label={`400 - ${t('gameWorlds.sdkGuide.invalidParams')}`} />
                </Tabs>
              </Box>

              {errorTabValue === 0 && <CodeBlock code={errorMissingHeaders} language="json" />}
              {errorTabValue === 1 && <CodeBlock code={errorUnauthorized} language="json" />}
              {errorTabValue === 2 && <CodeBlock code={errorInvalidParams} language="json" />}
            </>
          )}

          {/* Tab 2: API Test */}
          {mainTabValue === 1 && (
            <>
              {/* REQUEST SECTION */}
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
                    {t('gameWorlds.sdkGuide.request')}
                  </Typography>
                  <Box sx={{ transform: expandedRequestHeaders ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s', color: theme.palette.primary.main }}>
                    ▼
                  </Box>
                </Box>
                <Collapse in={expandedRequestHeaders}>
                  <Box sx={{ p: 2, backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#fafafa', borderRadius: 1, mt: 0.5 }}>
                    {/* Parameters Table */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                        {t('common.queryParameters') || 'Query Parameters'}
                      </Typography>
                      <Box sx={{
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        overflow: 'hidden'
                      }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 0 }}>
                          {/* App Name */}
                          <Box sx={{
                            p: 1.5,
                            backgroundColor: theme.palette.mode === 'dark' ? '#2a2a2a' : '#f5f5f5',
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            display: 'flex',
                            alignItems: 'center',
                            fontWeight: 500,
                            fontSize: '0.875rem'
                          }}>
                            {t('gameWorlds.sdkGuide.testLang')}
                          </Box>
                          <Box sx={{
                            p: 1,
                            borderLeft: `1px solid ${theme.palette.divider}`
                          }}>
                            <TextField
                              value={lang}
                              onChange={(e) => setLang(e.target.value)}
                              size="small"
                              fullWidth
                              placeholder="e.g., ko, en, zh (optional)"
                              sx={{ '& .MuiInputBase-root': { fontSize: '0.875rem' } }}
                            />
                          </Box>
                        </Box>
                      </Box>
                    </Box>

                    {/* Request Headers */}
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
                            {t('gameWorlds.sdkGuide.requestHeaders')} ({Object.keys(requestHeaders).length})
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

                    {/* Test Button */}
                    {/* Curl Preview */}
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                        {t('common.curlPreview') || 'curl Preview'}
                      </Typography>
                      <Box sx={{
                        p: 1.5,
                        backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
                        borderRadius: 1,
                        border: `1px solid ${theme.palette.divider}`,
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        overflow: 'auto',
                        maxHeight: 120,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}>
                        {`curl -X GET "${backendUrl}/api/v1/server/${currentEnvironmentId || 'your-environment'}/game-worlds${lang ? `?lang=${lang}` : ''}" \\
  -H "Content-Type: application/json" \\
  -H "X-Application-Name: gatrix-frontend-tester" \\
  -H "X-API-Token: ${apiToken}"`}
                      </Box>
                    </Box>

                    {/* Validation Error */}
                    {validationError && (
                      <Alert severity="error" sx={{ mb: 2 }}>
                        {validationError}
                      </Alert>
                    )}

                    <Button
                      variant="contained"
                      startIcon={testLoading ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <PlayArrowIcon />}
                      onClick={handleTestAPI}
                      disabled={testLoading}
                      fullWidth
                    >
                      {t('common.request') || 'Request'}
                    </Button>
                  </Box>
                </Collapse>
              </Box>

              {/* RESPONSE SECTION */}
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
                        {t('gameWorlds.sdkGuide.response')}
                      </Typography>
                      {testStatus && (
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('gameWorlds.sdkGuide.testStatus')}</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {testStatus} {testStatus === 200 ? 'OK' : testStatus === 401 ? 'Unauthorized' : testStatus === 400 ? 'Bad Request' : 'Error'}
                            </Typography>
                          </Box>
                          {testDuration !== null && (
                            <Box>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('gameWorlds.sdkGuide.testDuration')}</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{testDuration}ms</Typography>
                            </Box>
                          )}
                          {Object.keys(responseHeaders).length > 0 && (
                            <Box>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('gameWorlds.sdkGuide.testSize')}</Typography>
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
                      {/* Error Message */}
                      {testError && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                          {testError}
                        </Alert>
                      )}

                      {/* Response Headers */}
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
                              {t('gameWorlds.sdkGuide.responseHeaders')} ({Object.keys(responseHeaders).length})
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

                      {/* Response Body */}
                      <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                          {t('gameWorlds.sdkGuide.responseBody')}
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

export default GameWorldSDKGuideDrawer;

