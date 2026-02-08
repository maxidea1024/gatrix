const fs = require('fs');
const path = require('path');

// Files to fix and their replacements
const fixes = [
  // Remove unused imports and variables
  {
    pattern: /const { t } = useTranslations\(\);/g,
    replacement: '// const { t } = useTranslations();',
  },
  {
    pattern: /const { t, ([^}]+) } = useTranslations\(\);/g,
    replacement: '// const { t, $1 } = useTranslations();',
  },
  {
    pattern: /import { useTranslations } from '@\/contexts\/I18nContext';/g,
    replacement: "// import { useTranslations } from '@/contexts/I18nContext';",
  },
  // Fix user property names
  {
    pattern: /user\.avatarUrl/g,
    replacement: 'user.avatar_url',
  },
  {
    pattern: /user\.emailVerified/g,
    replacement: 'user.email_verified',
  },
  {
    pattern: /user\.lastLoginAt/g,
    replacement: 'user.last_login_at',
  },
  {
    pattern: /user\.createdAt/g,
    replacement: 'user.created_at',
  },
  // Fix unused variables
  {
    pattern: /const { ([^,]+), toggleTheme, isDark } = useTheme\(\);/g,
    replacement: 'const { $1 } = useTheme();',
  },
  {
    pattern: /Tooltip,\s*$/gm,
    replacement: '// Tooltip,',
  },
  {
    pattern: /Divider,\s*$/gm,
    replacement: '// Divider,',
  },
];

function fixFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    fixes.forEach((fix) => {
      const newContent = content.replace(fix.pattern, fix.replacement);
      if (newContent !== content) {
        content = newContent;
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error fixing ${filePath}:`, error.message);
  }
}

function findTsxFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);

    items.forEach((item) => {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        traverse(fullPath);
      } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
        files.push(fullPath);
      }
    });
  }

  traverse(dir);
  return files;
}

// Fix all TypeScript files in src directory
const srcDir = path.join(__dirname, 'src');
const files = findTsxFiles(srcDir);

console.log(`Found ${files.length} TypeScript files to check...`);

files.forEach(fixFile);

console.log('Done fixing TypeScript errors!');
