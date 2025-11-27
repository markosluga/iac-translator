# IAC Translator

A pluggable system for translating infrastructure configurations between different Infrastructure as Code (IaC) languages.

## Overview

The IAC Translator enables developers to convert their infrastructure definitions across platforms like CloudFormation, Terraform, Pulumi, AWS CDK, Bicep, and Kubernetes YAML. The architecture is designed to be extensible, allowing community contributors to add support for additional IaC languages through a well-defined plugin interface.

## Features

- **Multi-language support**: Translate between different IaC languages
- **Pluggable architecture**: Easy to add new language support
- **Semantic preservation**: Maintains infrastructure meaning across translations
- **Validation**: Catch errors before translation
- **CLI tool**: Command-line interface for easy usage

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

## Project Structure

```
iac-translator/
├── src/
│   ├── core/           # Translation engine, IR definitions
│   ├── plugins/        # Built-in language plugins
│   ├── cli/            # Command-line interface
│   └── utils/          # Shared utilities
├── tests/              # Test files
└── dist/               # Compiled output
```

## License

MIT
