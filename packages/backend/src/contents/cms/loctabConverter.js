#!/usr/bin/env node

/**
 * Localization Table Converter
 * 
 * Converts loctab-source CSV file to loctab JSON format for admin tool usage.
 * 
 * Usage:
 *   node loctabConverter.js
 *   node loctabConverter.js <input-file> <output-file>
 * 
 * Default:
 *   Input: loctab-source
 *   Output: loctab
 */

const fs = require('fs');
const path = require('path');

/**
 * Parse CSV line handling quoted fields properly
 * @param {string} line - CSV line to parse
 * @returns {string[]} - Array of field values
 */
function parseCSVLine(line) {
  const fields = [];
  let currentField = '';
  let insideQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        // Escaped quote ("") -> single quote
        currentField += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      // Field separator (outside quotes)
      fields.push(currentField);
      currentField = '';
    } else {
      currentField += char;
    }
  }
  
  // Add last field
  fields.push(currentField);
  
  return fields;
}

/**
 * Convert loctab-source CSV to loctab JSON
 * @param {string} inputPath - Path to loctab-source file
 * @param {string} outputPath - Path to output loctab file
 */
function convertLoctab(inputPath, outputPath) {
  console.log('Converting localization table...');
  console.log(`Input: ${inputPath}`);
  console.log(`Output: ${outputPath}\n`);
  
  // Read input file
  if (!fs.existsSync(inputPath)) {
    console.error(`❌ Error: Input file not found: ${inputPath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(inputPath, 'utf8');
  const lines = content.split('\n');
  
  if (lines.length < 2) {
    console.error('❌ Error: Input file must have at least 2 lines (header + data)');
    process.exit(1);
  }
  
  // Parse header (first line) - just for validation
  const header = parseCSVLine(lines[0]);
  console.log(`Header: ${header.join(', ')}`);
  console.log(`Total lines: ${lines.length.toLocaleString()}\n`);
  
  // Build localization object (only Chinese translation needed)
  const loctab = {};

  // Track keys in lowercase to detect case-insensitive duplicates
  const keyLowerCaseMap = new Map();

  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let duplicateCount = 0;
  let caseInsensitiveDuplicateCount = 0;

  // Process data lines (skip first line which is header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) {
      skippedCount++;
      continue;
    }

    try {
      const fields = parseCSVLine(line);

      // Validate field count
      if (fields.length < 4) {
        console.warn(`⚠️  Line ${i + 1}: Not enough fields (${fields.length}), skipping`);
        skippedCount++;
        continue;
      }

      // Extract fields
      // Field 0: msgctxt (not used)
      // Field 1: msgid (key) - Korean text
      // Field 2: msgid_plural (not used)
      // Field 3: msgstr[zh-CN] - Chinese translation
      // Field 4: references (not used)

      const key = fields[1].trim();
      const chinese = fields[3].trim();

      // Skip if key is empty
      if (!key) {
        skippedCount++;
        continue;
      }

      // Check for exact duplicate keys
      if (loctab.hasOwnProperty(key)) {
        // Duplicate key found - skip it
        duplicateCount++;
        skippedCount++;
        continue;
      }

      // Check for case-insensitive duplicate keys
      const keyLower = key.toLowerCase();
      if (keyLowerCaseMap.has(keyLower)) {
        // Case-insensitive duplicate found - skip it
        caseInsensitiveDuplicateCount++;
        skippedCount++;
        continue;
      }

      // Set Chinese translation (fallback to key if empty)
      loctab[key] = chinese || key;
      keyLowerCaseMap.set(keyLower, key);

      processedCount++;

      // Progress indicator (every 10000 lines)
      if (processedCount % 10000 === 0) {
        console.log(`Processed ${processedCount.toLocaleString()} entries...`);
      }

    } catch (error) {
      console.error(`❌ Error parsing line ${i + 1}: ${error.message}`);
      errorCount++;
    }
  }
  
  console.log('\n📊 Processing Summary:');
  console.log(`  ✅ Processed: ${processedCount.toLocaleString()} entries`);
  console.log(`  ⏭️  Skipped: ${skippedCount.toLocaleString()} lines`);
  console.log(`  🔁 Exact duplicates: ${duplicateCount.toLocaleString()} keys`);
  console.log(`  🔤 Case-insensitive duplicates: ${caseInsensitiveDuplicateCount.toLocaleString()} keys`);
  console.log(`  ❌ Errors: ${errorCount.toLocaleString()} lines`);
  
  // Save output file
  console.log(`\n💾 Saving to ${outputPath}...`);
  
  const outputJson = JSON.stringify(loctab, null, 2);
  fs.writeFileSync(outputPath, outputJson, 'utf8');
  
  const stats = fs.statSync(outputPath);
  const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
  
  console.log(`✅ Saved successfully! (${fileSizeMB} MB)`);
  console.log(`\n📦 Output structure:`);
  console.log(`  - Total entries: ${Object.keys(loctab).length.toLocaleString()}`);

  // Show sample entries
  console.log(`\n🔍 Sample entries (Korean → Chinese):`);
  const sampleKeys = Object.keys(loctab).slice(0, 5);
  sampleKeys.forEach(key => {
    console.log(`  "${key}" → "${loctab[key]}"`);
  });
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);
  
  // Default paths
  const defaultInputPath = path.join(__dirname, 'loctab-source');
  const defaultOutputPath = path.join(__dirname, 'loctab');
  
  // Get input/output paths from arguments or use defaults
  const inputPath = args[0] ? path.resolve(args[0]) : defaultInputPath;
  const outputPath = args[1] ? path.resolve(args[1]) : defaultOutputPath;
  
  try {
    convertLoctab(inputPath, outputPath);
    console.log('\n✅ Conversion completed successfully!');
  } catch (error) {
    console.error(`\n❌ Conversion failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

// Export for use as module
module.exports = {
  convertLoctab,
  parseCSVLine
};

