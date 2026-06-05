import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Button, Chip, CircularProgress,
  useTheme, alpha, Tooltip, IconButton, Divider,
  Alert, AlertTitle
} from '@mui/material';
import {
  AutoAwesome as AiIcon,
  Lightbulb as SuggestionIcon,
  Code as CodeIcon,
  TrendingUp as PatternIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface AiRootCausePanelProps {
  projectId: string;
  issueId: string;
  issueTitle: string;
  exceptionType?: string;
  exceptionValue?: string;
  stacktrace?: string;
  tags?: Record<string, any>;
  isDark: boolean;
  onClose?: () => void;
}

interface AnalysisResult {
  summary: string;
  rootCause: string;
  suggestions: string[];
  relatedPatterns: { label: string; confidence: number }[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  codePointers: { file: string; line: string; hint: string }[];
}

/**
 * MOCK: Generates a deterministic analysis based on error data.
 * In production, this would call an LLM API endpoint.
 */
function generateAnalysis(
  exceptionType?: string, exceptionValue?: string, stacktrace?: string, tags?: Record<string, any>
): AnalysisResult {
  const type = exceptionType || 'UnknownError';
  const value = exceptionValue || '';

  const codePointers: AnalysisResult['codePointers'] = [];
  if (stacktrace) {
    const lines = stacktrace.split('\n');
    for (const line of lines.slice(0, 5)) {
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):\d+\)/);
      if (match) {
        codePointers.push({ file: match[2], line: match[3], hint: `Check ${match[1]} for error handling` });
      }
    }
  }

  const patterns: AnalysisResult['relatedPatterns'] = [];
  let rootCause = '';
  let summary = '';
  const suggestions: string[] = [];
  let severity: AnalysisResult['severity'] = 'medium';

  if (type.includes('TypeError') || type.includes('ReferenceError')) {
    rootCause = `A ${type} indicates accessing a property on null/undefined or referencing an undeclared variable. This is commonly caused by missing null checks in async data flows.`;
    summary = `Null reference detected in runtime code path. The error "${value}" suggests a missing guard clause or race condition in data loading.`;
    suggestions.push('Add null/undefined checks before accessing object properties');
    suggestions.push('Use optional chaining (?.) for nested property access');
    suggestions.push('Add TypeScript strict null checks to catch these at compile time');
    patterns.push({ label: 'Null Reference Pattern', confidence: 92 });
    patterns.push({ label: 'Async Data Race', confidence: 67 });
    severity = 'high';
  } else if (type.includes('NetworkError') || type.includes('FetchError') || value.includes('fetch')) {
    rootCause = 'Network request failure — the server endpoint is either unreachable, returning errors, or the request is timing out.';
    summary = 'API call failure detected. This may indicate backend instability, DNS issues, or CORS misconfiguration.';
    suggestions.push('Implement retry logic with exponential backoff');
    suggestions.push('Add request timeout and circuit breaker patterns');
    suggestions.push('Check server health and network connectivity');
    patterns.push({ label: 'Network Instability', confidence: 85 });
    patterns.push({ label: 'API Degradation', confidence: 72 });
    severity = 'critical';
  } else if (type.includes('SyntaxError') || type.includes('ParseError')) {
    rootCause = 'Malformed data received from an external source — likely invalid JSON response from an API or corrupted user input.';
    summary = 'Data parsing failure. The input data structure does not match expected format.';
    suggestions.push('Add try/catch around JSON.parse calls');
    suggestions.push('Validate response content-type before parsing');
    suggestions.push('Add schema validation for external data');
    patterns.push({ label: 'Malformed Response', confidence: 88 });
    severity = 'medium';
  } else if (type.includes('OutOfMemory') || type.includes('RangeError')) {
    rootCause = 'Memory exhaustion or infinite recursion detected. This typically happens with unbounded data growth or recursive calls without base case.';
    summary = 'Resource exhaustion detected. The application is running out of memory or hitting stack limits.';
    suggestions.push('Review recursive functions for proper termination conditions');
    suggestions.push('Implement pagination for large data sets');
    suggestions.push('Add memory usage monitoring and alerts');
    patterns.push({ label: 'Memory Leak', confidence: 78 });
    patterns.push({ label: 'Unbounded Growth', confidence: 65 });
    severity = 'critical';
  } else {
    rootCause = `An unhandled ${type} occurred. The error message "${value}" suggests an unexpected condition in the application logic.`;
    summary = `Unhandled exception of type ${type}. This error may propagate from a third-party library or unvalidated input.`;
    suggestions.push('Add comprehensive error handling with user-friendly fallbacks');
    suggestions.push('Log the full error context for debugging');
    suggestions.push('Consider adding error boundaries in the UI layer');
    patterns.push({ label: 'Unhandled Exception', confidence: 60 });
    severity = 'medium';
  }

  if (tags?.environment === 'production') {
    suggestions.push('Deploy hotfix or feature flag to mitigate impact');
    severity = severity === 'medium' ? 'high' : severity;
  }

  return { summary, rootCause, suggestions, relatedPatterns: patterns, severity, codePointers };
}

