# Design Document

## Overview

The IAC Translator is built around a three-stage pipeline architecture: Parse → Transform → Generate. Each IaC language is supported through a plugin that implements parser and generator interfaces. The system uses an Abstract Intermediate Representation (IR) to decouple source and target languages, enabling N languages to be supported with 2N plugins (one parser, one generator per language) rather than N² direct translators.

The core design principles are:
- **Extensibility**: New languages can be added without modifying core code
- **Separation of Concerns**: Parsing, IR, and generation are independent layers
- **Semantic Preservation**: The IR captures infrastructure semantics, not syntax
- **Testability**: Round-trip testing validates parser/generator correctness

## Architecture

### High-Level Architecture

```
┌─────────────┐
│   CLI/API   │
└──────┬──────┘
       │
┌──────▼──────────────────────────────────────┐
│       Translation Engine                     │
│  - Plugin Registry                           │
│  - Translation Orchestration                 │
│  - Error Handling                            │
└──────┬──────────────────────────────────────┘
       │
       ├─────────────┬─────────────┬──────────────┐
       │             │             │              │
┌──────▼──────┐ ┌───▼────┐ ┌──────▼──────┐ ┌────▼─────┐
│   Parser    │ │   IR   │ │  Generator  │ │ Validator│
│   Plugin    │ │        │ │   Plugin    │ │          │
└─────────────┘ └────────┘ └─────────────┘ └──────────┘
```

### Component Interaction Flow

```
Source File → Parser Plugin → Abstract IR → Generator Plugin → Target File
                    ↓                              ↑
                Validator ←────────────────────────┘
```

## Components and Interfaces

### 1. Abstract IR (Intermediate Representation)

The IR represents infrastructure concepts in a language-agnostic format. It uses a tree structure with typed nodes.

**Core IR Node Types:**

```typescript
interface IRNode {
  type: string;
  metadata: NodeMetadata;
}

interface NodeMetadata {
  sourceLocation?: SourceLocation;
  comments?: string[];
  annotations?: Record<string, any>;
}

interface IRResource extends IRNode {
  type: 'resource';
  resourceType: string;  // e.g., "aws_s3_bucket", "VM"
  name: string;
  properties: Record<string, IRValue>;
  dependsOn: string[];
}

interface IRVariable extends IRNode {
  type: 'variable';
  name: string;
  valueType: string;
  defaultValue?: IRValue;
  description?: string;
}

interface IROutput extends IRNode {
  type: 'output';
  name: string;
  value: IRExpression;
  description?: string;
}

interface IRModule extends IRNode {
  type: 'module';
  name: string;
  source: string;
  inputs: Record<string, IRValue>;
}

interface IRConditional extends IRNode {
  type: 'conditional';
  condition: IRExpression;
  thenBranch: IRNode[];
  elseBranch?: IRNode[];
}

interface IRLoop extends IRNode {
  type: 'loop';
  iterator: string;
  collection: IRExpression;
  body: IRNode[];
}

type IRValue = string | number | boolean | IRExpression | IRValue[] | Record<string, IRValue>;

interface IRExpression {
  exprType: 'function' | 'reference' | 'literal';
  value: any;
}

interface IRDocument {
  version: string;
  resources: IRResource[];
  variables: IRVariable[];
  outputs: IROutput[];
  modules: IRModule[];
}
```

### 2. Parser Plugin Interface

Each parser plugin converts a source language into Abstract IR.

```typescript
interface ParserPlugin {
  languageName: string;
  fileExtensions: string[];
  
  parse(source: string, context: ParseContext): ParseResult;
  validate(source: string): ValidationResult;
}

interface ParseContext {
  filePath?: string;
  options: Record<string, any>;
}

interface ParseResult {
  success: boolean;
  ir?: IRDocument;
  errors: ParseError[];
  warnings: ParseWarning[];
}

interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
```

### 3. Generator Plugin Interface

Each generator plugin converts Abstract IR into a target language.

