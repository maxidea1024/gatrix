import re
import sys

def main():
    file_path = 'src/pages/argus/ArgusIssueDetailPage.tsx'
    with open(file_path, 'r', encoding='utf-8') as f:
        code = f.read()

    # Find the start of the grid
    grid_idx = code.find('<Box sx={{\n            display: \'grid\', gridTemplateColumns: { xs: \'1fr\', md: \'2fr 1fr\', xl: \'3fr 1fr\' }, gap: 3, alignItems: \'stretch\',')
    if grid_idx == -1:
        print('Could not find grid start')
        return

    # 1. Move SegmentedTabs inside the Left Column Box
    tabs_start = code.find('          {/* New Tabs Container */}')
    tabs_end = code.find('          </Box>\n\n          {activeTab === \'details\'')
    if tabs_start == -1 or tabs_end == -1:
        print('Could not find tabs')
        return
    
    tabs_block = code[tabs_start:tabs_end + 17] # Includes the </Box>\n
    code = code[:tabs_start] + code[tabs_end + 18:]
    
    # 2. Extract Right Column (Sidebar)
    sidebar_start = code.find('            {/* Right Column: Sidebar')
    sidebar_end = code.find('          {/* ====== END OF DETAILS TAB ====== */}\n          </Box>\n')
    if sidebar_start == -1 or sidebar_end == -1:
        print('Could not find sidebar')
        return
    
    sidebar_block = code[sidebar_start:sidebar_end + 67] # include the Box closing
    code = code[:sidebar_start] + code[sidebar_end + 67:]
    
    # Now code doesn't have tabs or sidebar.
    # The grid is wrapped by: {activeTab === 'details' && (
    # We want to remove that wrapper, and open the grid unconditionally.
    
    code = code.replace(
        "          {activeTab === 'details' && (\n<Box sx={{\n            display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr', xl: '3fr 1fr' }, gap: 3, alignItems: 'stretch',\n            position: 'relative',\n            '&::before': {\n              content: '\"\"',\n              display: { xs: 'none', md: 'block' },\n              position: 'absolute', top: 0, bottom: 0, left: { md: '66.666%', xl: '75%' },\n              width: '1px', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',\n            }\n          }}>\n            {/* Left Column: Main Content */}\n            <Box>\n",
        "<Box sx={{\n            display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr', xl: '3fr 1fr' }, gap: 3, alignItems: 'stretch',\n            position: 'relative',\n            '&::before': {\n              content: '\"\"',\n              display: { xs: 'none', md: 'block' },\n              position: 'absolute', top: 0, bottom: 0, left: { md: '66.666%', xl: '75%' },\n              width: '1px', backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',\n            }\n          }}>\n            {/* Left Column: Main Content */}\n            <Box sx={{ minWidth: 0 }}>\n" + tabs_block + "          {activeTab === 'details' && (\n              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>\n"
    )

    # 3. details tab end
    code = code.replace(
        "          )}\n\n          {activeTab === 'activity' && (\n",
        "              </Box>\n            )}\n\n          {activeTab === 'activity' && (\n"
    )

    # 4. Activity tab - remove inner grid
    code = code.replace(
        "          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '5fr 2fr', xl: '5fr 2fr' }, gap: 3, alignItems: 'stretch' }}>\n            <Box sx={{ minWidth: 0, pr: { md: 3 }, borderRight: { xs: 'none', md: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'}` } }}>\n",
        "              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>\n"
    )
    code = code.replace(
        "            </Box>\n            <Box sx={{ minWidth: 0, overflow: 'hidden', height: '100%' }}>\n",
        "                \n"
    )
    code = code.replace(
        "            </Box>\n          </Box>\n          )}\n\n          {activeTab === 'feedback'",
        "              </Box>\n            )}\n\n          {activeTab === 'feedback'"
    )
    
    # 5. Insert Sidebar at the end of the Grid
    # The grid was opened at <Box sx={{ display: 'grid'...
    # and it should close before </Box>\n      )}\n\n\n      <Dialog
    
    ai_end = code.find("          )}\n\n        </Box>\n      )}\n\n\n      <Dialog open={confirmDialog.open}")
    if ai_end != -1:
        # replace `          )}\n\n        </Box>\n      )}\n`
        # with    `          )}\n            </Box>\n{sidebar_block}\n        </Box>\n      )}\n`
        sidebar_clean = sidebar_block.replace("          {/* ====== END OF DETAILS TAB ====== */}\n          </Box>\n", "")
        code = code[:ai_end] + "            )}\n            </Box>\n" + sidebar_clean + "          </Grid>\n        </Box>\n      )}\n\n\n      <Dialog open={confirmDialog.open}" + code[ai_end+79:]
        # wait, the original was `        </Box>\n      )}\n`, so I need to close the left column `</Box>` then put the right column `sidebar_clean` (which is a `<Grid item>` wait, it's a Box?)
        # Let's fix that.

    with open('src/pages/argus/ArgusIssueDetailPage.temp.tsx', 'w', encoding='utf-8') as f:
        f.write(code)

if __name__ == '__main__':
    main()
