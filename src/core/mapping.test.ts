import { describe, it, expect, beforeEach } from 'vitest';
import {
  ResourceTypeMapper,
  ResourceTypeMapping,
  TerraformToCloudFormationMappings,
} from './mapping';

describe('ResourceTypeMapper', () => {
  let mapper: ResourceTypeMapper;

  beforeEach(() => {
    mapper = new ResourceTypeMapper();
  });

  describe('Mapping Registration', () => {
    it('should register a resource type mapping', () => {
      const mapping: ResourceTypeMapping = {
        sourceType: 'aws_s3_bucket',
        targetType: 'AWS::S3::Bucket',
        propertyMappings: [],
        transformations: [],
      };

      mapper.registerMapping('terraform', 'cloudformation', mapping);

      expect(mapper.hasMapping('terraform', 'cloudformation', 'aws_s3_bucket')).toBe(true);
    });

    it('should retrieve registered mapping', () => {
      const mapping: ResourceTypeMapping = {
        sourceType: 'aws_s3_bucket',
        targetType: 'AWS::S3::Bucket',
        propertyMappings: [],
        transformations: [],
      };

      mapper.registerMapping('terraform', 'cloudformation', mapping);

      const retrieved = mapper.getMapping('terraform', 'cloudformation', 'aws_s3_bucket');
      expect(retrieved).toBeDefined();
      expect(retrieved?.targetType).toBe('AWS::S3::Bucket');
    });

    it('should handle case-insensitive language names', () => {
      const mapping: ResourceTypeMapping = {
        sourceType: 'aws_s3_bucket',
        targetType: 'AWS::S3::Bucket',
        propertyMappings: [],
        transformations: [],
      };

      mapper.registerMapping('Terraform', 'CloudFormation', mapping);

      expect(mapper.hasMapping('terraform', 'cloudformation', 'aws_s3_bucket')).toBe(true);
      expect(mapper.hasMapping('TERRAFORM', 'CLOUDFORMATION', 'aws_s3_bucket')).toBe(true);
    });

    it('should return undefined for non-existent mapping', () => {
      const mapping = mapper.getMapping('terraform', 'cloudformation', 'nonexistent');
      expect(mapping).toBeUndefined();
    });
  });

  describe('Resource Type Mapping', () => {
    it('should map resource type', () => {
      const mapping: ResourceTypeMapping = {
        sourceType: 'aws_s3_bucket',
        targetType: 'AWS::S3::Bucket',
        propertyMappings: [],
        transformations: [],
      };

      mapper.registerMapping('terraform', 'cloudformation', mapping);

      const targetType = mapper.mapResourceType(
        'terraform',
        'cloudformation',
        'aws_s3_bucket'
      );
      expect(targetType).toBe('AWS::S3::Bucket');
    });

    it('should return undefined for unmapped resource type', () => {
      const targetType = mapper.mapResourceType(
        'terraform',
        'cloudformation',
        'unknown_type'
      );
      expect(targetType).toBeUndefined();
    });
  });

  describe('Property Mapping', () => {
    it('should map simple properties', () => {
      const mapping: ResourceTypeMapping = {
        sourceType: 'aws_s3_bucket',
        targetType: 'AWS::S3::Bucket',
        propertyMappings: [
          { sourcePath: 'bucket', targetPath: 'BucketName' },
          { sourcePath: 'acl', targetPath: 'AccessControl' },
        ],
        transformations: [],
      };

      mapper.registerMapping('terraform', 'cloudformation', mapping);

      const properties = {
        bucket: 'my-bucket',
        acl: 'private',
      };

      const mapped = mapper.mapProperties(
        'terraform',
        'cloudformation',
        'aws_s3_bucket',
        properties
      );

      expect(mapped.BucketName).toBe('my-bucket');
      expect(mapped.AccessControl).toBe('private');
      expect(mapped.bucket).toBeUndefined();
      expect(mapped.acl).toBeUndefined();
    });

    it('should handle nested property paths', () => {
      const mapping: ResourceTypeMapping = {
        sourceType: 'test_resource',
        targetType: 'Test::Resource',
        propertyMappings: [
          { sourcePath: 'config.name', targetPath: 'Name' },
          { sourcePath: 'config.value', targetPath: 'Settings.Value' },
        ],
        transformations: [],
      };

      mapper.registerMapping('source', 'target', mapping);

      const properties = {
        config: {
          name: 'test',
          value: 42,
        },
      };

      const mapped = mapper.mapProperties('source', 'target', 'test_resource', properties);

      expect(mapped.Name).toBe('test');
      expect(mapped.Settings).toBeDefined();
      expect((mapped.Settings as any).Value).toBe(42);
    });

    it('should apply value transformations', () => {
      const mapping: ResourceTypeMapping = {
        sourceType: 'test_resource',
        targetType: 'Test::Resource',
        propertyMappings: [
          {
            sourcePath: 'size',
            targetPath: 'Size',
            valueTransform: (value: number) => value * 1024,
          },
        ],
        transformations: [],
      };

      mapper.registerMapping('source', 'target', mapping);

      const properties = {
        size: 10,
      };

      const mapped = mapper.mapProperties('source', 'target', 'test_resource', properties);

      expect(mapped.Size).toBe(10240);
      expect(mapped.size).toBeUndefined();
    });

    it('should apply transformations', () => {
      const mapping: ResourceTypeMapping = {
        sourceType: 'test_resource',
        targetType: 'Test::Resource',
        propertyMappings: [],
        transformations: [
          (props) => {
            const result = { ...props };
            if (result.enabled === true) {
              result.status = 'active';
              delete result.enabled;
            }
            return result;
          },
        ],
      };

      mapper.registerMapping('source', 'target', mapping);

      const properties = {
        enabled: true,
        name: 'test',
      };

      const mapped = mapper.mapProperties('source', 'target', 'test_resource', properties);

      expect(mapped.status).toBe('active');
      expect(mapped.enabled).toBeUndefined();
      expect(mapped.name).toBe('test');
    });

    it('should apply multiple transformations in order', () => {
      const mapping: ResourceTypeMapping = {
        sourceType: 'test_resource',
        targetType: 'Test::Resource',
        propertyMappings: [],
        transformations: [
          (props) => ({ ...props, step1: true }),
          (props) => ({ ...props, step2: true }),
        ],
      };

      mapper.registerMapping('source', 'target', mapping);

      const properties = { name: 'test' };
      const mapped = mapper.mapProperties('source', 'target', 'test_resource', properties);

      expect(mapped.step1).toBe(true);
      expect(mapped.step2).toBe(true);
    });

    it('should return original properties when no mapping exists', () => {
      const properties = {
        bucket: 'my-bucket',
        acl: 'private',
      };

      const mapped = mapper.mapProperties(
        'terraform',
        'cloudformation',
        'unknown_type',
        properties
      );

      expect(mapped).toEqual(properties);
    });

    it('should preserve unmapped properties', () => {
      const mapping: ResourceTypeMapping = {
        sourceType: 'aws_s3_bucket',
        targetType: 'AWS::S3::Bucket',
        propertyMappings: [{ sourcePath: 'bucket', targetPath: 'BucketName' }],
        transformations: [],
      };

      mapper.registerMapping('terraform', 'cloudformation', mapping);

      const properties = {
        bucket: 'my-bucket',
        tags: { env: 'prod' },
      };

      const mapped = mapper.mapProperties(
        'terraform',
        'cloudformation',
        'aws_s3_bucket',
        properties
      );

      expect(mapped.BucketName).toBe('my-bucket');
      expect(mapped.tags).toEqual({ env: 'prod' });
    });
  });

  describe('Get All Mappings', () => {
    it('should return all mappings for a language pair', () => {
      const mapping1: ResourceTypeMapping = {
        sourceType: 'aws_s3_bucket',
        targetType: 'AWS::S3::Bucket',
        propertyMappings: [],
        transformations: [],
      };

      const mapping2: ResourceTypeMapping = {
        sourceType: 'aws_instance',
        targetType: 'AWS::EC2::Instance',
        propertyMappings: [],
        transformations: [],
      };

      mapper.registerMapping('terraform', 'cloudformation', mapping1);
      mapper.registerMapping('terraform', 'cloudformation', mapping2);

      const mappings = mapper.getAllMappings('terraform', 'cloudformation');

      expect(mappings).toHaveLength(2);
      expect(mappings.some((m) => m.sourceType === 'aws_s3_bucket')).toBe(true);
      expect(mappings.some((m) => m.sourceType === 'aws_instance')).toBe(true);
    });

    it('should return empty array when no mappings exist', () => {
      const mappings = mapper.getAllMappings('terraform', 'cloudformation');
      expect(mappings).toEqual([]);
    });
  });

  describe('Clear', () => {
    it('should clear all mappings', () => {
      const mapping: ResourceTypeMapping = {
        sourceType: 'aws_s3_bucket',
        targetType: 'AWS::S3::Bucket',
        propertyMappings: [],
        transformations: [],
      };

      mapper.registerMapping('terraform', 'cloudformation', mapping);
      expect(mapper.hasMapping('terraform', 'cloudformation', 'aws_s3_bucket')).toBe(true);

      mapper.clear();
      expect(mapper.hasMapping('terraform', 'cloudformation', 'aws_s3_bucket')).toBe(false);
    });
  });

  describe('Predefined Mappings', () => {
    it('should have Terraform to CloudFormation mappings', () => {
      expect(TerraformToCloudFormationMappings).toBeDefined();
      expect(TerraformToCloudFormationMappings.length).toBeGreaterThan(0);
    });

    it('should include S3 bucket mapping', () => {
      const s3Mapping = TerraformToCloudFormationMappings.find(
        (m) => m.sourceType === 'aws_s3_bucket'
      );

      expect(s3Mapping).toBeDefined();
      expect(s3Mapping?.targetType).toBe('AWS::S3::Bucket');
      expect(s3Mapping?.propertyMappings.length).toBeGreaterThan(0);
    });

    it('should include EC2 instance mapping', () => {
      const ec2Mapping = TerraformToCloudFormationMappings.find(
        (m) => m.sourceType === 'aws_instance'
      );

      expect(ec2Mapping).toBeDefined();
      expect(ec2Mapping?.targetType).toBe('AWS::EC2::Instance');
    });

    it('should work with mapper', () => {
      // Register all predefined mappings
      for (const mapping of TerraformToCloudFormationMappings) {
        mapper.registerMapping('terraform', 'cloudformation', mapping);
      }

      // Test S3 bucket mapping
      const properties = {
        bucket: 'my-bucket',
        acl: 'private',
      };

      const mapped = mapper.mapProperties(
        'terraform',
        'cloudformation',
        'aws_s3_bucket',
        properties
      );

      expect(mapped.BucketName).toBe('my-bucket');
      expect(mapped.AccessControl).toBe('private');
    });
  });
});
