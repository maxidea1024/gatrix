/**
 * AST-based refactoring script to rename environment identifiers
 *
 * This script uses ts-morph to safely rename:
 * - environmentId → environment
 * - environmentName → environment
 *
 * It only changes identifier names (variables, parameters, properties)
 * and does NOT change string literals.
 *
 * Usage:
 *   node archived/refactor-environment.js [--dry-run]
 */

const { Project, Node } = require('ts-morph');
const path = require('path');

const DRY_RUN = process.argv.includes('--dry-run');

// Identifiers to rename
const RENAME_MAP = {
  environmentId: 'environment',
  environmentName: 'environment',
};

// Files to skip (e.g., migrations that need to keep old names for DB columns)
const SKIP_PATTERNS = [/migrations\//, /\.d\.ts$/, /node_modules/];

function shouldSkipFile(filePath) {
  return SKIP_PATTERNS.some((pattern) => pattern.test(filePath));
}

function renameIdentifiers(project) {
  let filesChanged = 0;
  let identifiersRenamed = 0;

  const sourceFiles = project.getSourceFiles();

  for (const sourceFile of sourceFiles) {
    const filePath = sourceFile.getFilePath();

    if (shouldSkipFile(filePath)) {
      continue;
    }

    let fileModified = false;

    // Find all identifiers
    sourceFile.forEachDescendant((node) => {
      if (Node.isIdentifier(node)) {
        const identifierName = node.getText();
        const newName = RENAME_MAP[identifierName];

        if (newName) {
          // Check if this is actually an identifier (not part of a string literal or comment)
          const parent = node.getParent();

          // Skip if parent is a string literal or template literal
          if (
            parent &&
            (Node.isStringLiteral(parent) ||
              Node.isNoSubstitutionTemplateLiteral(parent) ||
              Node.isTemplateExpression(parent))
          ) {
            return;
          }

          // Check if this identifier is a meaningful code element
          const isVariableDeclaration = Node.isVariableDeclaration(parent);
          const isParameter = Node.isParameterDeclaration(parent);
          const isPropertySignature = Node.isPropertySignature(parent);
          const isPropertyDeclaration = Node.isPropertyDeclaration(parent);
          const isPropertyAccessExpression =
            Node.isPropertyAccessExpression(parent) && parent.getName() === identifierName;
          const isBindingElement = Node.isBindingElement(parent);
          const isShorthandPropertyAssignment = Node.isShorthandPropertyAssignment(parent);

          // For property assignments like { environmentId: value }
          const isPropertyAssignment = Node.isPropertyAssignment(parent);
          const isPropertyName = isPropertyAssignment && parent.getNameNode() === node;

          if (
            isVariableDeclaration ||
            isParameter ||
            isPropertySignature ||
            isPropertyDeclaration ||
            isPropertyAccessExpression ||
            isBindingElement ||
            isShorthandPropertyAssignment ||
            isPropertyName
          ) {
            console.log(`  ${filePath}: ${identifierName} → ${newName}`);

            if (!DRY_RUN) {
              try {
                node.rename(newName);
                identifiersRenamed++;
                fileModified = true;
              } catch (err) {
                console.error(`    Error renaming: ${err.message}`);
              }
            } else {
              identifiersRenamed++;
              fileModified = true;
            }
          }
        }
      }
    });

    if (fileModified) {
      filesChanged++;
    }
  }

  return { filesChanged, identifiersRenamed };
}

async function main() {
  console.log('Environment Identifier Refactoring Script');
  console.log('=========================================');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log('');

  const projectRoot = path.resolve(__dirname, '..');

  // Create project
  const project = new Project({
    tsConfigFilePath: path.join(projectRoot, 'packages/backend/tsconfig.json'),
  });

  // Add additional source files from frontend
  project.addSourceFilesAtPaths(path.join(projectRoot, 'packages/frontend/src/**/*.{ts,tsx}'));

  console.log(`Found ${project.getSourceFiles().length} source files`);
  console.log('');

  console.log('Renaming identifiers...');
  const { filesChanged, identifiersRenamed } = renameIdentifiers(project);

  console.log('');
  console.log('Summary:');
  console.log(`  Files changed: ${filesChanged}`);
  console.log(`  Identifiers renamed: ${identifiersRenamed}`);

  if (!DRY_RUN && filesChanged > 0) {
    console.log('');
    console.log('Saving changes...');
    await project.save();
    console.log('Done!');
  } else if (DRY_RUN) {
    console.log('');
    console.log('Dry run complete. No changes were made.');
    console.log('Run without --dry-run to apply changes.');
  }
}

main().catch(console.error);
