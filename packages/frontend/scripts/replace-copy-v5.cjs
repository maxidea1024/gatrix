/**
 * v5: More precise Tooltip+IconButton+CopyIcon pattern replacer
 * 
 * Finds blocks like:
 *   <Tooltip title={...}>
 *     <IconButton ... onClick={() => copyToClipboardWithNotification/handleCopy(EXPR, ...)}>
 *       <CopyIcon ... />
 *     </IconButton>
 *   </Tooltip>
 * 
 * And replaces with: <CopyButton text={EXPR} size={13} />
 * 
 * Also handles blocks without Tooltip wrapper.
 * 
 * Does NOT touch MenuItem patterns.
 */
const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..', 'src');
const skipFiles = new Set([
  'CopyButton.tsx',
  'SequenceEditor.tsx',
  'FrameEditor.tsx',
  'EnvironmentCopyDialog.tsx',
  'RichTextEditor.tsx', // clipboard is used for editor operations
]);

function findTsxFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...findTsxFiles(full));
    else if (entry.name.endsWith('.tsx')) results.push(full);
  }
  return results;
}

function processFile(filePath) {
  const basename = path.basename(filePath);
  if (skipFiles.has(basename)) return { skipped: true, reason: 'excluded' };

  const content = fs.readFileSync(filePath, 'utf8');
  
  // Must have CopyIcon or ContentCopyIcon usage in JSX
  if (!content.includes('<CopyIcon') && !content.includes('<ContentCopyIcon')) {
    return { skipped: true, reason: 'no copy icon' };
  }

  const lines = content.split('\n');
  const newLines = [];
  let replacements = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Pattern: <Tooltip title=...> ... <IconButton ... onClick={...copy...}> ... <CopyIcon/ContentCopyIcon .../> ... </IconButton> ... </Tooltip>
    if (trimmed.startsWith('<Tooltip') && !trimmed.includes('<CopyButton')) {
      const result = tryMatchCopyBlock(lines, i);
      if (result) {
        const indent = line.match(/^(\s*)/)[1];
        newLines.push(indent + result.replacement);
        replacements++;
        i = result.endLine + 1;
        continue;
      }
    }
    
    // Pattern: <IconButton ... onClick={...copy...}> ... <CopyIcon/> ... </IconButton> (no Tooltip wrapper)
    if (trimmed.startsWith('<IconButton') && !trimmed.includes('<CopyButton')) {
      // Check previous line is NOT <Tooltip
      const prevTrimmed = i > 0 ? lines[i-1].trim() : '';
      if (!prevTrimmed.startsWith('<Tooltip')) {
        const result = tryMatchCopyBlock(lines, i, true);
        if (result) {
          const indent = line.match(/^(\s*)/)[1];
          newLines.push(indent + result.replacement);
          replacements++;
          i = result.endLine + 1;
          continue;
        }
      }
    }

    newLines.push(line);
    i++;
  }

  if (replacements === 0) return { skipped: true, reason: 'no pattern match' };

  let newContent = newLines.join('\n');

  // Add CopyButton import if not present
  if (!newContent.includes("CopyButton") || !newContent.match(/import.*CopyButton.*from/)) {
    if (!newContent.includes("from '@/components/common/CopyButton'") &&
        !newContent.includes("from '../../components/common/CopyButton'") &&
        !newContent.includes("from '../common/CopyButton'")) {
      const importLines = newContent.split('\n');
      let lastImportIdx = -1;
      for (let j = 0; j < importLines.length; j++) {
        if (importLines[j].match(/^import\s/) || importLines[j].match(/^\s*\}\s*from\s/)) {
          lastImportIdx = j;
        }
      }
      if (lastImportIdx >= 0) {
        importLines.splice(lastImportIdx + 1, 0, "import { CopyButton } from '@/components/common/CopyButton';");
        newContent = importLines.join('\n');
      }
    }
  }

  fs.writeFileSync(filePath, newContent, 'utf8');
  return { replacements };
}

