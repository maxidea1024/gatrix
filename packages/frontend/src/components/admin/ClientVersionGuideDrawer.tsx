import React, { useState } from 'react';
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
import ResizableDrawer from '../common/ResizableDrawer';

interface ClientVersionGuideDrawerProps {
  open: boolean;
  onClose: () => void;
}

const ClientVersionGuideDrawer: React.FC<ClientVersionGuideDrawerProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { enqueueSnackbar } = useSnackbar();

  // State for error response tabs
  const [errorTabValue, setErrorTabValue] = useState(0);

  // State for API test
  const [testTabValue, setTestTabValue] = useState(0);
  const [apiToken, setApiToken] = useState('');
  const [platform, setPlatform] = useState('ios');
  const [version, setVersion] = useState('1.0.0');
  const [lang, setLang] = useState('ko');
  const [testResponse, setTestResponse] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  // curl example code
  const curlExample = `# Client Version Query API Example
curl -X GET "http://localhost:5000/api/v1/client/client-version?platform=ios&version=1.0.0&lang=ko" \\
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
  "message": "platform and version are required query parameters"
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
    navigator.clipboard.writeText(code);
    enqueueSnackbar(t('coupons.couponSettings.sdkGuideDrawer.copiedToClipboard'), {
      variant: 'success',
    });
  };

  const handleTestAPI = async () => {
    if (!apiToken.trim()) {
      setTestError('API Token is required');
      return;
    }

    setTestLoading(true);
    setTestError(null);
    setTestResponse(null);

    try {
      const params = new URLSearchParams();
      params.append('platform', platform);
      params.append('version', version);
      if (lang) {
        params.append('lang', lang);
      }

      const response = await fetch(
        `/api/v1/client/client-version?${params.toString()}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Application-Name': 'AdminTestClient',
            'X-API-Token': apiToken,
          },
        }
      );

      const data = await response.json();
      setTestResponse(data);

      if (!response.ok) {
        setTestError(`HTTP ${response.status}`);
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
      <Box sx={{ p: 3, overflow: 'auto', height: '100%' }}>
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
            /api/v1/client/client-version
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

        {/* API Test Section */}
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          {t('clientVersions.sdkGuideDrawer.apiTest') || 'API Test'}
        </Typography>

        <Box sx={{ mb: 3 }}>
          <Stack spacing={2} sx={{ mb: 2 }}>
            <TextField
              label="X-API-Token"
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              size="small"
              fullWidth
              placeholder="Enter your API token"
            />
            <TextField
              label="Platform"
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              size="small"
              fullWidth
              placeholder="e.g., ios, android, pc"
            />
            <TextField
              label="Version"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              size="small"
              fullWidth
              placeholder="e.g., 1.0.0"
            />
            <TextField
              label="Language (optional)"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              size="small"
              fullWidth
              placeholder="e.g., ko, en, zh"
            />
          </Stack>

          <Button
            variant="contained"
            startIcon={testLoading ? <CircularProgress size={20} /> : <PlayArrowIcon />}
            onClick={handleTestAPI}
            disabled={testLoading}
            fullWidth
          >
            {testLoading ? 'Testing...' : 'Test API'}
          </Button>
        </Box>

        {testError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {testError}
          </Alert>
        )}

        {testResponse && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Response:
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
                  backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#f5f5f5',
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
              <Box sx={{ height: 300, overflow: 'hidden' }}>
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
        )}

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
      </Box>
    </ResizableDrawer>
  );
};

export default ClientVersionGuideDrawer;

