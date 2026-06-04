import re

with open('src/pages/argus/ArgusIssueDetailPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the leftover {activeTab === ...} blocks
# 1. Activity tab block
activity_regex = r'\{activeTab === \'activity\' && \(\s*<Box sx=\{\{\s*display: \'flex\', flexDirection: \'column\', gap: 2\s*\}\}>\s*\{\s*/\*\s*Event Navigator\s*\*/\s*\}(.*?)\s*</Box>\s*\)\}'
match = re.search(activity_regex, content, flags=re.DOTALL)
if match:
    # We want to extract EventNavigator and put it at the top of Details
    event_nav_regex = r'\{\s*/\*\s*Event Navigator\s*\*/\s*\}(.*?)\{\s*/\*\s*Activity — embedded mode\s*\*/\s*\}'
    nav_match = re.search(event_nav_regex, match.group(0), flags=re.DOTALL)
    nav_code = nav_match.group(1).strip() if nav_match else ""
    
    # We already added ActivityTimeline to Right column, so we can discard the rest of the activity tab
    content = re.sub(activity_regex, '', content, flags=re.DOTALL)
    
    # Insert nav_code before Event Highlights
    if nav_code:
        content = content.replace("{/* Event Highlights — Sentry-style promoted tags/context */}", "{/* Event Navigator */}\n" + nav_code + "\n              {/* Event Highlights — Sentry-style promoted tags/context */}")

# 2. Feedback tab block
feedback_regex = r'\{activeTab === \'feedback\' && \(\s*<Box>\s*\{\s*/\*\s*User Feedback\s*\*/\s*\}(.*?)\s*</Box>\s*\)\}'
match_fb = re.search(feedback_regex, content, flags=re.DOTALL)
if match_fb:
    fb_code = match_fb.group(1).strip()
    content = re.sub(feedback_regex, '', content, flags=re.DOTALL)
    
    content = content.replace("{/* Right Column: Sidebar", "{/* User Feedback */}\n" + fb_code + "\n\n            {/* Right Column: Sidebar")

# 3. Traces tab block
traces_regex = r'\{activeTab === \'traces\' && \(\s*<Box>\s*\{\s*/\*\s*Trace Waterfall\s*\*/\s*\}(.*?)\s*</Box>\s*\)\}'
match_tr = re.search(traces_regex, content, flags=re.DOTALL)
if match_tr:
    tr_code = match_tr.group(1).strip()
    content = re.sub(traces_regex, '', content, flags=re.DOTALL)
    
    content = content.replace("{/* Right Column: Sidebar", "{/* Trace Waterfall */}\n" + tr_code + "\n\n            {/* Right Column: Sidebar")

# Fix stray {activeTab === 'details' && ( closing tags or similar
content = content.replace("              })()}\n            </Box>\n          )}\n                </Box>\n              )}", "              })()}\n            </Box>\n          )}")

with open('src/pages/argus/ArgusIssueDetailPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
