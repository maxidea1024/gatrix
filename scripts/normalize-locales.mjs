#!/usr/bin/env node
/*
  Normalize locale JSON files by:
  - Folding root-level admin sub-sections (users, gameWorlds, messageTemplates, scheduler, whitelist) into admin.{...}
  - Deep-merging objects to preserve keys (prefer existing admin values on conflict)
  - Fixing common typos (admin.gameWordls -> admin.gameWorlds)
  - Removing folded root-level duplicates
  - Rewriting files with stable formatting (2 spaces)
  
  Usage: node scripts/normalize-locales.mjs
*/

import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const files = [
  'packages/frontend/src/locales/en.json',
  'packages/frontend/src/locales/ko.json',
  'packages/frontend/src/locales/zh.json',
];

const ADMIN_SECTIONS = ['users', 'gameWorlds', 'messageTemplates', 'scheduler', 'whitelist'];

function isPlainObject(v) {
  return Object.prototype.toString.call(v) === '[object Object]';
}

function deepMerge(target, source) {
  if (!isPlainObject(target) || !isPlainObject(source)) return source;
  const out = { ...target };
  for (const [k, v] of Object.entries(source)) {
    if (k in out) {
      if (isPlainObject(out[k]) && isPlainObject(v)) {
        out[k] = deepMerge(out[k], v);
      } else {
        // Prefer existing admin value if present; otherwise take source
        // If target value is undefined/null/empty string, use source
        const tv = out[k];
        if (tv === undefined || tv === null || (typeof tv === 'string' && tv.trim() === '')) {
          out[k] = v;
        }
        // else keep target
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

function backupFile(absPath) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = absPath + `.backup-${ts}`;
  fs.copyFileSync(absPath, backupPath);
  return backupPath;
}

function normalizeFile(relPath) {
  const absPath = path.resolve(repoRoot, relPath);
  const raw = fs.readFileSync(absPath, 'utf8');
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    console.error(`✖ Failed to parse JSON: ${relPath}`);
    throw e;
  }

  // Ensure admin exists
  json.admin = json.admin && isPlainObject(json.admin) ? json.admin : {};

  // Fix typo: admin.gameWordls -> admin.gameWorlds
  if (json.admin.gameWordls && isPlainObject(json.admin.gameWordls)) {
    json.admin.gameWorlds = deepMerge(json.admin.gameWorlds || {}, json.admin.gameWordls);
    delete json.admin.gameWordls;
  }
  if (json.gameWordls && isPlainObject(json.gameWordls)) {
    json.admin.gameWorlds = deepMerge(json.admin.gameWorlds || {}, json.gameWordls);
    delete json.gameWordls;
  }

  // Fold root-level sections into admin
  const moved = [];
  for (const key of ADMIN_SECTIONS) {
    if (key in json && isPlainObject(json[key])) {
      const fromRoot = json[key];
      const intoAdmin = json.admin[key] || {};
      json.admin[key] = deepMerge(intoAdmin, fromRoot);
      delete json[key];
      moved.push(key);
    }
  }

  // Serialize with stable 2-space indentation
  const formatted = JSON.stringify(json, null, 2) + '\n';

  // Only write if changed
  if (formatted !== raw) {
    const backup = backupFile(absPath);
    fs.writeFileSync(absPath, formatted, 'utf8');
    console.log(`✔ Normalized ${relPath} (backup: ${path.relative(repoRoot, backup)})`);
    if (moved.length) {
      console.log(`  - Moved root sections into admin: ${moved.join(', ')}`);
    }
  } else {
    console.log(`• No changes for ${relPath}`);
  }
}

function main() {
  for (const f of files) {
    try {
      normalizeFile(f);
    } catch (e) {
      console.error(`Normalization failed for ${f}:`, e.message);
      process.exitCode = 1;
    }
  }
}

main();

