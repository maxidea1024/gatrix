import { FunctionPattern, RawFlagReference, LanguageTierInfo, ScanConfig } from '../types';
import { RegexScanner, ImportDetectionResult, ReceiverInfo } from './regexScanner';

// ============================================================
// Language-specific scanners with tier-aware confidence
// ============================================================

// -- Tier 1 Languages --

const TIER1_INFO: LanguageTierInfo = {
  tier: 1,
  supportsImportTracking: true,
  supportsTypeTracking: true,
};

/**
 * Dart language scanner (Tier 1).
 */
export class DartScanner extends RegexScanner {
  constructor() {
    super('dart', ['.dart'], TIER1_INFO);
  }

  protected detectImports(content: string, config: ScanConfig): ImportDetectionResult {
    const result = super.detectImports(content, config);

    // Dart: import 'package:gatrix/sdk.dart';
    for (const pkg of config.sdkPackages) {
      const escapedPkg = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const dartImportRe = new RegExp(`import\\s+['"]package:${escapedPkg}[^'"]*['"]`, 'g');
      if (dartImportRe.test(content)) {
        result.hasImport = true;
      }
    }

    return result;
  }
}

/**
 * Java language scanner (Tier 1).
 */
export class JavaScanner extends RegexScanner {
  constructor() {
    super('java', ['.java'], TIER1_INFO);
  }
}

/**
 * Kotlin language scanner (Tier 1).
 */
export class KotlinScanner extends RegexScanner {
  constructor() {
    super('kotlin', ['.kt', '.kts'], TIER1_INFO);
  }
}

/**
 * C# language scanner (Tier 1).
 */
export class CSharpScanner extends RegexScanner {
  constructor() {
    super('csharp', ['.cs'], TIER1_INFO);
  }

  protected detectImports(content: string, config: ScanConfig): ImportDetectionResult {
    const result = super.detectImports(content, config);

    // C#: using Gatrix.Feature;
    for (const pkg of config.sdkPackages) {
      const escapedPkg = pkg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const usingRe = new RegExp(`using\\s+${escapedPkg}[^;]*;`, 'g');
      if (usingRe.test(content)) {
        result.hasImport = true;
      }
    }

    return result;
  }
}

/**
 * Go language scanner (Tier 1).
 */
export class GoScanner extends RegexScanner {
  constructor() {
    super('go', ['.go'], TIER1_INFO);
  }

  protected detectImports(content: string, config: ScanConfig): ImportDetectionResult {
    const result = super.detectImports(content, config);

    // Go: import "github.com/gatrix/sdk"
    const goImportRe = /import\s+(?:\(\s*([^)]+)\)|"([^"]+)")/g;
    let m: ReturnType<RegExp['exec']>;
    while ((m = goImportRe.exec(content)) !== null) {
      const importBlock = m[1] ?? m[2] ?? '';
      for (const pkg of config.sdkPackages) {
        if (importBlock.includes(pkg)) {
          result.hasImport = true;
        }
      }
    }

    return result;
  }
}

/**
 * Swift language scanner (Tier 1).
 */
export class SwiftScanner extends RegexScanner {
  constructor() {
    super('swift', ['.swift'], TIER1_INFO);
  }

  protected detectImports(content: string, config: ScanConfig): ImportDetectionResult {
    const result = super.detectImports(content, config);

    // Swift: import Gatrix
    const importRe = /^import\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm;
    let m: ReturnType<RegExp['exec']>;
    while ((m = importRe.exec(content)) !== null) {
      if (config.sdkPackages.some((pkg) => pkg.toLowerCase() === m![1].toLowerCase())) {
        result.hasImport = true;
      }
    }

    return result;
  }
}

/**
 * Rust language scanner (Tier 1).
 */
export class RustScanner extends RegexScanner {
  constructor() {
    super('rust', ['.rs'], TIER1_INFO);
  }

