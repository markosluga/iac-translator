import { describe, it, expect, beforeEach } from 'vitest';
import { TranslationEngine, TranslationOptions } from './engine';
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

describe('TranslationEngine', () => {
  let engine: TranslationEngine;

  beforeEach(() => {
    engine = new TranslationEngine();
  });

  // Mock parser that succeeds
  const createSuccessParser = (languageName: string): ParserPlugin => ({
    languageName,
    fileExtensions: ['.tf'],
    parse: (source: string, context: ParseContext): ParseResult => ({
      success: true,
      ir: {
        version: '1.0',
        resources: [
          {
            type: 'resource',
            resourceType: 'aws_s3_bucket',
            name: 'test-bucket',
            properties: { bucket: 'my-bucket' },
            dependsOn: [],
            metadata: {},
          },
        ],
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

  // Mock parser that fails
  const createFailParser = (languageName: string): ParserPlugin => ({
    languageName,
    fileExtensions: ['.tf'],
    parse: (source: string, context: ParseContext): ParseResult => ({
      success: false,
      errors: [
        {
          message: 'Syntax error',
          location: { line: 1, column: 1 },
          severity: 'error',
        },
      ],
      warnings: [],
    }),
    validate: (source: string): ValidationResult => ({
      valid: false,
      errors: [{ message: 'Validation failed', location: { line: 1, column: 1 } }],
    }),
  });

  // Mock parser with warnings
  const createWarningParser = (languageName: string): ParserPlugin => ({
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
      warnings: [
        {
          message: 'Deprecated syntax',
          location: { line: 5, column: 10 },
          severity: 'warning',
        },
      ],
    }),
    validate: (source: string): ValidationResult => ({
      valid: true,
      errors: [],
    }),
  });

  // Mock generator that succeeds
  const createSuccessGenerator = (languageName: string): GeneratorPlugin => ({
    languageName,
    fileExtension: '.yaml',
    generate: (ir: IRDocument, context: GenerateContext): GenerateResult => ({
      success: true,
      output: 'Resources:\n  TestBucket:\n    Type: AWS::S3::Bucket',
      errors: [],
      warnings: [],
      unsupportedFeatures: [],
    }),
    format: (output: string): string => output.trim(),
  });

  // Mock generator that fails
  const createFailGenerator = (languageName: string): GeneratorPlugin => ({
    languageName,
    fileExtension: '.yaml',
    generate: (ir: IRDocument, context: GenerateContext): GenerateResult => ({
      success: false,
      errors: [{ message: 'Generation failed', severity: 'error' }],
      warnings: [],
      unsupportedFeatures: [],
    }),
    format: (output: string): string => output,
  });

  // Mock generator with unsupported features
  const createUnsupportedGenerator = (languageName: string): GeneratorPlugin => ({
    languageName,
    fileExtension: '.yaml',
    generate: (ir: IRDocument, context: GenerateContext): GenerateResult => ({
      success: true,
      output: 'Resources:\n  TestBucket:\n    Type: AWS::S3::Bucket',
      errors: [],
      warnings: [],
      unsupportedFeatures: [
        {
          feature: 'dynamic blocks',
          description: 'Dynamic blocks are not supported in CloudFormation',
          location: { line: 10, column: 5 },
        },
      ],
    }),
    format: (output: string): string => output,
  });

  describe('Plugin Registration', () => {
    it('should register parser plugin', () => {
      const parser = createSuccessParser('terraform');
      engine.registerParser(parser);

      const languages = engine.getSupportedLanguages();
      expect(languages.some((l) => l.name === 'terraform' && l.canParse)).toBe(true);
    });

    it('should register generator plugin', () => {
      const generator = createSuccessGenerator('cloudformation');
      engine.registerGenerator(generator);

      const languages = engine.getSupportedLanguages();
      expect(languages.some((l) => l.name === 'cloudformation' && l.canGenerate)).toBe(
        true
      );
    });
  });

  describe('Translation', () => {
    it('should successfully translate between languages', () => {
      engine.registerParser(createSuccessParser('terraform'));
      engine.registerGenerator(createSuccessGenerator('cloudformation'));

      const result = engine.translate(
        'resource "aws_s3_bucket" "test" {}',
        'terraform',
        'cloudformation'
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.ir).toBeDefined();
      expect(result.errors).toHaveLength(0);
    });

    it('should fail when parser not found', () => {
      engine.registerGenerator(createSuccessGenerator('cloudformation'));

      const result = engine.translate('source', 'nonexistent', 'cloudformation');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('No parser found');
    });

    it('should fail when generator not found', () => {
      engine.registerParser(createSuccessParser('terraform'));

      const result = engine.translate('source', 'terraform', 'nonexistent');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('No generator found');
    });

    it('should fail when parsing fails', () => {
      engine.registerParser(createFailParser('terraform'));
      engine.registerGenerator(createSuccessGenerator('cloudformation'));

      const result = engine.translate('invalid source', 'terraform', 'cloudformation');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].phase).toBe('parse');
    });

    it('should fail when generation fails', () => {
      engine.registerParser(createSuccessParser('terraform'));
      engine.registerGenerator(createFailGenerator('cloudformation'));

      const result = engine.translate('source', 'terraform', 'cloudformation');

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].phase).toBe('generate');
    });

    it('should collect parse warnings', () => {
      engine.registerParser(createWarningParser('terraform'));
      engine.registerGenerator(createSuccessGenerator('cloudformation'));

      const result = engine.translate('source', 'terraform', 'cloudformation');

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].phase).toBe('parse');
    });

    it('should collect unsupported feature warnings', () => {
      engine.registerParser(createSuccessParser('terraform'));
      engine.registerGenerator(createUnsupportedGenerator('cloudformation'));

      const result = engine.translate('source', 'terraform', 'cloudformation');

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some((w) => w.message.includes('Unsupported feature'))).toBe(
        true
      );
    });

    it('should format output when requested', () => {
      engine.registerParser(createSuccessParser('terraform'));
      engine.registerGenerator(createSuccessGenerator('cloudformation'));

      const result = engine.translate('source', 'terraform', 'cloudformation', {
        formatOutput: true,
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      // The mock formatter trims the output
      expect(result.output).not.toMatch(/^\s+|\s+$/);
    });

    it('should validate before translation when requested', () => {
      engine.registerParser(createFailParser('terraform'));
      engine.registerGenerator(createSuccessGenerator('cloudformation'));

      const result = engine.translate('invalid', 'terraform', 'cloudformation', {
        validateBefore: true,
      });

      expect(result.success).toBe(false);
      expect(result.errors[0].phase).toBe('validate');
    });

    it('should pass parse options to parser', () => {
      let capturedOptions: any;
      const parser: ParserPlugin = {
        languageName: 'terraform',
        fileExtensions: ['.tf'],
        parse: (source: string, context: ParseContext): ParseResult => {
          capturedOptions = context.options;
          return {
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
          };
        },
        validate: () => ({ valid: true, errors: [] }),
      };

      engine.registerParser(parser);
      engine.registerGenerator(createSuccessGenerator('cloudformation'));

      engine.translate('source', 'terraform', 'cloudformation', {
        parseOptions: { customOption: 'value' },
      });

      expect(capturedOptions).toEqual({ customOption: 'value' });
    });

    it('should pass generate options to generator', () => {
      let capturedOptions: any;
      const generator: GeneratorPlugin = {
        languageName: 'cloudformation',
        fileExtension: '.yaml',
        generate: (ir: IRDocument, context: GenerateContext): GenerateResult => {
          capturedOptions = context.options;
          return {
            success: true,
            output: 'output',
            errors: [],
            warnings: [],
            unsupportedFeatures: [],
          };
        },
        format: (output: string) => output,
      };

      engine.registerParser(createSuccessParser('terraform'));
      engine.registerGenerator(generator);

      engine.translate('source', 'terraform', 'cloudformation', {
        generateOptions: { targetVersion: '2.0' },
      });

      expect(capturedOptions).toEqual({ targetVersion: '2.0' });
    });
  });

  describe('Validation', () => {
    it('should validate source code', () => {
      engine.registerParser(createSuccessParser('terraform'));

      const result = engine.validate('valid source', 'terraform');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return validation errors', () => {
      engine.registerParser(createFailParser('terraform'));

      const result = engine.validate('invalid source', 'terraform');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should fail when parser not found', () => {
      const result = engine.validate('source', 'nonexistent');

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('No parser found');
    });
  });

  describe('Language Support', () => {
    it('should return empty list when no plugins registered', () => {
      const languages = engine.getSupportedLanguages();
      expect(languages).toHaveLength(0);
    });

    it('should list languages with parser only', () => {
      engine.registerParser(createSuccessParser('terraform'));

      const languages = engine.getSupportedLanguages();
      expect(languages).toHaveLength(1);
      expect(languages[0].name).toBe('terraform');
      expect(languages[0].canParse).toBe(true);
      expect(languages[0].canGenerate).toBe(false);
    });

    it('should list languages with generator only', () => {
      engine.registerGenerator(createSuccessGenerator('cloudformation'));

      const languages = engine.getSupportedLanguages();
      expect(languages).toHaveLength(1);
      expect(languages[0].name).toBe('cloudformation');
      expect(languages[0].canParse).toBe(false);
      expect(languages[0].canGenerate).toBe(true);
    });

    it('should list languages with both parser and generator', () => {
      engine.registerParser(createSuccessParser('terraform'));
      engine.registerGenerator(createSuccessGenerator('terraform'));

      const languages = engine.getSupportedLanguages();
      expect(languages).toHaveLength(1);
      expect(languages[0].name).toBe('terraform');
      expect(languages[0].canParse).toBe(true);
      expect(languages[0].canGenerate).toBe(true);
    });

    it('should include file extensions', () => {
      engine.registerParser(createSuccessParser('terraform'));
      engine.registerGenerator(createSuccessGenerator('cloudformation'));

      const languages = engine.getSupportedLanguages();
      const terraform = languages.find((l) => l.name === 'terraform');
      const cloudformation = languages.find((l) => l.name === 'cloudformation');

      expect(terraform?.fileExtensions).toEqual(['.tf']);
      expect(cloudformation?.fileExtension).toBe('.yaml');
    });
  });

  describe('Translation Support Check', () => {
    it('should return true when translation is supported', () => {
      engine.registerParser(createSuccessParser('terraform'));
      engine.registerGenerator(createSuccessGenerator('cloudformation'));

      expect(engine.canTranslate('terraform', 'cloudformation')).toBe(true);
    });

    it('should return false when parser missing', () => {
      engine.registerGenerator(createSuccessGenerator('cloudformation'));

      expect(engine.canTranslate('terraform', 'cloudformation')).toBe(false);
    });

    it('should return false when generator missing', () => {
      engine.registerParser(createSuccessParser('terraform'));

      expect(engine.canTranslate('terraform', 'cloudformation')).toBe(false);
    });

    it('should return false when both missing', () => {
      expect(engine.canTranslate('terraform', 'cloudformation')).toBe(false);
    });
  });
});
