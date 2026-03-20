// Scan all pages that have h4 headers with icons (likely page headers to convert)
// and report their header structure
const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'packages', 'frontend', 'src', 'pages');

function findTsxFiles(dir) {
  const results = [];
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fp = path.join(dir, item);
      const stat = fs.statSync(fp);
      if (stat.isDirectory()) {
        results.push(...findTsxFiles(fp));
      } else if (item.endsWith('Page.tsx')) {
        results.push(fp);
      }
    }
  } catch(e) {}
  return results;
}

const allPages = findTsxFiles(pagesDir);

// Skip auth, common pages - they have different layouts
const skipDirs = ['auth', 'common'];

console.log('=== Pages with h4 headers that need PageHeader ===');
allPages.forEach(fp => {
  const content = fs.readFileSync(fp, 'utf8');
  const rel = path.relative(pagesDir, fp);
  
  // Skip auth/common pages
  if (skipDirs.some(d => rel.startsWith(d + '\\'))) return;
  // Skip already converted pages
  if (content.includes('<PageHeader')) return;
  
  const lines = content.split('\n');
  
  // Find h4 Typography with icon pattern
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('variant="h4"') && lines[i-1]?.includes('Typography')) {
      // Show context
      const start = Math.max(0, i - 3);
      const end = Math.min(lines.length, i + 10);
      const context = lines.slice(start, end);
      
      // Check if there's an Icon nearby
      const block = context.join('\n');
      if (block.includes('Icon')) {
        // Extract icon name
        const iconMatch = block.match(/<(\w+Icon)\s/);
        const iconName = iconMatch ? iconMatch[1] : 'unknown';
        
        // Check for color in icon
        const hasColor = block.includes("color:") || block.includes('color=');
        
        console.log(`\n${rel} (line ${i+1}):`);
        console.log(`  Icon: ${iconName}, HasColor: ${hasColor}`);
        
        // Find translation keys
        const titleMatch = block.match(/\{t\('([^']+)'\)\}/);
        console.log(`  Title key: ${titleMatch ? titleMatch[1] : 'unknown'}`);
        break;
      }
    }
  }
});

// Also scan for icon color in existing PageHeader pages
console.log('\n\n=== PageHeader pages with colored icons ===');
allPages.forEach(fp => {
  const content = fs.readFileSync(fp, 'utf8');
  const rel = path.relative(pagesDir, fp);
  if (!content.includes('<PageHeader')) return;
  
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('icon={')) {
      // Check next few lines for color
      const block = lines.slice(i, Math.min(i + 3, lines.length)).join('\n');
      if (block.includes('color')) {
        console.log(`${rel}:${i+1}: ${lines[i].trim()}`);
      }
    }
  }
});
