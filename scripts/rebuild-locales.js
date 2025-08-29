#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { extractUsedKeys } = require('./check-translations');

const LOCALES_DIR = 'packages/frontend/src/locales';
const LANGS = ['en', 'ko', 'zh'];

function readJsonSafe(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}
function get(obj, dot) {
  return dot.split('.').reduce((o, k) => (o && typeof o === 'object') ? o[k] : undefined, obj);
}
function set(obj, dot, val) {
  const parts = dot.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = val;
}

function main() {
  const used = extractUsedKeys().filter(k => /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/.test(k));
  if (!used.length) {
    console.error('No used keys found.');
    process.exit(1);
  }

  // backup originals once
  for (const lang of LANGS) {
    const fp = path.join(LOCALES_DIR, `${lang}.json`);
    if (fs.existsSync(fp)) {
      const bak = fp + '.bak.rebuild';
      if (!fs.existsSync(bak)) fs.copyFileSync(fp, bak);
    }
  }

  // build new files
  for (const lang of LANGS) {
    const fp = path.join(LOCALES_DIR, `${lang}.json`);
    const oldObj = readJsonSafe(fp) || {};
    const out = {};

    for (const key of used) {
      const existing = get(oldObj, key);
      const fallback = key.split('.').slice(-1)[0].replace(/_/g, ' ');
      set(out, key, existing ?? fallback);
    }

    fs.writeFileSync(fp, JSON.stringify(out, null, 2) + '\n');
    console.log(`Wrote ${lang}.json with ${used.length} keys.`);
  }
}

if (require.main === module) main();

