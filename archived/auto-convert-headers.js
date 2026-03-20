// Auto-convert pages with h4 Typography + Icon headers to PageHeader
// Handles the most common pattern:
//   <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
//     <SomeIcon />
//     {t('some.title')}
//   </Typography>
//   <Typography variant="body2" color="text.secondary">
//     {t('some.subtitle')}
//   </Typography>
//
// Also removes icon color props like color: 'primary.main' from header icons

const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, '..', 'packages', 'frontend', 'src', 'pages');
const skipDirs = ['auth', 'common'];

function findTsxFiles(dir) {
  const results = [];
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fp = path.join(dir, item);
      const stat = fs.statSync(fp);
      if (stat.isDirectory()) results.push(...findTsxFiles(fp));
      else if (item.endsWith('Page.tsx')) results.push(fp);
    }
  } catch(e) {}
  return results;
}

const allPages = findTsxFiles(pagesDir);
let converted = 0;

allPages.forEach(fp => {
  const rel = path.relative(pagesDir, fp);
  if (skipDirs.some(d => rel.startsWith(d + '\\'))) return;
  
  let content = fs.readFileSync(fp, 'utf8');
  if (content.includes('<PageHeader')) return; // already converted
  
  const lines = content.split('\n');
  
  // Find the h4 Typography pattern with Icon
  let headerStart = -1;
  let headerEnd = -1;
  let iconName = '';
  let titleKey = '';
  let subtitleKey = '';
  let hasWrapper = false;
  let wrapperStart = -1;
  let wrapperEnd = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Look for <Typography with variant="h4" that contains an Icon
    if (line.includes('<Typography') && i + 1 < lines.length) {
      const nextFewLines = lines.slice(i, Math.min(i + 15, lines.length)).join('\n');
      
      if (nextFewLines.includes('variant="h4"') && nextFewLines.includes('Icon')) {
        // Found header Typography - extract icon and title
        headerStart = i;
        
        // Look backwards to find if wrapped in a Box
        for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
          const prevLine = lines[j].trim();
          if (prevLine.includes('{/* Header */}')) {
            wrapperStart = Math.min(wrapperStart >= 0 ? wrapperStart : j, j);
            continue;
          }
          if (prevLine.startsWith('<Box') && (prevLine.includes('justifyContent') || prevLine.includes('flex-start') || prevLine.includes("mb:"))) {
            wrapperStart = j;
            hasWrapper = true;
            break;
          }
          if (prevLine === '<Box>') {
            wrapperStart = j;
            hasWrapper = true;
            break;
          }
        }
        
        // Extract icon name
        for (let j = i; j < Math.min(i + 8, lines.length); j++) {
          const iconMatch = lines[j].match(/<(\w+Icon)\s*(?:sx=\{[^}]*\}\s*)?\/>/);
          if (iconMatch) {
            iconName = iconMatch[1];
            break;
          }
        }
        
        // Extract title key
        for (let j = i; j < Math.min(i + 8, lines.length); j++) {
          const titleMatch = lines[j].match(/\{t\(['"]([^'"]+)['"]\)\}/);
          if (titleMatch && !titleKey) {
            titleKey = titleMatch[1];
          }
        }
        
        // Find closing </Typography>
        for (let j = i; j < Math.min(i + 10, lines.length); j++) {
          if (lines[j].includes('</Typography>')) {
            headerEnd = j;
            break;
          }
        }
        
        // Look for subtitle Typography right after
        if (headerEnd >= 0) {
          for (let j = headerEnd + 1; j < Math.min(headerEnd + 5, lines.length); j++) {
            if (lines[j].trim().includes('<Typography') && lines[j + 1]?.trim().includes('variant="body2"')) {
              // Multiline Typography
              for (let k = j; k < Math.min(j + 5, lines.length); k++) {
                const subMatch = lines[k].match(/\{t\(['"]([^'"]+)['"]\)\}/);
                if (subMatch) {
                  subtitleKey = subMatch[1];
                  // Find closing </Typography>
                  for (let l = k; l < Math.min(k + 3, lines.length); l++) {
                    if (lines[l].includes('</Typography>')) {
                      headerEnd = l;
                      break;
                    }
                  }
                  break;
                }
              }
              break;
            }
            if (lines[j].includes('variant="body2"') && lines[j].includes('<Typography')) {
              // Single line or same line
              for (let k = j; k < Math.min(j + 3, lines.length); k++) {
                const subMatch = lines[k].match(/\{t\(['"]([^'"]+)['"]\)\}/);
                if (subMatch) {
                  subtitleKey = subMatch[1];
                  for (let l = k; l < Math.min(k + 3, lines.length); l++) {
                    if (lines[l].includes('</Typography>')) {
                      headerEnd = l;
                      break;
                    }
                  }
                  break;
                }
              }
              break;
            }
          }
        }
        
        break; // Found the header, stop searching
      }
    }
  }
  
  if (headerStart < 0 || !iconName || !titleKey) {
    if (content.includes('variant="h4"')) {
      console.log(`SKIP (complex): ${rel}`);
    }
    return;
  }
  
  // Build PageHeader replacement
  let pageHeaderJsx = '';
  const indent = '      '; // standard indent
  
  if (subtitleKey) {
    pageHeaderJsx = `${indent}<PageHeader\n${indent}  icon={<${iconName} />}\n${indent}  title={t('${titleKey}')}\n${indent}  subtitle={t('${subtitleKey}')}\n${indent}/>`;
  } else {
    pageHeaderJsx = `${indent}<PageHeader\n${indent}  icon={<${iconName} />}\n${indent}  title={t('${titleKey}')}\n${indent}/>`;
  }
  
  // Determine replacement range
  let replaceStart = headerStart;
  let replaceEnd = headerEnd;
  
  if (hasWrapper && wrapperStart >= 0) {
    // Need to also check: is there a closing </Box> after the subtitle?
    // Check for the wrapper Box close
    for (let j = headerEnd + 1; j < Math.min(headerEnd + 5, lines.length); j++) {
      if (lines[j].trim() === '</Box>') {
        replaceEnd = j;
        replaceStart = wrapperStart;
        
        // Also check for another </Box> right after (double wrapper)
        if (j + 1 < lines.length && lines[j + 1].trim() === '</Box>') {
          replaceEnd = j + 1;
        }
        break;
      }
    }
  }
  
  // Also check for {/* Header */} comment before
  if (replaceStart > 0 && lines[replaceStart - 1].trim() === '{/* Header */}') {
    replaceStart--;
  }
  
  // Replace lines
  lines.splice(replaceStart, replaceEnd - replaceStart + 1, pageHeaderJsx);
  content = lines.join('\n');
  
  // Add PageHeader import if needed
  if (!content.includes("import PageHeader from")) {
    const importLines = content.split('\n');
    let lastImportIdx = -1;
    for (let i = 0; i < Math.min(importLines.length, 200); i++) {
      if (importLines[i].startsWith('import ') || importLines[i].startsWith('} from ')) {
        lastImportIdx = i;
      }
    }
    if (lastImportIdx >= 0) {
      importLines.splice(lastImportIdx + 1, 0, "import PageHeader from '@/components/common/PageHeader';");
      content = importLines.join('\n');
    }
  }
  
  fs.writeFileSync(fp, content, 'utf8');
  console.log(`CONVERTED: ${rel} (icon=${iconName}, title=${titleKey}, subtitle=${subtitleKey || 'none'})`);
  converted++;
});

console.log(`\nTotal converted: ${converted}`);
