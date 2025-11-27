import { describe, it, expect, beforeEach } from 'vitest';
import { CloudFormationGenerator } from './cloudformation-generator';
import { IRDocument, IRResource, IRVariable, IROutput } from '../core/ir';

describe('CloudFormationGenerator', () => {
  let generator: CloudFormationGenerator;

  beforeEach(() => {
    generator = new CloudFormationGenerator();
  });

  describe('Plugin Interface', () => {
    it('should have correct language name', () => {
      expect(generator.languageName).toBe('cloudformation');
    });

    it('should have correct file extension', () => {
      expect(generator.fileExtension).toBe('.yaml');
    });
  });

  describe('Basic Generation', () => {
    it('should generate empty template', () => {
      const ir: IRDocument = {
        version: '1.0',
        resources: [],
        variables: [],
        outputs: [],
        modules: [],
      };

      const result = generator.generate(ir, { options: {} });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output).toContain('AWSTemplateFormatVersion');
      expect(result.output).toContain('2010-09-09');
    });

    it('should format output with newline', () => {
      const output = 'test: value';
      const formatted = generator.format(output);

      expect(formatted.endsWith('\n')).toBe(true);
      expect(formatted.trim()).toBe('test: value');
    });
  });

  describe('Resource Generation', () => {
    it('should generate simple S3 bucket resource', () => {
      const ir: IRDocument = {
        version: '1.0',
        resources: [
          {
            type: 'resource',
            resourceType: 'aws_s3_bucket',
            name: 'my_bucket',
            properties: {
              bucket: 'my-bucket-name',
            },
            dependsOn: [],
            metadata: {},
          },
        ],
        variables: [],
        outputs: [],
        modules: [],
      };

      const result = generator.generate(ir, { options: {} });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Resources:');
      expect(result.output).toContain('MyBucket:');
      expect(result.output).toContain('AWS::S3::Bucket');
      expect(result.output).toContain('Bucket: my-bucket-name');
    });

    it('should generate EC2 instance resource', () => {
      const ir: IRDocument = {
        version: '1.0',
        resources: [
          {
            type: 'resource',
            resourceType: 'aws_instance',
            name: 'web_server',
            properties: {
              instance_type: 't2.micro',
              ami: 'ami-12345678',
            },
            dependsOn: [],
            metadata: {},
          },
        ],
        variables: [],
        outputs: [],
        modules: [],
      };

      const result = generator.generate(ir, { options: {} });

      expect(result.success).toBe(true);
      expect(result.output).toContain('WebServer:');
      expect(result.output).toContain('AWS::EC2::Instance');
      expect(result.output).toContain('InstanceType: t2.micro');
      expect(result.output).toContain('Ami: ami-12345678');
    });

    it('should handle multiple resources', () => {
      const ir: IRDocument = {
        version: '1.0',
        resources: [
          {
            type: 'resource',
            resourceType: 'aws_s3_bucket',
            name: 'bucket1',
            properties: { bucket: 'bucket-1' },
            dependsOn: [],
            metadata: {},
          },
          {
            type: 'resource',
            resourceType: 'aws_s3_bucket',
            name: 'bucket2',
            properties: { bucket: 'bucket-2' },
            dependsOn: [],
            metadata: {},
          },
        ],
        variables: [],
        outputs: [],
        modules: [],
      };

      const result = generator.generate(ir, { options: {} });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Bucket1:');
      expect(result.output).toContain('Bucket2:');
    });

    it('should handle resource dependencies', () => {
      const ir: IRDocument = {
        version: '1.0',
        resources: [
          {
            type: 'resource',
            resourceType: 'aws_s3_bucket',
            name: 'my_bucket',
            properties: { bucket: 'my-bucket' },
            dependsOn: ['my_role'],
            metadata: {},
          },
        ],
        variables: [],
        outputs: [],
        modules: [],
      };

      const result = generator.generate(ir, { options: {} });

      expect(result.success).toBe(true);
      expect(result.output).toContain('DependsOn:');
      expect(result.output).toContain('MyRole');
    });

    it('should handle unsupported resource types', () => {
      const ir: IRDocument = {
        version: '1.0',
        resources: [
          {
            type: 'resource',
            resourceType: 'unknown_resource_type',
            name: 'my_resource',
            properties: {},
            dependsOn: [],
            metadata: {},
          },
        ],
        variables: [],
        outputs: [],
        modules: [],
      };

      const result = generator.generate(ir, { options: {} });

      expect(result.success).toBe(true);
      expect(result.unsupportedFeatures.length).toBeGreaterThan(0);
      expect(result.output).toContain('Custom::unknown_resource_type');
    });
  });

  describe('Parameter Generation', () => {
    it('should generate parameter from variable', () => {
      const ir: IRDocument = {
        version: '1.0',
        resources: [],
        variables: [
          {
            type: 'variable',
            name: 'region',
            valueType: 'string',
            defaultValue: 'us-east-1',
            description: 'AWS region',
            metadata: {},
          },
        ],
        outputs: [],
        modules: [],
      };

      const result = generator.generate(ir, { options: {} });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Parameters:');
      expect(result.output).toContain('Region:');
      expect(result.output).toContain('Type: String');
      expect(result.output).toContain('Default: us-east-1');
      expect(result.output).toContain('Description: AWS region');
    });

    it('should generate number parameter', () => {
      const ir: IRDocument = {
        version: '1.0',
        resources: [],
        variables: [
          {
            type: 'variable',
            name: 'instance_count',
            valueType: 'number',
            defaultValue: 3,
            metadata: {},
          },
        ],
        outputs: [],
        modules: [],
      };

      const result = generator.generate(ir, { options: {} });

      expect(result.success).toBe(true);
      expect(result.output).toContain('InstanceCount:');
      expect(result.output).toContain('Type: Number');
      expect(result.output).toContain('Default: 3');
    });

    it('should generate parameter without default', () => {
      const ir: IRDocument = {
        version: '1.0',
        resources: [],
        variables: [
          {
            type: 'variable',
            name: 'api_key',
            valueType: 'string',
            metadata: {},
          },
        ],
        outputs: [],
        modules: [],
      };

      const result = generator.generate(ir, { options: {} });

      expect(result.success).toBe(true);
      expect(result.output).toContain('ApiKey:');
      expect(result.output).toContain('Type: String');
      expect(result.output).not.toContain('Default:');
    });
  });

  describe('Output Generation', () => {
    it('should generate output with literal value', () => {
      const ir: IRDocument = {
        version: '1.0',
        resources: [],
        variables: [],
        outputs: [
          {
            type: 'output',
            name: 'bucket_name',
            value: {
              exprType: 'literal',
              value: 'my-bucket',
            },
            description: 'The bucket name',
            metadata: {},
          },
        ],
        modules: [],
      };

      const result = generator.generate(ir, { options: {} });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Outputs:');
      expect(result.output).toContain('BucketName:');
      expect(result.output).toContain('Value: my-bucket');
      expect(result.output).toContain('Description: The bucket name');
    });

    it('should generate output with reference', () => {
      const ir: IRDocument = {
        version: '1.0',
        resources: [],
        variables: [],
        outputs: [
          {
            type: 'output',
            name: 'bucket_arn',
            value: {
              exprType: 'reference',
              value: 'aws_s3_bucket.my_bucket.arn',
            },
            metadata: {},
          },
        ],
        modules: [],
      };

      const result = generator.generate(ir, { options: {} });

      expect(result.success).toBe(true);
      expect(result.output).toContain('BucketArn:');
      expect(result.output).toContain('Fn::GetAtt');
      expect(result.output).toContain('MyBucket');
    });

    it('should generate output with variable reference', () => {
      const ir: IRDocument = {
        version: '1.0',
        resources: [],
        variables: [],
        outputs: [
          {
            type: 'output',
            name: 'region_output',
            value: {
              exprType: 'reference',
              value: 'var.region',
            },
            metadata: {},
          },
        ],
        modules: [],
      };

      const result = generator.generate(ir, { options: {} });

      expect(result.success).toBe(true);
      expect(result.output).toContain('RegionOutput:');
      expect(result.output).toContain('Ref: Region');
    });
  });

  describe('Module Handling', () => {
    it('should report modules as unsupported', () => {
      const ir: IRDocument = {
        version: '1.0',
        resources: [],
        variables: [],
        outputs: [],
        modules: [
          {
            type: 'module',
            name: 'vpc',
            source: './modules/vpc',
            inputs: { cidr: '10.0.0.0/16' },
            metadata: {},
          },
        ],
      };

      const result = generator.generate(ir, { options: {} });

      expect(result.success).toBe(true);
      expect(result.unsupportedFeatures.length).toBeGreaterThan(0);
      expect(result.unsupportedFeatures[0].feature).toBe('modules');
    });
  });

  describe('Complete Template', () => {
    it('should generate complete template with all sections', () => {
      const ir: IRDocument = {
        version: '1.0',
        resources: [
          {
            type: 'resource',
            resourceType: 'aws_s3_bucket',
            name: 'my_bucket',
            properties: { bucket: 'my-bucket' },
            dependsOn: [],
            metadata: {},
          },
        ],
        variables: [
          {
            type: 'variable',
            name: 'region',
            valueType: 'string',
            defaultValue: 'us-east-1',
            metadata: {},
          },
        ],
        outputs: [
          {
            type: 'output',
            name: 'bucket_name',
            value: { exprType: 'literal', value: 'my-bucket' },
            metadata: {},
          },
        ],
        modules: [],
      };

      const result = generator.generate(ir, { options: {} });

      expect(result.success).toBe(true);
      expect(result.output).toContain('AWSTemplateFormatVersion');
      expect(result.output).toContain('Parameters:');
      expect(result.output).toContain('Resources:');
      expect(result.output).toContain('Outputs:');
    });
  });

  describe('Naming Conventions', () => {
    it('should convert snake_case to PascalCase', () => {
      const ir: IRDocument = {
        version: '1.0',
        resources: [
          {
            type: 'resource',
            resourceType: 'aws_s3_bucket',
            name: 'my_test_bucket',
            properties: { bucket_name: 'test' },
            dependsOn: [],
            metadata: {},
          },
        ],
        variables: [],
        outputs: [],
        modules: [],
      };

      const result = generator.generate(ir, { options: {} });

      expect(result.success).toBe(true);
      expect(result.output).toContain('MyTestBucket:');
      expect(result.output).toContain('BucketName: test');
    });

    it('should handle kebab-case names', () => {
      const ir: IRDocument = {
        version: '1.0',
        resources: [
          {
            type: 'resource',
            resourceType: 'aws_s3_bucket',
            name: 'my-test-bucket',
            properties: {},
            dependsOn: [],
            metadata: {},
          },
        ],
        variables: [],
        outputs: [],
        modules: [],
      };

      const result = generator.generate(ir, { options: {} });

      expect(result.success).toBe(true);
      expect(result.output).toContain('MyTestBucket:');
    });
  });
});