```typescript
interface GeneratorPlugin {
  languageName: string;
  fileExtension: string;
  
  generate(ir: IRDocument, context: GenerateContext): GenerateResult;
  format(output: string): string;
}

interface GenerateContext {
  options: Record<string, any>;
  targetVersion?: string;
}

interface GenerateResult {
  success: boolean;
  output?: string;
  errors: GenerateError[];
  warnings: GenerateWarning[];
  unsupportedFeatures: UnsupportedFeature[];
}
```

### 4. Translation Engine

The core orchestrator that manages plugins and coordinates translation.

```typescript
class TranslationEngine {
  private parsers: Map<string, ParserPlugin>;
  private generators: Map<string, GeneratorPlugin>;
  
  registerParser(plugin: ParserPlugin): void;
  registerGenerator(plugin: GeneratorPlugin): void;
  
  translate(
    source: string,
    sourceLanguage: string,
    targetLanguage: string,
    options?: TranslationOptions
  ): TranslationResult;
  
  validate(source: string, language: string): ValidationResult;
  
  getSupportedLanguages(): LanguageInfo[];
}

interface TranslationOptions {
  validateBefore?: boolean;
  validateAfter?: boolean;
  preserveComments?: boolean;
  formatOutput?: boolean;
}

interface TranslationResult {
  success: boolean;
  output?: string;
  ir?: IRDocument;
  errors: TranslationError[];
  warnings: TranslationWarning[];
}
```

### 5. Plugin Registry

Manages plugin discovery and loading.

```typescript
class PluginRegistry {
  loadPlugin(pluginPath: string): Plugin;
  discoverPlugins(directory: string): Plugin[];
  validatePlugin(plugin: Plugin): boolean;
}
```

### 6. Validator

Validates configurations and IR.

```typescript
class Validator {
  validateSyntax(source: string, language: string): ValidationResult;
  validateSemantics(ir: IRDocument): ValidationResult;
  validateRoundTrip(original: string, roundTripped: string, language: string): boolean;
}
```

## Data Models

### Resource Mapping

The system maintains mappings between resource types across languages:

```typescript
interface ResourceTypeMapping {
  sourceType: string;
  targetType: string;
  propertyMappings: PropertyMapping[];
  transformations: Transformation[];
}

interface PropertyMapping {
  sourcePath: string;
  targetPath: string;
  valueTransform?: (value: any) => any;
}
```

### Error Types

