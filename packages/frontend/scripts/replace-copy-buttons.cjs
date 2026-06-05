/**
 * Comprehensive script to replace ALL CopyIcon/ContentCopyIcon clipboard patterns with CopyButton.
 * 
 * Patterns handled:
 * 1. <Tooltip ...><IconButton ...onClick={...copy/handleCopy(EXPR)...}>< CopyIcon .../></IconButton></Tooltip>
 * 2. <IconButton ...onClick={...copy/handleCopy(EXPR)...}>< CopyIcon .../></IconButton> (no Tooltip wrapper)
 * 
 * NOT touched:
 * - CopyButton.tsx itself
 * - MenuItem/ListItemIcon (menu icons)
 * - Button startIcon (labeled buttons)
 * - SequenceEditor/FrameEditor (frame copy, not clipboard)
 * - EnvironmentCopyDialog (env copy)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = path.resolve(__dirname, '..', 'src');

// Find ALL files containing CopyIcon or ContentCopyIcon
const grepOutput = execSync(
  `npx -y ripgrep -l "<ContentCopyIcon|<CopyIcon" "${srcDir}" --glob "*.tsx"`,
  { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
).trim();

const allFiles = grepOutput.split('\n').filter(f => f.trim());

// Files to skip
const skipFiles = [
  'CopyButton.tsx',
  'SequenceEditor.tsx',
  'FrameEditor.tsx',
  'EnvironmentCopyDialog.tsx',
];

let totalFiles = 0;
let totalReplacements = 0;

for (const filePath of allFiles) {
  const basename = path.basename(filePath);
  if (skipFiles.includes(basename)) {
    console.log(`SKIP (excluded): ${basename}`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  let replacements = 0;

  // ------- Pattern 1: Tooltip > IconButton > CopyIcon (multiline) -------
  // Very permissive regex to handle various whitespace/formatting
  const p1 = /<Tooltip\s+title=\{[^}]*\}\s*(?:arrow)?\s*>\s*\n?\s*<IconButton\s*\n?\s*(?:size="small"\s*)?\n?\s*onClick=\{(?:\(\)\s*=>|)\s*(?:handleCopy\w*|copyToClipboard\w*|handleCopyText|handleCopyDetails)\s*\(([^)]*)\)\s*(?:;\s*)?\}\s*\n?\s*(?:sx=\{\{[^}]*\}\}\s*)?\n?\s*>\s*\n?\s*<(?:ContentCopyIcon|CopyIcon)\s*\n?\s*(?:sx=\{\{[^}]*\}\}\s*)?\/>\s*\n?\s*<\/IconButton>\s*\n?\s*<\/Tooltip>/gm;

  content = content.replace(p1, (match, expr) => {
    replacements++;
    return `<CopyButton text={${expr.trim()}} size={13} />`;
  });

  // ------- Pattern 2: IconButton > CopyIcon (no Tooltip, multiline) -------
  const p2 = /<IconButton\s*\n?\s*(?:size="small"\s*)?\n?\s*onClick=\{(?:\(\)\s*=>|)\s*(?:handleCopy\w*|copyToClipboard\w*|handleCopyText|handleCopyDetails)\s*\(([^)]*)\)\s*(?:;\s*)?\}\s*\n?\s*(?:sx=\{\{[^}]*\}\}\s*)?\n?\s*>\s*\n?\s*<(?:ContentCopyIcon|CopyIcon)\s*\n?\s*(?:sx=\{\{[^}]*\}\}\s*)?\/>\s*\n?\s*<\/IconButton>/gm;

  content = content.replace(p2, (match, expr) => {
    // Skip if this is inside a ListItemIcon (menu item icon)
    const idx = content.indexOf(match);
    const before = content.substring(Math.max(0, idx - 100), idx);
    if (before.includes('<ListItemIcon>')) {
      return match; // Don't replace menu icons
    }
    replacements++;
    return `<CopyButton text={${expr.trim()}} size={13} />`;
  });

  // ------- Pattern 3: Tooltip+IconButton with inline copyToClipboardWithNotification -------
  const p3 = /<Tooltip\s+title=\{[^}]*\}\s*(?:arrow)?\s*>\s*\n?\s*<IconButton\s*\n?\s*(?:size="small"\s*)?\n?\s*onClick=\{(?:\(\)\s*=>\s*\{?\s*\n?\s*)?copyToClipboardWithNotification\s*\(\s*\n?\s*([^,]+),[\s\S]*?\)\s*;?\s*\}?\s*\}\s*\n?\s*(?:sx=\{\{[^}]*\}\}\s*)?\n?\s*>\s*\n?\s*<(?:ContentCopyIcon|CopyIcon)\s*\n?\s*(?:sx=\{\{[^}]*\}\}\s*)?\/>\s*\n?\s*<\/IconButton>\s*\n?\s*<\/Tooltip>/gm;

  content = content.replace(p3, (match, expr) => {
    replacements++;
    return `<CopyButton text={${expr.trim()}} size={13} />`;
  });

  // ------- Pattern 4: IconButton with inline copyToClipboardWithNotification (no Tooltip) -------
  const p4 = /<IconButton\s*\n?\s*(?:size="small"\s*)?\n?\s*onClick=\{(?:\(\)\s*=>\s*\{?\s*\n?\s*)?copyToClipboardWithNotification\s*\(\s*\n?\s*([^,]+),[\s\S]*?\)\s*;?\s*\}?\s*\}\s*\n?\s*(?:sx=\{\{[^}]*\}\}\s*)?\n?\s*>\s*\n?\s*<(?:ContentCopyIcon|CopyIcon)\s*\n?\s*(?:sx=\{\{[^}]*\}\}\s*)?\/>\s*\n?\s*<\/IconButton>/gm;

  content = content.replace(p4, (match, expr) => {
    const idx = content.indexOf(match);
    const before = content.substring(Math.max(0, idx - 100), idx);
    if (before.includes('<ListItemIcon>')) return match;
    replacements++;
    return `<CopyButton text={${expr.trim()}} size={13} />`;
  });

  // If we made replacements, ensure CopyButton import exists
  if (replacements > 0 && !content.includes("from '@/components/common/CopyButton'") && !content.includes("from '../../components/common/CopyButton'")) {
    // Determine the right import path
    const relPath = path.relative(srcDir, filePath);
    let importPath = '@/components/common/CopyButton';
    
    // Add import after the last existing import
    const lastImportIdx = content.lastIndexOf('\nimport ');
    if (lastImportIdx !== -1) {
      const endOfLine = content.indexOf('\n', lastImportIdx + 1);
      // Find the end of this import statement (might be multi-line)
      let searchIdx = endOfLine;
      while (searchIdx < content.length) {
        const nextLine = content.indexOf('\n', searchIdx + 1);
        const lineContent = content.substring(searchIdx, nextLine === -1 ? content.length : nextLine);
        if (lineContent.includes("from '") || lineContent.includes('from "') || lineContent.includes("} from")) {
          searchIdx = nextLine === -1 ? content.length : nextLine;
        } else {
          break;
        }
      }
      content = content.substring(0, searchIdx) + 
        `\nimport { CopyButton } from '${importPath}';` + 
        content.substring(searchIdx);
    }
  }

  // Clean up: remove CopyIcon/ContentCopyIcon import if no longer used
  if (replacements > 0) {
    // Check if CopyIcon/ContentCopyIcon is still used somewhere
    const stillUsedCopy = content.includes('<ContentCopyIcon') || content.includes('<CopyIcon');
    if (!stillUsedCopy) {
      // Remove the import line
      content = content.replace(/,?\s*ContentCopy\s+as\s+ContentCopyIcon\s*,?/g, (match) => {
        // If it's between two items, remove carefully
        if (match.startsWith(',') && match.endsWith(',')) return ',';
        return '';
      });
      content = content.replace(/,?\s*ContentCopy\s+as\s+CopyIcon\s*,?/g, (match) => {
        if (match.startsWith(',') && match.endsWith(',')) return ',';
        return '';
      });
    }

    // Remove copyToClipboardWithNotification import if no longer used
    if (!content.includes('copyToClipboardWithNotification(')) {
      content = content.replace(/import\s*\{\s*copyToClipboardWithNotification\s*\}\s*from\s*['"][^'"]+['"];\s*\n/g, '');
    }

    // Remove handleCopy function if no longer called
    const handleCopyFuncs = ['handleCopy', 'handleCopyKeyName', 'handleCopyCode', 'handleCopyName', 'handleCopyText'];
    for (const funcName of handleCopyFuncs) {
      // Check if function is still called
      const callPattern = new RegExp(`${funcName}\\s*\\(`, 'g');
      const defPattern = new RegExp(`const ${funcName}\\s*=`, 'g');
      
      const calls = content.match(callPattern) || [];
      const defs = content.match(defPattern) || [];
      
      // If the function is defined but never called (except in its own definition)
      if (defs.length > 0 && calls.length <= defs.length) {
        // Remove the function definition (simple single-line or multi-line)
        const removePattern = new RegExp(
          `\\s*\\/\\/[^\\n]*\\n\\s*const ${funcName}[\\s\\S]*?\\};\\s*\\n`,
          'g'
        );
        content = content.replace(removePattern, '\n');
      }
    }
  }

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    const relPath = path.relative(srcDir, filePath).replace(/\\/g, '/');
    console.log(`DONE: ${relPath} (${replacements} replacements)`);
    totalFiles++;
    totalReplacements += replacements;
  } else {
    const relPath = path.relative(srcDir, filePath).replace(/\\/g, '/');
    console.log(`SKIP: ${relPath} (pattern not matched)`);
  }
}

console.log(`\n=== Summary ===`);
console.log(`Files modified: ${totalFiles}`);
console.log(`Total replacements: ${totalReplacements}`);
