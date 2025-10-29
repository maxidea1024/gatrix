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
} from '@mui/material';
import {
  Close as CloseIcon,
  ContentCopy as ContentCopyIcon,
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

  // curl example code
  const curlExample = `# Coupon Redeem API Example
curl -X POST http://localhost:5000/api/v1/server/coupons/{COUPON_CODE}/redeem \\
  -H "Content-Type: application/json" \\
  -H "X-API-Token: your-api-token-here" \\
  -d '{
    "userId": "user123",
    "userName": "John Doe",
    "worldId": "world01",
    "platform": "ios",
    "channel": "kakao",
    "subChannel": "google"
  }'`;

  // JSON request example
  const jsonRequest = `{
  "userId": "user123",
  "userName": "John Doe",
  "worldId": "world01",
  "platform": "ios",
  "channel": "kakao",
  "subChannel": "google"
}`;

  // JSON response example
  const jsonResponse = `{
  "success": true,
  "data": {
    "reward": {},
    "userUsedCount": 1,
    "sequence": 1,
    "usedAt": "2025-10-28T04:17:05.123Z",
    "rewardEmailTitle": "Congratulations! You received a coupon reward.",
    "rewardEmailBody": "Congratulations! You received a reward by using the coupon. Please check it in the game."
  }
}`;

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    enqueueSnackbar(t('coupons.couponSettings.sdkGuideDrawer.copiedToClipboard'), {
      variant: 'success',
    });
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
      <Box sx={{ p: 3, overflow: 'auto', height: '100%' }}>
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

        {/* Error Codes */}
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          {t('coupons.couponSettings.sdkGuideDrawer.errorCodes')}
        </Typography>
        <Stack spacing={2}>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              400 Bad Request
            </Typography>
            <Typography variant="body2" sx={{ ml: 2 }}>
              • <strong>INVALID_PARAMETERS</strong>: {t('coupons.couponSettings.sdkGuideDrawer.error400')}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              404 Not Found
            </Typography>
            <Typography variant="body2" sx={{ ml: 2 }}>
              • <strong>NOT_FOUND</strong>: {t('coupons.couponSettings.sdkGuideDrawer.error404')}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              409 Conflict
            </Typography>
            <Typography variant="body2" sx={{ ml: 2 }}>
              • <strong>CONFLICT</strong>: {t('coupons.couponSettings.sdkGuideDrawer.error409Conflict')}
            </Typography>
            <Typography variant="body2" sx={{ ml: 2 }}>
              • <strong>LIMIT_REACHED</strong>: {t('coupons.couponSettings.sdkGuideDrawer.error409LimitReached')}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              422 Unprocessable Entity
            </Typography>
            <Typography variant="body2" sx={{ ml: 2 }}>
              • <strong>UNPROCESSABLE_ENTITY</strong>: {t('coupons.couponSettings.sdkGuideDrawer.error422')}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              429 Too Many Requests
            </Typography>
            <Typography variant="body2" sx={{ ml: 2 }}>
              • <strong>TOO_MANY_REQUESTS</strong>: {t('coupons.couponSettings.sdkGuideDrawer.error429')}
            </Typography>
          </Box>
        </Stack>
      </Box>
    </ResizableDrawer>
  );
};

export default SDKGuideDrawer;

