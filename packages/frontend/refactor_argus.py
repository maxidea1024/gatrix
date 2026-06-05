import re

with open('src/pages/argus/ArgusIssueDetailPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove SegmentedTabs
tabs_regex = r'\{\s*/\*\s*Tabs Container\s*\*/\s*\}\s*<Box sx=\{\{ mb: 3 \}\}>\s*<SegmentedTabs.*?/>\s*</Box>'
content = re.sub(tabs_regex, '', content, flags=re.DOTALL)

# 2. Remove the {activeTab === 'details' && ( and its closing braces.
# It starts at: {activeTab === 'details' && (\n                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
content = content.replace("{activeTab === 'details' && (\n                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>", "<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>")

# 3. Add EventDistributionChart to the top of Left Column
chart_component = """
              {/* Event Distribution Chart (Moved from right sidebar) */}
              {projectId && issueId && (
                <Box sx={{ mb: 3 }}>
                  <EventDistributionChart
                    projectId={projectId}
                    issueId={issueId}
                    isDark={isDark}
                  />
                </Box>
              )}
"""
content = content.replace("              {/* Event Highlights — Sentry-style promoted tags/context */}", chart_component + "\n              {/* Event Highlights — Sentry-style promoted tags/context */}")

# 4. Remove EventDistributionChart from Right Column
right_col_chart_regex = r'\{\s*/\*\s*Event Distribution Chart\s*\*/\s*\}\s*\{projectId && issueId && \(\s*<Box sx=\{\{ mb: 2 \}\}>\s*<EventDistributionChart.*?/>\s*</Box>\s*\)\}'
content = re.sub(right_col_chart_regex, '', content, flags=re.DOTALL)

# 5. Restore BreadcrumbsTimeline after the Exception block
breadcrumbs_code = """
              {/* Breadcrumbs */}
              <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
                {latestEvent && (
                  <BreadcrumbsTimeline
                    breadcrumbs={typeof latestEvent.breadcrumbs === 'string' ? JSON.parse(latestEvent.breadcrumbs) : latestEvent.breadcrumbs}
                    isDark={isDark}
                  />
                )}
              </Box>
"""
content = content.replace("                {/* Stacktrace */}\n                <StacktraceView stacktrace={latestEvent.stacktrace_raw} isDark={isDark} />\n              </Paper>", "                {/* Stacktrace */}\n                <StacktraceView stacktrace={latestEvent.stacktrace_raw} isDark={isDark} />\n              </Paper>" + breadcrumbs_code)

# 6. Remove activeTab condition for AI analysis.
# We will put AI analysis in a dialog. So let's replace {activeTab === 'ai' && ( ... )} with a Dialog.
ai_regex = r'\{activeTab === \'ai\' && \(\s*<Box>\s*\{\s*/\*\s*AI Root Cause — flat section\s*\*/\s*\}\s*\{projectId && issueId && \(\s*<AiRootCausePanel.*?\/>\s*\)\}\s*</Box>\s*\)\}'
ai_dialog = """
      <Dialog open={showAiAnalysis} onClose={() => setShowAiAnalysis(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 700 }}>
          {t('argus.issues.aiAnalysis', 'AI Analysis')}
          <IconButton onClick={() => setShowAiAnalysis(false)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflowX: 'hidden' }}>
          {projectId && issueId && (
            <AiRootCausePanel
              projectId={projectId}
              issueId={issueId}
              issueTitle={issue.title}
              exceptionType={latestEvent?.exception_type}
              exceptionValue={latestEvent?.exception_value}
              stacktrace={latestEvent?.stacktrace_raw}
              tags={latestEvent?.tags ? (typeof latestEvent.tags === 'string' ? (() => { try { return JSON.parse(latestEvent.tags); } catch { return undefined; } })() : latestEvent.tags) : undefined}
              isDark={isDark}
            />
          )}
        </DialogContent>
      </Dialog>
"""
content = re.sub(ai_regex, '', content, flags=re.DOTALL)

# Insert the dialog before the closing of the main component return
content = content.replace("</PageContentLoader>", ai_dialog + "\n    </PageContentLoader>")

# 7. Add state for showAiAnalysis
content = content.replace("const [showTrace, setShowTrace] = useState(false);", "const [showTrace, setShowTrace] = useState(false);\n  const [showAiAnalysis, setShowAiAnalysis] = useState(false);")

# 8. Add AI button to the Action Bar
ai_button = """
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1 }}>
              <Button variant="outlined" size="small" onClick={() => setShowAiAnalysis(true)} sx={{ height: 26, fontSize: '0.75rem', borderRadius: 1.5, borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', color: 'text.primary', '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } }}>
                {t('argus.issues.aiAnalysis', 'AI 분석')}
              </Button>
            </Box>
"""
content = content.replace("{/* Priority */}", ai_button + "\n            {/* Priority */}")

# 9. Add ActivityTimeline to Right Column
activity_timeline = """
              {/* Activity Timeline */}
              {projectId && issueId && (
                <Box sx={{ mt: 3, mb: 2 }}>
                  <Typography variant="caption" fontWeight={700} sx={{
                    fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em',
                    color: 'text.secondary', mb: 1.5, display: 'block',
                  }}>
                    {t('argus.issues.activity', 'Activity')}
                  </Typography>
                  <ActivityTimeline projectId={projectId} issueId={issueId} isDark={isDark} />
                </Box>
              )}
"""
content = content.replace("{/* Issue Tracking */}", activity_timeline + "\n              {/* Issue Tracking */}")

# 10. Update StacktraceView to include the Most Relevant / Full toggle UI
stacktrace_header = """
                {/* Exception header */}
                <Box sx={{
                  p: 2, backgroundColor: alpha(levelColor, 0.06),
                  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
                }}>
                  <Box>
                    <Typography variant="body1" fontWeight={700} sx={{ color: levelColor, fontFamily: 'monospace' }}>
                      {latestEvent.exception_type}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.5, color: isDark ? '#aaa' : '#666' }}>
                      {latestEvent.exception_value}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Box sx={{ 
                      display: 'flex', backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', 
                      borderRadius: 1, overflow: 'hidden', p: 0.3
                    }}>
                      <Button size="small" sx={{ 
                        fontSize: '0.7rem', py: 0, minWidth: 0, px: 1, 
                        color: 'text.primary', backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#fff',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)', '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#fff' }
                      }}>{t('argus.issues.mostRelevant', 'Most Relevant')}</Button>
                      <Button size="small" sx={{ 
                        fontSize: '0.7rem', py: 0, minWidth: 0, px: 1, color: 'text.secondary' 
                      }}>{t('argus.issues.fullStackTrace', 'Full Stack Trace')}</Button>
                    </Box>
                  </Box>
                </Box>
"""
content = re.sub(r'\{\s*/\*\s*Exception header\s*\*/\s*\}\s*<Box sx=\{\{\s*p: 2, backgroundColor: alpha\(levelColor, 0\.06\),\s*borderBottom: `1px solid \$\{isDark \? \'rgba\(255,255,255,0\.04\)\' : \'rgba\(0,0,0,0\.04\)\'\}`,\s*\}\}>\s*<Typography variant="body1" fontWeight=\{700\} sx=\{\{ color: levelColor, fontFamily: \'monospace\' \}\}>\s*\{latestEvent\.exception_type\}\s*</Typography>\s*<Typography variant="body2" sx=\{\{ mt: 0\.5, color: isDark \? \'#aaa\' : \'#666\' \}\}>\s*\{latestEvent\.exception_value\}\s*</Typography>\s*</Box>', stacktrace_header, content, flags=re.DOTALL)


# Fix the unclosed Box issue from removing the {activeTab === 'details' && (
# We need to find the closing </Box> of the details block and remove it.
# It's located exactly before {activeTab === 'ai' && (
# Let's replace:
#                </Box>
#              )}
#
#              {activeTab === 'ai'
content = re.sub(r'</Box>\s*\)\}\s*\{activeTab === \'ai\'', '{activeTab === \'ai\'', content, flags=re.DOTALL)


with open('src/pages/argus/ArgusIssueDetailPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

