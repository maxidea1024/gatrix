import React from 'react';
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

interface ClientVersionGuideDrawerProps {
  open: boolean;
  onClose: () => void;
}

const ClientVersionGuideDrawer: React.FC<ClientVersionGuideDrawerProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { enqueueSnackbar } = useSnackbar();

  // curl example code
  const curlExample = `# Client Version Query API Example
curl -X GET "http://localhost:5000/api/v1/client/client-version?platform=ios&version=1.0.0&environment=production" \\
  -H "Content-Type: application/json"`;

  // JSON response example
  const jsonResponse = `{
  "success": true,
  "data": {
    "id": 1,
    "platform": "ios",
    "clientVersion": "1.0.0",
    "environment": "production",
    "gameServerAddress": "game.example.com:9000",
    "gameServerAddressForWhiteList": "game-vip.example.com:9000",
    "patchAddress": "patch.example.com",
    "patchAddressForWhiteList": "patch-vip.example.com",
    "guestModeAllowed": true,
    "externalClickLink": "https://website.example.com",
    "customPayload": {
      "feature1": true,
      "setting1": "value1"
    },
    "createdAt": "2025-10-28T04:17:05.123Z",
    "updatedAt": "2025-10-28T04:17:05.123Z",
    "timestamp": "2025-10-29T08:38:26.771Z",
    "meta": {
      "key1": "value1",
      "key2": "value2"
    }
  },
  "cached": false
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
            • <strong>platform</strong>: {t('clientVersions.sdkGuideDrawer.paramPlatform')}
          </Typography>
          <Typography variant="body2">
            • <strong>version</strong>: {t('clientVersions.sdkGuideDrawer.paramClientVersion')}
          </Typography>
          <Typography variant="body2">
            • <strong>environment</strong>: {t('clientVersions.sdkGuideDrawer.paramEnvironment')}
          </Typography>
        </Stack>

        <Divider sx={{ my: 3 }} />

        {/* Required Headers */}
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          {t('clientVersions.sdkGuideDrawer.requiredHeaders')}
        </Typography>
        <Stack spacing={1} sx={{ mb: 3 }}>
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

        {/* Response Example */}
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          {t('clientVersions.sdkGuideDrawer.responseExample')}
        </Typography>
        <CodeBlock code={jsonResponse} language="json" />
      </Box>
    </ResizableDrawer>
  );
};

export default ClientVersionGuideDrawer;

