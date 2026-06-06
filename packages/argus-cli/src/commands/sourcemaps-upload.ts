import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import FormData from 'form-data';
import fetch from 'node-fetch';
import chalk from 'chalk';
import ora from 'ora';

interface UploadOptions {
  project: string;
  release: string;
  dist: string;
  urlPrefix: string;
  authToken: string;
  url: string;
  extensions: string;
  dryRun: boolean;
}

/**
 * Collect source map files from the given paths.
 * Matches .js and .js.map files by default.
 */
async function collectFiles(
  paths: string[],
  extensions: string[]
): Promise<{ absolutePath: string; relativePath: string }[]> {
  const files: { absolutePath: string; relativePath: string }[] = [];

  for (const inputPath of paths) {
    const resolved = path.resolve(inputPath);
    const stat = fs.statSync(resolved);

    if (stat.isFile()) {
      files.push({
        absolutePath: resolved,
        relativePath: path.basename(resolved),
      });
    } else if (stat.isDirectory()) {
      const patterns = extensions.map((ext) => `**/*${ext}`);
      for (const pattern of patterns) {
        const matched = await glob(pattern, {
          cwd: resolved,
          nodir: true,
          absolute: false,
        });
        for (const m of matched) {
          files.push({
            absolutePath: path.join(resolved, m),
            relativePath: m.replace(/\\/g, '/'),
          });
        }
      }
    }
  }

  return files;
}

/**
 * Upload collected files to the Argus sourcemaps API.
 */
async function uploadSourcemaps(
  files: { absolutePath: string; relativePath: string }[],
  options: UploadOptions
): Promise<void> {
  const form = new FormData();
  form.append('release', options.release);
  if (options.dist) {
    form.append('dist', options.dist);
  }

  let totalSize = 0;
  for (const file of files) {
    const stat = fs.statSync(file.absolutePath);
    totalSize += stat.size;

    // Apply url-prefix: ~/static/js/main.js.map
    const uploadPath = options.urlPrefix
      ? `${options.urlPrefix.replace(/\/$/, '')}/${file.relativePath}`
      : file.relativePath;

    // Send the full path as a separate field (multipart sanitizes filenames)
    form.append('file_path', uploadPath);
    form.append('file', fs.createReadStream(file.absolutePath), {
      filename: file.relativePath,
      contentType: 'application/octet-stream',
    });
  }

  const apiUrl = `${options.url.replace(/\/$/, '')}/argus/api/${options.project}/sourcemaps`;

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.authToken}`,
      'x-application-name': 'argus-cli',
      ...form.getHeaders(),
    },
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed (${response.status}): ${text}`);
  }

  const result = (await response.json()) as {
    success: boolean;
    data?: { release_id: number; file_count: number };
    error?: string;
  };

  if (!result.success) {
    throw new Error(`Upload failed: ${result.error || 'Unknown error'}`);
  }

  console.log(
    chalk.green(
      `\n✓ Uploaded ${files.length} files (${formatBytes(totalSize)})`
    )
  );
  console.log(chalk.dim(`  Release: ${options.release}`));
  if (options.dist) console.log(chalk.dim(`  Dist: ${options.dist}`));
  console.log(chalk.dim(`  Release ID: ${result.data?.release_id}`));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function registerSourcemapsCommand(program: Command): void {
  const sourcemaps = program
    .command('sourcemaps')
    .description('Manage source maps');

  sourcemaps
    .command('upload <paths...>')
    .description('Upload source map files for a release')
    .requiredOption('-p, --project <id>', 'Project ID (e.g. "abc123")')
    .requiredOption('-r, --release <version>', 'Release version (e.g. "1.0.0")')
    .option('-d, --dist <dist>', 'Distribution identifier', '')
    .option(
      '--url-prefix <prefix>',
      'URL prefix for uploaded files (e.g. "~/static/js")',
      ''
    )
    .option(
      '--auth-token <token>',
      'Auth token for Argus API',
      process.env.ARGUS_AUTH_TOKEN || 'unsecured-server-api-token'
    )
    .option(
      '--url <url>',
      'Argus API base URL',
      process.env.ARGUS_URL || 'http://localhost:45300'
    )
    .option(
      '--extensions <exts>',
      'Comma-separated file extensions to include',
      '.js,.js.map,.cjs,.cjs.map,.mjs,.mjs.map'
    )
    .option('--dry-run', 'Show what would be uploaded without uploading', false)
    .action(async (paths: string[], opts: UploadOptions) => {
      const spinner = ora('Collecting source map files...').start();

      try {
        const extensions = opts.extensions.split(',').map((e) => e.trim());
        const files = await collectFiles(paths, extensions);

        if (files.length === 0) {
          spinner.fail('No source map files found');
          console.log(
            chalk.yellow(
              `  Searched for: ${extensions.join(', ')} in ${paths.join(', ')}`
            )
          );
          process.exit(1);
        }

        spinner.succeed(`Found ${files.length} files`);

        if (opts.dryRun) {
          console.log(chalk.cyan('\nDry run — files that would be uploaded:'));
          for (const file of files) {
            const stat = fs.statSync(file.absolutePath);
            console.log(
              `  ${chalk.dim(formatBytes(stat.size).padStart(10))}  ${file.relativePath}`
            );
          }
          return;
        }

        const uploadSpinner = ora(
          `Uploading ${files.length} files to ${opts.url}...`
        ).start();

        await uploadSourcemaps(files, opts);
        uploadSpinner.succeed('Upload complete');
      } catch (error) {
        spinner.fail(
          `Failed: ${error instanceof Error ? error.message : String(error)}`
        );
        process.exit(1);
      }
    });
}
