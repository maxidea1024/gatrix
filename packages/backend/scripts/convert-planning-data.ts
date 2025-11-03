#!/usr/bin/env node

/**
 * Planning Data Conversion CLI Tool
 * 
 * 기획데이터 변환 도구
 * CMS 폴더의 원본 데이터를 처리하여 최종 JSON 파일 생성
 * 
 * Usage:
 *   npx ts-node scripts/convert-planning-data.ts [options]
 *   yarn planning-data:convert [options]
 * 
 * Options:
 *   --input <path>      CMS 폴더 경로 (기본값: packages/backend/cms)
 *   --output <path>     출력 폴더 경로 (기본값: packages/backend/data/planning)
 *   --all               모든 데이터 변환 (기본값)
 *   --rewards           보상 데이터만 변환
 *   --ui-lists          UI 목록만 변환
 *   --localization      로컬라이징만 변환
 *   --verbose           상세 로그 출력
 *   --help              도움말 표시
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

interface ConvertOptions {
  input: string;
  output: string;
  all: boolean;
  rewards: boolean;
  uiLists: boolean;
  localization: boolean;
  verbose: boolean;
}

class PlanningDataConverter {
  private options: ConvertOptions;
  private startTime: number = 0;

  constructor(options: ConvertOptions) {
    this.options = options;
  }

  private log(message: string, level: 'info' | 'warn' | 'error' | 'success' = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}]`;
    
    switch (level) {
      case 'info':
        console.log(`${prefix} ℹ️  ${message}`);
        break;
      case 'warn':
        console.warn(`${prefix} ⚠️  ${message}`);
        break;
      case 'error':
        console.error(`${prefix} ❌ ${message}`);
        break;
      case 'success':
        console.log(`${prefix} ✅ ${message}`);
        break;
    }
  }

  private async ensureOutputDir(): Promise<void> {
    try {
      await fs.mkdir(this.options.output, { recursive: true });
      this.log(`Output directory ready: ${this.options.output}`);
    } catch (error) {
      this.log(`Failed to create output directory: ${error}`, 'error');
      throw error;
    }
  }

  private async validateInputDir(): Promise<void> {
    try {
      const stat = await fs.stat(this.options.input);
      if (!stat.isDirectory()) {
        throw new Error('Input path is not a directory');
      }
      this.log(`Input directory validated: ${this.options.input}`);
    } catch (error) {
      this.log(`Input directory validation failed: ${error}`, 'error');
      throw error;
    }
  }

  async convert(): Promise<void> {
    this.startTime = Date.now();
    this.log('🚀 Starting planning data conversion...');

    try {
      // Validate input
      await this.validateInputDir();
      await this.ensureOutputDir();

      // Run adminToolDataBuilder
      // The builder is located in src/contents/cms directory
      const builderPath = path.join(__dirname, '../src/contents/cms/adminToolDataBuilder.js');

      this.log('Running adminToolDataBuilder...');

      const command = `node "${builderPath}" --all --cms-dir "${this.options.input}" --output-dir "${this.options.output}"`;
      
      if (this.options.verbose) {
        this.log(`Command: ${command}`);
      }

      const output = execSync(command, {
        encoding: 'utf-8',
        stdio: 'pipe',
      });

      if (this.options.verbose) {
        this.log(`Builder output:\n${output}`);
      }

      // Verify output files
      await this.verifyOutputFiles();

      const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
      this.log(`✨ Conversion completed in ${duration}s`, 'success');

    } catch (error) {
      this.log(`Conversion failed: ${error}`, 'error');
      process.exit(1);
    }
  }

  private async verifyOutputFiles(): Promise<void> {
    const requiredFiles = [
      'reward-lookup.json',
      'reward-type-list.json',
      'reward-localization-kr.json',
      'reward-localization-us.json',
      'reward-localization-cn.json',
      'ui-list-data.json',
      'loctab.json',
    ];

    this.log('Verifying output files...');

    let allExist = true;
    for (const file of requiredFiles) {
      const filePath = path.join(this.options.output, file);
      try {
        const stat = await fs.stat(filePath);
        const sizeKB = (stat.size / 1024).toFixed(2);
        this.log(`  ✓ ${file} (${sizeKB} KB)`);
      } catch (error) {
        this.log(`  ✗ ${file} - NOT FOUND`, 'warn');
        allExist = false;
      }
    }

    if (!allExist) {
      this.log('Some output files are missing', 'warn');
    } else {
      this.log('All output files verified', 'success');
    }
  }
}

// Parse command line arguments
function parseArgs(): ConvertOptions {
  const args = process.argv.slice(2);

  // Get the workspace root (go up from packages/backend to root)
  const workspaceRoot = path.resolve(__dirname, '../../..');

  const options: ConvertOptions = {
    input: path.join(workspaceRoot, 'packages/backend/cms'),
    output: path.join(workspaceRoot, 'packages/backend/data/planning'),
    all: true,
    rewards: false,
    uiLists: false,
    localization: false,
    verbose: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
        options.input = args[++i];
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--rewards':
        options.all = false;
        options.rewards = true;
        break;
      case '--ui-lists':
        options.all = false;
        options.uiLists = true;
        break;
      case '--localization':
        options.all = false;
        options.localization = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Planning Data Conversion CLI Tool

Usage:
  npx ts-node scripts/convert-planning-data.ts [options]
  yarn planning-data:convert [options]

Options:
  --input <path>      CMS 폴더 경로 (기본값: packages/backend/cms)
  --output <path>     출력 폴더 경로 (기본값: packages/backend/data/planning)
  --all               모든 데이터 변환 (기본값)
  --rewards           보상 데이터만 변환
  --ui-lists          UI 목록만 변환
  --localization      로컬라이징만 변환
  --verbose           상세 로그 출력
  --help              도움말 표시

Examples:
  # 기본 변환 (모든 데이터)
  yarn planning-data:convert

  # 커스텀 경로 지정
  yarn planning-data:convert --input ./cms --output ./output

  # 상세 로그 출력
  yarn planning-data:convert --verbose

  # 보상 데이터만 변환
  yarn planning-data:convert --rewards
  `);
}

// Main
async function main(): Promise<void> {
  const options = parseArgs();
  const converter = new PlanningDataConverter(options);
  await converter.convert();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

