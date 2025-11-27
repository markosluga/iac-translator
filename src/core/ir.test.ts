import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  IRDocument,
  IRResource,
  IRVariable,
  IROutput,
  IRModule,
  IRConditional,
  IRLoop,
  IRExpression,
  IRValue,
  NodeMetadata,
  SourceLocation,
} from './ir';

describe('IR Type Definitions', () => {
  it('should create a valid IRResource', () => {
    const resource: IRResource = {
      type: 'resource',
      resourceType: 'aws_s3_bucket',
      name: 'my-bucket',
      properties: {
        bucket: 'my-bucket-name',
        acl: 'private',
      },
      dependsOn: [],
      metadata: {},
    };

    expect(resource.type).toBe('resource');
    expect(resource.resourceType).toBe('aws_s3_bucket');
    expect(resource.name).toBe('my-bucket');
  });

  it('should create a valid IRVariable', () => {
    const variable: IRVariable = {
      type: 'variable',
      name: 'region',
      valueType: 'string',
      defaultValue: 'us-east-1',
      description: 'AWS region',
      metadata: {},
    };

    expect(variable.type).toBe('variable');
    expect(variable.name).toBe('region');
    expect(variable.valueType).toBe('string');
  });

  it('should create a valid IROutput', () => {
    const output: IROutput = {
      type: 'output',
      name: 'bucket_arn',
      value: {
        exprType: 'reference',
        value: 'aws_s3_bucket.my-bucket.arn',
      },
      description: 'The ARN of the bucket',
      metadata: {},
    };

    expect(output.type).toBe('output');
    expect(output.name).toBe('bucket_arn');
  });

  it('should create a valid IRModule', () => {
    const module: IRModule = {
      type: 'module',
      name: 'vpc',
      source: './modules/vpc',
      inputs: {
        cidr: '10.0.0.0/16',
      },
      metadata: {},
    };

    expect(module.type).toBe('module');
    expect(module.name).toBe('vpc');
  });

  it('should create a valid IRConditional', () => {
    const conditional: IRConditional = {
      type: 'conditional',
      condition: {
        exprType: 'function',
        value: { name: 'equals', args: ['var.env', 'prod'] },
      },
      thenBranch: [],
      elseBranch: [],
      metadata: {},
    };

    expect(conditional.type).toBe('conditional');
    expect(conditional.condition.exprType).toBe('function');
  });

  it('should create a valid IRLoop', () => {
    const loop: IRLoop = {
      type: 'loop',
      iterator: 'item',
      collection: {
        exprType: 'reference',
        value: 'var.items',
      },
      body: [],
      metadata: {},
    };

    expect(loop.type).toBe('loop');
    expect(loop.iterator).toBe('item');
  });

  it('should create a valid IRDocument', () => {
    const document: IRDocument = {
      version: '1.0',
      resources: [],
      variables: [],
      outputs: [],
      modules: [],
    };

    expect(document.version).toBe('1.0');
    expect(Array.isArray(document.resources)).toBe(true);
  });

  it('should handle metadata with source location', () => {
    const location: SourceLocation = {
      line: 10,
      column: 5,
      file: 'main.tf',
    };

    const metadata: NodeMetadata = {
      sourceLocation: location,
      comments: ['This is a comment'],
      annotations: { important: true },
    };

    expect(metadata.sourceLocation?.line).toBe(10);
    expect(metadata.comments).toHaveLength(1);
    expect(metadata.annotations?.important).toBe(true);
  });
});

describe('IR Property-Based Tests', () => {
  it('should handle arbitrary IRExpression values', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('function', 'reference', 'literal'),
        fc.anything(),
        (exprType, value) => {
          const expr: IRExpression = { exprType, value };
          expect(expr.exprType).toBe(exprType);
          expect(expr.value).toBe(value);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle arbitrary resource names', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        fc.string({ minLength: 1 }),
        (resourceType, name) => {
          const resource: IRResource = {
            type: 'resource',
            resourceType,
            name,
            properties: {},
            dependsOn: [],
            metadata: {},
          };
          expect(resource.resourceType).toBe(resourceType);
          expect(resource.name).toBe(name);
        }
      ),
      { numRuns: 100 }
    );
  });
});
