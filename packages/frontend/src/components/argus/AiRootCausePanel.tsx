import React, { useState, useCallback, useEffect } from 'react';
import {
  Box, Typography, Button, Chip, CircularProgress,
  useTheme, alpha, Tooltip, IconButton, Divider,
} from '@mui/material';
import {
  AutoAwesome as AiIcon, Psychology as ThinkIcon,
  Lightbulb as SuggestionIcon, BugReport as BugIcon,
  Code as CodeIcon, TrendingUp as PatternIcon,
  Refresh as RefreshIcon, Close as CloseIcon,
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
  const [progressText, setProgressText] = useState('');

  const runAnalysis = useCallback(() => {
    setLoading(true);
    setAnalysis(null);
    setProgressText('Reading stacktrace...');

    let step = 0;
    const steps = ['Parsing error signature...', 'Searching similar patterns...', 'Generating actionable insights...'];
    
    const interval = setInterval(() => {
      if (step < steps.length) {
        setProgressText(steps[step]);
        step++;
      }
    }, 600);

    // Simulate processing delay
    setTimeout(() => {
      clearInterval(interval);
      const result = generateAnalysis(exceptionType, exceptionValue, stacktrace, tags);
      setAnalysis(result);
      setLoading(false);
    }, 2500);
  }, [exceptionType, exceptionValue, stacktrace, tags]);

  const severityCfg = analysis ? SEVERITY_CONFIG[analysis.severity] : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Premium Header */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 3, py: 2.5,
        background: isDark ? 'linear-gradient(90deg, rgba(124, 77, 255, 0.15) 0%, rgba(30, 30, 30, 1) 100%)' : 'linear-gradient(90deg, rgba(124, 77, 255, 0.08) 0%, rgba(255, 255, 255, 1) 100%)',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 36, height: 36, borderRadius: '10px',
            background: 'linear-gradient(135deg, #7c4dff, #448aff)',
            color: '#fff',
            boxShadow: '0 4px 14px rgba(124, 77, 255, 0.4)'
          }}>
            <AiIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={800} sx={{ fontSize: '1.1rem', letterSpacing: '-0.02em' }}>
              {t('argus.ai.title', 'AI Root Cause Analysis')}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
              Gatrix Intelligence
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {analysis && severityCfg && (
            <Chip label={severityCfg.label} size="small" sx={{
              height: 24, fontSize: '0.7rem', fontWeight: 800,
              backgroundColor: alpha(severityCfg.color, 0.1), color: severityCfg.color,
              border: `1px solid ${alpha(severityCfg.color, 0.2)}`
            }} />
          )}
          {analysis && (
            <Tooltip title={t('argus.ai.reanalyze', 'Re-analyze')}>
              <IconButton onClick={() => runAnalysis()} sx={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}` }}>
                <RefreshIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          )}
          {onClose && (
            <IconButton onClick={onClose} sx={{ ml: 1, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)' }}>
              <CloseIcon sx={{ fontSize: 20 }} />
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 4 }}>
        
        {/* Initial CTA State */}
        {!analysis && !loading && (
          <Box sx={{ 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            py: 6, px: 2, textAlign: 'center'
          }}>
            <Box sx={{ 
              width: 80, height: 80, borderRadius: '50%', mb: 3,
              background: alpha('#7c4dff', 0.1),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: `2px solid ${alpha('#7c4dff', 0.2)}`
            }}>
              <ThinkIcon sx={{ fontSize: 40, color: '#7c4dff' }} />
            </Box>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 1.5 }}>
              Let AI investigate this error
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 400, mb: 4, lineHeight: 1.6 }}>
              Our AI engine will analyze the stacktrace, error context, and historical patterns to pinpoint the exact root cause and provide actionable code suggestions.
            </Typography>
            <Button 
              variant="contained" 
              size="large"
              startIcon={<AiIcon />}
              onClick={() => runAnalysis()}
              sx={{ 
                px: 4, py: 1.5, borderRadius: '12px',
                background: 'linear-gradient(135deg, #7c4dff 0%, #448aff 100%)',
                boxShadow: '0 8px 24px rgba(124, 77, 255, 0.3)',
                textTransform: 'none', fontSize: '1rem', fontWeight: 700,
                transition: 'all 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 12px 28px rgba(124, 77, 255, 0.4)',
                }
              }}
            >
              Start Analysis
            </Button>
          </Box>
        )}

        {/* Loading State */}
        {loading && (
          <Box sx={{ 
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            py: 8, px: 2, textAlign: 'center'
          }}>
            <Box sx={{ position: 'relative', width: 64, height: 64, mb: 3 }}>
              <CircularProgress size={64} thickness={2} sx={{ color: '#7c4dff', position: 'absolute', top: 0, left: 0 }} />
              <AiIcon sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#7c4dff', fontSize: 24, animation: 'pulse 1.5s infinite' }} />
            </Box>
            <Typography variant="h6" fontWeight={600} sx={{ mb: 1, color: '#7c4dff' }}>
              Analyzing Error Data...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {progressText}
            </Typography>
          </Box>
        )}

        {/* Results State */}
        {analysis && !loading && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            
            {/* Summary */}
            <Box sx={{ 
              p: 2.5, borderRadius: 2, 
              background: isDark ? 'rgba(124, 77, 255, 0.08)' : 'rgba(124, 77, 255, 0.04)',
              borderLeft: '4px solid #7c4dff'
            }}>
              <Typography sx={{ fontSize: '0.95rem', lineHeight: 1.6, fontWeight: 500, color: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)' }}>
                {analysis.summary}
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
              
              {/* Left Column (Root Cause & Suggestions) */}
              <Box sx={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
                
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#f44336', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <BugIcon sx={{ fontSize: 18 }} /> {t('argus.ai.rootCause', 'Root Cause')}
                  </Typography>
                  <Box sx={{ 
                    p: 2.5, borderRadius: 2, 
                    border: `1px solid ${isDark ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.3)'}`,
                    backgroundColor: isDark ? 'rgba(244, 67, 54, 0.05)' : 'rgba(244, 67, 54, 0.02)'
                  }}>
                    <Typography sx={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'text.secondary' }}>
                      {analysis.rootCause}
                    </Typography>
                  </Box>
                </Box>

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#4caf50', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <SuggestionIcon sx={{ fontSize: 18 }} /> {t('argus.ai.suggestions', 'Actionable Suggestions')}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {analysis.suggestions.map((s, i) => (
                      <Box key={i} sx={{ 
                        display: 'flex', gap: 1.5, alignItems: 'flex-start',
                        p: 2, borderRadius: 2,
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)'
                      }}>
                        <CheckIcon sx={{ fontSize: 18, color: '#4caf50', mt: 0.2, flexShrink: 0 }} />
                        <Typography sx={{ fontSize: '0.88rem', lineHeight: 1.6 }}>{s}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>

              </Box>

              {/* Right Column (Patterns & Code) */}
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
                
                {analysis.relatedPatterns.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#ff9800', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <PatternIcon sx={{ fontSize: 18 }} /> {t('argus.ai.patterns', 'Detected Patterns')}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {analysis.relatedPatterns.map((p, i) => (
                        <Box key={i} sx={{ 
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          p: 1.5, borderRadius: 1.5,
                          backgroundColor: alpha('#ff9800', 0.08), border: `1px solid ${alpha('#ff9800', 0.15)}`
                        }}>
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#ff9800' }}>{p.label}</Typography>
                          <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#ff9800' }}>{p.confidence}%</Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}

                {analysis.codePointers.length > 0 && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#7c4dff', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <CodeIcon sx={{ fontSize: 18 }} /> {t('argus.ai.codePointers', 'Code References')}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {analysis.codePointers.slice(0, 3).map((cp, i) => (
                        <Box key={i} sx={{
                          p: 1.5, borderRadius: 1.5,
                          backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
                        }}>
                          <Typography sx={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#7c4dff', mb: 0.5 }}>
                            {cp.file}:{cp.line}
                          </Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.4 }}>
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
