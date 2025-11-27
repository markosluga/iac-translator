/**
 * Resource Type Mapping System
 * Maps resource types and properties between different IaC languages
 */

import { IRValue } from './ir';

/**
 * Property mapping definition
 */
export interface PropertyMapping {
  sourcePath: string;
  targetPath: string;
  valueTransform?: (value: any) => any;
}

/**
 * Transformation function type
 */
export type Transformation = (properties: Record<string, IRValue>) => Record<string, IRValue>;

/**
 * Resource type mapping definition
 */
export interface ResourceTypeMapping {
  sourceType: string;
  targetType: string;
  propertyMappings: PropertyMapping[];
  transformations: Transformation[];
}

/**
 * Resource Type Mapper
 * Manages mappings between resource types across languages
 */
export class ResourceTypeMapper {
  private mappings: Map<string, Map<string, ResourceTypeMapping>> = new Map();

  /**
   * Register a resource type mapping
   * @param sourceLanguage Source language name
   * @param targetLanguage Target language name
   * @param mapping Resource type mapping
   */
  registerMapping(
    sourceLanguage: string,
    targetLanguage: string,
    mapping: ResourceTypeMapping
  ): void {
    const key = this.getMappingKey(sourceLanguage, targetLanguage);
    
    if (!this.mappings.has(key)) {
      this.mappings.set(key, new Map());
    }

    const languageMappings = this.mappings.get(key)!;
    languageMappings.set(mapping.sourceType, mapping);
  }

  /**
   * Get resource type mapping
   * @param sourceLanguage Source language name
   * @param targetLanguage Target language name
   * @param sourceType Source resource type
   */
  getMapping(
    sourceLanguage: string,
    targetLanguage: string,
    sourceType: string
  ): ResourceTypeMapping | undefined {
    const key = this.getMappingKey(sourceLanguage, targetLanguage);
    const languageMappings = this.mappings.get(key);
    
    if (!languageMappings) {
      return undefined;
    }

    return languageMappings.get(sourceType);
  }

  /**
   * Check if a mapping exists
   */
  hasMapping(
    sourceLanguage: string,
    targetLanguage: string,
    sourceType: string
  ): boolean {
    return this.getMapping(sourceLanguage, targetLanguage, sourceType) !== undefined;
  }

  /**
   * Map resource type
   * @param sourceLanguage Source language name
   * @param targetLanguage Target language name
   * @param sourceType Source resource type
   * @returns Target resource type or undefined if no mapping exists
   */
  mapResourceType(
    sourceLanguage: string,
    targetLanguage: string,
    sourceType: string
  ): string | undefined {
    const mapping = this.getMapping(sourceLanguage, targetLanguage, sourceType);
    return mapping?.targetType;
  }

  /**
   * Map resource properties
   * @param sourceLanguage Source language name
   * @param targetLanguage Target language name
   * @param sourceType Source resource type
   * @param properties Source properties
   * @returns Mapped properties
   */
  mapProperties(
    sourceLanguage: string,
    targetLanguage: string,
    sourceType: string,
    properties: Record<string, IRValue>
  ): Record<string, IRValue> {
    const mapping = this.getMapping(sourceLanguage, targetLanguage, sourceType);
    
    if (!mapping) {
      return properties;
    }

    let result = { ...properties };

    // Apply property mappings
    for (const propMapping of mapping.propertyMappings) {
      const sourceValue = this.getNestedValue(result, propMapping.sourcePath);
      
      if (sourceValue !== undefined) {
        // Remove source property
        this.deleteNestedValue(result, propMapping.sourcePath);
        
        // Transform value if transformer provided
        const targetValue = propMapping.valueTransform
          ? propMapping.valueTransform(sourceValue)
          : sourceValue;
        
        // Set target property
        this.setNestedValue(result, propMapping.targetPath, targetValue);
      }
    }

    // Apply transformations
    for (const transformation of mapping.transformations) {
      result = transformation(result);
    }

    return result;
  }

  /**
   * Get all mappings for a language pair
   */
  getAllMappings(
    sourceLanguage: string,
    targetLanguage: string
  ): ResourceTypeMapping[] {
    const key = this.getMappingKey(sourceLanguage, targetLanguage);
    const languageMappings = this.mappings.get(key);
    
    if (!languageMappings) {
      return [];
    }

    return Array.from(languageMappings.values());
  }