const SEVERITY_CONFIG: Record<string, { color: string; label: string }> = {
  critical: { color: '#f44336', label: 'Critical' },
  high: { color: '#ff9800', label: 'High' },
  medium: { color: '#2196f3', label: 'Medium' },
  low: { color: '#4caf50', label: 'Low' },
};

const AiRootCausePanel: React.FC<AiRootCausePanelProps> = ({
  projectId, issueId, issueTitle, exceptionType, exceptionValue, stacktrace, tags, isDark, onClose,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runAnalysis = useCallback(() => {
    setLoading(true);
    setAnalysis(null);

    // Simulate processing delay
    setTimeout(() => {
      const result = generateAnalysis(exceptionType, exceptionValue, stacktrace, tags);
      setAnalysis(result);
      setLoading(false);
    }, 1500);
  }, [exceptionType, exceptionValue, stacktrace, tags]);

  const severityCfg = analysis ? SEVERITY_CONFIG[analysis.severity] : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 3, py: 2,
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
        backgroundColor: isDark ? alpha(theme.palette.background.paper, 0.5) : '#fafafa'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AiIcon sx={{ color: '#7c4dff' }} />
          <Typography variant="h6" sx={{ fontSize: '1.1rem', fontWeight: 600 }}>
            {t('argus.ai.title')}
          </Typography>
          {analysis && severityCfg && (
            <Chip label={severityCfg.label} size="small" sx={{
              ml: 1, height: 22, fontSize: '0.7rem', fontWeight: 700,
              backgroundColor: alpha(severityCfg.color, 0.15), color: severityCfg.color,
            }} />
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {!analysis && !loading && (
            <Button 
              variant="contained" 
              color="primary"
              size="small"
              startIcon={<AiIcon />}
              onClick={() => runAnalysis()}
              sx={{ textTransform: 'none', px: 2 }}
            >
              {t('argus.ai.analyze')}
            </Button>
          )}
          {analysis && (
            <Tooltip title={t('argus.ai.reanalyze')}>
              <IconButton onClick={() => runAnalysis()} size="small">
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {onClose && (
            <IconButton onClick={onClose} size="small" sx={{ ml: 1 }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
        
        {/* Initial CTA State */}
        {!analysis && !loading && (
          <Box sx={{ py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              {t('argus.ai.emptyHint')}
            </Typography>
            <Button 
              variant="outlined" 
              startIcon={<AiIcon />}
              onClick={() => runAnalysis()}
            >
              {t('argus.ai.analyze')}
            </Button>
          </Box>
        )}

        {/* Loading State */}
        {loading && (
          <Box sx={{ py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={32} sx={{ mb: 2, color: '#7c4dff' }} />
            <Typography color="text.secondary">
              {t('argus.ai.analyzing')}
            </Typography>
          </Box>
        )}

        {/* Results State */}
        {analysis && !loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            
            {/* Summary & Root Cause */}
            <Alert 
              icon={<AiIcon />} 
              severity="info"
              sx={{ 
                '& .MuiAlert-icon': { color: '#7c4dff' },
                backgroundColor: isDark ? alpha('#7c4dff', 0.05) : alpha('#7c4dff', 0.03),
                border: `1px solid ${alpha('#7c4dff', 0.2)}`,
                color: 'text.primary'
              }}
            >
              <AlertTitle sx={{ fontWeight: 600, mb: 1 }}>{t('argus.ai.rootCause')}</AlertTitle>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                {analysis.summary}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {analysis.rootCause}
              </Typography>
            </Alert>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
              
              {/* Left Column (Suggestions) */}
              <Box sx={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <SuggestionIcon fontSize="small" sx={{ color: '#4caf50' }} /> 
                  {t('argus.ai.suggestions')}
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {analysis.suggestions.map((s, i) => (
                    <Box key={i} sx={{ 
                      display: 'flex', gap: 1, alignItems: 'flex-start',
                      p: 1.5, borderRadius: 1,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'
                    }}>
                      <CheckIcon sx={{ fontSize: 18, color: '#4caf50', mt: 0.1, flexShrink: 0 }} />
                      <Typography variant="body2">{s}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* Right Column (Patterns & Code) */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                
                {analysis.relatedPatterns.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <PatternIcon fontSize="small" sx={{ color: '#ff9800' }} /> 
                      {t('argus.ai.patterns')}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {analysis.relatedPatterns.map((p, i) => (
                        <Box key={i} sx={{ 
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          px: 1.5, py: 1, borderRadius: 1,
                          backgroundColor: alpha('#ff9800', 0.1)
                        }}>
                          <Typography variant="caption" sx={{ fontWeight: 600, color: '#ff9800' }}>{p.label}</Typography>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#ff9800' }}>{p.confidence}%</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                {analysis.codePointers.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <CodeIcon fontSize="small" color="primary" /> 
                      {t('argus.ai.codePointers')}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {analysis.codePointers.slice(0, 3).map((cp, i) => (
                        <Box key={i} sx={{
                          p: 1.5, borderRadius: 1,
                          backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
                        }}>
                          <Typography variant="caption" sx={{ color: 'primary.main', display: 'block', mb: 0.5 }}>
                            {cp.file}:{cp.line}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {cp.hint}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default AiRootCausePanel;