  protected detectImports(content: string, config: ScanConfig): ImportDetectionResult {
    const result = super.detectImports(content, config);

    // Rust: use gatrix::sdk; or use gatrix_sdk::*;
    const useRe = /^use\s+([a-zA-Z_][a-zA-Z0-9_:]*)/gm;
    let m: ReturnType<RegExp['exec']>;
    while ((m = useRe.exec(content)) !== null) {
      const usePath = m[1].replace(/::/g, '/');
      if (config.sdkPackages.some((pkg) => usePath.toLowerCase().includes(pkg.toLowerCase()))) {
        result.hasImport = true;
      }
    }

    // Rust: extern crate gatrix;
    const externRe = /^extern\s+crate\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm;
    while ((m = externRe.exec(content)) !== null) {
      if (config.sdkPackages.some((pkg) => pkg.toLowerCase() === m![1].toLowerCase())) {
        result.hasImport = true;
      }
    }

    return result;
  }
}

// -- Tier 2 Languages --

const TIER2_INFO: LanguageTierInfo = {
  tier: 2,
  supportsImportTracking: false,
  supportsTypeTracking: false,
};

/**
 * Python language scanner (Tier 2).
 */
export class PythonScanner extends RegexScanner {
  constructor() {
    super('python', ['.py'], TIER2_INFO);
  }

  protected detectImports(content: string, config: ScanConfig): ImportDetectionResult {
    const result = super.detectImports(content, config);

    // Python: import gatrix / from gatrix import ... / from gatrix.sdk import ...
    const importRe = /^(?:import|from)\s+([a-zA-Z_][a-zA-Z0-9_.]*)/gm;
    let m: ReturnType<RegExp['exec']>;
    while ((m = importRe.exec(content)) !== null) {
      if (config.sdkPackages.some((pkg) => m![1].toLowerCase().includes(pkg.toLowerCase()))) {
        result.hasImport = true;
      }
    }

    return result;
  }
}

/**
 * Ruby language scanner (Tier 2).
 */
export class RubyScanner extends RegexScanner {
  constructor() {
    super('ruby', ['.rb'], TIER2_INFO);
  }

  protected detectImports(content: string, config: ScanConfig): ImportDetectionResult {
    const result = super.detectImports(content, config);

    // Ruby: require 'gatrix' / require_relative 'gatrix'
    const requireRe = /^(?:require|require_relative)\s+['"]([^'"]+)['"]/gm;
    let m: ReturnType<RegExp['exec']>;
    while ((m = requireRe.exec(content)) !== null) {
      if (config.sdkPackages.some((pkg) => m![1].toLowerCase().includes(pkg.toLowerCase()))) {
        result.hasImport = true;
      }
    }

    return result;
  }
}

/**
 * PHP language scanner (Tier 2).
 */
export class PhpScanner extends RegexScanner {
  constructor() {
    super('php', ['.php'], TIER2_INFO);
  }

  protected detectImports(content: string, config: ScanConfig): ImportDetectionResult {
    const result = super.detectImports(content, config);

    // PHP: use Gatrix\Feature\Client;
    const useRe = /^use\s+([a-zA-Z_\\][a-zA-Z0-9_\\]*)/gm;
    let m: ReturnType<RegExp['exec']>;
    while ((m = useRe.exec(content)) !== null) {
      if (config.sdkPackages.some((pkg) => m![1].toLowerCase().includes(pkg.toLowerCase()))) {
        result.hasImport = true;
      }
    }

    // PHP: require_once 'vendor/gatrix/sdk.php';
    const requireRe = /(?:require_once|require|include_once|include)\s+['"]([^'"]+)['"]/g;
    while ((m = requireRe.exec(content)) !== null) {
      if (config.sdkPackages.some((pkg) => m![1].toLowerCase().includes(pkg.toLowerCase()))) {
        result.hasImport = true;
      }
    }

    return result;
  }
}

/**
 * C language scanner (Tier 2).
 */
export class CScanner extends RegexScanner {
  constructor() {
    super('c', ['.c', '.h'], TIER2_INFO);
  }

  protected detectImports(content: string, config: ScanConfig): ImportDetectionResult {
    const result = super.detectImports(content, config);

    const includeRe = /^#include\s*[<"]([^>"]+)[>"]/gm;
    let m: ReturnType<RegExp['exec']>;
    while ((m = includeRe.exec(content)) !== null) {
      const headerName = m[1].toLowerCase();
      if (config.sdkPackages.some((pkg) => headerName.includes(pkg.toLowerCase()))) {
        result.hasImport = true;
      }
    }

    return result;
  }
}

/**
 * C++ language scanner (Tier 2).
 */
