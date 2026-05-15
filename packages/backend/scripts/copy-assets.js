/**
 * Copy non-TypeScript assets from src/ to dist/
 * This ensures template files (.hbs), and other static assets
 * are available at runtime after TypeScript compilation.
 */
const fs = require('fs');
const path = require('path');

const ASSET_DIRS = [
  { src: 'src/templates', dest: 'dist/templates' },
];

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`[copy-assets] Source not found, skipping: ${src}`);
    return 0;
  }

  fs.mkdirSync(dest, { recursive: true });
  let count = 0;

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      count += copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      count++;
    }
  }
  return count;
}

let totalCopied = 0;
for (const { src, dest } of ASSET_DIRS) {
  const copied = copyDirRecursive(src, dest);
  console.log(`[copy-assets] ${src} -> ${dest} (${copied} files)`);
  totalCopied += copied;
}

console.log(`[copy-assets] Done. Total files copied: ${totalCopied}`);
