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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as ContentCopyIcon,
  PlayArrow as PlayArrowIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useTheme } from '@mui/material/styles';
import Editor from '@monaco-editor/react';
import { useSnackbar } from 'notistack';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import ResizableDrawer from '../common/ResizableDrawer';
import { useEnvironment } from '../../contexts/EnvironmentContext';
import { getBackendUrl } from '../../utils/backendUrl';

interface ClientVersionGuideDrawerProps {
  open: boolean;
  onClose: () => void;
}

const ClientVersionGuideDrawer: React.FC<ClientVersionGuideDrawerProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { enqueueSnackbar } = useSnackbar();
  const { currentEnvironmentId } = useEnvironment();
  const backendUrl = getBackendUrl();

  // State for main tabs (Guide vs Test)
  const [mainTabValue, setMainTabValue] = useState(0);

  // State for error response tabs
  const [errorTabValue, setErrorTabValue] = useState(0);

  // State for API test
  const [apiToken, setApiToken] = useState('gatrix-unsecured-client-api-token'); // Default to unsecured client token
  const [platform, setPlatform] = useState('ios');
  const [version, setVersion] = useState(''); // Optional - empty means latest
  const [status, setStatus] = useState(''); // Optional status filter
  const [lang, setLang] = useState(''); // Optional - empty means no language filter
  const [testResponse, setTestResponse] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [testStartTime, setTestStartTime] = useState<number | null>(null);
  const [testDuration, setTestDuration] = useState<number | null>(null);
  const [testStatus, setTestStatus] = useState<number | null>(null);
  const [requestHeaders, setRequestHeaders] = useState<Record<string, string>>({});
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [expandedRequestHeaders, setExpandedRequestHeaders] = useState(true);
  const [expandedResponseHeaders, setExpandedResponseHeaders] = useState(false);
  const [expandedRequestHeadersDetail, setExpandedRequestHeadersDetail] = useState(false);
  const [expandedResponseHeadersDetail, setExpandedResponseHeadersDetail] = useState(false);

  // Load saved values from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('clientVersionGuideDrawer_testInputs');
      if (saved) {
        const { apiToken: savedToken, platform: savedPlatform, version: savedVersion, status: savedStatus, lang: savedLang } = JSON.parse(saved);
        if (savedToken) setApiToken(savedToken);
        if (savedPlatform) setPlatform(savedPlatform);
        if (savedVersion !== undefined) setVersion(savedVersion);
        if (savedStatus !== undefined) setStatus(savedStatus);
        if (savedLang) setLang(savedLang);
      }
    } catch (error) {
      // Silently ignore localStorage errors
    }
  }, []);

  // Save values to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('clientVersionGuideDrawer_testInputs', JSON.stringify({
        apiToken,
        platform,
        version,
        status,
        lang,
      }));
    } catch (error) {
      // Silently ignore localStorage errors
    }
  }, [apiToken, platform, version, status, lang]);

  // curl example code
  const curlExample = `# Client Version Query API Example
# Query specific version
curl -X GET "${backendUrl}/api/v1/client/${currentEnvironmentId || 'your-environment'}/client-version?platform=ios&version=1.0.0&lang=ko" \\
  -H "Content-Type: application/json" \\
  -H "X-Application-Name: MyGameApp" \\
  -H "X-API-Token: your-api-token-here"

# Query latest version (omit version parameter)
curl -X GET "${backendUrl}/api/v1/client/${currentEnvironmentId || 'your-environment'}/client-version?platform=ios&lang=ko" \\
  -H "Content-Type: application/json" \\
  -H "X-Application-Name: MyGameApp" \\
  -H "X-API-Token: your-api-token-here"

# Query latest ONLINE version only
curl -X GET "${backendUrl}/api/v1/client/${currentEnvironmentId || 'your-environment'}/client-version?platform=ios&status=ONLINE" \\
  -H "Content-Type: application/json" \\
  -H "X-Application-Name: MyGameApp" \\
  -H "X-API-Token: your-api-token-here"`;

  // JSON response example
  const jsonResponse = `{
  "success": true,
  "data": {
    "platform": "ios",
    "clientVersion": "1.0.0",
    "status": "ONLINE",
    "gameServerAddress": "game.example.com:9000",
    "patchAddress": "patch.example.com",
    "guestModeAllowed": true,
    "externalClickLink": "https://website.example.com",
    "meta": {
      "key1": "value1",
      "key2": "value2",
      "feature1": true,
      "setting1": "value1"
    }
  },
  "cached": false
}`;

  // Maintenance response example
  const maintenanceResponse = `{
  "success": true,
  "data": {
    "platform": "ios",
    "clientVersion": "1.0.0",
    "status": "MAINTENANCE",
    "maintenanceMessage": "서버 점검 중입니다. 잠시 후 다시 시도해주세요.",
    "gameServerAddress": "game.example.com:9000",
    "patchAddress": "patch.example.com",
    "guestModeAllowed": false,
    "externalClickLink": "https://website.example.com",
    "meta": {
      "key1": "value1",
      "key2": "value2"
    }
  },
  "cached": false
}`;

  // Error response examples
  const errorMissingParams = `{
  "success": false,
  "message": "platform is a required query parameter"
}`;

  const errorMissingHeaders = `{
  "success": false,
  "message": "X-Application-Name and X-API-Token headers are required"
}`;

  const errorNotFound = `{
  "success": false,
  "message": "Client version not found"
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
    if (!platform.trim()) {
      setValidationError(t('clientVersions.sdkGuideDrawer.platformRequired') || 'Platform is required');
      return;
    }
    if (!apiToken.trim()) {
      setValidationError(t('clientVersions.sdkGuideDrawer.apiTokenRequired') || 'API Token is required');
      return;
    }

    setValidationError(null);
    setTestLoading(true);
    setTestError(null);
    setTestResponse(null);
    setTestStatus(null);
    setTestDuration(null);
    setRequestHeaders({});
    setResponseHeaders({});
    // Keep request section open, prepare to expand Response
    setExpandedResponseHeaders(false);

    try {
      const params = new URLSearchParams();
      params.append('platform', platform);
      // version is optional - omit to get latest
      if (version && version.trim()) {
        params.append('version', version.trim());
      }
      // status is optional - filter by status when fetching latest
      if (status && status.trim()) {
        params.append('status', status.trim());
      }
      if (lang) {
        params.append('lang', lang);
      }

      const startTime = performance.now();
      setTestStartTime(startTime);

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Application-Name': 'gatrix-frontend-tester',
        'X-API-Token': apiToken,
      };

      setRequestHeaders(headers);

      const envPath = currentEnvironmentId || 'default';
      const response = await fetch(
        `/api/v1/client/${envPath}/client-version?${params.toString()}`,
        {
          method: 'GET',
          headers,
        }
      );

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);
      setTestDuration(duration);
      setTestStatus(response.status);

      // Extract response headers
      const resHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        resHeaders[key] = value;
      });
      setResponseHeaders(resHeaders);

      const data = await response.json();
      setTestResponse(data);

      // Expand Response section when response is received
      setExpandedResponseHeaders(true);

      if (!response.ok) {
        setTestError(`HTTP ${response.status}: ${data.message || 'Request failed'}`);
      } else {
        // Clear error on success
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
      title={t('clientVersions.sdkGuideDrawer.title')}
      subtitle={t('clientVersions.sdkGuideDrawer.subtitle')}
      defaultWidth={600}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Main Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 2 }}>
          <Tabs value={mainTabValue} onChange={(e, newValue) => setMainTabValue(newValue)}>
            <Tab label={t('clientVersions.sdkGuideDrawer.tabGuide')} />
            <Tab label={t('clientVersions.sdkGuideDrawer.tabTest')} />
          </Tabs>
        </Box>

        {/* Content */}
        <Box sx={{ p: 3, overflow: 'auto', flex: 1 }}>
          {/* Tab 1: SDK Guide */}
          {mainTabValue === 0 && (
            <>
              {/* Description */}
              <Alert severity="info" sx={{ mb: 3 }}>
                {t('clientVersions.sdkGuideDrawer.description')}
              </Alert>

              {/* Endpoint */}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {t('clientVersions.sdkGuideDrawer.endpoint')}
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
                  <strong>{t('clientVersions.sdkGuideDrawer.method')}:</strong> GET
                </Typography>
                <Typography component="div" sx={{ wordBreak: 'break-all' }}>
                  /api/v1/client/{'{environment}'}/client-version
                </Typography>
              </Paper>

              <Divider sx={{ my: 3 }} />

              {/* Parameters */}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {t('clientVersions.sdkGuideDrawer.parameters')}
              </Typography>
              <Stack spacing={1} sx={{ mb: 3 }}>
                <Typography variant="body2">
                  • <strong>platform</strong> (required): {t('clientVersions.sdkGuideDrawer.paramPlatform')}
                </Typography>
                <Typography variant="body2">
                  • <strong>version</strong> (required): {t('clientVersions.sdkGuideDrawer.paramClientVersion')}
                </Typography>
                <Typography variant="body2">
                  • <strong>lang</strong> (optional): {t('clientVersions.sdkGuideDrawer.paramLang')}
                </Typography>
              </Stack>

              <Divider sx={{ my: 3 }} />

              {/* Required Headers */}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {t('clientVersions.sdkGuideDrawer.requiredHeaders')}
              </Typography>
              <Stack spacing={1} sx={{ mb: 3 }}>
                <Typography variant="body2">
                  • <strong>X-Application-Name</strong>: {t('clientVersions.sdkGuideDrawer.headerAppName')}
                </Typography>
                <Typography variant="body2">
                  • <strong>X-API-Token</strong>: {t('clientVersions.sdkGuideDrawer.headerApiToken')}
                </Typography>
                <Typography variant="body2">
                  • <strong>Content-Type</strong>: {t('clientVersions.sdkGuideDrawer.headerContentType')}
                </Typography>
              </Stack>

              <Divider sx={{ my: 3 }} />

              {/* curl Example */}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                curl {t('common.example') || 'Example'}
              </Typography>
              <CodeBlock code={curlExample} language="bash" />

              <Divider sx={{ my: 3 }} />

              {/* Response Status Field */}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {t('clientVersions.sdkGuideDrawer.responseStatus')}
              </Typography>
              <Alert severity="info" sx={{ mb: 3 }}>
                {t('clientVersions.sdkGuideDrawer.responseStatusDesc')}
              </Alert>

              {/* Client Status List - Table Format */}
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                {t('clientVersions.sdkGuideDrawer.statusTableHeader')}
              </Typography>
              <TableContainer sx={{ mb: 3, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#f5f5f5' }}>
                      <TableCell sx={{ fontWeight: 600, width: '15%' }}>
                        {t('clientVersions.sdkGuideDrawer.statusTableStatus')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, width: '35%' }}>
                        {t('clientVersions.sdkGuideDrawer.statusTableDescription')}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600, width: '50%' }}>
                        {t('clientVersions.sdkGuideDrawer.statusTableClientAction')}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {/* ONLINE */}
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <CheckCircleIcon sx={{ color: 'success.main', fontSize: 20 }} />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>ONLINE</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{t('clientVersions.sdkGuideDrawer.statusOnline')}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{t('clientVersions.sdkGuideDrawer.statusOnlineAction')}</Typography>
                      </TableCell>
                    </TableRow>

                    {/* MAINTENANCE */}
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <WarningIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>MAINTENANCE</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{t('clientVersions.sdkGuideDrawer.statusMaintenance')}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{t('clientVersions.sdkGuideDrawer.statusMaintenanceAction')}</Typography>
                      </TableCell>
                    </TableRow>

                    {/* OFFLINE */}
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>OFFLINE</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{t('clientVersions.sdkGuideDrawer.statusOffline')}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{t('clientVersions.sdkGuideDrawer.statusOfflineAction')}</Typography>
                      </TableCell>
                    </TableRow>

                    {/* RECOMMENDED_UPDATE */}
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <InfoIcon sx={{ color: 'info.main', fontSize: 20 }} />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>RECOMMENDED_UPDATE</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{t('clientVersions.sdkGuideDrawer.statusRecommendedUpdate')}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{t('clientVersions.sdkGuideDrawer.statusRecommendedUpdateAction')}</Typography>
                      </TableCell>
                    </TableRow>

                    {/* FORCED_UPDATE */}
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>FORCED_UPDATE</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{t('clientVersions.sdkGuideDrawer.statusForcedUpdate')}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{t('clientVersions.sdkGuideDrawer.statusForcedUpdateAction')}</Typography>
                      </TableCell>
                    </TableRow>

                    {/* BLOCKED_PATCH_ALLOWED */}
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>BLOCKED_PATCH_ALLOWED</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{t('clientVersions.sdkGuideDrawer.statusBlockedPatchAllowed')}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{t('clientVersions.sdkGuideDrawer.statusBlockedPatchAllowedAction')}</Typography>
                      </TableCell>
                    </TableRow>

                    {/* UNDER_REVIEW */}
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <WarningIcon sx={{ color: 'warning.main', fontSize: 20 }} />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>UNDER_REVIEW</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{t('clientVersions.sdkGuideDrawer.statusUnderReview')}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{t('clientVersions.sdkGuideDrawer.statusUnderReviewAction')}</Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              <Divider sx={{ my: 3 }} />

              {/* Response Example */}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {t('clientVersions.sdkGuideDrawer.responseExample')} (ONLINE)
              </Typography>
              {t('clientVersions.sdkGuideDrawer.responseDescription') && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {t('clientVersions.sdkGuideDrawer.responseDescription')}
                </Alert>
              )}
              <CodeBlock code={jsonResponse} language="json" />

              <Divider sx={{ my: 3 }} />

              {/* Maintenance Response Example */}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {t('clientVersions.sdkGuideDrawer.maintenanceResponse')}
              </Typography>
              {t('clientVersions.sdkGuideDrawer.maintenanceResponseDesc') && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  {t('clientVersions.sdkGuideDrawer.maintenanceResponseDesc')}
                </Alert>
              )}
              <CodeBlock code={maintenanceResponse} language="json" />

              <Divider sx={{ my: 3 }} />

              {/* Error Response Examples - Tabbed */}
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                {t('clientVersions.sdkGuideDrawer.errorResponses')}
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                {t('clientVersions.sdkGuideDrawer.errorResponsesDesc')}
              </Typography>

              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={errorTabValue} onChange={(e, newValue) => setErrorTabValue(newValue)}>
                  <Tab label="400 - Missing Params" />
                  <Tab label="400 - Missing Headers" />
                  <Tab label="404 - Not Found" />
                </Tabs>
              </Box>

              {errorTabValue === 0 && <CodeBlock code={errorMissingParams} language="json" />}
              {errorTabValue === 1 && <CodeBlock code={errorMissingHeaders} language="json" />}
              {errorTabValue === 2 && <CodeBlock code={errorNotFound} language="json" />}

              <Divider sx={{ my: 3 }} />

              {/* Whitelist Note */}
              {t('clientVersions.sdkGuideDrawer.whitelistNote') && (
                <>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    {t('common.note') || 'Note'}
                  </Typography>
                  <Alert severity="warning">
                    {t('clientVersions.sdkGuideDrawer.whitelistNote')}
                  </Alert>
                </>
              )}
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
                    {t('clientVersions.sdkGuideDrawer.request')}
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
                        Parameters
                      </Typography>
                      <Box sx={{
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1,
                        overflow: 'hidden'
                      }}>
                        <Box sx={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 0 }}>
                          {/* Platform */}
                          <Box sx={{
                            p: 1.5,
                            backgroundColor: theme.palette.mode === 'dark' ? '#2a2a2a' : '#f5f5f5',
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            display: 'flex',
                            alignItems: 'center',
                            fontWeight: 500,
                            fontSize: '0.875rem'
                          }}>
                            Platform *
                          </Box>
                          <Box sx={{
                            p: 1,
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            borderLeft: `1px solid ${theme.palette.divider}`
                          }}>
                            <TextField
                              value={platform}
                              onChange={(e) => setPlatform(e.target.value)}
                              size="small"
                              fullWidth
                              placeholder="e.g., ios, android, pc"
                              sx={{ '& .MuiInputBase-root': { fontSize: '0.875rem' } }}
                            />
                          </Box>

                          {/* Version */}
                          <Box sx={{
                            p: 1.5,
                            backgroundColor: theme.palette.mode === 'dark' ? '#2a2a2a' : '#f5f5f5',
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            display: 'flex',
                            alignItems: 'center',
                            fontWeight: 500,
                            fontSize: '0.875rem'
                          }}>
                            Version
                          </Box>
                          <Box sx={{
                            p: 1,
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            borderLeft: `1px solid ${theme.palette.divider}`
                          }}>
                            <TextField
                              value={version}
                              onChange={(e) => setVersion(e.target.value)}
                              size="small"
                              fullWidth
                              placeholder={t('clientVersions.sdkGuideDrawer.versionPlaceholder')}
                              sx={{ '& .MuiInputBase-root': { fontSize: '0.875rem' } }}
                            />
                          </Box>

                          {/* Status */}
                          <Box sx={{
                            p: 1.5,
                            backgroundColor: theme.palette.mode === 'dark' ? '#2a2a2a' : '#f5f5f5',
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            display: 'flex',
                            alignItems: 'center',
                            fontWeight: 500,
                            fontSize: '0.875rem'
                          }}>
                            Status
                          </Box>
                          <Box sx={{
                            p: 1,
                            borderBottom: `1px solid ${theme.palette.divider}`,
                            borderLeft: `1px solid ${theme.palette.divider}`
                          }}>
                            <FormControl size="small" fullWidth>
                              <Select
                                value={status}
                                onChange={(e) => setStatus(e.target.value)}
                                displayEmpty
                                sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
                              >
                                <MenuItem value="">{t('clientVersions.sdkGuideDrawer.statusNone')}</MenuItem>
                                <MenuItem value="ONLINE">ONLINE</MenuItem>
                                <MenuItem value="OFFLINE">OFFLINE</MenuItem>
                                <MenuItem value="MAINTENANCE">MAINTENANCE</MenuItem>
                                <MenuItem value="RECOMMENDED_UPDATE">RECOMMENDED_UPDATE</MenuItem>
                                <MenuItem value="FORCED_UPDATE">FORCED_UPDATE</MenuItem>
                                <MenuItem value="UNDER_REVIEW">UNDER_REVIEW</MenuItem>
                                <MenuItem value="BLOCKED_PATCH_ALLOWED">BLOCKED_PATCH_ALLOWED</MenuItem>
                              </Select>
                            </FormControl>
                          </Box>

                          {/* Language */}
                          <Box sx={{
                            p: 1.5,
                            backgroundColor: theme.palette.mode === 'dark' ? '#2a2a2a' : '#f5f5f5',
                            display: 'flex',
                            alignItems: 'center',
                            fontWeight: 500,
                            fontSize: '0.875rem'
                          }}>
                            Language
                          </Box>
                          <Box sx={{
                            p: 1,
                            borderLeft: `1px solid ${theme.palette.divider}`
                          }}>
                            <FormControl size="small" fullWidth>
                              <Select
                                value={lang}
                                onChange={(e) => setLang(e.target.value)}
                                displayEmpty
                                sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
                              >
                                <MenuItem value="">{t('clientVersions.sdkGuideDrawer.statusNone')}</MenuItem>
                                <MenuItem value="ko">ko</MenuItem>
                                <MenuItem value="en">en</MenuItem>
                                <MenuItem value="zh">zh</MenuItem>
                              </Select>
                            </FormControl>
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
                            Headers ({Object.keys(requestHeaders).length})
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
                        {`curl -X GET "${backendUrl}/api/v1/client/${currentEnvironmentId || 'your-environment'}/client-version?platform=${platform}${version ? `&version=${version}` : ''}${status ? `&status=${status}` : ''}${lang ? `&lang=${lang}` : ''}" \\
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

                    {/* Test Button */}
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
                        {t('clientVersions.sdkGuideDrawer.response')}
                      </Typography>
                      {testStatus && (
                        <Box sx={{ display: 'flex', gap: 2 }}>
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('clientVersions.sdkGuideDrawer.status')}</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {testStatus} {testStatus === 200 ? 'OK' : testStatus === 404 ? 'Not Found' : testStatus === 400 ? 'Bad Request' : 'Error'}
                            </Typography>
                          </Box>
                          {testDuration !== null && (
                            <Box>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('clientVersions.sdkGuideDrawer.time')}</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{testDuration}ms</Typography>
                            </Box>
                          )}
                          {Object.keys(responseHeaders).length > 0 && (
                            <Box>
                              <Typography variant="caption" sx={{ color: 'text.secondary' }}>{t('clientVersions.sdkGuideDrawer.size')}</Typography>
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
                              Headers ({Object.keys(responseHeaders).length})
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
                          Body
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

export default ClientVersionGuideDrawer;

