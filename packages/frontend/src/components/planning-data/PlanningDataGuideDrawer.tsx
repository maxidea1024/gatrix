import React from 'react';
import {
    Box,
    Typography,
    Alert,
    IconButton,
    Tooltip,
} from '@mui/material';
import {
    ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useTheme } from '@mui/material/styles';
import Editor from '@monaco-editor/react';
import ResizableDrawer from '../common/ResizableDrawer';
import { copyToClipboardWithNotification } from '../../utils/clipboard';

interface PlanningDataGuideDrawerProps {
    open: boolean;
    onClose: () => void;
}

interface PlanningDataGuideContentProps {
    variant?: 'drawer' | 'inline';
}

// Code block component with Monaco Editor for syntax highlighting
const CodeBlock: React.FC<{ code: string; language?: string; onCopy: () => void; height?: number }> = ({
    code,
    language = 'shell',
    onCopy,
    height = 120
}) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    // Calculate height based on line count
    const lineCount = code.split('\n').length;
    const calculatedHeight = Math.min(Math.max(lineCount * 19 + 16, height), 300);

    return (
        <Box sx={{
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            overflow: 'hidden',
            position: 'relative'
        }}>
            <Box sx={{
                display: 'flex',
                justifyContent: 'flex-end',
                p: 0.5,
                backgroundColor: isDark ? '#1e1e1e' : '#f5f5f5',
                borderBottom: `1px solid ${theme.palette.divider}`,
            }}>
                <Tooltip title="Copy">
                    <IconButton size="small" onClick={onCopy} sx={{ color: 'primary.main' }}>
                        <CopyIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Box>
            <Box sx={{ height: calculatedHeight }}>
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
                        lineNumbers: 'off',
                        folding: false,
                        padding: { top: 8, bottom: 8 },
                        scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
                    }}
                />
            </Box>
        </Box>
    );
};

// Reusable guide content component
export const PlanningDataGuideContent: React.FC<PlanningDataGuideContentProps> = ({ variant = 'drawer' }) => {
    const { t } = useTranslation();
    const { enqueueSnackbar } = useSnackbar();

    const handleCopy = (text: string) => {
        copyToClipboardWithNotification(
            text,
            () => enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
            () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
        );
    };

    // Get the backend URL from environment config
    // Priority: runtime config > VITE_API_URL > current origin with /api/v1 fallback
    const getBackendUrl = () => {
        if (typeof window !== 'undefined') {
            // Check runtime config first (set dynamically in production)
            const runtimeUrl = (window as any)?.ENV?.VITE_API_URL;
            if (runtimeUrl && runtimeUrl.trim() && !runtimeUrl.startsWith('/')) {
                return runtimeUrl.trim().replace(/\/api\/v1$/, '');
            }
        }
        // Check build-time env
        const envUrl = (import.meta as any).env?.VITE_API_URL;
        if (envUrl && envUrl.trim() && !envUrl.startsWith('/')) {
            return envUrl.trim().replace(/\/api\/v1$/, '');
        }
        // Fallback to current origin (same server)
        return typeof window !== 'undefined' ? window.location.origin : 'https://your-gatrix-server.com';
    };
    const backendUrl = getBackendUrl();

    const convertCommand = 'yarn planning-data:convert --input=./cms --output=./converted-planning-data';
    const uploadCommand = `yarn upload-planning-data \\
  --api-url=${backendUrl} \\
  --env=qa \\
  --dir=./converted-planning-data \\
  --token=<YOUR_API_TOKEN>

# Options:
#   --api-url   (Required) Backend API URL
#   --env       (Required) Target environment (dev, qa, production)
#   --dir       (Required) Directory containing planning data files
#   --token     (Required) Server API token for authentication`;

    const curlCommand = `# Upload all JSON files from a directory
for file in ./converted-planning-data/*.json; do
  curl -X POST ${backendUrl}/api/v1/server/qa/planning-data/upload \\
    -H "X-API-Token: <YOUR_SERVER_API_TOKEN>" \\
    -H "X-Application-Name: PlanningDataUploader" \\
    -F "files=@$file" \\
    -F "comment=Upload via curl"
done

# Or upload a single file
curl -X POST ${backendUrl}/api/v1/server/qa/planning-data/upload \\
  -H "X-API-Token: <YOUR_SERVER_API_TOKEN>" \\
  -H "X-Application-Name: PlanningDataUploader" \\
  -F "files=@./converted-planning-data/reward.json" \\
  -F "comment=Upload reward.json"`;

    const containerSx = variant === 'inline' ? {
        bgcolor: 'action.hover',
        borderRadius: 2,
        p: 3,
        textAlign: 'left'
    } : {};

    return (
        <Box sx={containerSx}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                {t('planningData.uploadGuide.title')}
            </Typography>

            {/* Web Upload */}
            <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>1. {t('planningData.uploadGuide.webUpload')}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, pl: 2 }}>
                {t('planningData.uploadGuide.webUploadDesc')}
            </Typography>

            {/* Data Build */}
            <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>2. {t('planningData.uploadGuide.dataBuild')}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, pl: 2 }}>
                {t('planningData.uploadGuide.dataBuildDesc')}
            </Typography>
            <Alert severity="warning" sx={{ mb: 2, textAlign: 'left' }}>
                {t('planningData.uploadGuide.clientDataWarning')}
            </Alert>
            <Box sx={{ mb: 3 }}>
                <CodeBlock code={convertCommand} onCopy={() => handleCopy(convertCommand)} />
            </Box>

            {/* CLI Upload */}
            <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>3. {t('planningData.uploadGuide.cliUpload')}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, pl: 2 }}>
                {t('planningData.uploadGuide.cliUploadDesc')}
            </Typography>
            <Box sx={{ mb: 3 }}>
                <CodeBlock code={uploadCommand} onCopy={() => handleCopy(uploadCommand)} />
            </Box>

            {/* Curl Upload */}
            <Typography variant="body2" sx={{ mb: 1 }}>
                <strong>4. {t('planningData.uploadGuide.curlUpload')}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, pl: 2 }}>
                {t('planningData.uploadGuide.curlUploadDesc')}
            </Typography>
            <CodeBlock code={curlCommand} onCopy={() => handleCopy(curlCommand)} />
        </Box>
    );
};

const PlanningDataGuideDrawer: React.FC<PlanningDataGuideDrawerProps> = ({ open, onClose }) => {
    const { t } = useTranslation();

    return (
        <ResizableDrawer
            open={open}
            onClose={onClose}
            title={t('planningData.uploadGuide.title')}
            subtitle={t('planningData.uploadGuide.subtitle')}
            defaultWidth={550}
        >
            <Box sx={{ p: 3, height: '100%', overflow: 'auto' }}>
                <PlanningDataGuideContent variant="drawer" />
            </Box>
        </ResizableDrawer>
    );
};

export default PlanningDataGuideDrawer;
