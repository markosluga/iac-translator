import { describe, it, expect, beforeEach } from 'vitest';
import { TranslationEngine } from '../core/engine';
import { TerraformParser } from '../plugins/terraform-parser';
import { CloudFormationGenerator } from '../plugins/cloudformation-generator';

describe('End-to-End Translation: Terraform → CloudFormation', () => {
  let engine: TranslationEngine;

  beforeEach(() => {
    engine = new TranslationEngine();
    engine.registerParser(new TerraformParser());
    engine.registerGenerator(new CloudFormationGenerator());
  });

  describe('Complete Translation Pipeline', () => {
    it('should translate simple S3 bucket', () => {
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

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.ir).toBeDefined();
      
      // Verify CloudFormation output
      expect(result.output).toContain('AWSTemplateFormatVersion');
      expect(result.output).toContain('Resources:');
      expect(result.output).toContain('MyBucket:');
      expect(result.output).toContain('AWS::S3::Bucket');
      expect(result.output).toContain('Bucket: my-test-bucket');
      expect(result.output).toContain('Acl: private');
    });

    it('should translate EC2 instance', () => {
      const terraformSource = `
resource "aws_instance" "web_server" {
  ami = "ami-12345678"
  instance_type = "t2.micro"
}
      `;

      const result = engine.translate(
        terraformSource,
        'terraform',
        'cloudformation'
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('WebServer:');
      expect(result.output).toContain('AWS::EC2::Instance');
      expect(result.output).toContain('Ami: ami-12345678');
      expect(result.output).toContain('InstanceType: t2.micro');
    });

    it('should translate configuration with variables', () => {
      const terraformSource = `
variable "region" {
  type = "string"
  default = "us-east-1"
  description = "AWS region"
}

resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-bucket"
}
      `;

      const result = engine.translate(
        terraformSource,
        'terraform',
        'cloudformation'
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Parameters:');
      expect(result.output).toContain('Region:');
      expect(result.output).toContain('Type: String');
      expect(result.output).toContain('Default: us-east-1');
      expect(result.output).toContain('Resources:');
      expect(result.output).toContain('MyBucket:');
    });

    it('should translate configuration with outputs', () => {
      const terraformSource = `
resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-bucket"
}

output "bucket_name" {
  value = "my-bucket"
  description = "The name of the bucket"
}
      `;

      const result = engine.translate(
        terraformSource,
        'terraform',
        'cloudformation'
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Outputs:');
      expect(result.output).toContain('BucketName:');
      expect(result.output).toContain('Value: my-bucket');
      expect(result.output).toContain('Description: The name of the bucket');
    });

    it('should translate multiple resources', () => {
      const terraformSource = `
resource "aws_s3_bucket" "bucket1" {
  bucket = "first-bucket"
}

resource "aws_s3_bucket" "bucket2" {
  bucket = "second-bucket"
}

resource "aws_instance" "web" {
  ami = "ami-12345678"
  instance_type = "t2.micro"
}
      `;

      const result = engine.translate(
        terraformSource,
        'terraform',
        'cloudformation'
      );

      expect(result.success).toBe(true);
      expect(result.output).toContain('Bucket1:');
      expect(result.output).toContain('Bucket2:');
      expect(result.output).toContain('Web:');
      expect(result.ir?.resources).toHaveLength(3);
    });

    it('should translate complete infrastructure', () => {
      const terraformSource = `
variable "environment" {
  type = "string"
  default = "production"
}

resource "aws_vpc" "main" {
  cidr_block = "10.0.0.0/16"
}

resource "aws_subnet" "public" {
  vpc_id = "vpc-123"
  cidr_block = "10.0.1.0/24"
}

resource "aws_instance" "web" {
  ami = "ami-12345678"
  instance_type = "t2.micro"
  subnet_id = "subnet-123"
}

output "instance_id" {
  value = "i-12345"
}
      `;

      const result = engine.translate(
        terraformSource,
        'terraform',
        'cloudformation'
      );

      expect(result.success).toBe(true);
      expect(result.ir?.variables).toHaveLength(1);
      expect(result.ir?.resources).toHaveLength(3);
      expect(result.ir?.outputs).toHaveLength(1);
      
      expect(result.output).toContain('Parameters:');
      expect(result.output).toContain('Resources:');
      expect(result.output).toContain('Outputs:');
    });
  });

  describe('Semantic Preservation', () => {
    it('should preserve resource properties', () => {
      const terraformSource = `
resource "aws_s3_bucket" "test" {
  bucket = "test-bucket"
  acl = "public-read"
}
      `;

      const result = engine.translate(
        terraformSource,
        'terraform',
        'cloudformation'
      );

      expect(result.success).toBe(true);
      
      // Verify IR preserves properties
      const resource = result.ir?.resources[0];
      expect(resource?.properties.bucket).toBe('test-bucket');
      expect(resource?.properties.acl).toBe('public-read');
      
      // Verify output contains properties
      expect(result.output).toContain('test-bucket');
      expect(result.output).toContain('public-read');
    });

    it('should preserve resource dependencies', () => {
      const terraformSource = `
resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-bucket"
  depends_on = ["my_role"]
}
      `;

      const result = engine.translate(
        terraformSource,
        'terraform',
        'cloudformation'
      );

      expect(result.success).toBe(true);
      
      // Verify IR preserves dependencies
      const resource = result.ir?.resources[0];
      expect(resource?.dependsOn).toHaveLength(1);
      
      // Verify output contains DependsOn
      expect(result.output).toContain('DependsOn:');
      expect(result.output).toContain('MyRole');
    });

    it('should preserve variable metadata', () => {
      const terraformSource = `
variable "instance_count" {
  type = "number"
  default = 3
  description = "Number of instances"
}
      `;

      const result = engine.translate(
        terraformSource,
        'terraform',
        'cloudformation'
      );

      expect(result.success).toBe(true);
      
      // Verify IR preserves variable details
      const variable = result.ir?.variables[0];
      expect(variable?.name).toBe('instance_count');
      expect(variable?.valueType).toBe('number');
      expect(variable?.defaultValue).toBe(3);
      expect(variable?.description).toBe('Number of instances');
      
      // Verify output
      expect(result.output).toContain('InstanceCount:');
      expect(result.output).toContain('Type: Number');
      expect(result.output).toContain('Default: 3');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid Terraform syntax', () => {
      const invalidSource = `
resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-bucket"
      `;

      const result = engine.translate(
        invalidSource,
        'terraform',
        'cloudformation'
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle unsupported resource types', () => {
      const terraformSource = `
resource "unknown_provider_resource" "test" {
  property = "value"
}
      `;

      const result = engine.translate(
        terraformSource,
        'terraform',
        'cloudformation'
      );

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.output).toContain('Custom::unknown_provider_resource');
    });

    it('should handle modules with warning', () => {
      const terraformSource = `
module "vpc" {
  source = "./modules/vpc"
  cidr = "10.0.0.0/16"
}
      `;

      const result = engine.translate(
        terraformSource,
        'terraform',
        'cloudformation'
      );

      expect(result.success).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings.some(w => w.message.includes('module'))).toBe(true);
    });
  });

  describe('Translation Options', () => {
    it('should validate before translation when requested', () => {
      const invalidSource = `
resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-bucket"
      `;

      const result = engine.translate(
        invalidSource,
        'terraform',
        'cloudformation',
        { validateBefore: true }
      );

      expect(result.success).toBe(false);
      expect(result.errors[0].phase).toBe('validate');
    });

    it('should format output when requested', () => {
      const terraformSource = `
resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-bucket"
}
      `;

      const result = engine.translate(
        terraformSource,
        'terraform',
        'cloudformation',
        { formatOutput: true }
      );

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      expect(result.output?.endsWith('\n')).toBe(true);
    });
  });

  describe('Language Support', () => {
    it('should report supported languages', () => {
      const languages = engine.getSupportedLanguages();

      expect(languages.length).toBeGreaterThan(0);
      
      const terraform = languages.find(l => l.name === 'terraform');
      expect(terraform).toBeDefined();
      expect(terraform?.canParse).toBe(true);
      
      const cloudformation = languages.find(l => l.name === 'cloudformation');
      expect(cloudformation).toBeDefined();
      expect(cloudformation?.canGenerate).toBe(true);
    });

    it('should confirm translation support', () => {
      expect(engine.canTranslate('terraform', 'cloudformation')).toBe(true);
      expect(engine.canTranslate('terraform', 'nonexistent')).toBe(false);
      expect(engine.canTranslate('nonexistent', 'cloudformation')).toBe(false);
    });
  });

  describe('Validation Only Mode', () => {
    it('should validate without translating', () => {
      const terraformSource = `
resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-bucket"
}
      `;

      const result = engine.validate(terraformSource, 'terraform');

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect validation errors', () => {
      const invalidSource = `
resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-bucket"
      `;

      const result = engine.validate(invalidSource, 'terraform');

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
