import sys

def extract(c, s, e):
    b = c.find(s)
    if b == -1: return '', c
    d = c.find(e, b)
    if d == -1: return '', c
    return c[b:d+len(e)], c[:b] + c[d+len(e):]

def main():
    with open('src/pages/argus/ArgusIssueDetailPage.tsx', 'r', encoding='utf-8') as f:
        c = f.read()

    # 1. Left column start
    c = c.replace('            {/* Left Column: Main Content */}\n            <Box>', '            {/* Left Column: Main Content */}\n            <Box sx={{ minWidth: 0 }}>')

    # 2. Extract components
    edc, c = extract(c, '{/* Event Distribution Chart */}', '</Box>\n              )}')
    ai, c = extract(c, '{/* AI Root Cause — flat section */}', '/>\n              )}')
    en, c = extract(c, '{/* Event Navigator */}', '</Box>\n              )}')
    eh, c = extract(c, '{/* Event Highlights — Sentry-style promoted tags/context */}', '})()}')
    le, c = extract(c, '{/* Latest Event */}', '</Box>\n          )}')
    logs, c = extract(c, '{/* Structured Logs Section */}', '</Paper>\n      )}')
    sc, c = extract(c, '{/* Suspect Commits — renders null if no data */}', 'isDark={isDark} />\n              )}')
    it, c = extract(c, '{/* Issue Tracking */}', '</Box>\n              )}')
    at, c = extract(c, '{/* Activity — embedded mode */}', 'embedded\n                  />\n                </Box>\n              )}')
    td, c = extract(c, '{/* Tag Distribution — sidebar */}', 'isDark={isDark}\n                />\n              )}')
    if not td:
        td, c = extract(c, '{/* Tag Distribution — sidebar */}', 'isDark={isDark}\n                  />\n                </Box>\n              )}')
    if not td:
        td, c = extract(c, '{/* Tag Distribution — sidebar */}', '/>\n              )}')

    # 3. Insert Tabs
    tabs_str = """
              {/* Tabs Container */}
              <Box sx={{ mb: 3 }}>
                <SegmentedTabs
                  items={[
                    { key: 'details', label: t('argus.issues.tabs.details', 'Details') },
                    { key: 'activity', label: t('argus.issues.tabs.activity', 'Activity') },
                    { key: 'feedback', label: t('argus.issues.tabs.feedback', 'User Feedback') },
                    { key: 'traces', label: t('argus.issues.tabs.traces', 'Traces & Logs') },
                    { key: 'ai', label: t('argus.issues.tabs.ai', 'AI Analysis') },
                  ]}
                  value={activeTab}
                  onChange={(k) => setUrlState({ tab: k })}
                />
              </Box>

              {activeTab === 'details' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  __EH__
                  __LE__
                </Box>
              )}

              {activeTab === 'activity' && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  __EN__
                  __AT__
                </Box>
              )}

              {activeTab === 'feedback' && (
                <Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', p: 3, textAlign: 'center' }}>
                    {t('argus.issues.noFeedbacks', 'No user feedbacks yet.')}
                  </Typography>
                </Box>
              )}

              {activeTab === 'traces' && (
                <Box>
                  __LOGS__
                </Box>
              )}

              {activeTab === 'ai' && (
                <Box>
                  __AI__
                </Box>
              )}
"""
    tabs_str = tabs_str.replace('__EH__', eh).replace('__LE__', le).replace('__EN__', en).replace('__AT__', at).replace('__LOGS__', logs).replace('__AI__', ai)

    # insert tabs after Left Column box
    lc_str = '            {/* Left Column: Main Content */}\n            <Box sx={{ minWidth: 0 }}>'
    ip = c.find(lc_str) + len(lc_str)
    c = c[:ip] + tabs_str + c[ip:]

    # 4. Insert Right Column components
    ip_rc = c.find('{/* Right Column: Sidebar — Sentry style: flat sections with Dividers */}')
    ip_insert = c.find('{/* Timing — Last/First Seen */}', ip_rc)

    right_comp_str = """
              __EDC__
              __TD__
              __SC__
              __IT__
"""
    prop_end = c.find('</Box>\n              </Box>\n\n              <Divider sx={{ mb: 2 }} />', ip_insert)
    if prop_end != -1:
        ip_insert_after = prop_end + len('</Box>\n              </Box>\n\n              <Divider sx={{ mb: 2 }} />')
        right_comp_str = right_comp_str.replace('__EDC__', edc).replace('__TD__', td).replace('__SC__', sc).replace('__IT__', it)
        c = c[:ip_insert_after] + right_comp_str + c[ip_insert_after:]
    else:
        print('Failed to find properties end')

    # Remove extra dividers left behind
    c = c.replace('<Divider sx={{ mb: 2 }} />\n\n              \n\n              <Divider sx={{ mb: 2 }} />', '<Divider sx={{ mb: 2 }} />')

    with open('src/pages/argus/ArgusIssueDetailPage.tsx', 'w', encoding='utf-8') as f:
        f.write(c)

if __name__ == '__main__':
    main()
