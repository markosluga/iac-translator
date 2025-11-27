/**
 * Abstract Intermediate Representation (IR) for Infrastructure as Code
 * 
 * This module defines the language-agnostic IR that serves as the bridge
 * between different IaC languages.
 */

/**
 * Source location information for error reporting and debugging
 */
export interface SourceLocation {
  line: number;
  column: number;
  file?: string;
}

/**
 * Metadata attached to IR nodes
 */
export interface NodeMetadata {
  sourceLocation?: SourceLocation;
  comments?: string[];
  annotations?: Record<string, any>;
}

/**
 * Base interface for all IR nodes
 */
export interface IRNode {
  type: string;
  metadata: NodeMetadata;
}

/**
 * Expression types in the IR
 */
export interface IRExpression {
  exprType: 'function' | 'reference' | 'literal';
  value: any;
}

/**
 * Possible values in the IR
 */
export type IRValue = 
  | string 
  | number 
  | boolean 
  | IRExpression 
  | IRValue[] 
  | { [key: string]: IRValue };

/**
 * Resource definition in the IR
 */
export interface IRResource extends IRNode {
  type: 'resource';
  resourceType: string;
  name: string;
  properties: Record<string, IRValue>;
  dependsOn: string[];
}

/**
 * Variable definition in the IR
 */
export interface IRVariable extends IRNode {
  type: 'variable';
  name: string;
  valueType: string;
  defaultValue?: IRValue;
  description?: string;
}

/**
 * Output definition in the IR
 */
export interface IROutput extends IRNode {
  type: 'output';
  name: string;
  value: IRExpression;
  description?: string;
}

/**
 * Module reference in the IR
 */
export interface IRModule extends IRNode {
  type: 'module';
  name: string;
  source: string;
  inputs: Record<string, IRValue>;
}

/**
 * Conditional construct in the IR
 */
export interface IRConditional extends IRNode {
  type: 'conditional';
  condition: IRExpression;
  thenBranch: IRNode[];
  elseBranch?: IRNode[];
}

/**
 * Loop construct in the IR
 */
export interface IRLoop extends IRNode {
  type: 'loop';
  iterator: string;
  collection: IRExpression;
  body: IRNode[];
}

/**
 * Complete IR document representing an infrastructure configuration
 */
export interface IRDocument {
  version: string;
  resources: IRResource[];
  variables: IRVariable[];
  outputs: IROutput[];
  modules: IRModule[];
}
