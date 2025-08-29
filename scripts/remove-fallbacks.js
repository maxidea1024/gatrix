#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const FRONTEND_DIR = 'packages/frontend/src';

function removeFallbacks() {
  console.log('🔍 Finding all TypeScript/React files with fallback patterns...\n');
  
  // Find all .tsx and .ts files
  const files = glob.sync(`${FRONTEND_DIR}/**/*.{ts,tsx}`, {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
  });
  
  let totalFiles = 0;
  let totalReplacements = 0;
  
  files.forEach(filePath => {
    try {
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;
      
      // Pattern to match t('key') || 'fallback text'
      // This regex captures the t() call and removes the || 'fallback' part
      const fallbackPattern = /t\(([^)]+)\)\s*\|\|\s*['"`][^'"`]*['"`]/g;
      
      let matches = [];
      let match;
      while ((match = fallbackPattern.exec(originalContent)) !== null) {
        matches.push({
          full: match[0],
          tCall: `t(${match[1]})`,
          start: match.index,
          end: match.index + match[0].length
        });
      }
      
      if (matches.length > 0) {
        console.log(`📝 ${path.relative(process.cwd(), filePath)}: ${matches.length} fallback(s) found`);
        
        // Replace from end to start to maintain correct indices
        matches.reverse().forEach(match => {
          content = content.substring(0, match.start) + match.tCall + content.substring(match.end);
          console.log(`  ✅ Removed: ${match.full} → ${match.tCall}`);
          totalReplacements++;
        });
        
        fs.writeFileSync(filePath, content, 'utf8');
        totalFiles++;
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
  });
  
  console.log(`\n✅ Completed! Modified ${totalFiles} files with ${totalReplacements} replacements.`);
}

if (require.main === module) {
  removeFallbacks();
}

module.exports = { removeFallbacks };
