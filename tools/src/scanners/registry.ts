import { LanguageScanner, SupportedLanguage } from '../types';
import { TypeScriptScanner, JavaScriptScanner } from './typescriptScanner';
import {
  DartScanner,
  LuaScanner,
  CScanner,
  CppScanner,
  CSharpScanner,
  JavaScanner,
  KotlinScanner,
  GoScanner,
  SwiftScanner,
  RustScanner,
  PythonScanner,
  RubyScanner,
  PhpScanner,
} from './languageScanners';

// ============================================================
// Scanner registry - plugin-based scanner management
// ============================================================

export class ScannerRegistry {
  private scanners = new Map<SupportedLanguage, LanguageScanner>();
  private extensionMap = new Map<string, SupportedLanguage>();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    // Tier 1: Full import + type tracking
    this.register(new TypeScriptScanner());
    this.register(new JavaScriptScanner());
    this.register(new DartScanner());
    this.register(new JavaScanner());
    this.register(new KotlinScanner());
    this.register(new CSharpScanner());
    this.register(new GoScanner());
    this.register(new SwiftScanner());
    this.register(new RustScanner());

    // Tier 2: Import tracking, no type tracking
    this.register(new PythonScanner());
    this.register(new RubyScanner());
    this.register(new PhpScanner());
    this.register(new CScanner());
    this.register(new CppScanner());

    // Tier 3: Pattern-based with guard rails
    this.register(new LuaScanner());
  }

  register(scanner: LanguageScanner): void {
    this.scanners.set(scanner.language, scanner);
    for (const ext of scanner.extensions) {
      this.extensionMap.set(ext, scanner.language);
    }
  }

  getByLanguage(language: SupportedLanguage): LanguageScanner | undefined {
    return this.scanners.get(language);
  }

  getByExtension(ext: string): LanguageScanner | undefined {
    const language = this.extensionMap.get(ext);
    if (!language) return undefined;
    return this.scanners.get(language);
  }

  getLanguageForExtension(ext: string): SupportedLanguage | undefined {
    return this.extensionMap.get(ext);
  }

  getLanguages(): SupportedLanguage[] {
    return Array.from(this.scanners.keys());
  }

  getExtensions(): string[] {
    return Array.from(this.extensionMap.keys());
  }

  /**
   * Apply custom extension-to-language mappings from user config.
   * This allows users to map unusual extensions like '.hh' -> 'cpp'.
   */
  applyExtensionMappings(mappings: Record<string, SupportedLanguage>): void {
    for (const [ext, language] of Object.entries(mappings)) {
      const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;
      if (this.scanners.has(language)) {
        this.extensionMap.set(normalizedExt, language);
      } else {
        console.warn(
          `[WARN] Custom extension mapping: language "${language}" for "${normalizedExt}" not registered.`,
        );
      }
    }
  }
}
