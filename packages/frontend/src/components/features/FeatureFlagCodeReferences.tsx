import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    IconButton,
    Link,
    CircularProgress,
    Alert,
    Stack,
    Divider,
    Tooltip,
    useTheme,
} from '@mui/material';
import {
    OpenInNew as OpenInNewIcon,
    Code as CodeIcon,
    History as HistoryIcon,
    GitHub as GitHubIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import EmptyPlaceholder from '../common/EmptyPlaceholder';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import { getLanguageIcon } from '../../utils/languageIcons';

// Syntax Highlighter
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneLight, oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';
import java from 'react-syntax-highlighter/dist/esm/languages/prism/java';
import lua from 'react-syntax-highlighter/dist/esm/languages/prism/lua';
import dart from 'react-syntax-highlighter/dist/esm/languages/prism/dart';

// Register languages
SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('lua', lua);
SyntaxHighlighter.registerLanguage('dart', dart);
SyntaxHighlighter.registerLanguage('ts', typescript);
SyntaxHighlighter.registerLanguage('js', javascript);

interface CodeReference {
    id: string;
    flagName: string;
    filePath: string;
    lineNumber: number;
    columnNumber?: number;
    codeSnippet?: string;
    functionName?: string;
    receiver?: string;
    language?: string;
    confidence: number;
    detectionStrategy?: string;
    codeUrl?: string;
    repository?: string;
    branch?: string;
    commitHash?: string;
    scanTime: string;
}

interface ScanInfo {
    scanId: string;
    scanTime: string;
    commitHash: string;
    totalReferences: number;
    uniqueFlags: number;
}

interface FeatureFlagCodeReferencesProps {
    flagName: string;
    onLoad?: (count: number) => void;
}

const FeatureFlagCodeReferences: React.FC<FeatureFlagCodeReferencesProps> = ({ flagName, onLoad }) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [references, setReferences] = useState<CodeReference[]>([]);
    const [scanInfo, setScanInfo] = useState<ScanInfo | null>(null);

    const isDarkMode = theme.palette.mode === 'dark';
    const syntaxStyle = isDarkMode ? oneDark : oneLight;

    useEffect(() => {
        const fetchReferences = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await api.get(`/admin/features/${flagName}/code-references`);
                if (response.success) {
                    const refs = response.data.references || [];
                    setReferences(refs);
                    setScanInfo(response.data.scanInfo || null);
                    onLoad?.(refs.length);
                } else {
                    setError(t('featureFlags.codeReferences.loadFailed'));
                }
            } catch (err) {
                console.error('Error fetching code references:', err);
                setError(t('featureFlags.codeReferences.loadFailed'));
            } finally {
                setLoading(false);
            }
        };

        if (flagName) {
            fetchReferences();
        }
    }, [flagName, t, onLoad]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ mb: 2 }}>
                {error}
            </Alert>
        );
    }

    return (
        <Box>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
                {scanInfo && (
                    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover', minWidth: 200 }}>
                        <Stack spacing={0.5}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <HistoryIcon fontSize="small" color="action" />
                                <Typography variant="caption" fontWeight={600}>
                                    {t('featureFlags.codeReferences.scanInfo')}
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                                <Typography variant="caption" color="text.secondary">
                                    {t('featureFlags.codeReferences.lastScan')}
                                </Typography>
                                <Typography variant="caption" fontWeight={500}>
                                    {formatDateTimeDetailed(scanInfo.scanTime)}
                                </Typography>
                            </Box>
                            {scanInfo.commitHash && (
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                                    <Typography variant="caption" color="text.secondary">
                                        {t('featureFlags.codeReferences.commit')}
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                                        {scanInfo.commitHash.substring(0, 7)}
                                    </Typography>
                                </Box>
                            )}
                        </Stack>
                    </Paper>
                )}
            </Box>

            {references.length === 0 ? (
                <EmptyPlaceholder
                    message={t('featureFlags.codeReferences.noReferences')}
                    description={t('featureFlags.codeReferences.noReferencesHint')}
                >
                    <CodeIcon sx={{ fontSize: 48, color: 'text.disabled', display: 'block', mx: 'auto', mb: 2 }} />
                </EmptyPlaceholder>
            ) : (
                <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                        <TableHead sx={{ bgcolor: 'action.hover' }}>
                            <TableRow>
                                <TableCell width="40%">{t('featureFlags.codeReferences.file')}</TableCell>
                                <TableCell width="10%">{t('featureFlags.codeReferences.line')}</TableCell>
                                <TableCell width="20%">{t('featureFlags.codeReferences.function')}</TableCell>
                                <TableCell width="10%">{t('featureFlags.codeReferences.language')}</TableCell>
                                <TableCell width="10%">{t('featureFlags.codeReferences.confidence')}</TableCell>
                                <TableCell width="10%" align="right">
                                    {t('common.actions')}
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {references.map((ref) => (
                                <React.Fragment key={ref.id}>
                                    <TableRow hover>
                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                            {ref.filePath}
                                            {ref.repository && (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                                                    <GitHubIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                                                    <Typography variant="caption" color="text.secondary">
                                                        {ref.repository}
                                                        {ref.branch ? ` (${ref.branch})` : ''}
                                                    </Typography>
                                                </Box>
                                            )}
                                        </TableCell>
                                        <TableCell>{ref.lineNumber}</TableCell>
                                        <TableCell>
                                            {ref.functionName ? (
                                                <Chip
                                                    label={ref.functionName}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}
                                                />
                                            ) : (
                                                '-'
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {ref.language && (
                                                <Chip
                                                    icon={getLanguageIcon(ref.language)}
                                                    label={ref.language}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ '& .MuiChip-icon': { ml: 0.5 } }}
                                                />
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip title={`${ref.confidence}% confidence`}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                    <Box
                                                        sx={{
                                                            width: 32,
                                                            height: 6,
                                                            bgcolor: 'action.selected',
                                                            borderRadius: 1,
                                                            overflow: 'hidden',
                                                        }}
                                                    >
                                                        <Box
                                                            sx={{
                                                                width: `${ref.confidence}%`,
                                                                height: '100%',
                                                                bgcolor:
                                                                    ref.confidence > 80
                                                                        ? 'success.main'
                                                                        : ref.confidence > 50
                                                                            ? 'warning.main'
                                                                            : 'error.main',
                                                            }}
                                                        />
                                                    </Box>
                                                    <Typography variant="caption">{ref.confidence}%</Typography>
                                                </Box>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell align="right">
                                            {ref.codeUrl && (
                                                <IconButton
                                                    size="small"
                                                    component={Link}
                                                    href={ref.codeUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    title={t('featureFlags.codeReferences.viewInRepository')}
                                                >
                                                    <OpenInNewIcon fontSize="small" />
                                                </IconButton>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                    {ref.codeSnippet && (
                                        <TableRow>
                                            <TableCell colSpan={6} sx={{
                                                p: 0,
                                                borderBottom: '1px solid',
                                                borderColor: 'divider',
                                                bgcolor: isDarkMode ? '#1e1e1e' : '#fafafa'
                                            }}>
                                                <Box sx={{ px: 2, py: 1 }}>
                                                    <SyntaxHighlighter
                                                        language={ref.language?.toLowerCase() || 'typescript'}
                                                        style={syntaxStyle}
                                                        showLineNumbers={true}
                                                        startingLineNumber={Math.max(1, ref.lineNumber - 3)} // Assuming scanner sends 3 context lines
                                                        wrapLines={true}
                                                        lineProps={(lineNumber) => ({
                                                            style: {
                                                                display: 'block',
                                                                backgroundColor: lineNumber === ref.lineNumber
                                                                    ? (isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0,0, 0.05)')
                                                                    : 'transparent',
                                                            }
                                                        })}
                                                        customStyle={{
                                                            margin: 0,
                                                            padding: '8px 0',
                                                            fontSize: '0.85rem',
                                                            backgroundColor: 'transparent',
                                                            fontFamily: 'D2Coding, monospace',
                                                        }}
                                                    >
                                                        {ref.codeSnippet}
                                                    </SyntaxHighlighter>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );
};

export default FeatureFlagCodeReferences;
