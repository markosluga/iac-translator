import { describe, it, expect, beforeEach } from 'vitest';
import { TerraformParser } from './terraform-parser';


describe('TerraformParser', () => {
  let parser: TerraformParser;

  beforeEach(() => {
    parser = new TerraformParser();
  });

  describe('Plugin Interface', () => {
    it('should have correct language name', () => {
      expect(parser.languageName).toBe('terraform');
    });

    it('should have correct file extensions', () => {
      expect(parser.fileExtensions).toEqual(['.tf', '.tfvars']);
    });
  });

  describe('Validation', () => {
    it('should validate empty source', () => {
      const result = parser.validate('');
      expect(result.valid).toBe(true);
    });

    it('should validate simple resource', () => {
      const source = `
resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-bucket-name"
}
      `;
      const result = parser.validate(source);
      expect(result.valid).toBe(true);
    });

    it('should detect unbalanced braces', () => {
      const source = `
resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-bucket-name"
      `;
      const result = parser.validate(source);
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Unbalanced braces');
    });

    it('should validate comments only', () => {
      const source = `
# This is a comment
// Another comment
      `;
      const result = parser.validate(source);
      expect(result.valid).toBe(true);
    });
  });

  describe('Resource Parsing', () => {
    it('should parse simple resource', () => {
      const source = `
resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-bucket-name"
  acl = "private"
}
      `;
      const result = parser.parse(source, { options: {} });

      expect(result.success).toBe(true);
      expect(result.ir).toBeDefined();
      expect(result.ir!.resources).toHaveLength(1);

      const resource = result.ir!.resources[0];
      expect(resource.type).toBe('resource');
      expect(resource.resourceType).toBe('aws_s3_bucket');
      expect(resource.name).toBe('my_bucket');
      expect(resource.properties.bucket).toBe('my-bucket-name');
      expect(resource.properties.acl).toBe('private');
    });

    it('should parse resource with number property', () => {
      const source = `
resource "aws_instance" "web" {
  instance_type = "t2.micro"
  count = 3
}
      `;
      const result = parser.parse(source, { options: {} });

      expect(result.success).toBe(true);
      const resource = result.ir!.resources[0];
      expect(resource.properties.count).toBe(3);
    });

    it('should parse resource with boolean property', () => {
      const source = `
resource "aws_s3_bucket" "my_bucket" {
  versioning = true
}
      `;
      const result = parser.parse(source, { options: {} });

      expect(result.success).toBe(true);
      const resource = result.ir!.resources[0];
      expect(resource.properties.versioning).toBe(true);
    });

    it('should parse resource with list property', () => {
      const source = `
resource "aws_security_group" "sg" {
  ingress = ["80", "443"]
}
      `;
      const result = parser.parse(source, { options: {} });

      expect(result.success).toBe(true);
      const resource = result.ir!.resources[0];
      expect(Array.isArray(resource.properties.ingress)).toBe(true);
    });

    it('should parse multiple resources', () => {
      const source = `
resource "aws_s3_bucket" "bucket1" {
  bucket = "bucket-1"
}

resource "aws_s3_bucket" "bucket2" {
  bucket = "bucket-2"
}
      `;
      const result = parser.parse(source, { options: {} });

      expect(result.success).toBe(true);
      expect(result.ir!.resources).toHaveLength(2);
      expect(result.ir!.resources[0].name).toBe('bucket1');
      expect(result.ir!.resources[1].name).toBe('bucket2');
    });

    it('should parse resource with depends_on', () => {
      const source = `
resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-bucket"
  depends_on = ["aws_iam_role.my_role"]
}
      `;
      const result = parser.parse(source, { options: {} });

      expect(result.success).toBe(true);
      const resource = result.ir!.resources[0];
      expect(resource.dependsOn).toHaveLength(1);
      expect(resource.dependsOn[0]).toBe('aws_iam_role.my_role');
    });

    it('should include source location in metadata', () => {
      const source = `
resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-bucket"
}
      `;
      const result = parser.parse(source, { options: {} });

      expect(result.success).toBe(true);
      const resource = result.ir!.resources[0];
      expect(resource.metadata.sourceLocation).toBeDefined();
      expect(resource.metadata.sourceLocation?.line).toBeGreaterThan(0);
    });
  });

  describe('Variable Parsing', () => {
    it('should parse simple variable', () => {
      const source = `
variable "region" {
  type = "string"
  default = "us-east-1"
  description = "AWS region"
}
      `;
      const result = parser.parse(source, { options: {} });

      expect(result.success).toBe(true);
      expect(result.ir!.variables).toHaveLength(1);

      const variable = result.ir!.variables[0];
      expect(variable.type).toBe('variable');
      expect(variable.name).toBe('region');
      expect(variable.valueType).toBe('string');
      expect(variable.defaultValue).toBe('us-east-1');
      expect(variable.description).toBe('AWS region');
    });

    it('should parse variable without default', () => {
      const source = `
variable "api_key" {
  type = "string"
}
      `;
      const result = parser.parse(source, { options: {} });

      expect(result.success).toBe(true);
      const variable = result.ir!.variables[0];
      expect(variable.name).toBe('api_key');
      expect(variable.defaultValue).toBeUndefined();
    });
  });

  describe('Output Parsing', () => {
    it('should parse simple output', () => {
      const source = `
output "bucket_arn" {
  value = "arn:aws:s3:::my-bucket"
  description = "The ARN of the bucket"
}
      `;
      const result = parser.parse(source, { options: {} });

      expect(result.success).toBe(true);
      expect(result.ir!.outputs).toHaveLength(1);

      const output = result.ir!.outputs[0];
      expect(output.type).toBe('output');
      expect(output.name).toBe('bucket_arn');
      expect(output.value).toBeDefined();
      expect(output.description).toBe('The ARN of the bucket');
    });

    it('should parse output with string value', () => {
      const source = `
output "bucket_arn" {
  value = "arn:aws:s3:::my-bucket"
}
      `;
      const result = parser.parse(source, { options: {} });

      expect(result.success).toBe(true);
      const output = result.ir!.outputs[0];
      expect(output.value.exprType).toBe('literal');
      expect(output.value.value).toBe('arn:aws:s3:::my-bucket');
    });
  });

  describe('Module Parsing', () => {
    it('should parse simple module', () => {
      const source = `
module "vpc" {
  source = "./modules/vpc"
  cidr = "10.0.0.0/16"
}
      `;
      const result = parser.parse(source, { options: {} });

      expect(result.success).toBe(true);
      expect(result.ir!.modules).toHaveLength(1);

      const module = result.ir!.modules[0];
      expect(module.type).toBe('module');
      expect(module.name).toBe('vpc');
      expect(module.source).toBe('./modules/vpc');
      expect(module.inputs.cidr).toBe('10.0.0.0/16');
    });

    it('should parse module with multiple inputs', () => {
      const source = `
module "vpc" {
  source = "./modules/vpc"
  cidr = "10.0.0.0/16"
  enable_dns = true
  az_count = 3
}
      `;
      const result = parser.parse(source, { options: {} });

      expect(result.success).toBe(true);
      const module = result.ir!.modules[0];
      expect(module.inputs.cidr).toBe('10.0.0.0/16');
      expect(module.inputs.enable_dns).toBe(true);
      expect(module.inputs.az_count).toBe(3);
    });
  });

  describe('Complete Configuration', () => {
    it('should parse configuration with all block types', () => {
      const source = `
variable "region" {
  type = "string"
  default = "us-east-1"
}

resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-bucket-name"
}

module "vpc" {
  source = "./modules/vpc"
  cidr = "10.0.0.0/16"
}

output "bucket_name" {
  value = aws_s3_bucket.my_bucket.id
}
      `;
      const result = parser.parse(source, { options: {} });

      expect(result.success).toBe(true);
      expect(result.ir!.variables).toHaveLength(1);
      expect(result.ir!.resources).toHaveLength(1);
      expect(result.ir!.modules).toHaveLength(1);
      expect(result.ir!.outputs).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid syntax gracefully', () => {
      const source = `
resource "aws_s3_bucket" "my_bucket" {
  bucket = "my-bucket"
      `;
      const result = parser.parse(source, { options: {} });

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
