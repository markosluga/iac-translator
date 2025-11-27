/**
 * Terraform Parser Plugin
 * Converts Terraform HCL syntax to Abstract IR
 */

import {
  ParserPlugin,
  ParseContext,
  ParseResult,
  ValidationResult,
  ParseError,
} from '../core/plugin';
import {
  IRDocument,
  IRResource,
  IRVariable,
  IROutput,
  IRModule,
  IRExpression,
  IRValue,
} from '../core/ir';

/**
 * Simplified Terraform/HCL parser
 * Note: This is a minimal implementation for demonstration.
 * A production parser would use a proper HCL parsing library.
 */
export class TerraformParser implements ParserPlugin {
  languageName = 'terraform';
  fileExtensions = ['.tf', '.tfvars'];

  parse(source: string, context: ParseContext): ParseResult {
    const errors: ParseError[] = [];
    const warnings: ParseError[] = [];

    try {
      // Basic validation
      const validationResult = this.validate(source);
      if (!validationResult.valid) {
        return {
          success: false,
          errors: validationResult.errors.map((e) => ({
            message: e.message,
            location: e.location,
            severity: 'error' as const,
          })),
          warnings: [],
        };
      }

      const ir: IRDocument = {
        version: '1.0',
        resources: [],
        variables: [],
        outputs: [],
        modules: [],
      };

      // Parse resources
      const resourceMatches = this.findBlocks(source, 'resource');
      for (const match of resourceMatches) {
        try {
          const resource = this.parseResource(match);
          ir.resources.push(resource);
        } catch (error) {
          errors.push({
            message: `Failed to parse resource: ${error instanceof Error ? error.message : 'Unknown error'}`,
            location: { line: match.line, column: 1 },
            severity: 'error',
          });
        }
      }

      // Parse variables
      const variableMatches = this.findBlocks(source, 'variable');
      for (const match of variableMatches) {
        try {
          const variable = this.parseVariable(match);
          ir.variables.push(variable);
        } catch (error) {
          errors.push({
            message: `Failed to parse variable: ${error instanceof Error ? error.message : 'Unknown error'}`,
            location: { line: match.line, column: 1 },
            severity: 'error',
          });
        }
      }

      // Parse outputs
      const outputMatches = this.findBlocks(source, 'output');
      for (const match of outputMatches) {
        try {
          const output = this.parseOutput(match);
          ir.outputs.push(output);
        } catch (error) {
          errors.push({
            message: `Failed to parse output: ${error instanceof Error ? error.message : 'Unknown error'}`,
            location: { line: match.line, column: 1 },
            severity: 'error',
          });
        }
      }

      // Parse modules
      const moduleMatches = this.findBlocks(source, 'module');
      for (const match of moduleMatches) {
        try {
          const module = this.parseModule(match);
          ir.modules.push(module);
        } catch (error) {
          errors.push({
            message: `Failed to parse module: ${error instanceof Error ? error.message : 'Unknown error'}`,
            location: { line: match.line, column: 1 },
            severity: 'error',
          });
        }
      }

      if (errors.length > 0) {
        return {
          success: false,
          errors,
          warnings,
        };
      }

      return {
        success: true,
        ir,
        errors: [],
        warnings,
      };
    } catch (error) {
      return {
        success: false,
        errors: [
          {
            message: `Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            severity: 'error',
          },
        ],
        warnings: [],
      };
    }
  }

  validate(source: string): ValidationResult {
    const errors: Array<{ message: string; location?: { line: number; column: number } }> = [];

    // Basic syntax validation
    if (!source || source.trim().length === 0) {
      return { valid: true, errors: [] }; // Empty file is valid
    }

    // Check for balanced braces
    const openBraces = (source.match(/{/g) || []).length;
    const closeBraces = (source.match(/}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push({
        message: 'Unbalanced braces in configuration',
        location: { line: 1, column: 1 },
      });
    }

    // Check for basic block structure
    const blockPattern = /(resource|variable|output|module|data|locals|terraform)\s+/g;
    const hasBlocks = blockPattern.test(source);
    
    if (!hasBlocks && source.trim().length > 0) {
      // Check if it's just comments
      const withoutComments = source.replace(/#[^\n]*/g, '').replace(/\/\/[^\n]*/g, '').trim();
      if (withoutComments.length > 0) {
        errors.push({
          message: 'No valid Terraform blocks found',
          location: { line: 1, column: 1 },
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Find all blocks of a given type in the source
   */
  private findBlocks(
    source: string,
    blockType: string
  ): Array<{ content: string; line: number; name: string; type?: string }> {
    const blocks: Array<{ content: string; line: number; name: string; type?: string }> = [];
    const lines = source.split('\n');
    
    let currentLine = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      currentLine = i + 1;

      // Match block declarations
      let regex: RegExp;
      if (blockType === 'resource') {
        regex = /^resource\s+"([^"]+)"\s+"([^"]+)"\s*{/;
      } else {
        regex = new RegExp(`^${blockType}\\s+"([^"]+)"\\s*{`);
      }

      const match = line.match(regex);
      if (match) {
        const resourceType = blockType === 'resource' ? match[1] : undefined;
        const name = blockType === 'resource' ? match[2] : match[1];
        
        // Find the closing brace
        let braceCount = 1;
        let blockContent = '';
        let j = i;
        
        // Get the rest of the first line after the opening brace
        const firstLineRest = line.substring(line.indexOf('{') + 1);
        blockContent += firstLineRest + '\n';
        
        j++;
        while (j < lines.length && braceCount > 0) {
          const currentLine = lines[j];
          blockContent += currentLine + '\n';
          
          for (const char of currentLine) {
            if (char === '{') braceCount++;
            if (char === '}') braceCount--;
          }
          j++;
        }

        blocks.push({
          content: blockContent.trim(),
          line: currentLine,
          name,
          type: resourceType,
        });
      }
    }

    return blocks;
  }

