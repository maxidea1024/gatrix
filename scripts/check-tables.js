#!/usr/bin/env node

/**
 * Script to check if all table names use the correct g_ prefix
 */

const fs = require('fs');
const path = require('path');

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Tables that should have g_ prefix
const expectedTables = [
  'g_users',
  'g_oauth_accounts', 
  'g_audit_logs',
  'g_sessions'
];

// Tables that should NOT be referenced (old names)
const oldTables = [
  'users',
  'oauth_accounts',
  'audit_logs', 
  'sessions'
];

// File extensions to check
const extensions = ['.ts', '.js', '.sql'];

// Directories to check
const checkDirs = [
  'packages/backend/src',
  'packages/frontend/src'
];

function checkFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];
  
  // Check for old table names (without g_ prefix)
  oldTables.forEach(table => {
    // Look for table name in SQL contexts
    const patterns = [
      new RegExp(`FROM\\s+${table}\\b`, 'gi'),
      new RegExp(`JOIN\\s+${table}\\b`, 'gi'),
      new RegExp(`INTO\\s+${table}\\b`, 'gi'),
      new RegExp(`UPDATE\\s+${table}\\b`, 'gi'),
      new RegExp(`TABLE\\s+${table}\\b`, 'gi'),
      new RegExp(`'${table}'`, 'gi'),
      new RegExp(`"${table}"`, 'gi'),
      new RegExp(`\`${table}\``, 'gi')
    ];
    
    patterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const lines = content.substring(0, content.indexOf(match)).split('\n');
          const lineNumber = lines.length;
          issues.push({
            type: 'old_table',
            table,
            match,
            line: lineNumber,
            suggestion: `Should use g_${table} instead of ${table}`
          });
        });
      }
    });
  });
  
  return issues;
}

function checkDirectory(dir) {
  const issues = [];
  
  if (!fs.existsSync(dir)) {
    log('yellow', `Directory ${dir} does not exist, skipping...`);
    return issues;
  }
  
  function walkDir(currentDir) {
    const files = fs.readdirSync(currentDir);
    
    files.forEach(file => {
      const filePath = path.join(currentDir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        // Skip node_modules and other irrelevant directories
        if (!['node_modules', 'dist', 'build', 'coverage', '.git'].includes(file)) {
          walkDir(filePath);
        }
      } else if (stat.isFile()) {
        const ext = path.extname(file);
        if (extensions.includes(ext)) {
          const fileIssues = checkFile(filePath);
          if (fileIssues.length > 0) {
            issues.push({
              file: filePath,
              issues: fileIssues
            });
          }
        }
      }
    });
  }
  
  walkDir(dir);
  return issues;
}

function main() {
  log('blue', '🔍 Checking for table naming issues...\n');
  
  let totalIssues = 0;
  
  checkDirs.forEach(dir => {
    log('blue', `Checking directory: ${dir}`);
    const issues = checkDirectory(dir);
    
    if (issues.length === 0) {
      log('green', `✅ No issues found in ${dir}\n`);
    } else {
      log('red', `❌ Found issues in ${dir}:\n`);
      
      issues.forEach(fileIssue => {
        log('yellow', `  File: ${fileIssue.file}`);
        fileIssue.issues.forEach(issue => {
          log('red', `    Line ${issue.line}: ${issue.match}`);
          log('blue', `    💡 ${issue.suggestion}`);
        });
        console.log();
        totalIssues += fileIssue.issues.length;
      });
    }
  });
  
  console.log('='.repeat(60));
  if (totalIssues === 0) {
    log('green', '🎉 All table names are using the correct g_ prefix!');
  } else {
    log('red', `❌ Found ${totalIssues} table naming issues that need to be fixed.`);
    log('yellow', '\nPlease update the table names to use the g_ prefix:');
    oldTables.forEach(table => {
      log('blue', `  ${table} → g_${table}`);
    });
  }
  
  process.exit(totalIssues > 0 ? 1 : 0);
}

if (require.main === module) {
  main();
}
