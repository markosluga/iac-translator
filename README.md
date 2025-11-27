# IAC Translator

> ⚠️ **Work in Progress** - This project is under active development. Core functionality is working, but not all features are complete yet.

A pluggable system for translating infrastructure configurations between different Infrastructure as Code (IaC) languages.

## Overview

The IAC Translator enables developers to convert their infrastructure definitions across platforms like CloudFormation, Terraform, Pulumi, AWS CDK, Bicep, and Kubernetes YAML. The architecture is designed to be extensible, allowing community contributors to add support for additional IaC languages through a well-defined plugin interface.

## Current Status

✅ **Completed Features:**
- Core translation engine with plugin architecture
- Abstract Intermediate Representation (IR)
- Terraform parser (basic HCL support)
- CloudFormation generator (YAML output)
- Resource type mapping system
- End-to-end Terraform → CloudFormation translation
- Comprehensive test suite (140 tests passing)

🚧 **In Progress:**
- File I/O utilities
- Advanced Terraform features (conditionals, loops, modules)
- Additional language support (Pulumi, CDK)
- CLI interface
- Documentation

## Features

- **Multi-language support**: Translate between different IaC languages
- **Pluggable architecture**: Easy to add new language support through well-defined interfaces
- **Semantic preservation**: Maintains infrastructure meaning across translations
- **Validation**: Catch errors before translation with validation-only mode
- **Resource mapping**: Intelligent mapping of resource types and properties
- **Error handling**: Graceful handling of unsupported features with warnings

## Getting Started

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

### Testing

```bash
npm test
```

### Development

```bash
npm run dev
```

## Usage Example

```typescript
import { TranslationEngine } from 'iac-translator';
import { TerraformParser } from 'iac-translator/plugins/terraform-parser';
import { CloudFormationGenerator } from 'iac-translator/plugins/cloudformation-generator';

// Create engine and register plugins
const engine = new TranslationEngine();
engine.registerParser(new TerraformParser());
engine.registerGenerator(new CloudFormationGenerator());

// Translate Terraform to CloudFormation
const terraformSource = `
resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-test-bucket"
  acl = "private"
}
`;

const result = engine.translate(
  terraformSource,
  'terraform',
  'cloudformation'
);

if (result.success) {
  console.log(result.output);
} else {
  console.error(result.errors);
}
```

## Architecture

The translator uses a three-stage pipeline:

```
Source Code → Parser Plugin → Abstract IR → Generator Plugin → Target Code
```

### Core Components

- **Translation Engine**: Orchestrates the translation process
- **Plugin Registry**: Manages parser and generator plugins
- **Abstract IR**: Language-agnostic intermediate representation
- **Resource Mapper**: Maps resource types and properties between languages

### Supported Translations

| From | To | Status |
|------|-----|--------|
| Terraform | CloudFormation | ✅ Working |
| CloudFormation | Terraform | 🚧 Planned |
| Terraform | Pulumi | 🚧 Planned |
| CloudFormation | Pulumi | 🚧 Planned |

## Project Structure

```
iac-translator/
├── src/
│   ├── core/              # Core translation engine
│   │   ├── ir.ts          # Abstract IR definitions
│   │   ├── engine.ts      # Translation engine
│   │   ├── registry.ts    # Plugin registry
│   │   ├── plugin.ts      # Plugin interfaces
│   │   └── mapping.ts     # Resource type mapping
│   ├── plugins/           # Language plugins
│   │   ├── terraform-parser.ts
│   │   └── cloudformation-generator.ts
│   ├── integration/       # Integration tests
│   └── index.ts           # Main entry point
├── .kiro/specs/           # Feature specifications
└── dist/                  # Compiled output
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Adding a New Language Plugin

1. Implement the `ParserPlugin` or `GeneratorPlugin` interface
2. Define language name and file extensions
3. Implement parse/generate methods
4. Add tests for your plugin
5. Register with the translation engine

See the [design document](.kiro/specs/iac-translator/design.md) for detailed plugin development guidelines.

## Contributing

This project is under active development. Contributions are welcome! Please see the [tasks list](.kiro/specs/iac-translator/tasks.md) for current development priorities.

## Roadmap

- [ ] Complete file I/O utilities
- [ ] Support for Terraform conditionals and loops
- [ ] Module translation support
- [ ] CLI interface
- [ ] Additional language pairs (Pulumi, CDK, Bicep)
- [ ] Property-based testing for correctness
- [ ] Plugin development documentation
- [ ] Example configurations and tutorials

## License

MIT