```typescript
interface ParseError {
  message: string;
  location: SourceLocation;
  severity: 'error' | 'warning';
}

interface SourceLocation {
  line: number;
  column: number;
  file?: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Translation produces valid output
*For any* valid source configuration in a supported language, translating it to any supported target language should produce syntactically valid output in the target language.
**Validates: Requirements 1.1, 6.1, 6.3**

### Property 2: Semantic preservation
*For any* valid source configuration, after translation all resource definitions, properties, dependencies, variables, outputs, and their relationships should be preserved in the target language with equivalent semantics.
**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

### Property 3: Round-trip consistency
*For any* valid configuration in a supported language, parsing it to IR and then generating it back to the same language should produce semantically equivalent output (allowing for stylistic differences).
**Validates: Requirements 7.1**

### Property 4: Plugin registration
*For any* valid parser or generator plugin, registering it should make it available for use, and the most recently registered plugin for a language should be the active one.
**Validates: Requirements 2.1, 2.2, 2.4**

### Property 5: Plugin validation
*For any* plugin that is missing required interface methods, registration should fail with a clear validation error.
**Validates: Requirements 2.3**

### Property 6: Configuration propagation
*For any* plugin with configuration requirements, the configuration parameters should be accessible through the plugin interface during parsing or generation.
**Validates: Requirements 2.5**

### Property 7: Validation detects errors
*For any* configuration with syntax or semantic errors, validation should detect and report the errors with location information.
**Validates: Requirements 4.1, 4.2, 4.3**

### Property 8: Validation-only mode
*For any* configuration, when validation-only mode is requested, the system should validate without producing translation output.
**Validates: Requirements 4.5**

### Property 9: Pattern preservation
*For any* configuration containing conditionals, loops, modules, or function calls, translation should preserve these patterns with equivalent constructs in the target language.
**Validates: Requirements 5.1, 5.2, 5.3, 5.4**

### Property 10: Graceful degradation
*For any* configuration with unsupported features, translation should succeed for supported portions and document unsupported elements in comments.
**Validates: Requirements 1.3, 5.5**

### Property 11: Error reporting
*For any* translation failure, the system should provide structured error information including message, location, and cause.
**Validates: Requirements 1.4, 6.5**

### Property 12: File output
*For any* successful translation with a specified output path, the translated configuration should be written to that location.
**Validates: Requirements 1.2, 10.2**

### Property 13: Comment preservation
*For any* configuration with comments, round-tripping through IR should preserve comments in appropriate locations.
**Validates: Requirements 7.4**

### Property 14: IR node type mapping
*For any* configuration element, parsing should convert it to the corresponding Abstract IR node type.
**Validates: Requirements 6.2**

### Property 15: Backward compatibility
*For any* existing plugin, extending the Abstract IR schema should not break the plugin's functionality.
**Validates: Requirements 8.3**

### Property 16: Unknown type handling
*For any* IR node with an unknown type, parsers and generators should handle it gracefully without crashing.
**Validates: Requirements 8.4**

### Property 17: CLI translation
*For any* valid CLI invocation with source file, source language, and target language, the CLI should perform the translation.
**Validates: Requirements 10.1, 10.2**

### Property 18: CLI error handling
*For any* translation failure via CLI, the process should exit with a non-zero status code and write errors to stderr.
**Validates: Requirements 10.5**

### Property 19: Name transformation consistency
*For any* configuration with resource references, applying naming transformations during translation should preserve all reference relationships.
**Validates: Requirements 3.5**

## Error Handling

### Error Categories

1. **Parse Errors**: Syntax errors in source configuration
   - Invalid syntax
   - Malformed structures
   - Unsupported language features

2. **Validation Errors**: Semantic errors in configuration
   - Invalid resource types
   - Missing required properties
   - Type mismatches

3. **Translation Errors**: Errors during IR transformation
   - Unmappable constructs
   - Incompatible language features
   - Resource type not supported in target

4. **Generation Errors**: Errors producing target output
   - IR node type not supported
   - Invalid property values
   - Template rendering failures

5. **Plugin Errors**: Errors in plugin system
   - Plugin not found
   - Invalid plugin interface
   - Plugin execution failure

### Error Handling Strategy

- All errors include structured information: message, location, severity
- Errors are collected and reported together when possible
- Warnings allow translation to continue with caveats
- Fatal errors stop translation immediately
- Partial results are preserved when possible for debugging

### Error Recovery

- Parser errors: attempt to continue parsing to find multiple errors
- Validation errors: report all validation issues before stopping
- Translation errors: translate what's possible, document what's not
- Generation errors: produce partial output with error comments

## Testing Strategy

### Unit Testing

Unit tests will verify specific behaviors and edge cases:

- Parser plugins correctly handle specific syntax constructs
- Generator plugins produce expected output for specific IR nodes
- Plugin registry correctly loads and validates plugins
- Error handling produces appropriate error messages
- CLI argument parsing and help text display

### Property-Based Testing

Property-based testing will verify universal correctness properties using **fast-check** (for TypeScript/JavaScript implementation). Each property test will run a minimum of 100 iterations.

Key property tests:

1. **Round-trip property**: Parse then generate should preserve semantics
2. **Semantic preservation**: All configuration elements preserved after translation
3. **Validation consistency**: Invalid inputs always rejected, valid inputs accepted
4. **Plugin interface compliance**: All plugins implement required methods
5. **Error structure**: All errors include required fields
6. **Name transformation**: References remain valid after naming changes

Each property-based test will be tagged with a comment referencing the design document property:
```typescript
// Feature: iac-translator, Property 3: Round-trip consistency
```

### Integration Testing

- End-to-end translation between language pairs
- CLI tool with various argument combinations
- Plugin loading from filesystem
- Multi-file configuration handling

### Test Data

- Sample configurations for each supported language
- Invalid configurations for error testing
- Edge cases: empty files, large files, deeply nested structures
- Real-world examples from public IaC repositories

## Implementation Phases

### Phase 1: Core Infrastructure
- Abstract IR type definitions
- Plugin interfaces
- Translation engine skeleton
- Basic error handling

### Phase 2: First Language Pair
- Implement parser for one source language (e.g., Terraform)
- Implement generator for one target language (e.g., CloudFormation)
- Validate end-to-end translation works
- Establish testing patterns

### Phase 3: Additional Languages
- Add parsers and generators for remaining languages
- Build resource type mapping tables
- Handle language-specific edge cases

### Phase 4: Advanced Features
- Conditional translation
- Loop handling
- Module support
- Function mapping

### Phase 5: CLI and Tooling
- Command-line interface
- Configuration file support
- Batch translation
- Validation-only mode

### Phase 6: Documentation and Examples
- Plugin development guide
- API documentation
- Example plugins
- Tutorial for contributors

## Technology Choices

### Implementation Language
**TypeScript** - Provides strong typing for IR and plugin interfaces, excellent tooling, and broad ecosystem support.

### Parser Libraries
- **Terraform**: HCL parser (e.g., `hcl2-parser`)
- **CloudFormation**: YAML/JSON parser (built-in)
- **Pulumi**: Language-specific AST parsers
- **Kubernetes**: YAML parser with schema validation

### Testing Framework
- **Unit tests**: Jest or Vitest
- **Property-based tests**: fast-check
- **Integration tests**: Custom test harness

### CLI Framework
- **Commander.js** or **yargs** for argument parsing
- **chalk** for colored output
- **ora** for progress indicators

## Plugin Development Guide

### Creating a Parser Plugin

1. Implement the `ParserPlugin` interface
2. Define language name and file extensions
3. Implement `parse()` method to convert source to IR
4. Implement `validate()` method for syntax checking
5. Handle errors gracefully with structured error objects
6. Add unit tests for parser
7. Add property tests for round-trip validation

### Creating a Generator Plugin

1. Implement the `GeneratorPlugin` interface
2. Define language name and file extension
3. Implement `generate()` method to convert IR to target
4. Implement `format()` method for output formatting
5. Handle unsupported IR nodes gracefully
6. Add unit tests for generator
7. Add property tests for output validation

### Plugin Registration

Plugins can be registered programmatically or discovered from a plugins directory:

```typescript
// Programmatic registration
engine.registerParser(new TerraformParser());
engine.registerGenerator(new CloudFormationGenerator());

// Directory discovery
registry.discoverPlugins('./plugins');
```

## Open Source Considerations

### License
Recommend **MIT License** for maximum adoption and contribution.

### Repository Structure
```
iac-translator/
├── src/
│   ├── core/           # Translation engine, IR definitions
│   ├── plugins/        # Built-in language plugins
│   ├── cli/            # Command-line interface
│   └── utils/          # Shared utilities
├── tests/
│   ├── unit/
│   ├── property/
│   └── integration/
├── docs/
│   ├── plugin-guide.md
│   ├── api-reference.md
│   └── examples/
├── examples/           # Sample configurations
└── plugins/            # External plugin directory
```

### Contribution Guidelines
- Clear CONTRIBUTING.md with plugin development guide
- Issue templates for bug reports and feature requests
- Pull request template with checklist
- Code of conduct
- Automated CI/CD for testing and validation

### Community Building
- Encourage plugin contributions for new languages
- Maintain registry of community plugins
- Provide plugin scaffolding tool
- Regular releases with changelog
- Active issue triage and PR reviews