  /**
   * Clear all mappings
   */
  clear(): void {
    this.mappings.clear();
  }

  /**
   * Generate mapping key from language pair
   */
  private getMappingKey(sourceLanguage: string, targetLanguage: string): string {
    return `${sourceLanguage.toLowerCase()}:${targetLanguage.toLowerCase()}`;
  }

  /**
   * Get nested value from object using dot notation path
   */
  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Set nested value in object using dot notation path
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part];
    }

    current[parts[parts.length - 1]] = value;
  }

  /**
   * Delete nested value from object using dot notation path
   */
  private deleteNestedValue(obj: any, path: string): void {
    const parts = path.split('.');
    let current = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current)) {
        return;
      }
      current = current[part];
    }

    delete current[parts[parts.length - 1]];
  }
}

/**
 * Common resource type mappings for Terraform → CloudFormation
 */
export const TerraformToCloudFormationMappings: ResourceTypeMapping[] = [
  {
    sourceType: 'aws_s3_bucket',
    targetType: 'AWS::S3::Bucket',
    propertyMappings: [
      { sourcePath: 'bucket', targetPath: 'BucketName' },
      { sourcePath: 'acl', targetPath: 'AccessControl' },
    ],
    transformations: [],
  },
  {
    sourceType: 'aws_instance',
    targetType: 'AWS::EC2::Instance',
    propertyMappings: [
      { sourcePath: 'ami', targetPath: 'ImageId' },
      { sourcePath: 'instance_type', targetPath: 'InstanceType' },
      { sourcePath: 'key_name', targetPath: 'KeyName' },
      { sourcePath: 'subnet_id', targetPath: 'SubnetId' },
    ],
    transformations: [],
  },
  {
    sourceType: 'aws_security_group',
    targetType: 'AWS::EC2::SecurityGroup',
    propertyMappings: [
      { sourcePath: 'name', targetPath: 'GroupName' },
      { sourcePath: 'description', targetPath: 'GroupDescription' },
      { sourcePath: 'vpc_id', targetPath: 'VpcId' },
    ],
    transformations: [],
  },
  {
    sourceType: 'aws_vpc',
    targetType: 'AWS::EC2::VPC',
    propertyMappings: [
      { sourcePath: 'cidr_block', targetPath: 'CidrBlock' },
      { sourcePath: 'enable_dns_support', targetPath: 'EnableDnsSupport' },
      { sourcePath: 'enable_dns_hostnames', targetPath: 'EnableDnsHostnames' },
    ],
    transformations: [],
  },
  {
    sourceType: 'aws_subnet',
    targetType: 'AWS::EC2::Subnet',
    propertyMappings: [
      { sourcePath: 'vpc_id', targetPath: 'VpcId' },
      { sourcePath: 'cidr_block', targetPath: 'CidrBlock' },
      { sourcePath: 'availability_zone', targetPath: 'AvailabilityZone' },
    ],
    transformations: [],
  },
  {
    sourceType: 'aws_iam_role',
    targetType: 'AWS::IAM::Role',
    propertyMappings: [
      { sourcePath: 'name', targetPath: 'RoleName' },
      { sourcePath: 'assume_role_policy', targetPath: 'AssumeRolePolicyDocument' },
      { sourcePath: 'description', targetPath: 'Description' },
    ],
    transformations: [],
  },
  {
    sourceType: 'aws_lambda_function',
    targetType: 'AWS::Lambda::Function',
    propertyMappings: [
      { sourcePath: 'function_name', targetPath: 'FunctionName' },
      { sourcePath: 'runtime', targetPath: 'Runtime' },
      { sourcePath: 'handler', targetPath: 'Handler' },
      { sourcePath: 'role', targetPath: 'Role' },
      { sourcePath: 'timeout', targetPath: 'Timeout' },
      { sourcePath: 'memory_size', targetPath: 'MemorySize' },
    ],
    transformations: [],
  },
  {
    sourceType: 'aws_dynamodb_table',
    targetType: 'AWS::DynamoDB::Table',
    propertyMappings: [
      { sourcePath: 'name', targetPath: 'TableName' },
      { sourcePath: 'billing_mode', targetPath: 'BillingMode' },
      { sourcePath: 'hash_key', targetPath: 'KeySchema' },
    ],
    transformations: [],
  },
];
