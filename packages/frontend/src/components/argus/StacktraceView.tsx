import React, { useState } from 'react';
import { Box, Typography, IconButton, Collapse } from '@mui/material';
import {
  GitHub as GitHubIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import {
  oneLight,
  oneDark,
} from 'react-syntax-highlighter/dist/esm/styles/prism';
import tsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx';
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import python from 'react-syntax-highlighter/dist/esm/languages/prism/python';

SyntaxHighlighter.registerLanguage('tsx', tsx);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('python', python);

interface StacktraceViewProps {
  stacktrace: any;
  mode?: 'relevant' | 'full';
  order?: 'recent' | 'oldest';
  isDark: boolean;
}

const StacktraceView: React.FC<StacktraceViewProps> = React.memo(
  ({ stacktrace, mode = 'full', order = 'recent', isDark }) => {
    const { t } = useTranslation();
    const [toggledFrames, setToggledFrames] = useState<Set<number>>(new Set());

    let frames: any[] = [];
    try {
      frames =
        typeof stacktrace === 'string'
          ? JSON.parse(stacktrace)
          : Array.isArray(stacktrace)
            ? stacktrace
            : [];
    } catch {
      frames = [];
    }

    if (frames.length === 0) return null;

    let displayFrames =
      mode === 'relevant' ? frames.filter((f) => f.in_app) : [...frames];
    if (order === 'oldest') {
      displayFrames = displayFrames.reverse();
    }

    const toggleFrame = (idx: number) => {
      setToggledFrames((prev) => {
        const next = new Set(prev);
        next.has(idx) ? next.delete(idx) : next.add(idx);
        return next;
      });
    };

    // Only expand the first 3 in-app frames by default to prevent UI freezing
    let inAppCount = 0;

    if (displayFrames.length === 0 && mode === 'relevant') {
      return (
        <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">
            {t(
              'argus.issues.noInAppFrames',
              'No in-app frames found in stacktrace.'
            )}
          </Typography>
        </Box>
      );
    }

    const syntaxStyle = isDark ? oneDark : oneLight;

    return (
      <Box>
        {displayFrames.map((frame: any, idx: number) => {
          const isInApp = !!frame.in_app;
          const hasContext =
            !!frame.context_line ||
            (frame.pre_context && frame.pre_context.length > 0);

          let defaultExpanded = false;
          if (hasContext && isInApp) {
            inAppCount++;
            if (inAppCount <= 3) defaultExpanded = true;
          }

          const isExpanded =
            hasContext &&
            (defaultExpanded
              ? !toggledFrames.has(idx)
              : toggledFrames.has(idx));

          let codeSnippet = '';
          let startLine = 1;
          if (hasContext) {
            const pre = frame.pre_context || [];
            const post = frame.post_context || [];
            const lines = [...pre, frame.context_line || '', ...post];
            codeSnippet = lines.join('\n');
            startLine = Math.max(1, (frame.lineno || 1) - pre.length);
          }

          return (
            <Box
              key={idx}
              sx={{
                borderBottom:
                  idx < displayFrames.length - 1
                    ? `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
                    : 'none',
              }}
            >
              {/* Frame Header */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 2,
                  py: 1,
                  backgroundColor: isDark
                    ? 'rgba(255,255,255,0.02)'
                    : 'rgba(0,0,0,0.01)',
                  '&:hover': {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.03)',
                  },
                  transition: 'background 0.15s',
                }}
              >
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 0.5,
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{ fontSize: '0.8rem', color: isDark ? '#ccc' : '#444' }}
                  >
                    {frame.filename || frame.abs_path || '<anonymous>'}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontSize: '0.8rem', color: 'text.secondary' }}
                  >
                    in
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontSize: '0.8rem',
                      color: isDark ? '#bb86fc' : '#6200ea',
                      fontWeight: 600,
                    }}
                  >
                    {frame.function || '<anonymous>'}
                  </Typography>
                  {frame.lineno && (
                    <>
                      <Typography
                        variant="body2"
                        sx={{ fontSize: '0.8rem', color: 'text.secondary' }}
                      >
                        at
                      </Typography>
                      <Typography
                        variant="body2"
                        sx={{
                          fontSize: '0.8rem',
                          color: isDark ? '#aaa' : '#666',
                        }}
                      >
                        {frame.lineno}
                        {frame.colno ? `:${frame.colno}` : ''}
                      </Typography>
                    </>
                  )}
                </Box>

                {/* Right Icons */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    flexShrink: 0,
                  }}
                >
                  {frame.abs_path && (
                    <IconButton
                      size="small"
                      component="a"
                      href={
                        frame.abs_path.startsWith('http')
                          ? frame.abs_path
                          : `https://github.com/search?q=${encodeURIComponent(frame.filename || frame.abs_path)}`
                      }
                      target="_blank"
                      title={t('argus.issues.viewInGithub', 'View in GitHub')}
                      sx={{ color: 'text.secondary' }}
                    >
                      <GitHubIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  )}
                  {hasContext && (
                    <IconButton
                      size="small"
                      onClick={() => toggleFrame(idx)}
                      sx={{
                        color: 'text.secondary',
                        transform: isExpanded ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                      }}
                    >
                      <ExpandMoreIcon sx={{ fontSize: 18 }} />
                    </IconButton>
                  )}
                </Box>
              </Box>

              {/* Frame Code (Expanded) */}
              <Collapse in={isExpanded} unmountOnExit>
                {hasContext && (
                  <Box
                    sx={{
                      backgroundColor: isDark ? '#1e1e1e' : '#fafafa',
                      borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                    }}
                  >
                    {/* @ts-expect-error react-syntax-highlighter type incompatibility */}
                    <SyntaxHighlighter
                      language={
                        frame.filename?.endsWith('.ts') ||
                        frame.filename?.endsWith('.tsx')
                          ? 'tsx'
                          : frame.filename?.endsWith('.py')
                            ? 'python'
                            : 'javascript'
                      }
                      style={syntaxStyle}
                      showLineNumbers={true}
                      startingLineNumber={startLine}
                      wrapLines={true}
                      lineProps={(lineNumber: number) => {
                        const isCulprit = lineNumber === frame.lineno;
                        return {
                          style: {
                            display: 'block',
                            backgroundColor: isCulprit
                              ? isDark
                                ? 'rgba(244, 67, 54, 0.15)'
                                : 'rgba(244, 67, 54, 0.08)'
                              : 'transparent',
                            borderLeft: isCulprit
                              ? '3px solid #f44336'
                              : '3px solid transparent',
                            paddingLeft: '0px',
                          },
                        };
                      }}
                      customStyle={{
                        margin: 0,
                        padding: '8px 0',
                        fontSize: '0.8rem',
                        background: 'transparent',
                      }}
                    >
                      {codeSnippet}
                    </SyntaxHighlighter>
                  </Box>
                )}
              </Collapse>
            </Box>
          );
        })}
      </Box>
    );
  }
);

export default StacktraceView;
