/**
 * v4: Line-by-line state machine to replace copy button patterns.
 * 
 * Strategy: Find blocks that start with <Tooltip ...> or <IconButton ...>
 * containing copyToClipboardWithNotification or handleCopy, and ending with
 * </Tooltip> or </IconButton>, then replace with <CopyButton text={...} size={13} />
 */
const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..', 'src');
const skipFiles = new Set([
  'CopyButton.tsx',
  'SequenceEditor.tsx', 
  'FrameEditor.tsx',
  'EnvironmentCopyDialog.tsx',
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
  if (!content.includes('copyToClipboardWithNotification')) {
    return { skipped: true, reason: 'no clipboard usage' };
  }

  const lines = content.split('\n');
  const newLines = [];
  let replacements = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Pattern 1: Detect <Tooltip title={...}> followed by <IconButton ... onClick={...copy...}>...<CopyIcon/>...</IconButton></Tooltip>
    // Pattern 2: Detect <IconButton ... onClick={...copy...}>...<CopyIcon/>...</IconButton>
    
    // Check if this line starts a Tooltip+IconButton copy block
    if (trimmed.startsWith('<Tooltip') && trimmed.includes('title=')) {
      // Look ahead to see if this is a copy button pattern
      const blockResult = tryExtractCopyBlock(lines, i, 'tooltip');
      if (blockResult) {
        const indent = line.match(/^(\s*)/)[1];
        newLines.push(indent + blockResult.replacement);
        replacements++;
        i = blockResult.endLine + 1;
        continue;
      }
    }

    // Check for standalone IconButton with copy
    if (trimmed.startsWith('<IconButton') && !trimmed.includes('<CopyButton')) {
      const blockResult = tryExtractCopyBlock(lines, i, 'iconbutton');
      if (blockResult) {
        const indent = line.match(/^(\s*)/)[1];
        newLines.push(indent + blockResult.replacement);
        replacements++;
        i = blockResult.endLine + 1;
        continue;
      }
    }

    newLines.push(line);
    i++;
  }

  if (replacements === 0) return { skipped: true, reason: 'no pattern match' };

  let newContent = newLines.join('\n');

  // Add CopyButton import if not present
  if (!newContent.includes("from '@/components/common/CopyButton'") &&
      !newContent.includes("from '../../components/common/CopyButton'") &&
      !newContent.includes("from '../common/CopyButton'")) {
    // Find last import line
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

  // Remove handleCopy helper functions that are now unused
  newContent = removeUnusedHandleCopy(newContent);

  // Clean up unused imports if copyToClipboardWithNotification is no longer used
  if (!newContent.includes('copyToClipboardWithNotification(')) {
    newContent = newContent.replace(/import\s*\{\s*copyToClipboardWithNotification\s*\}\s*from\s*['"][^'"]+['"];\s*\n?/g, '');
  }

  // Clean up ContentCopyIcon/CopyIcon imports if no longer used in JSX
  if (!newContent.includes('<ContentCopyIcon') && !newContent.includes('<CopyIcon')) {
    // Remove from multi-import lines
    newContent = newContent.replace(/,?\s*ContentCopy\s+as\s+ContentCopyIcon\s*,?/g, (m) => {
      if (m.startsWith(',') && m.endsWith(',')) return ',';
      return '';
    });
    // Don't remove CopyIcon if it's used in MenuItem context
    const copyIconInMenu = newContent.includes('<CopyIcon');
    if (!copyIconInMenu) {
      newContent = newContent.replace(/,?\s*ContentCopy\s+as\s+CopyIcon\s*,?/g, (m) => {
        if (m.startsWith(',') && m.endsWith(',')) return ',';
        return '';
      });
    }
  }

  fs.writeFileSync(filePath, newContent, 'utf8');
  return { replacements };
}

function tryExtractCopyBlock(lines, startIdx, mode) {
  // Collect the block of lines
  const blockLines = [];
  let depth = 0;
  let endIdx = startIdx;
  let foundCopy = false;
  let foundCopyIcon = false;
  let copyText = null;

  // Determine end tag
  const endTag = mode === 'tooltip' ? '</Tooltip>' : '</IconButton>';
  const maxLines = 40; // Safety limit

  for (let i = startIdx; i < Math.min(lines.length, startIdx + maxLines); i++) {
    const line = lines[i];
    blockLines.push(line);

    // Check for copy-related content
    if (line.includes('copyToClipboardWithNotification(') || line.includes('handleCopy(') || line.includes('handleCopyText(') || line.includes('handleCopyDetails(')) {
      foundCopy = true;
    }
    if (line.includes('ContentCopyIcon') || (line.includes('CopyIcon') && !line.includes('CopyButton'))) {
      foundCopyIcon = true;
    }

    if (line.trim().includes(endTag) || line.trim() === endTag) {
      endIdx = i;
      break;
    }
    if (i === startIdx + maxLines - 1) {
      return null; // Too long, abort
    }
  }

  if (!foundCopy || !foundCopyIcon) return null;

  // Check context: skip if inside MenuItem/ListItemIcon
  const prevLines = lines.slice(Math.max(0, startIdx - 3), startIdx).join('\n');
  if (prevLines.includes('<ListItemIcon') || prevLines.includes('<MenuItem')) return null;

  // Extract the text being copied
  const blockText = blockLines.join('\n');
  
  // Try to find copyToClipboardWithNotification(EXPR, ...)
  let match = blockText.match(/copyToClipboardWithNotification\(\s*\n?\s*((?:[^,\n]|\n\s*(?=[^()]*\)))+)/s);
  if (match) {
    copyText = match[1].trim();
  }

  // Try handleCopy(EXPR) or handleCopyText(EXPR)
  if (!copyText) {
    match = blockText.match(/(?:handleCopy|handleCopyText|handleCopyDetails)\(\s*([\s\S]*?)\s*\)/);
    if (match) {
      copyText = match[1].trim();
      // Remove trailing comma artifacts
      copyText = copyText.replace(/,\s*$/, '');
    }
  }

  if (!copyText) return null;

  // Clean up: remove String() wrapper if simple
  // Clean up trailing semicolons, extra whitespace
  copyText = copyText.replace(/;\s*$/, '').trim();

  return {
    replacement: `<CopyButton text={${copyText}} size={13} />`,
    endLine: endIdx,
  };
}

function removeUnusedHandleCopy(content) {
  // Remove simple handleCopy functions that wrap copyToClipboardWithNotification
  // Pattern: const handleCopy = (text: string) => { copyToClipboardWithNotification(...) };
  // or: const handleCopy = (text: string, type: string) => { ... };
  const patterns = [
    // Arrow function with body
    /\s*(?:\/\/[^\n]*\n\s*)?const\s+handleCopy\w*\s*=\s*\([^)]*\)\s*(?::\s*\w+)?\s*=>\s*\{[^}]*copyToClipboardWithNotification[^}]*\};\s*\n/g,
    // Regular function 
    /\s*(?:\/\/[^\n]*\n\s*)?(?:const|function)\s+handleCopy\w*\s*(?:=\s*)?\([^)]*\)\s*(?::\s*\w+)?\s*(?:=>)?\s*\{\s*(?:handleActionMenuClose\(\);\s*)?copyToClipboardWithNotification\([^)]*(?:\([^)]*\)[^)]*)*\);\s*\};\s*\n/gs,
  ];

  for (const pattern of patterns) {
    // Check if handleCopy is still used elsewhere
    const fnMatch = content.match(/const\s+(handleCopy\w*)\s*=/);
    if (fnMatch) {
      const fnName = fnMatch[1];
      // Count usages (exclude the definition itself)
      const defRemoved = content.replace(/const\s+handleCopy\w*\s*=.*?};/gs, '');
      const usageCount = (defRemoved.match(new RegExp(fnName + '\\b', 'g')) || []).length;
      if (usageCount === 0) {
        content = content.replace(pattern, '\n');
      }
    }
  }

  return content;
}

// Main
const allFiles = findTsxFiles(srcDir);
let totalModified = 0;
let totalReplacements = 0;

for (const f of allFiles) {
  const result = processFile(f);
  const rel = path.relative(srcDir, f).replace(/\\/g, '/');
  if (result.skipped) {
    // silent
  } else {
    console.log(`DONE: ${rel} (${result.replacements} replacements)`);
    totalModified++;
    totalReplacements += result.replacements;
  }
}

console.log(`\n=== Summary ===`);
console.log(`Files modified: ${totalModified}`);
console.log(`Total replacements: ${totalReplacements}`);