export class CppScanner extends RegexScanner {
  constructor() {
    super('cpp', ['.cpp', '.cxx', '.cc', '.hpp', '.hh'], TIER2_INFO);
  }

  protected detectImports(content: string, config: ScanConfig): ImportDetectionResult {
    const result = super.detectImports(content, config);

    const includeRe = /^#include\s*[<"]([^>"]+)[>"]/gm;
    let m: ReturnType<RegExp['exec']>;
    while ((m = includeRe.exec(content)) !== null) {
      const headerName = m[1].toLowerCase();
      if (config.sdkPackages.some((pkg) => headerName.includes(pkg.toLowerCase()))) {
        result.hasImport = true;
      }
    }

    for (const pkg of config.sdkPackages) {
      if (content.includes(`using namespace ${pkg}`) || content.includes(`${pkg}::`)) {
        result.hasImport = true;
      }
    }

    return result;
  }
}

// -- Tier 3 Languages --

const TIER3_INFO: LanguageTierInfo = {
  tier: 3,
  supportsImportTracking: false,
  supportsTypeTracking: false,
};

/**
 * Lua language scanner (Tier 3).
 * Strict receiver-based detection with require-module validation.
 */
export class LuaScanner extends RegexScanner {
  constructor() {
    super('lua', ['.lua'], TIER3_INFO);
  }

  scan(
    filePath: string,
    content: string,
    patterns: FunctionPattern[],
    config: ScanConfig,
  ): RawFlagReference[] {
    const refs = super.scan(filePath, content, patterns, config);

    // In strict mode (default for Lua), filter out global calls
    const luaConfig = config.languageOverrides.lua;
    const allowGlobal = luaConfig?.allowGlobalCalls ?? false;

    if (!allowGlobal) {
      return refs.filter((ref) => {
        // Only include references with a confirmed receiver (colon call or dot call)
        const lines = content.split('\n');
        const line = lines[ref.line - 1] || '';
        const receiverInfo = this.extractReceiver(line, ref.column - 1);
        return receiverInfo.hasReceiver;
      });
    }

    return refs;
  }

  protected detectImports(content: string, config: ScanConfig): ImportDetectionResult {
    const result: ImportDetectionResult = {
      hasImport: false,
      importedNames: [],
      receiverVariable: null,
    };

    // Lua modules from config
    const modules = config.languageOverrides.lua?.sdkModules ?? ['gatrix'];

    for (const mod of modules) {
      const escapedMod = mod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // local client = require("gatrix")
      const requireRe = new RegExp(
        `local\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*=\\s*require\\s*\\(?\\s*['"]${escapedMod}['"]\\s*\\)?`,
        'g',
      );
      let m: ReturnType<RegExp['exec']>;
      while ((m = requireRe.exec(content)) !== null) {
        result.hasImport = true;
        result.importedNames.push(m[1]);
        result.receiverVariable = m[1];
      }
    }

    return result;
  }

  /**
   * Override receiver check for Lua colon calls.
   */
  protected extractReceiver(line: string, methodStart: number): ReceiverInfo {
    const before = line.slice(0, methodStart);

    // Lua colon call: client:method()
    const colonMatch = before.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*$/);
    if (colonMatch) {
      return { receiver: colonMatch[1], hasReceiver: true, isColonCall: true };
    }

    // Lua dot call: client.method()
    const dotMatch = before.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*\.\s*$/);
    if (dotMatch) {
      return { receiver: dotMatch[1], hasReceiver: true, isColonCall: false };
    }

    return { receiver: null, hasReceiver: false, isColonCall: false };
  }

  protected applyDetectionMode(
    config: ScanConfig,
    importInfo: ImportDetectionResult,
    receiver: string | null,
  ): boolean {
    // Lua always uses strict mode unless explicitly overridden
    const luaConfig = config.languageOverrides.lua;
    const allowGlobal = luaConfig?.allowGlobalCalls ?? false;

    // If global calls not allowed, require receiver
    if (!allowGlobal && !receiver) {
      return false;
    }

    // If in strict mode, require import
    if (config.detectionMode === 'strict') {
      return importInfo.hasImport;
    }

    // Balanced: import OR receiver
    if (config.detectionMode === 'balanced') {
      return importInfo.hasImport || !!receiver;
    }

    return true;
  }
}
