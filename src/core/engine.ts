/**
 * Translation Engine - Core orchestrator for IaC translation
 */

import { IRDocument } from './ir';
import {
  ParserPlugin,
  GeneratorPlugin,
  ParseContext,
  GenerateContext,
  ParseError,
  GenerateError,
  ValidationError,
  ValidationResult,
} from './plugin';
import { PluginRegistry } from './registry';

/**
 * Translation options
 */
export interface TranslationOptions {
  validateBefore?: boolean;
  validateAfter?: boolean;
  preserveComments?: boolean;
  formatOutput?: boolean;
  parseOptions?: Record<string, any>;
  generateOptions?: Record<string, any>;
}

/**
 * Translation error
 */
export interface TranslationError {
  message: string;
  phase: 'parse' | 'generate' | 'validate';
  details?: any;
}

/**
 * Translation result
 */
export interface TranslationResult {
  success: boolean;
  output?: string;
  ir?: IRDocument;
  errors: TranslationError[];
  warnings: TranslationError[];
}

/**
 * Language information
 */
export interface LanguageInfo {
  name: string;
  canParse: boolean;
  canGenerate: boolean;
  fileExtensions?: string[];
  fileExtension?: string;
}

/**
 * Translation Engine class
 */
export class TranslationEngine {
  private registry: PluginRegistry;

  constructor() {
    this.registry = new PluginRegistry();
  }

  /**
   * Register a parser plugin
   */
  registerParser(plugin: ParserPlugin): void {
    this.registry.registerParser(plugin);
  }

  /**
   * Register a generator plugin
   */
  registerGenerator(plugin: GeneratorPlugin): void {
    this.registry.registerGenerator(plugin);
  }

  /**
   * Translate source code from one language to another
   */
  translate(
    source: string,
    sourceLanguage: string,
    targetLanguage: string,
    options: TranslationOptions = {}
  ): TranslationResult {
    const errors: TranslationError[] = [];
    const warnings: TranslationError[] = [];

    // Get plugins
    const parser = this.registry.getParser(sourceLanguage);
    if (!parser) {
      return {
        success: false,
        errors: [
          {
            message: `No parser found for language: ${sourceLanguage}`,
            phase: 'parse',
          },
        ],
        warnings: [],
      };
    }

    const generator = this.registry.getGenerator(targetLanguage);
    if (!generator) {
      return {
        success: false,
        errors: [
          {
            message: `No generator found for language: ${targetLanguage}`,
            phase: 'generate',
          },
        ],
        warnings: [],
      };
    }

    // Validate before translation if requested
    if (options.validateBefore) {
      const validationResult = this.validate(source, sourceLanguage);
      if (!validationResult.valid) {
        return {
          success: false,
          errors: validationResult.errors.map((e) => ({
            message: e.message,
            phase: 'validate' as const,
            details: e.location,
          })),
          warnings: [],
        };
      }
    }

    // Parse source
    const parseContext: ParseContext = {
      options: options.parseOptions || {},
    };
    const parseResult = parser.parse(source, parseContext);

    if (!parseResult.success || !parseResult.ir) {
      return {
        success: false,
        errors: parseResult.errors.map((e) => ({
          message: e.message,
          phase: 'parse' as const,
          details: e.location,
        })),
        warnings: parseResult.warnings.map((w) => ({
          message: w.message,
          phase: 'parse' as const,
          details: w.location,
        })),
      };
    }

    // Collect parse warnings
    warnings.push(
      ...parseResult.warnings.map((w) => ({
        message: w.message,
        phase: 'parse' as const,
        details: w.location,
      }))
    );

    const ir = parseResult.ir;

    // Generate target code
    const generateContext: GenerateContext = {
      options: options.generateOptions || {},
    };
    const generateResult = generator.generate(ir, generateContext);

    if (!generateResult.success || !generateResult.output) {
      return {
        success: false,
        ir,
        errors: generateResult.errors.map((e) => ({
          message: e.message,
          phase: 'generate' as const,
        })),
        warnings: [
          ...warnings,
          ...generateResult.warnings.map((w) => ({
            message: w.message,
            phase: 'generate' as const,
          })),
        ],
      };
    }

    // Collect generate warnings
    warnings.push(
      ...generateResult.warnings.map((w) => ({
        message: w.message,
        phase: 'generate' as const,
      }))
    );

    // Add warnings for unsupported features
    if (generateResult.unsupportedFeatures.length > 0) {
      warnings.push(
        ...generateResult.unsupportedFeatures.map((f) => ({
          message: `Unsupported feature: ${f.feature} - ${f.description}`,
          phase: 'generate' as const,
          details: f.location,
        }))
      );
    }

    let output = generateResult.output;

    // Format output if requested
    if (options.formatOutput) {
      output = generator.format(output);
    }

    return {
      success: true,
      output,
      ir,
      errors: [],
      warnings,
    };
  }

  /**
   * Validate source code without translation
   */
  validate(source: string, language: string): ValidationResult {
    const parser = this.registry.getParser(language);
    if (!parser) {
      return {
        valid: false,
        errors: [
          {
            message: `No parser found for language: ${language}`,
          },
        ],
      };
    }

    return parser.validate(source);
  }

  /**
   * Get information about all supported languages
   */
  getSupportedLanguages(): LanguageInfo[] {
    const languages = new Map<string, LanguageInfo>();

    // Add parsers
    for (const langName of this.registry.getParserLanguages()) {
      const parser = this.registry.getParser(langName);
      if (parser) {
        languages.set(langName, {
          name: langName,
          canParse: true,
          canGenerate: false,
          fileExtensions: parser.fileExtensions,
        });
      }
    }

    // Add generators
    for (const langName of this.registry.getGeneratorLanguages()) {
      const generator = this.registry.getGenerator(langName);
      if (generator) {
        const existing = languages.get(langName);
        if (existing) {
          existing.canGenerate = true;
          existing.fileExtension = generator.fileExtension;
        } else {
          languages.set(langName, {
            name: langName,
            canParse: false,
            canGenerate: true,
            fileExtension: generator.fileExtension,
          });
        }
      }
    }

    return Array.from(languages.values());
  }

  /**
   * Check if translation is supported between two languages
   */
  canTranslate(sourceLanguage: string, targetLanguage: string): boolean {
    return (
      this.registry.hasParser(sourceLanguage) &&
      this.registry.hasGenerator(targetLanguage)
    );
  }
}
