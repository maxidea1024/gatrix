import React, { useState, useCallback } from 'react';
import {
  Box, Typography, Button, Chip, CircularProgress,
  useTheme, alpha, LinearProgress, Tooltip, IconButton, Divider,
} from '@mui/material';
import {
  AutoAwesome as AiIcon, Psychology as ThinkIcon,
  Lightbulb as SuggestionIcon, BugReport as BugIcon,
  Code as CodeIcon, TrendingUp as PatternIcon,
  ContentCopy as CopyIcon, Refresh as RefreshIcon,
  CheckCircle as CheckIcon, Warning as WarningIcon,
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
 * Generates a deterministic analysis based on error data.
 * In production, this would call an LLM API endpoint.
 */
function generateAnalysis(
  exceptionType?: string, exceptionValue?: string, stacktrace?: string, tags?: Record<string, any>
): AnalysisResult {
  const type = exceptionType || 'UnknownError';
  const value = exceptionValue || '';

  // Extract file/line from stacktrace
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

  // Pattern-based analysis
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

  // Add environment-specific suggestions
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
  projectId, issueId, issueTitle, exceptionType, exceptionValue, stacktrace, tags, isDark,
}) => {
  const { t } = useTranslation();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const runAnalysis = useCallback(() => {
    setLoading(true);
    setProgress(0);
    setAnalysis(null);

    // Simulate AI processing with progress
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 95) { clearInterval(interval); return 95; }
        return prev + Math.random() * 15;
      });
    }, 200);

    // Simulate processing delay
    setTimeout(() => {
      clearInterval(interval);
      setProgress(100);
      const result = generateAnalysis(exceptionType, exceptionValue, stacktrace, tags);
      setAnalysis(result);
      setLoading(false);
    }, 1500);
  }, [exceptionType, exceptionValue, stacktrace, tags]);

  const severityCfg = analysis ? SEVERITY_CONFIG[analysis.severity] : null;

  return (
    <Box sx={{ mb: 2 }}>
      {/* Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1, mb: 1.5,
      }}>
        <AiIcon sx={{ fontSize: 20, color: '#7c4dff' }} />
        <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1, fontSize: '0.85rem' }}>
          {t('argus.ai.title', 'AI Root Cause Analysis')}
        </Typography>
        {analysis && severityCfg && (
          <Chip label={severityCfg.label} size="small" sx={{
            height: 20, fontSize: '0.62rem', fontWeight: 800,
            backgroundColor: alpha(severityCfg.color, 0.1), color: severityCfg.color,
          }} />
        )}
        {!analysis && !loading && (
          <Button size="small" variant="contained" startIcon={<ThinkIcon sx={{ fontSize: 16 }} />}
            onClick={() => runAnalysis()}
            sx={{
              textTransform: 'none', fontSize: '0.72rem', fontWeight: 700, py: 0.3, px: 1.5,
            }}>
            {t('argus.ai.analyze', 'Analyze')}
          </Button>
        )}
        {analysis && (
          <Tooltip title={t('argus.ai.reanalyze', 'Re-analyze')}>
            <IconButton size="small" onClick={() => runAnalysis()}>
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Loading bar */}
      {loading && (
        <Box sx={{ px: 2, pt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <CircularProgress size={16} sx={{ color: '#7c4dff' }} />
            <Typography sx={{ fontSize: '0.75rem', color: '#7c4dff', fontWeight: 600 }}>
              {t('argus.ai.analyzing', 'Analyzing error patterns...')}
            </Typography>
          </Box>
          <LinearProgress variant="determinate" value={progress}
            sx={{ height: 3, borderRadius: 2, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              '& .MuiLinearProgress-bar': { background: 'linear-gradient(90deg, #7c4dff, #448aff)' },
            }}
          />
          <Box sx={{ display: 'flex', gap: 1, mt: 1.5, mb: 1 }}>
            {['Parsing stacktrace', 'Finding patterns', 'Generating insights'].map((step, i) => (
              <Chip key={step} label={step} size="small" sx={{
                height: 20, fontSize: '0.6rem',
                backgroundColor: progress > (i + 1) * 30 ? alpha('#7c4dff', 0.1) : 'transparent',
                color: progress > (i + 1) * 30 ? '#7c4dff' : 'text.disabled',
                border: `1px solid ${progress > (i + 1) * 30 ? alpha('#7c4dff', 0.2) : isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
              }} />
            ))}
          </Box>
        </Box>
      )}

      {/* Empty state — no analysis yet */}
      {!analysis && !loading && (
        <Box sx={{
          py: 1.5, textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5,
        }}>
          <AiIcon sx={{ fontSize: 24, color: alpha('#7c4dff', 0.25) }} />
          <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', lineHeight: 1.5 }}>
            {t('argus.ai.emptyHint', 'Click the Analyze button above to get AI-powered root cause analysis, suggestions, and code references for this issue.')}
          </Typography>
        </Box>
      )}

      {/* Analysis Result */}
      {analysis && (
          <Box sx={{ p: 2 }}>
            {/* Summary */}
            <Box sx={{ mb: 2, p: 1.5, borderRadius: 1.5, backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.015)' }}>
              <Typography sx={{ fontSize: '0.82rem', lineHeight: 1.6 }}>{analysis.summary}</Typography>
            </Box>

            {/* Root Cause */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#f44336', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <BugIcon sx={{ fontSize: 14 }} /> {t('argus.ai.rootCause', 'Root Cause')}
              </Typography>
              <Typography sx={{ fontSize: '0.8rem', lineHeight: 1.6, color: 'text.secondary' }}>{analysis.rootCause}</Typography>
            </Box>

            {/* Suggestions */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#4caf50', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                <SuggestionIcon sx={{ fontSize: 14 }} /> {t('argus.ai.suggestions', 'Suggestions')}
              </Typography>
              {analysis.suggestions.map((s, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 0.75, mb: 0.5, alignItems: 'flex-start' }}>
                  <CheckIcon sx={{ fontSize: 14, color: '#4caf50', mt: 0.3, flexShrink: 0 }} />
                  <Typography sx={{ fontSize: '0.78rem', lineHeight: 1.5 }}>{s}</Typography>
                </Box>
              ))}
            </Box>

            {/* Related Patterns */}
            {analysis.relatedPatterns.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#ff9800', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                  <PatternIcon sx={{ fontSize: 14 }} /> {t('argus.ai.patterns', 'Detected Patterns')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {analysis.relatedPatterns.map((p, i) => (
                    <Chip key={i} label={`${p.label} (${p.confidence}%)`} size="small" sx={{
                      height: 24, fontSize: '0.7rem', fontWeight: 600,
                      backgroundColor: alpha('#ff9800', 0.08), color: '#ff9800',
                      border: `1px solid ${alpha('#ff9800', 0.15)}`,
                    }} />
                  ))}
                </Box>
              </Box>
            )}

            {/* Code Pointers */}
            {analysis.codePointers.length > 0 && (
              <Box>
                <Typography variant="caption" sx={{ fontWeight: 800, color: '#7c4dff', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                  <CodeIcon sx={{ fontSize: 14 }} /> {t('argus.ai.codePointers', 'Code References')}
                </Typography>
                {analysis.codePointers.slice(0, 3).map((cp, i) => (
                  <Box key={i} sx={{
                    display: 'flex', alignItems: 'center', gap: 1, py: 0.5,
                    borderBottom: i < analysis.codePointers.length - 1 ? `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}` : 'none',
                  }}>
                    <Typography sx={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#7c4dff' }}>
                      {cp.file}:{cp.line}
                    </Typography>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>— {cp.hint}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
      )}
      <Divider sx={{ mt: 2 }} />
    </Box>
  );
};

export default AiRootCausePanel;
