#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const FRONTEND_DIR = 'packages/frontend/src';

function fixMuiGrid() {
  console.log('🔧 Fixing MUI Grid v2 migration issues...\n');

  // Find all .tsx and .ts files
  const files = glob.sync(`${FRONTEND_DIR}/**/*.{ts,tsx}`, {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
  });

  let totalFiles = 0;
  let totalReplacements = 0;

  files.forEach((filePath) => {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;
      let fileReplacements = 0;

      // Fix Grid item prop removal
      const itemPattern = /<Grid\s+item\s+/g;
      content = content.replace(itemPattern, '<Grid ');
      const itemMatches = (originalContent.match(itemPattern) || []).length;
      fileReplacements += itemMatches;

      // Fix Grid xs, md, lg, xl props (remove item prop if present)
      const gridPropsPattern = /<Grid\s+(?:item\s+)?(xs|sm|md|lg|xl)=/g;
      content = content.replace(gridPropsPattern, '<Grid $1=');

      // Count additional replacements for grid props
      const gridPropsMatches = (originalContent.match(gridPropsPattern) || []).length;
      fileReplacements += gridPropsMatches;

      if (fileReplacements > 0) {
        console.log(
          `📝 ${path.relative(process.cwd(), filePath)}: ${fileReplacements} Grid fix(es)`
        );
        fs.writeFileSync(filePath, content, 'utf8');
        totalFiles++;
        totalReplacements += fileReplacements;
      }
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
  });

  console.log(
    `\n✅ MUI Grid migration completed! Modified ${totalFiles} files with ${totalReplacements} fixes.`
  );
}

if (require.main === module) {
  fixMuiGrid();
}

module.exports = { fixMuiGrid };
