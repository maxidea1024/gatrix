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
import ResizableDrawer from '../common/ResizableDrawer';

interface SDKGuideDrawerProps {
  open: boolean;
  onClose: () => void;
}

const SDKGuideDrawer: React.FC<SDKGuideDrawerProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { enqueueSnackbar } = useSnackbar();

  // State for main tabs (Guide vs Test)
  const [mainTabValue, setMainTabValue] = useState(0);

  // State for error response tabs
  const [errorTabValue, setErrorTabValue] = useState(0);

  // State for API test
  const [apiToken, setApiToken] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [userId, setUserId] = useState('user123');
  const [userName, setUserName] = useState('John Doe');
  const [characterId, setCharacterId] = useState('');
  const [worldId, setWorldId] = useState('world01');
  const [platform, setPlatform] = useState('ios');
  const [channel, setChannel] = useState('app_store');
  const [subChannel, setSubChannel] = useState('web');
  const [testResponse, setTestResponse] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [requestHeaders, setRequestHeaders] = useState<Record<string, string>>({});
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [expandedRequestHeaders, setExpandedRequestHeaders] = useState(false);
  const [expandedResponseHeaders, setExpandedResponseHeaders] = useState(false);
  const [testDuration, setTestDuration] = useState<number | null>(null);
  const [testStatus, setTestStatus] = useState<number | null>(null);

  // Load saved values from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sdkGuideDrawer_testInputs');
      if (saved) {
        const { apiToken: savedToken, couponCode: savedCode, userId: savedUserId, userName: savedUserName, characterId: savedCharacterId, worldId: savedWorldId, platform: savedPlatform, channel: savedChannel, subChannel: savedSubChannel } = JSON.parse(saved);
        if (savedToken) setApiToken(savedToken);
        if (savedCode) setCouponCode(savedCode);
        if (savedUserId) setUserId(savedUserId);
        if (savedUserName) setUserName(savedUserName);
        if (savedCharacterId) setCharacterId(savedCharacterId);
        if (savedWorldId) setWorldId(savedWorldId);
        if (savedPlatform) setPlatform(savedPlatform);
        if (savedChannel) setChannel(savedChannel);
        if (savedSubChannel) setSubChannel(savedSubChannel);
      }
    } catch (error) {
      // Silently ignore localStorage errors
    }
  }, []);

  // Save values to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('sdkGuideDrawer_testInputs', JSON.stringify({
        apiToken,
        couponCode,
        userId,
        userName,
        characterId,
        worldId,
        platform,
        channel,
        subChannel,
      }));
    } catch (error) {
      // Silently ignore localStorage errors
    }
  }, [apiToken, couponCode, userId, userName, characterId, worldId, platform, channel, subChannel]);

  // curl example code
  const curlExample = `# Coupon Redeem API Example
curl -X POST http://localhost:5000/api/v1/server/coupons/{COUPON_CODE}/redeem \\
  -H "Content-Type: application/json" \\
  -H "X-Application-Name: MyGameApp" \\
  -H "X-API-Token: your-api-token-here" \\
  -d '{
    "userId": "user123",
    "userName": "John Doe",
    "characterId": "char456",
    "worldId": "world01",
    "platform": "ios",
    "channel": "app_store",
    "subChannel": "web"
  }'`;

  // JSON request example
  const jsonRequest = `{
  "userId": "user123",
  "userName": "John Doe",
  "characterId": "char456",
  "worldId": "world01",
  "platform": "ios",
  "channel": "app_store",
  "subChannel": "web"
}`;

  // JSON response example
  const jsonResponse = `{
  "success": true,
  "data": {
    "reward": [
      {
        "type": 1,
        "id": 1001,
        "quantity": 100
      },
      {
        "type": 2,
        "id": 2001,
        "quantity": 50
      }
    ],
    "userUsedCount": 1,
    "sequence": 1,
    "usedAt": "2025-10-28T04:17:05.123Z",
    "rewardEmailTitle": "Congratulations! You received a coupon reward.",
    "rewardEmailBody": "Congratulations! You received a reward by using the coupon. Please check it in the game."
  }
}`;

  // Error response examples
  const errorMissingParams = `{
  "success": false,
  "error": {
    "code": "INVALID_PARAMETERS",
    "message": "Missing required parameters",
    "details": {
      "missing": ["userId", "userName"]
    }
  }
}`;

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

  const errorNotFound = `{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Coupon code not found",
    "details": {
      "code": "INVALID_CODE"
    }
  }
}`;

  const errorConflict = `{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "Coupon already used by this user",
    "details": {
      "reason": "ALREADY_USED"
    }
  }
}`;

  const errorLimitReached = `{
  "success": false,
  "error": {
    "code": "LIMIT_REACHED",
    "message": "User has reached the usage limit for this coupon",
    "details": {
      "reason": "USER_LIMIT_EXCEEDED",
      "limit": 1,
      "used": 1
    }
  }
}`;

  const errorUnprocessable = `{
  "success": false,
  "error": {
    "code": "UNPROCESSABLE_ENTITY",
    "message": "Coupon is expired or targeting conditions not met",
    "details": {
      "reason": "EXPIRED_OR_INVALID_TARGET"
    }
  }
}`;

  const errorTooManyRequests = `{
  "success": false,
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Too many requests for this coupon code",
    "details": {
      "retryAfter": 60
    }
  }
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

    if (!couponCode.trim()) {
      setTestError('Coupon Code is required');
      return;
    }

    setTestLoading(true);
    setTestError(null);
    setTestResponse(null);
    setTestStatus(null);
    setTestDuration(null);
    // Collapse Request and prepare to expand Response
    setExpandedRequestHeaders(false);
    setExpandedResponseHeaders(false);

    const startTime = performance.now();

    try {
      const response = await fetch(
        `/api/v1/server/coupons/${couponCode}/redeem`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Application-Name': 'AdminTestClient',
            'X-API-Token': apiToken,
          },
          body: JSON.stringify({
            userId,
            userName,
            ...(characterId && { characterId }),
            worldId,
            platform,
            channel,
            subChannel,
          }),
        }
      );

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      const data = await response.json();
      setTestResponse(data);
      setTestStatus(response.status);
      setTestDuration(duration);

      // Set request headers
      setRequestHeaders({
        'Content-Type': 'application/json',
        'X-Application-Name': 'AdminTestClient',
        'X-API-Token': apiToken,
      });

      // Set response headers (basic info)
      setResponseHeaders({
        'Content-Type': response.headers.get('Content-Type') || 'application/json',
        'Status': `${response.status} ${response.statusText}`,
      });

      // Expand Response section when response is received
      setExpandedResponseHeaders(true);

      // Only set error if response is not ok
      if (!response.ok) {
        setTestError(`HTTP ${response.status}: ${data.error?.message || 'Request failed'}`);
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
      title={t('coupons.couponSettings.sdkGuideDrawer.title')}
      subtitle={t('coupons.couponSettings.sdkGuideDrawer.subtitle')}
      defaultWidth={600}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Main Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 2 }}>
          <Tabs value={mainTabValue} onChange={(e, newValue) => setMainTabValue(newValue)}>
            <Tab label={t('coupons.couponSettings.sdkGuideDrawer.tabGuide')} />
            <Tab label={t('coupons.couponSettings.sdkGuideDrawer.tabTest')} />
          </Tabs>
        </Box>

        {/* Content */}
        <Box sx={{ p: 3, overflow: 'auto', flex: 1 }}>
        {/* Tab 1: SDK Guide */}
        {mainTabValue === 0 && (
          <>
        {/* Description */}
        <Alert severity="info" sx={{ mb: 3 }}>
          {t('coupons.couponSettings.sdkGuideDrawer.description')}
        </Alert>

        {/* Endpoint */}
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          {t('coupons.couponSettings.sdkGuideDrawer.endpoint')}
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
            <strong>{t('coupons.couponSettings.sdkGuideDrawer.method')}:</strong> POST
          </Typography>
          <Typography component="div" sx={{ wordBreak: 'break-all' }}>
            /api/v1/server/coupons/{'{'}<strong>code</strong>{'}'}
            /redeem
          </Typography>
        </Paper>

        <Divider sx={{ my: 3 }} />

        {/* Parameters */}
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          {t('coupons.couponSettings.sdkGuideDrawer.parameters')}
        </Typography>
        <Stack spacing={1} sx={{ mb: 3 }}>
          <Typography variant="body2">
            • <strong>userId</strong>: {t('coupons.couponSettings.sdkGuideDrawer.paramUserId')}
          </Typography>
          <Typography variant="body2">
            • <strong>userName</strong>: {t('coupons.couponSettings.sdkGuideDrawer.paramUserName')}
          </Typography>
          <Typography variant="body2">
            • <strong>characterId</strong>: {t('coupons.couponSettings.sdkGuideDrawer.paramCharacterId')}
          </Typography>
          <Typography variant="body2">
            • <strong>worldId</strong>: {t('coupons.couponSettings.sdkGuideDrawer.paramWorldId')}
          </Typography>
          <Typography variant="body2">
            • <strong>platform</strong>: {t('coupons.couponSettings.sdkGuideDrawer.paramPlatform')}
          </Typography>
          <Typography variant="body2">
            • <strong>channel</strong>: {t('coupons.couponSettings.sdkGuideDrawer.paramChannel')}
          </Typography>
          <Typography variant="body2">
            • <strong>subChannel</strong>: {t('coupons.couponSettings.sdkGuideDrawer.paramSubChannel')}
          </Typography>
        </Stack>

        <Divider sx={{ my: 3 }} />

        {/* Required Headers */}
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          {t('coupons.couponSettings.sdkGuideDrawer.requiredHeaders')}
        </Typography>
        <Stack spacing={1} sx={{ mb: 3 }}>
          <Typography variant="body2">
            • <strong>X-API-Token</strong>: {t('coupons.couponSettings.sdkGuideDrawer.headerApiToken')}
          </Typography>
          <Typography variant="body2">
            • <strong>X-Application-Name</strong>: {t('coupons.couponSettings.sdkGuideDrawer.headerAppName')}
          </Typography>
          <Typography variant="body2">
            • <strong>Content-Type</strong>: {t('coupons.couponSettings.sdkGuideDrawer.headerContentType')}
          </Typography>
        </Stack>

        <Divider sx={{ my: 3 }} />

        {/* Request Body */}
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          {t('coupons.couponSettings.sdkGuideDrawer.requestBody')}
        </Typography>
        <CodeBlock code={jsonRequest} language="json" />

        {/* curl Example */}
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          curl {t('common.example') || 'Example'}
        </Typography>
        <CodeBlock code={curlExample} language="bash" />

        <Divider sx={{ my: 3 }} />

        {/* Response Example */}
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          {t('coupons.couponSettings.sdkGuideDrawer.responseExample')}
        </Typography>
        <CodeBlock code={jsonResponse} language="json" />

        <Divider sx={{ my: 3 }} />

        {/* Error Codes - Tabbed */}
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          {t('coupons.couponSettings.sdkGuideDrawer.errorCodes')}
        </Typography>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          {t('coupons.couponSettings.sdkGuideDrawer.errorCodesDesc') || 'Error response examples for different scenarios'}
        </Typography>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={errorTabValue} onChange={(e, newValue) => setErrorTabValue(newValue)} variant="scrollable" scrollButtons="auto">
            <Tab label="400 - Missing Params" />
            <Tab label="400 - Missing Headers" />
            <Tab label="404 - Not Found" />
            <Tab label="409 - Conflict" />
            <Tab label="409 - Limit Reached" />
            <Tab label="422 - Unprocessable" />
            <Tab label="429 - Too Many Requests" />
          </Tabs>
        </Box>

        {errorTabValue === 0 && <CodeBlock code={errorMissingParams} language="json" />}
        {errorTabValue === 1 && <CodeBlock code={errorMissingHeaders} language="json" />}
        {errorTabValue === 2 && <CodeBlock code={errorNotFound} language="json" />}
        {errorTabValue === 3 && <CodeBlock code={errorConflict} language="json" />}
        {errorTabValue === 4 && <CodeBlock code={errorLimitReached} language="json" />}
        {errorTabValue === 5 && <CodeBlock code={errorUnprocessable} language="json" />}
        {errorTabValue === 6 && <CodeBlock code={errorTooManyRequests} language="json" />}
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
                  backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#f5f5f5',
                  borderRadius: 1,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  '&:hover': { backgroundColor: theme.palette.mode === 'dark' ? '#3d3d3d' : '#eeeeee' },
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Request
                </Typography>
                <Box sx={{ transform: expandedRequestHeaders ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
                  ▼
                </Box>
              </Box>
              <Collapse in={expandedRequestHeaders}>
                <Box sx={{ p: 2, backgroundColor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#fafafa', borderRadius: 1, mt: 0.5 }}>
                  {/* Parameters */}
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                      Parameters
                    </Typography>
                    <Stack spacing={2} sx={{ pl: 1 }}>
                      <TextField
                        label="API Token"
                        type="password"
                        value={apiToken}
                        onChange={(e) => setApiToken(e.target.value)}
                        size="small"
                        fullWidth
                        placeholder="Enter your API token"
                      />
                      <TextField
                        label="Coupon Code"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        size="small"
                        fullWidth
                        placeholder="e.g., ABC12345"
                      />
                      <TextField
                        label="User ID"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        size="small"
                        fullWidth
                        placeholder="e.g., user123"
                      />
                      <TextField
                        label="User Name"
                        value={userName}
                        onChange={(e) => setUserName(e.target.value)}
                        size="small"
                        fullWidth
                        placeholder="e.g., John Doe"
                      />
                      <TextField
                        label="Character ID"
                        value={characterId}
                        onChange={(e) => setCharacterId(e.target.value)}
                        size="small"
                        fullWidth
                        placeholder="e.g., char456"
                        required
                      />
                      <TextField
                        label="World ID"
                        value={worldId}
                        onChange={(e) => setWorldId(e.target.value)}
                        size="small"
                        fullWidth
                        placeholder="e.g., world01"
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
                        label="Channel"
                        value={channel}
                        onChange={(e) => setChannel(e.target.value)}
                        size="small"
                        fullWidth
                        placeholder="e.g., app_store"
                      />
                      <TextField
                        label="Sub Channel"
                        value={subChannel}
                        onChange={(e) => setSubChannel(e.target.value)}
                        size="small"
                        fullWidth
                        placeholder="e.g., web"
                      />
                    </Stack>
                  </Box>

                  {/* Request Headers */}
                  {Object.keys(requestHeaders).length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                        Headers ({Object.keys(requestHeaders).length})
                      </Typography>
                      <Stack spacing={0.5} sx={{ pl: 1 }}>
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
                    </Box>
                  )}

                  {/* Test Button */}
                  <Button
                    variant="contained"
                    startIcon={testLoading ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <PlayArrowIcon />}
                    onClick={handleTestAPI}
                    disabled={testLoading}
                    fullWidth
                  >
                    Test API
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
                    backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#f5f5f5',
                    borderRadius: 1,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    '&:hover': { backgroundColor: theme.palette.mode === 'dark' ? '#3d3d3d' : '#eeeeee' },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Response
                    </Typography>
                    {testStatus && (
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Status</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {testStatus} {testStatus === 200 ? 'OK' : testStatus === 404 ? 'Not Found' : testStatus === 400 ? 'Bad Request' : 'Error'}
                          </Typography>
                        </Box>
                        {testDuration !== null && (
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Time</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{testDuration}ms</Typography>
                          </Box>
                        )}
                        {Object.keys(responseHeaders).length > 0 && (
                          <Box>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Size</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {new Blob([JSON.stringify(testResponse)]).size} bytes
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ transform: expandedResponseHeaders ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>
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
                        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                          Headers ({Object.keys(responseHeaders).length})
                        </Typography>
                        <Stack spacing={0.5} sx={{ pl: 1 }}>
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

export default SDKGuideDrawer;

