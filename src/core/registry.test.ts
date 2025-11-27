import { describe, it, expect, beforeEach } from 'vitest';
import {
  PluginRegistry,
  PluginValidationError,
} from './registry';
import {
  ParserPlugin,
  GeneratorPlugin,
  ParseContext,
  ParseResult,
  ValidationResult,
  GenerateContext,
  GenerateResult,
} from './plugin';
import { IRDocument } from './ir';

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  // Mock parser plugin
  const createMockParser = (languageName: string): ParserPlugin => ({
    languageName,
    fileExtensions: ['.tf'],
    parse: (source: string, context: ParseContext): ParseResult => ({
      success: true,
      ir: {
        version: '1.0',
        resources: [],
        variables: [],
        outputs: [],
        modules: [],
      },
      errors: [],
      warnings: [],
    }),
    validate: (source: string): ValidationResult => ({
      valid: true,
      errors: [],
    }),
  });

  // Mock generator plugin
  const createMockGenerator = (languageName: string): GeneratorPlugin => ({
    languageName,
    fileExtension: '.yaml',
    generate: (ir: IRDocument, context: GenerateContext): GenerateResult => ({
      success: true,
      output: 'generated code',
      errors: [],
      warnings: [],
      unsupportedFeatures: [],
    }),
    format: (output: string): string => output,
  });

  describe('Parser Registration', () => {
    it('should register a valid parser plugin', () => {
      const parser = createMockParser('terraform');
      registry.registerParser(parser);

      expect(registry.hasParser('terraform')).toBe(true);
      expect(registry.getParser('terraform')).toBe(parser);
    });

    it('should register parser with case-insensitive language name', () => {
      const parser = createMockParser('Terraform');
      registry.registerParser(parser);

      expect(registry.hasParser('terraform')).toBe(true);
      expect(registry.hasParser('TERRAFORM')).toBe(true);
      expect(registry.getParser('terraform')).toBe(parser);
    });

    it('should replace existing parser when registering same language', () => {
      const parser1 = createMockParser('terraform');
      const parser2 = createMockParser('terraform');

      registry.registerParser(parser1);
      registry.registerParser(parser2);

      expect(registry.getParser('terraform')).toBe(parser2);
    });

    it('should throw error for parser without languageName', () => {
      const invalidParser = {
        fileExtensions: ['.tf'],
        parse: () => ({} as ParseResult),
        validate: () => ({} as ValidationResult),
      } as any;

      expect(() => registry.registerParser(invalidParser)).toThrow(
        PluginValidationError
      );
    });

    it('should throw error for parser without fileExtensions', () => {
      const invalidParser = {
        languageName: 'terraform',
        parse: () => ({} as ParseResult),
        validate: () => ({} as ValidationResult),
      } as any;

      expect(() => registry.registerParser(invalidParser)).toThrow(
        PluginValidationError
      );
    });

    it('should throw error for parser with empty fileExtensions', () => {
      const invalidParser = {
        languageName: 'terraform',
        fileExtensions: [],
        parse: () => ({} as ParseResult),
        validate: () => ({} as ValidationResult),
      } as any;

      expect(() => registry.registerParser(invalidParser)).toThrow(
        PluginValidationError
      );
    });

    it('should throw error for parser without parse method', () => {
      const invalidParser = {
        languageName: 'terraform',
        fileExtensions: ['.tf'],
        validate: () => ({} as ValidationResult),
      } as any;

      expect(() => registry.registerParser(invalidParser)).toThrow(
        PluginValidationError
      );
    });

    it('should throw error for parser without validate method', () => {
      const invalidParser = {
        languageName: 'terraform',
        fileExtensions: ['.tf'],
        parse: () => ({} as ParseResult),
      } as any;

      expect(() => registry.registerParser(invalidParser)).toThrow(
        PluginValidationError
      );
    });
  });

  describe('Generator Registration', () => {
    it('should register a valid generator plugin', () => {
      const generator = createMockGenerator('cloudformation');
      registry.registerGenerator(generator);

      expect(registry.hasGenerator('cloudformation')).toBe(true);
      expect(registry.getGenerator('cloudformation')).toBe(generator);
    });

    it('should register generator with case-insensitive language name', () => {
      const generator = createMockGenerator('CloudFormation');
      registry.registerGenerator(generator);

      expect(registry.hasGenerator('cloudformation')).toBe(true);
      expect(registry.hasGenerator('CLOUDFORMATION')).toBe(true);
      expect(registry.getGenerator('cloudformation')).toBe(generator);
    });

    it('should replace existing generator when registering same language', () => {
      const generator1 = createMockGenerator('cloudformation');
      const generator2 = createMockGenerator('cloudformation');

      registry.registerGenerator(generator1);
      registry.registerGenerator(generator2);

      expect(registry.getGenerator('cloudformation')).toBe(generator2);
    });

    it('should throw error for generator without languageName', () => {
      const invalidGenerator = {
        fileExtension: '.yaml',
        generate: () => ({} as GenerateResult),
        format: () => '',
      } as any;

      expect(() => registry.registerGenerator(invalidGenerator)).toThrow(
        PluginValidationError
      );
    });

    it('should throw error for generator without fileExtension', () => {
      const invalidGenerator = {
        languageName: 'cloudformation',
        generate: () => ({} as GenerateResult),
        format: () => '',
      } as any;

      expect(() => registry.registerGenerator(invalidGenerator)).toThrow(
        PluginValidationError
      );
    });

    it('should throw error for generator without generate method', () => {
      const invalidGenerator = {
        languageName: 'cloudformation',
        fileExtension: '.yaml',
        format: () => '',
      } as any;

      expect(() => registry.registerGenerator(invalidGenerator)).toThrow(
        PluginValidationError
      );
    });

    it('should throw error for generator without format method', () => {
      const invalidGenerator = {
        languageName: 'cloudformation',
        fileExtension: '.yaml',
        generate: () => ({} as GenerateResult),
      } as any;

      expect(() => registry.registerGenerator(invalidGenerator)).toThrow(
        PluginValidationError
      );
    });
  });

  describe('Plugin Registration (Generic)', () => {
    it('should register parser via registerPlugin', () => {
      const parser = createMockParser('terraform');
      registry.registerPlugin(parser);

      expect(registry.hasParser('terraform')).toBe(true);
    });

    it('should register generator via registerPlugin', () => {
      const generator = createMockGenerator('cloudformation');
      registry.registerPlugin(generator);

      expect(registry.hasGenerator('cloudformation')).toBe(true);
    });

    it('should throw error for invalid plugin type', () => {
      const invalidPlugin = {
        languageName: 'invalid',
      } as any;

      expect(() => registry.registerPlugin(invalidPlugin)).toThrow(
        PluginValidationError
      );
    });
  });

  describe('Plugin Retrieval', () => {
    it('should return undefined for non-existent parser', () => {
      expect(registry.getParser('nonexistent')).toBeUndefined();
    });

    it('should return undefined for non-existent generator', () => {
      expect(registry.getGenerator('nonexistent')).toBeUndefined();
    });

    it('should return false for non-existent parser check', () => {
      expect(registry.hasParser('nonexistent')).toBe(false);
    });

    it('should return false for non-existent generator check', () => {
      expect(registry.hasGenerator('nonexistent')).toBe(false);
    });
  });

  describe('Language Listing', () => {
    it('should list all registered parser languages', () => {
      registry.registerParser(createMockParser('terraform'));
      registry.registerParser(createMockParser('pulumi'));

      const languages = registry.getParserLanguages();
      expect(languages).toContain('terraform');
      expect(languages).toContain('pulumi');
      expect(languages).toHaveLength(2);
    });

    it('should list all registered generator languages', () => {
      registry.registerGenerator(createMockGenerator('cloudformation'));
      registry.registerGenerator(createMockGenerator('terraform'));

      const languages = registry.getGeneratorLanguages();
      expect(languages).toContain('cloudformation');
      expect(languages).toContain('terraform');
      expect(languages).toHaveLength(2);
    });

    it('should return empty array when no parsers registered', () => {
      expect(registry.getParserLanguages()).toEqual([]);
    });

    it('should return empty array when no generators registered', () => {
      expect(registry.getGeneratorLanguages()).toEqual([]);
    });
  });

  describe('Clear', () => {
    it('should clear all registered plugins', () => {
      registry.registerParser(createMockParser('terraform'));
      registry.registerGenerator(createMockGenerator('cloudformation'));

      registry.clear();

      expect(registry.getParserLanguages()).toHaveLength(0);
      expect(registry.getGeneratorLanguages()).toHaveLength(0);
    });
  });
});