  /**
   * Parse a resource block
   */
  private parseResource(block: { content: string; line: number; name: string; type?: string }): IRResource {
    const properties = this.parseProperties(block.content);
    const dependsOn = this.extractDependsOn(properties);

    return {
      type: 'resource',
      resourceType: block.type || 'unknown',
      name: block.name,
      properties,
      dependsOn,
      metadata: {
        sourceLocation: { line: block.line, column: 1 },
      },
    };
  }

  /**
   * Parse a variable block
   */
  private parseVariable(block: { content: string; line: number; name: string }): IRVariable {
    const properties = this.parseProperties(block.content);
    
    return {
      type: 'variable',
      name: block.name,
      valueType: (properties.type as string) || 'string',
      defaultValue: properties.default,
      description: properties.description as string,
      metadata: {
        sourceLocation: { line: block.line, column: 1 },
      },
    };
  }

  /**
   * Parse an output block
   */
  private parseOutput(block: { content: string; line: number; name: string }): IROutput {
    const properties = this.parseProperties(block.content);
    
    return {
      type: 'output',
      name: block.name,
      value: this.parseExpression(properties.value),
      description: properties.description as string,
      metadata: {
        sourceLocation: { line: block.line, column: 1 },
      },
    };
  }

  /**
   * Parse a module block
   */
  private parseModule(block: { content: string; line: number; name: string }): IRModule {
    const properties = this.parseProperties(block.content);
    const source = properties.source as string;
    delete properties.source;

    return {
      type: 'module',
      name: block.name,
      source: source || '',
      inputs: properties,
      metadata: {
        sourceLocation: { line: block.line, column: 1 },
      },
    };
  }

  /**
   * Parse properties from block content
   */
  private parseProperties(content: string): Record<string, IRValue> {
    const properties: Record<string, IRValue> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
        continue;
      }

      // Simple key = value parsing
      const match = trimmed.match(/^(\w+)\s*=\s*(.+?)$/);
      if (match) {
        const key = match[1];
        const value = match[2].trim();
        properties[key] = this.parseValue(value);
      }
    }

    return properties;
  }

  /**
   * Parse a value (string, number, boolean, etc.)
   */
  private parseValue(value: string): IRValue {
    // Remove trailing comments
    value = value.replace(/#.*$/, '').replace(/\/\/.*$/, '').trim();

    // String
    if (value.startsWith('"') && value.endsWith('"')) {
      return value.slice(1, -1);
    }

    // Number
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return parseFloat(value);
    }

    // Boolean
    if (value === 'true') return true;
    if (value === 'false') return false;

    // List
    if (value.startsWith('[') && value.endsWith(']')) {
      const items = value.slice(1, -1).split(',').map((item) => {
        const trimmed = item.trim();
        // Remove quotes from list items
        if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
          return trimmed.slice(1, -1);
        }
        return this.parseValue(trimmed);
      });
      return items;
    }

    // Reference or expression (unquoted identifiers)
    return this.parseExpression(value);
  }

  /**
   * Parse an expression
   */
  private parseExpression(value: any): IRExpression {
    if (typeof value === 'string') {
      // Check if it's a reference (e.g., var.name, aws_s3_bucket.my_bucket.arn)
      if (value.includes('.') || value.startsWith('var.') || value.startsWith('local.')) {
        return {
          exprType: 'reference',
          value,
        };
      }

      // Check if it's a function call
      if (value.includes('(') && value.includes(')')) {
        return {
          exprType: 'function',
          value,
        };
      }
    }

    // Literal value
    return {
      exprType: 'literal',
      value,
    };
  }

  /**
   * Extract depends_on from properties
   */
  private extractDependsOn(properties: Record<string, IRValue>): string[] {
    const dependsOn = properties.depends_on;
    if (Array.isArray(dependsOn)) {
      delete properties.depends_on;
      return dependsOn.map((dep) => String(dep));
    }
    return [];
  }
}
