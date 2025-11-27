/**
 * Plugin interfaces for parsers and generators
 */

import { IRDocument } from './ir';

/**
 * Error types for parsing and generation
 */
export interface ParseError {
  message: string;
  location?: {
    line: number;
    column: number;
    file?: string;
  };
  severity: 'error' | 'warning';
}

export interface ValidationError {
  message: string;
  location?: {
    line: number;
    column: number;
    file?: string;
  };
}

export interface GenerateError {
  message: string;
  severity: 'error' | 'warning';
}

export interface UnsupportedFeature {
  feature: string;
  description: string;
  location?: {
    line: number;
    column: number;
  };
}

/**
 * Context objects for parsing and generation
 */
export interface ParseContext {
  filePath?: string;
  options: Record<string, any>;
}

export interface GenerateContext {
  options: Record<string, any>;
  targetVersion?: string;
}

/**
 * Result objects for parsing and generation
 */
export interface ParseResult {
  success: boolean;
  ir?: IRDocument;
  errors: ParseError[];
  warnings: ParseError[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface GenerateResult {
  success: boolean;
  output?: string;
  errors: GenerateError[];
  warnings: GenerateError[];
  unsupportedFeatures: UnsupportedFeature[];
}

/**
 * Parser plugin interface
 * Converts source language syntax into Abstract IR
 */
export interface ParserPlugin {
  languageName: string;
  fileExtensions: string[];

  parse(source: string, context: ParseContext): ParseResult;
  validate(source: string): ValidationResult;
}

/**
 * Generator plugin interface
 * Converts Abstract IR into target language syntax
 */
export interface GeneratorPlugin {
  languageName: string;
  fileExtension: string;

  generate(ir: IRDocument, context: GenerateContext): GenerateResult;
  format(output: string): string;
}

/**
 * Union type for any plugin
 */
export type Plugin = ParserPlugin | GeneratorPlugin;

/**
 * Type guards for plugin types
 */
export function isParserPlugin(plugin: Plugin): plugin is ParserPlugin {
  return 'parse' in plugin && 'validate' in plugin;
}

export function isGeneratorPlugin(plugin: Plugin): plugin is GeneratorPlugin {
  return 'generate' in plugin && 'format' in plugin;
}
