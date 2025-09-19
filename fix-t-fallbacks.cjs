#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const FRONTEND_DIR = 'packages/frontend/src';

function fixTFallbacks() {
  console.log('🔧 Fixing t() function fallback parameters...\n');
  
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
      let fileReplacements = 0;
      
      // Pattern 1: t('key', 'fallback text')
      const pattern1 = /t\(\s*['"`]([^'"`]+)['"`]\s*,\s*['"`][^'"`]*['"`]\s*\)/g;
      content = content.replace(pattern1, "t('$1')");
      const matches1 = (originalContent.match(pattern1) || []).length;
      fileReplacements += matches1;
      
      // Pattern 2: t('key', { defaultValue: 'fallback' })
      const pattern2 = /t\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{\s*defaultValue:\s*['"`][^'"`]*['"`]\s*\}\s*\)/g;
      content = content.replace(pattern2, "t('$1')");
      const matches2 = (originalContent.match(pattern2) || []).length;
      fileReplacements += matches2;
      
      // Pattern 3: t('key', { count: number, defaultValue: 'fallback' })
      const pattern3 = /t\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{\s*count:\s*[^,}]+,\s*defaultValue:\s*['"`][^'"`]*['"`]\s*\}\s*\)/g;
      content = content.replace(pattern3, "t('$1', { count: $2 })");
      
      // Pattern 4: t('key', { defaultValue: 'fallback', count: number })
      const pattern4 = /t\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{\s*defaultValue:\s*['"`][^'"`]*['"`]\s*,\s*count:\s*([^}]+)\s*\}\s*\)/g;
      content = content.replace(pattern4, "t('$1', { count: $2 })");
      
      // Pattern 5: t('key', { ...other, defaultValue: 'fallback' })
      const pattern5 = /t\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{\s*([^}]*),\s*defaultValue:\s*['"`][^'"`]*['"`]\s*\}\s*\)/g;
      content = content.replace(pattern5, "t('$1', { $2 })");
      
      // Pattern 6: t('key', { defaultValue: 'fallback', ...other })
      const pattern6 = /t\(\s*['"`]([^'"`]+)['"`]\s*,\s*\{\s*defaultValue:\s*['"`][^'"`]*['"`]\s*,\s*([^}]+)\s*\}\s*\)/g;
      content = content.replace(pattern6, "t('$1', { $2 })");
      
      const matches3 = (originalContent.match(pattern3) || []).length;
      const matches4 = (originalContent.match(pattern4) || []).length;
      const matches5 = (originalContent.match(pattern5) || []).length;
      const matches6 = (originalContent.match(pattern6) || []).length;
      fileReplacements += matches3 + matches4 + matches5 + matches6;
      
      if (fileReplacements > 0) {
        console.log(`📝 ${path.relative(process.cwd(), filePath)}: ${fileReplacements} t() fallback fix(es)`);
        fs.writeFileSync(filePath, content, 'utf8');
        totalFiles++;
        totalReplacements += fileReplacements;
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
    }
  });
  
  console.log(`\n✅ t() fallback removal completed! Modified ${totalFiles} files with ${totalReplacements} fixes.`);
}

if (require.main === module) {
  fixTFallbacks();
}

module.exports = { fixTFallbacks };
