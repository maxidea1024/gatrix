#!/usr/bin/env node

/**
 * Planning Data Conversion CLI Tool
 *
 * 기획데이터 변환 도구
 * CMS 폴더의 원본 데이터를 처리하여 최종 JSON 파일 생성
 * 항상 모든 데이터를 변환합니다 (옵션으로 선택 불가)
 *
 * Usage:
 *   npx ts-node scripts/convert-planning-data.ts [options]
 *   yarn planning-data:convert [options]
 *
 * Options:
 *   --input <path>      CMS 폴더 경로 (기본값: packages/backend/cms)
 *   --output <path>     출력 폴더 경로 (기본값: packages/backend/data/planning)
 *   --verbose           상세 로그 출력
 *   --help              도움말 표시
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

interface ConvertOptions {
  input: string;
  output: string;
  verbose: boolean;
  binaryCode: string;
  countryCode: number;
  timeOffset: number;
}

class PlanningDataConverter {
  private options: ConvertOptions;
  private startTime: number = 0;

  constructor(options: ConvertOptions) {
    this.options = options;
  }

  private log(
    message: string,
    level: 'info' | 'warn' | 'error' | 'success' = 'info'
  ) {
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
      const builderPath = path.join(
        __dirname,
        '../src/contents/cms/adminToolDataBuilder.js'
      );

      this.log('Running adminToolDataBuilder...');

      // Build with binaryCode, countryCode, and timeOffset options
      const command = `node "${builderPath}" --cms-dir "${this.options.input}" --output-dir "${this.options.output}" --binary-code ${this.options.binaryCode} --country-code ${this.options.countryCode} --time-offset ${this.options.timeOffset}`;

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
      'reward-lookup-kr.json',
      'reward-lookup-en.json',
      'reward-lookup-zh.json',
      'reward-type-list.json',
      'ui-list-data-kr.json',
      'ui-list-data-en.json',
      'ui-list-data-zh.json',
      'hottimebuff-lookup-kr.json',
      'hottimebuff-lookup-en.json',
      'hottimebuff-lookup-zh.json',
      'eventpage-lookup-kr.json',
      'eventpage-lookup-en.json',
      'eventpage-lookup-zh.json',
      'liveevent-lookup-kr.json',
      'liveevent-lookup-en.json',
      'liveevent-lookup-zh.json',
      'materecruiting-lookup-kr.json',
      'materecruiting-lookup-en.json',
      'materecruiting-lookup-zh.json',
      'oceannpcarea-lookup-kr.json',
      'oceannpcarea-lookup-en.json',
      'oceannpcarea-lookup-zh.json',
      'cashshop-lookup.json',
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

  // Get the backend root
  // When run via ts-node: __dirname is scripts directory
  // When run via compiled JS: __dirname is dist/scripts directory
  let backendRoot: string;

  if (__dirname.includes('dist')) {
    // Compiled: dist/scripts -> backend
    backendRoot = path.resolve(__dirname, '../..');
  } else {
    // ts-node: scripts -> backend
    backendRoot = path.resolve(__dirname, '..');
  }

  const options: ConvertOptions = {
    input: path.join(backendRoot, 'cms'),
    output: path.join(backendRoot, 'data', 'planning'),
    verbose: false,
    binaryCode: 'cn',
    countryCode: 6,
    timeOffset: 8,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
        options.input = args[++i];
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--binary-code':
        options.binaryCode = args[++i];
        break;
      case '--country-code':
        options.countryCode = parseInt(args[++i], 10);
        break;
      case '--time-offset':
        options.timeOffset = parseInt(args[++i], 10);
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
  --input <path>        CMS 폴더 경로 (기본값: packages/backend/cms)
  --output <path>       출력 폴더 경로 (기본값: packages/backend/data/planning)
  --binary-code <code>  바이너리 코드 (기본값: cn)
                        CMS 파일 접미사 결정 (예: cn -> CashShop_BCCN.json)
  --country-code <num>  국가 코드 (기본값: 6)
                        localBitFlag 필터링용. 0=KOREA, 2=GLOBAL, 6=CHINA
  --time-offset <num>   타임존 오프셋 (기본값: 8)
                        기획데이터 시간 파싱용
  --verbose             상세 로그 출력
  --help                도움말 표시

Examples:
  # 기본 변환 (중국 설정)
  yarn planning-data:convert

  # 한국 설정으로 변환
  yarn planning-data:convert --binary-code kr --country-code 0

  # 커스텀 경로 지정
  yarn planning-data:convert --input ./cms --output ./output

  # 상세 로그 출력
  yarn planning-data:convert --verbose
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