function tryMatchCopyBlock(lines, startIdx, isIconButtonStart = false) {
  const blockLines = [];
  const endTag = isIconButtonStart ? '</IconButton>' : '</Tooltip>';
  const maxLines = 50;
  let endIdx = startIdx;
  let foundCopyIcon = false;
  let foundCopyCall = false;
  let inMenuItem = false;

  // Check if we're inside a MenuItem context (previous lines)
  for (let k = Math.max(0, startIdx - 5); k < startIdx; k++) {
    const prevLine = lines[k].trim();
    if (prevLine.includes('<MenuItem') || prevLine.includes('<ListItemIcon')) {
      inMenuItem = true;
      break;
    }
    // Check if previous context closed
    if (prevLine.includes('</MenuItem>')) inMenuItem = false;
  }
  if (inMenuItem) return null;

  for (let j = startIdx; j < Math.min(lines.length, startIdx + maxLines); j++) {
    const line = lines[j];
    blockLines.push(line);

    if (line.includes('ContentCopyIcon') || line.includes('CopyIcon')) {
      // Make sure it's in JSX usage, not import
      if (line.trim().startsWith('<') || line.trim().startsWith('{')) {
        foundCopyIcon = true;
      }
    }
    if (line.includes('copyToClipboardWithNotification') || 
        line.includes('handleCopy(') || 
        line.includes('handleCopyText(') ||
        line.includes('navigator.clipboard')) {
      foundCopyCall = true;
    }

    if (line.trim().includes(endTag)) {
      endIdx = j;
      break;
    }
    if (j === startIdx + maxLines - 1) return null;
  }

  if (!foundCopyIcon) return null;
  if (!foundCopyCall) return null;

  const blockText = blockLines.join('\n');

  // Extract the text being copied
  let copyText = null;

  // Pattern: copyToClipboardWithNotification(\n  EXPR, \n  () =>...)
  const directMatch = blockText.match(/copyToClipboardWithNotification\(\s*\n?\s*([\s\S]*?)(?:,\s*\n\s*\(\)\s*=>)/);
  if (directMatch) {
    copyText = directMatch[1].trim();
  }

  // Pattern: handleCopy(EXPR)
  if (!copyText) {
    const handleMatch = blockText.match(/(?:handleCopy|handleCopyText|handleCopyDetails)\(\s*([\s\S]*?)\s*\)/);
    if (handleMatch) {
      copyText = handleMatch[1].trim();
      // Clean up trailing commas
      copyText = copyText.replace(/,\s*$/, '').trim();
      // If it's a multi-arg handleCopy, take only first arg
      if (copyText.includes(',')) {
        // Simple split on first top-level comma (handle nested parens)
        let depth = 0;
        let firstComma = -1;
        for (let c = 0; c < copyText.length; c++) {
          if (copyText[c] === '(' || copyText[c] === '{' || copyText[c] === '[') depth++;
          else if (copyText[c] === ')' || copyText[c] === '}' || copyText[c] === ']') depth--;
          else if (copyText[c] === ',' && depth === 0) {
            firstComma = c;
            break;
          }
        }
        if (firstComma > 0) {
          copyText = copyText.substring(0, firstComma).trim();
        }
      }
    }
  }

  if (!copyText) return null;

  // Clean up
  copyText = copyText.replace(/;\s*$/, '').trim();

  return {
    replacement: `<CopyButton text={${copyText}} size={13} />`,
    endLine: endIdx,
  };
}

// Main
const allFiles = findTsxFiles(srcDir);
let totalModified = 0;
let totalReplacements = 0;

for (const f of allFiles) {
  const result = processFile(f);
  const rel = path.relative(srcDir, f).replace(/\\/g, '/');
  if (!result.skipped) {
    console.log(`DONE: ${rel} (${result.replacements} replacements)`);
    totalModified++;
    totalReplacements += result.replacements;
  }
}

console.log(`\n=== Summary ===`);
console.log(`Files modified: ${totalModified}`);
console.log(`Total replacements: ${totalReplacements}`);
