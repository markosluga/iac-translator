/**
 * Plugin Registry for managing parser and generator plugins
 */

import {
  ParserPlugin,
  GeneratorPlugin,
  Plugin,
  isParserPlugin,
  isGeneratorPlugin,
} from './plugin';

/**
 * Error thrown when plugin validation fails
 */
export class PluginValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PluginValidationError';
  }
}

/**
 * Registry for managing plugins
 */
export class PluginRegistry {
  private parsers: Map<string, ParserPlugin> = new Map();
  private generators: Map<string, GeneratorPlugin> = new Map();

  /**
   * Register a parser plugin
   * @throws {PluginValidationError} if plugin validation fails
   */
  registerParser(plugin: ParserPlugin): void {
    this.validateParserPlugin(plugin);
    this.parsers.set(plugin.languageName.toLowerCase(), plugin);
  }

  /**
   * Register a generator plugin
   * @throws {PluginValidationError} if plugin validation fails
   */
  registerGenerator(plugin: GeneratorPlugin): void {
    this.validateGeneratorPlugin(plugin);
    this.generators.set(plugin.languageName.toLowerCase(), plugin);
  }

  /**
   * Register any plugin (parser or generator)
   * @throws {PluginValidationError} if plugin validation fails
   */
  registerPlugin(plugin: Plugin): void {
    if (isParserPlugin(plugin)) {
      this.registerParser(plugin);
    } else if (isGeneratorPlugin(plugin)) {
      this.registerGenerator(plugin);
    } else {
      throw new PluginValidationError(
        'Plugin must implement either ParserPlugin or GeneratorPlugin interface'
      );
    }
  }

  /**
   * Get a parser plugin by language name
   */
  getParser(languageName: string): ParserPlugin | undefined {
    return this.parsers.get(languageName.toLowerCase());
  }

  /**
   * Get a generator plugin by language name
   */
  getGenerator(languageName: string): GeneratorPlugin | undefined {
    return this.generators.get(languageName.toLowerCase());
  }

  /**
   * Check if a parser exists for a language
   */
  hasParser(languageName: string): boolean {
    return this.parsers.has(languageName.toLowerCase());
  }

  /**
   * Check if a generator exists for a language
   */
  hasGenerator(languageName: string): boolean {
    return this.generators.has(languageName.toLowerCase());
  }

  /**
   * Get all registered parser language names
   */
  getParserLanguages(): string[] {
    return Array.from(this.parsers.keys());
  }

  /**
   * Get all registered generator language names
   */
  getGeneratorLanguages(): string[] {
    return Array.from(this.generators.keys());
  }

  /**
   * Validate a parser plugin implements all required methods
   * @throws {PluginValidationError} if validation fails
   */
  private validateParserPlugin(plugin: ParserPlugin): void {
    if (!plugin.languageName || typeof plugin.languageName !== 'string') {
      throw new PluginValidationError(
        'Parser plugin must have a languageName property of type string'
      );
    }

    if (
      !plugin.fileExtensions ||
      !Array.isArray(plugin.fileExtensions) ||
      plugin.fileExtensions.length === 0
    ) {
      throw new PluginValidationError(
        'Parser plugin must have a non-empty fileExtensions array'
      );
    }

    if (typeof plugin.parse !== 'function') {
      throw new PluginValidationError(
        'Parser plugin must implement parse() method'
      );
    }

    if (typeof plugin.validate !== 'function') {
      throw new PluginValidationError(
        'Parser plugin must implement validate() method'
      );
    }
  }

  /**
   * Validate a generator plugin implements all required methods
   * @throws {PluginValidationError} if validation fails
   */
  private validateGeneratorPlugin(plugin: GeneratorPlugin): void {
    if (!plugin.languageName || typeof plugin.languageName !== 'string') {
      throw new PluginValidationError(
        'Generator plugin must have a languageName property of type string'
      );
    }

    if (!plugin.fileExtension || typeof plugin.fileExtension !== 'string') {
      throw new PluginValidationError(
        'Generator plugin must have a fileExtension property of type string'
      );
    }

    if (typeof plugin.generate !== 'function') {
      throw new PluginValidationError(
        'Generator plugin must implement generate() method'
      );
    }

    if (typeof plugin.format !== 'function') {
      throw new PluginValidationError(
        'Generator plugin must implement format() method'
      );
    }
  }

  /**
   * Clear all registered plugins
   */
  clear(): void {
    this.parsers.clear();
    this.generators.clear();
  }
}
