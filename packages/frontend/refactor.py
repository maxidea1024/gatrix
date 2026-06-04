import sys

def extract(content, start_marker, end_marker):
    start = content.find(start_marker)
    if start == -1: return '', content
    
    end = content.find(end_marker, start)
    if end == -1: return '', content
    
    block = content[start:end+len(end_marker)]
    new_content = content[:start] + content[end+len(end_marker):]
    return block, new_content

def refactor():
    with open('src/pages/argus/ArgusIssueDetailPage.tsx', 'r', encoding='utf-8') as f:
        content = f.read()

    # Imports
    import_page_header = "import PageHeader from '@/components/common/PageHeader';"
    import_seg_tabs = "import SegmentedTabs from '@/components/common/SegmentedTabs';\nimport ArgusBreadcrumbs from '@/components/argus/ArgusBreadcrumbs';"
    content = content.replace(import_page_header, import_page_header + '\n' + import_seg_tabs)
    
    import_url_state = "import { useArgusUrlState } from '@/hooks/useArgusUrlState';"
    content = content.replace("import SuspectCommits from '@/components/argus/SuspectCommits';", "import SuspectCommits from '@/components/argus/SuspectCommits';\n" + import_url_state)

    # URL State
    target = "const { projectId, issueId } = useParams<{ projectId: string; issueId: string }>();"
    url_state_code = """
  const location = useLocation();
  const URL_PARAMS = React.useMemo(() => ({
    tab: { key: 'tab', default: 'details' },
  }), []);
  const [urlState, setUrlState] = useArgusUrlState(URL_PARAMS);
  const activeTab = urlState.tab;
"""
    content = content.replace(target, target + '\n' + url_state_code)
    # Fix useLocation import
    if "useLocation" not in content[:content.find("from 'react-router-dom'")]:
        content = content.replace("import { useParams, useNavigate } from 'react-router-dom';", "import { useParams, useNavigate, useLocation } from 'react-router-dom';")

    # Extract Blocks
    edc, content = extract(content, '{/* Event Distribution Chart */}', '</Box>\n              )}')
    en, content = extract(content, '{/* Event Navigator */}', '</Box>\n              )}')
    at, content = extract(content, '{/* Activity — embedded mode */}', '</Box>\n              )}')
    sc, content = extract(content, '{/* Suspect Commits — renders null if no data */}', 'isDark={isDark} />\n              )}')
    it, content = extract(content, '{/* Issue Tracking */}', '</Box>\n              )}')
    td, content = extract(content, '{/* Tag Distribution — sidebar */}', 'isDark={isDark}\n                />\n              )}')
    fb, content = extract(content, '{/* Linked User Feedbacks */}', '</Box>\n              )}')
    bc, content = extract(content, '{/* Breadcrumbs */}', '</Box>\n              )}')

    # Logs
    logs_start = '{/* Structured Logs Section */}'
    logs_end = '</Paper>\n      )}'
    logs, content = extract(content, logs_start, logs_end)
    if not logs: 
        logs, content = extract(content, logs_start, '</Paper>')

    # Remove extra dividers
    content = content.replace('<Divider sx={{ mb: 2 }} />\n\n', '')
    content = content.replace('<Divider sx={{ my: 2 }} />\n\n', '')
    content = content.replace('<Divider sx={{ mb: 2 }} />\n', '')
    content = content.replace('<Divider sx={{ my: 2 }} />\n', '')

    grid_box_start = content.find("<Box sx={{\n            display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr', xl: '3fr 1fr' }")
    if grid_box_start == -1:
        grid_box_start = content.find("<Box sx={{\n            display: 'grid'")

    tabs_ui = """
          {/* New Tabs Container */}
          <Box sx={{ mb: 3 }}>
            <SegmentedTabs
              items={[
                { key: 'details', label: t('argus.issues.tabs.details', 'Details') },
                { key: 'activity', label: t('argus.issues.tabs.activity', 'Activity') },
                { key: 'feedback', label: t('argus.issues.tabs.feedback', 'User Feedback') },
                { key: 'traces', label: t('argus.issues.tabs.traces', 'Traces & Logs') },
              ]}
              value={activeTab}
              onChange={(k) => setUrlState({ tab: k })}
            />
          </Box>

          {activeTab === 'details' && (
"""
    content = content[:grid_box_start] + tabs_ui + content[grid_box_start:]

    closing_seq = "          </Box>\n        </Box>\n      )}"
    insert_point = content.find(closing_seq)
    
    template = """
          {/* ====== END OF DETAILS TAB ====== */}
          </Box>
          )}

          {activeTab === 'activity' && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '5fr 2fr', xl: '5fr 2fr' }, gap: 3, alignItems: 'stretch' }}>
            <Box sx={{ minWidth: 0, pr: { md: 3 }, borderRight: { xs: 'none', md: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}` } }}>
              __EN__
              __AT__
            </Box>
            <Box sx={{ minWidth: 0, overflow: 'hidden', height: '100%' }}>
              __SC__
              __IT__
            </Box>
          </Box>
          )}

          {activeTab === 'feedback' && (
          <Box>
              __FB__
          </Box>
          )}

          {activeTab === 'traces' && (
          <Box>
              __LOGS__
          </Box>
          )}
"""
    template = template.replace('__EN__', en).replace('__AT__', at).replace('__SC__', sc).replace('__IT__', it).replace('__FB__', fb).replace('__LOGS__', logs)

    content = content[:insert_point] + template + "\n        </Box>\n      )}" + content[insert_point+len(closing_seq):]

    right_col_start = content.find('{/* Right Column: Sidebar')
    if right_col_start != -1:
        ip = content.find('{/* Timing — Last/First Seen */}', right_col_start)
        if ip != -1:
            content = content[:ip] + edc + '\n\n              ' + td + '\n\n              ' + content[ip:]

    st_header = content.find('{/* Exception + Stacktrace */}')
    if st_header != -1:
        content = content[:st_header] + bc + '\n\n              ' + content[st_header:]

    with open('src/pages/argus/ArgusIssueDetailPage.tsx', 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    refactor()
    print('Refactoring complete.')
