import re

with open('src/pages/argus/ArgusIssueDetailPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the leftover {activeTab === 'activity'} block
content = re.sub(r'\{\s*/\*\s*Activity — embedded mode\s*\*/\s*\}(.*?)\{activeTab === \'feedback\'', r'{activeTab === \'feedback\'', content, flags=re.DOTALL)
# And the closing braces above it
content = re.sub(r'</Box>\s*\)\}\s*\{activeTab === \'feedback\'', r'{activeTab === \'feedback\'', content, flags=re.DOTALL)
# One more closing brace that might be left:
content = re.sub(r'\s*\}\)\(\)\}\s*</Box>\s*\)\}\s*</Box>\s*\)\}\s*\{activeTab === \'feedback\'', r'\n              })()}\n            </Box>\n          )}\n          {activeTab === \'feedback\'', content, flags=re.DOTALL)


# Remove the feedback block and move its content to the bottom of Left Column
fb_regex = r'\{activeTab === \'feedback\' && \(\s*<Box>(.*?)</Box>\s*\)\}'
fb_match = re.search(fb_regex, content, flags=re.DOTALL)
if fb_match:
    fb_code = fb_match.group(1).strip()
    content = re.sub(fb_regex, '', content, flags=re.DOTALL)
    content = content.replace("{/* Right Column: Sidebar", "{/* User Feedback */}\n              <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>\n" + fb_code + "\n              </Box>\n\n            {/* Right Column: Sidebar")

# Remove the traces block and move its content to the bottom of Left Column
traces_regex = r'\{activeTab === \'traces\' && \(\s*<Box>(.*?)</Box>\s*\)\}\s*\{\s*/\*\s*Right Column: Sidebar'
traces_match = re.search(traces_regex, content, flags=re.DOTALL)
if traces_match:
    tr_code = traces_match.group(1).strip()
    content = re.sub(traces_regex, r'{/* Right Column: Sidebar', content, flags=re.DOTALL)
    content = content.replace("{/* Right Column: Sidebar", "{/* Traces & Logs */}\n              <Box sx={{ mt: 2, pt: 2, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>\n" + tr_code + "\n              </Box>\n\n            {/* Right Column: Sidebar")


# Just in case there are still stray closing braces, let's just make sure it compiles.
with open('src/pages/argus/ArgusIssueDetailPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
