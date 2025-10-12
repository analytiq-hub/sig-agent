#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { DocRouterOrg } from '@docrouter/sdk';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Configuration schema
const ConfigSchema = z.object({
  baseURL: z.string().default('https://app.docrouter.ai/fastapi'),
  organizationId: z.string(),
  orgToken: z.string(),
  timeout: z.number().default(30000),
  retries: z.number().default(3),
});

type Config = z.infer<typeof ConfigSchema>;

// Parse command line arguments and environment variables
function parseConfig(): Config {
  const args = process.argv.slice(2);
  const config: Partial<Config> = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace('--', '');
    const value = args[i + 1];
    if (key && value) {
      switch (key) {
        case 'url':
          config.baseURL = value;
          break;
        case 'org-id':
          config.organizationId = value;
          break;
        case 'org-token':
          config.orgToken = value;
          break;
        case 'timeout':
          config.timeout = parseInt(value, 10);
          break;
        case 'retries':
          config.retries = parseInt(value, 10);
          break;
      }
    }
  }

  // Fall back to environment variables
  config.baseURL = config.baseURL || process.env.DOCROUTER_API_URL || 'https://app.docrouter.ai/fastapi';
  config.organizationId = config.organizationId || process.env.DOCROUTER_ORG_ID || '';
  config.orgToken = config.orgToken || process.env.DOCROUTER_ORG_API_TOKEN || '';

  return ConfigSchema.parse(config);
}

// Create the MCP server
const server = new Server(
  {
    name: 'docrouter-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Global DocRouter client
let docrouterClient: DocRouterOrg;

// Initialize DocRouter client
function initializeClient(config: Config) {
  docrouterClient = new DocRouterOrg({
    baseURL: config.baseURL,
    orgToken: config.orgToken,
    organizationId: config.organizationId,
    timeout: config.timeout,
    retries: config.retries,
  });
}

// Helper function to handle errors
function handleError(error: unknown): string {
  if (error instanceof Error) {
    return JSON.stringify({ error: error.message }, null, 2);
  }
  return JSON.stringify({ error: 'Unknown error occurred' }, null, 2);
}

// Helper function to serialize dates
function serializeDates(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(serializeDates);
  }
  
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeDates(value);
    }
    return result;
  }
  
  return obj;
}

// Helper function to safely get typed arguments
function getArg<T>(args: Record<string, unknown>, key: string, defaultValue?: T): T {
  const value = args[key];
  if (value === undefined || value === null) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required argument: ${key}`);
  }
  return value as T;
}

function getOptionalArg<T>(args: Record<string, unknown>, key: string, defaultValue?: T): T | undefined {
  const value = args[key];
  if (value === undefined || value === null) {
    return defaultValue;
  }
  return value as T;
}

// Schema validation function
function validateSchemaFormat(schema: any): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Check if schema is an object
    if (!schema || typeof schema !== 'object') {
      errors.push('Schema must be an object');
      return { valid: false, errors, warnings };
    }

    // Check for required top-level structure
    if (!schema.type || schema.type !== 'json_schema') {
      errors.push('Schema must have type: "json_schema"');
    }

    if (!schema.json_schema || typeof schema.json_schema !== 'object') {
      errors.push('Schema must have json_schema object');
    } else {
      const jsonSchema = schema.json_schema;

      // Check json_schema structure
      if (!jsonSchema.name || typeof jsonSchema.name !== 'string') {
        errors.push('json_schema must have a name field');
      }

      if (!jsonSchema.schema || typeof jsonSchema.schema !== 'object') {
        errors.push('json_schema must have a schema object');
      } else {
        const innerSchema = jsonSchema.schema;

        // Check inner schema structure
        if (innerSchema.type !== 'object') {
          errors.push('Inner schema type must be "object"');
        }

        if (!innerSchema.properties || typeof innerSchema.properties !== 'object') {
          errors.push('Schema must have properties object');
        }

        if (!Array.isArray(innerSchema.required)) {
          errors.push('Schema must have required array');
        }

        if (innerSchema.additionalProperties !== false) {
          errors.push('Schema must have additionalProperties: false');
        }

        // Check strict mode
        if (jsonSchema.strict !== true) {
          errors.push('Schema must have strict: true');
        }

        // Validate that all properties are in required array (strict mode requirement)
        if (innerSchema.properties && Array.isArray(innerSchema.required)) {
          const propertyNames = Object.keys(innerSchema.properties);
          const requiredNames = innerSchema.required;
          
          for (const propName of propertyNames) {
            if (!requiredNames.includes(propName)) {
              errors.push(`Property "${propName}" must be in required array (strict mode requirement)`);
            }
          }

          for (const reqName of requiredNames) {
            if (!propertyNames.includes(reqName)) {
              errors.push(`Required property "${reqName}" is not defined in properties`);
            }
          }
        }

        // Validate nested objects
        if (innerSchema.properties) {
          validateNestedObjects(innerSchema.properties, errors, warnings);
        }
      }
    }

    // Check for non-portable features (warnings)
    if (schema.json_schema?.schema?.properties) {
      checkForNonPortableFeatures(schema.json_schema.schema.properties, warnings);
    }

  } catch (error) {
    errors.push(`Schema validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// Helper function to validate nested objects
function validateNestedObjects(properties: any, errors: string[], warnings: string[]): void {
  for (const [propName, propDef] of Object.entries(properties)) {
    if (typeof propDef === 'object' && propDef !== null) {
      const prop = propDef as any;
      
      if (prop.type === 'object') {
        if (!prop.properties || typeof prop.properties !== 'object') {
          errors.push(`Object property "${propName}" must have properties object`);
        }
        
        if (!Array.isArray(prop.required)) {
          errors.push(`Object property "${propName}" must have required array`);
        }
        
        if (prop.additionalProperties !== false) {
          errors.push(`Object property "${propName}" must have additionalProperties: false`);
        }

        // Recursively validate nested objects
        if (prop.properties) {
          validateNestedObjects(prop.properties, errors, warnings);
        }
      }
      
      if (prop.type === 'array' && prop.items) {
        if (prop.items.type === 'object') {
          if (!prop.items.properties || typeof prop.items.properties !== 'object') {
            errors.push(`Array items object "${propName}" must have properties object`);
          }
          
          if (!Array.isArray(prop.items.required)) {
            errors.push(`Array items object "${propName}" must have required array`);
          }
          
          if (prop.items.additionalProperties !== false) {
            errors.push(`Array items object "${propName}" must have additionalProperties: false`);
          }

          // Recursively validate nested objects in arrays
          if (prop.items.properties) {
            validateNestedObjects(prop.items.properties, errors, warnings);
          }
        }
      }
    }
  }
}

// Helper function to check for non-portable features
function checkForNonPortableFeatures(properties: any, warnings: string[]): void {
  for (const [propName, propDef] of Object.entries(properties)) {
    if (typeof propDef === 'object' && propDef !== null) {
      const prop = propDef as any;

      // Check for enum (not recommended for portability)
      if (prop.enum) {
        warnings.push(`Property "${propName}" uses enum - consider using description instead for better portability`);
      }

      // Check for pattern (not recommended for portability)
      if (prop.pattern) {
        warnings.push(`Property "${propName}" uses pattern - consider using description instead for better portability`);
      }

      // Check for min/max constraints (not recommended for portability)
      if (prop.minimum !== undefined || prop.maximum !== undefined) {
        warnings.push(`Property "${propName}" uses min/max constraints - consider using description instead for better portability`);
      }

      if (prop.minItems !== undefined || prop.maxItems !== undefined) {
        warnings.push(`Property "${propName}" uses minItems/maxItems - consider using description instead for better portability`);
      }

      if (prop.uniqueItems !== undefined) {
        warnings.push(`Property "${propName}" uses uniqueItems - consider using description instead for better portability`);
      }

      // Recursively check nested objects
      if (prop.type === 'object' && prop.properties) {
        checkForNonPortableFeatures(prop.properties, warnings);
      }

      if (prop.type === 'array' && prop.items && prop.items.type === 'object' && prop.items.properties) {
        checkForNonPortableFeatures(prop.items.properties, warnings);
      }
    }
  }
}

// Form validation function
function validateFormFormat(form: any): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    // Check if form is an object
    if (!form || typeof form !== 'object') {
      errors.push('Form must be an object');
      return { valid: false, errors, warnings };
    }

    // Check for required top-level structure
    if (!form.json_formio || !Array.isArray(form.json_formio)) {
      errors.push('Form must have json_formio array');
      return { valid: false, errors, warnings };
    }

    // Validate each component in the form
    validateFormComponents(form.json_formio, errors, warnings, '');

    // Validate field mappings if present
    if (form.json_formio_mapping) {
      validateFieldMappings(form.json_formio_mapping, form.json_formio, errors, warnings);
    }

  } catch (error) {
    errors.push(`Form validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// Helper function to validate Form.io components
function validateFormComponents(components: any[], errors: string[], warnings: string[], path: string): void {
  const validFieldTypes = [
    'textfield', 'email', 'number', 'select', 'textarea', 'checkbox',
    'datetime', 'phoneNumber', 'panel', 'columns', 'fieldset', 'radio',
    'selectboxes', 'currency', 'day', 'time', 'url', 'password', 'file'
  ];

  const collectedKeys = new Set<string>();

  for (let i = 0; i < components.length; i++) {
    const component = components[i];
    const componentPath = path ? `${path}[${i}]` : `component[${i}]`;

    if (!component || typeof component !== 'object') {
      errors.push(`${componentPath}: Component must be an object`);
      continue;
    }

    // Check required field: type
    if (!component.type) {
      errors.push(`${componentPath}: Component must have a "type" field`);
    } else if (!validFieldTypes.includes(component.type)) {
      warnings.push(`${componentPath}: Unknown field type "${component.type}" - may not render correctly`);
    }

    // For input components, validate key and label
    if (component.input === true || ['textfield', 'email', 'number', 'select', 'textarea', 'checkbox', 'datetime', 'phoneNumber'].includes(component.type)) {
      if (!component.key) {
        errors.push(`${componentPath}: Input component must have a "key" field`);
      } else {
        // Check for duplicate keys
        if (collectedKeys.has(component.key)) {
          errors.push(`${componentPath}: Duplicate key "${component.key}" found`);
        }
        collectedKeys.add(component.key);

        // Key should be valid identifier
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(component.key)) {
          warnings.push(`${componentPath}: Key "${component.key}" should be a valid identifier (alphanumeric and underscore only)`);
        }
      }

      if (!component.label) {
        warnings.push(`${componentPath}: Input component should have a "label" field for better UX`);
      }
    }

    // Validate select/dropdown fields
    if (component.type === 'select') {
      if (!component.data || !component.data.values) {
        errors.push(`${componentPath}: Select field must have data.values array`);
      } else if (!Array.isArray(component.data.values)) {
        errors.push(`${componentPath}: data.values must be an array`);
      } else if (component.data.values.length === 0) {
        warnings.push(`${componentPath}: Select field has empty values array`);
      }
    }

    // Validate nested components (panels, columns, etc.)
    if (component.type === 'panel' || component.type === 'fieldset') {
      if (!component.components || !Array.isArray(component.components)) {
        errors.push(`${componentPath}: ${component.type} must have components array`);
      } else {
        validateFormComponents(component.components, errors, warnings, `${componentPath}.components`);
      }
    }

    // Validate columns layout
    if (component.type === 'columns') {
      if (!component.columns || !Array.isArray(component.columns)) {
        errors.push(`${componentPath}: columns layout must have columns array`);
      } else {
        for (let j = 0; j < component.columns.length; j++) {
          const column = component.columns[j];
          if (!column.components || !Array.isArray(column.components)) {
            errors.push(`${componentPath}.columns[${j}]: Column must have components array`);
          } else {
            validateFormComponents(column.components, errors, warnings, `${componentPath}.columns[${j}].components`);
          }
        }
      }
    }

    // Check validation rules
    if (component.validate) {
      if (typeof component.validate !== 'object') {
        errors.push(`${componentPath}: validate must be an object`);
      }
    }
  }
}

// Helper function to validate field mappings
function validateFieldMappings(mappings: any, formComponents: any[], errors: string[], warnings: string[]): void {
  if (typeof mappings !== 'object' || mappings === null) {
    errors.push('json_formio_mapping must be an object');
    return;
  }

  // Collect all field keys from form components
  const formKeys = new Set<string>();
  const collectKeys = (components: any[]) => {
    for (const comp of components) {
      if (comp.key) formKeys.add(comp.key);
      if (comp.components) collectKeys(comp.components);
      if (comp.columns) {
        for (const col of comp.columns) {
          if (col.components) collectKeys(col.components);
        }
      }
    }
  };
  collectKeys(formComponents);

  for (const [fieldKey, mapping] of Object.entries(mappings)) {
    if (!formKeys.has(fieldKey)) {
      warnings.push(`Mapping for "${fieldKey}" references a field key that doesn't exist in the form`);
    }

    if (typeof mapping !== 'object' || mapping === null) {
      errors.push(`Mapping for "${fieldKey}" must be an object`);
      continue;
    }

    const m = mapping as any;

    if (!m.sources || !Array.isArray(m.sources)) {
      errors.push(`Mapping for "${fieldKey}" must have sources array`);
      continue;
    }

    if (m.sources.length === 0) {
      warnings.push(`Mapping for "${fieldKey}" has empty sources array`);
    }

    for (let i = 0; i < m.sources.length; i++) {
      const source = m.sources[i];
      if (!source.promptId) {
        errors.push(`Mapping for "${fieldKey}".sources[${i}] must have promptId`);
      }
      if (!source.schemaFieldPath) {
        errors.push(`Mapping for "${fieldKey}".sources[${i}] must have schemaFieldPath`);
      }
    }

    if (!m.mappingType) {
      errors.push(`Mapping for "${fieldKey}" must have mappingType`);
    } else if (!['direct', 'concatenated'].includes(m.mappingType)) {
      errors.push(`Mapping for "${fieldKey}" has invalid mappingType "${m.mappingType}" (must be "direct" or "concatenated")`);
    }

    // Check concatenated mappings
    if (m.mappingType === 'concatenated' && m.sources.length < 2) {
      warnings.push(`Mapping for "${fieldKey}" is marked as concatenated but only has ${m.sources.length} source(s)`);
    }
  }
}

// Define tools - organized by category matching the SDK
const tools: Tool[] = [
  // ========== DOCUMENTS ==========
  {
    name: 'upload_documents',
    description: 'Upload documents to DocRouter',
    inputSchema: {
      type: 'object',
      properties: {
        documents: {
          type: 'array',
          description: 'Array of documents to upload',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Document name' },
              content: { type: 'string', description: 'Base64 encoded document content' },
              type: { type: 'string', description: 'Document type (pdf, image, etc.)' },
              metadata: { type: 'object', description: 'Optional metadata' },
            },
            required: ['name', 'content', 'type'],
          },
        },
      },
      required: ['documents'],
    },
  },
  {
    name: 'list_documents',
    description: 'List documents from DocRouter',
    inputSchema: {
      type: 'object',
      properties: {
        skip: { type: 'number', description: 'Number of documents to skip', default: 0 },
        limit: { type: 'number', description: 'Number of documents to return', default: 10 },
        tagIds: { type: 'string', description: 'Comma-separated list of tag IDs to filter by' },
        nameSearch: { type: 'string', description: 'Search by document name' },
        metadataSearch: { type: 'string', description: 'Search by metadata' },
      },
    },
  },
  {
    name: 'get_document',
    description: 'Get document by ID from DocRouter',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document to retrieve' },
        fileType: { type: 'string', description: 'File type to retrieve (pdf, image, etc.)', default: 'pdf' },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'update_document',
    description: 'Update document metadata',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document to update' },
        documentName: { type: 'string', description: 'New document name' },
        tagIds: { type: 'array', items: { type: 'string' }, description: 'Array of tag IDs' },
        metadata: { type: 'object', description: 'Document metadata' },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'delete_document',
    description: 'Delete a document',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document to delete' },
      },
      required: ['documentId'],
    },
  },

  // ========== OCR ==========
  {
    name: 'get_ocr_blocks',
    description: 'Get OCR blocks for a document',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document' },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'get_ocr_text',
    description: 'Get OCR text for a document',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document' },
        pageNum: { type: 'number', description: 'Optional page number' },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'get_ocr_metadata',
    description: 'Get OCR metadata for a document',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document' },
      },
      required: ['documentId'],
    },
  },

  // ========== LLM ==========
  {
    name: 'run_llm',
    description: 'Run AI extraction on a document using a specific prompt',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document' },
        promptRevId: { type: 'string', description: 'ID of the prompt' },
        force: { type: 'boolean', description: 'Force re-extraction', default: false },
      },
      required: ['documentId', 'promptRevId'],
    },
  },
  {
    name: 'get_llm_result',
    description: 'Get LLM extraction results',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document' },
        promptRevId: { type: 'string', description: 'ID of the prompt' },
        fallback: { type: 'boolean', description: 'Use fallback results', default: false },
      },
      required: ['documentId', 'promptRevId'],
    },
  },
  {
    name: 'update_llm_result',
    description: 'Update LLM extraction results',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document' },
        promptId: { type: 'string', description: 'ID of the prompt' },
        result: { type: 'object', description: 'Updated result data' },
        isVerified: { type: 'boolean', description: 'Whether result is verified', default: false },
      },
      required: ['documentId', 'promptId', 'result'],
    },
  },
  {
    name: 'delete_llm_result',
    description: 'Delete LLM extraction results',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document' },
        promptId: { type: 'string', description: 'ID of the prompt' },
      },
      required: ['documentId', 'promptId'],
    },
  },

  // ========== TAGS ==========
  {
    name: 'create_tag',
    description: 'Create a new tag',
    inputSchema: {
      type: 'object',
      properties: {
        tag: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Tag name' },
            color: { type: 'string', description: 'Tag color' },
          },
          required: ['name', 'color'],
        },
      },
      required: ['tag'],
    },
  },
  {
    name: 'get_tag',
    description: 'Get tag by ID',
    inputSchema: {
      type: 'object',
      properties: {
        tagId: { type: 'string', description: 'ID of the tag' },
      },
      required: ['tagId'],
    },
  },
  {
    name: 'list_tags',
    description: 'List all tags',
    inputSchema: {
      type: 'object',
      properties: {
        skip: { type: 'number', description: 'Number of tags to skip', default: 0 },
        limit: { type: 'number', description: 'Number of tags to return', default: 10 },
        nameSearch: { type: 'string', description: 'Search by tag name' },
      },
    },
  },
  {
    name: 'update_tag',
    description: 'Update a tag',
    inputSchema: {
      type: 'object',
      properties: {
        tagId: { type: 'string', description: 'ID of the tag' },
        tag: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Tag name' },
            color: { type: 'string', description: 'Tag color' },
          },
        },
      },
      required: ['tagId', 'tag'],
    },
  },
  {
    name: 'delete_tag',
    description: 'Delete a tag',
    inputSchema: {
      type: 'object',
      properties: {
        tagId: { type: 'string', description: 'ID of the tag' },
      },
      required: ['tagId'],
    },
  },

  // ========== FORMS ==========
  {
    name: 'create_form',
    description: 'Create a new form',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Form name' },
        response_format: { type: 'object', description: 'Form response format' },
      },
      required: ['name', 'response_format'],
    },
  },
  {
    name: 'list_forms',
    description: 'List all forms',
    inputSchema: {
      type: 'object',
      properties: {
        skip: { type: 'number', description: 'Number of forms to skip', default: 0 },
        limit: { type: 'number', description: 'Number of forms to return', default: 10 },
        tag_ids: { type: 'string', description: 'Comma-separated tag IDs' },
      },
    },
  },
  {
    name: 'get_form',
    description: 'Get form by ID',
    inputSchema: {
      type: 'object',
      properties: {
        formRevId: { type: 'string', description: 'ID of the form' },
      },
      required: ['formRevId'],
    },
  },
  {
    name: 'update_form',
    description: 'Update a form',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'ID of the form' },
        form: { type: 'object', description: 'Form data' },
      },
      required: ['formId', 'form'],
    },
  },
  {
    name: 'delete_form',
    description: 'Delete a form',
    inputSchema: {
      type: 'object',
      properties: {
        formId: { type: 'string', description: 'ID of the form' },
      },
      required: ['formId'],
    },
  },
  {
    name: 'submit_form',
    description: 'Submit a form',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document' },
        formRevId: { type: 'string', description: 'ID of the form' },
        submission_data: { type: 'object', description: 'Form submission data' },
        submitted_by: { type: 'string', description: 'User who submitted' },
      },
      required: ['documentId', 'formRevId', 'submission_data'],
    },
  },
  {
    name: 'get_form_submission',
    description: 'Get form submission',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document' },
        formRevId: { type: 'string', description: 'ID of the form' },
      },
      required: ['documentId', 'formRevId'],
    },
  },
  {
    name: 'delete_form_submission',
    description: 'Delete form submission',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'ID of the document' },
        formRevId: { type: 'string', description: 'ID of the form' },
      },
      required: ['documentId', 'formRevId'],
    },
  },

  // ========== PROMPTS ==========
  {
    name: 'create_prompt',
    description: 'Create a new prompt',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Prompt name' },
            content: { type: 'string', description: 'Prompt content' },
          },
          required: ['name', 'content'],
        },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'list_prompts',
    description: 'List all prompts',
    inputSchema: {
      type: 'object',
      properties: {
        skip: { type: 'number', description: 'Number of prompts to skip', default: 0 },
        limit: { type: 'number', description: 'Number of prompts to return', default: 10 },
        document_id: { type: 'string', description: 'Filter by document ID' },
        tag_ids: { type: 'string', description: 'Comma-separated tag IDs' },
        nameSearch: { type: 'string', description: 'Search by prompt name' },
      },
    },
  },
  {
    name: 'get_prompt',
    description: 'Get prompt by ID',
    inputSchema: {
      type: 'object',
      properties: {
        promptRevId: { type: 'string', description: 'ID of the prompt' },
      },
      required: ['promptRevId'],
    },
  },
  {
    name: 'update_prompt',
    description: 'Update a prompt',
    inputSchema: {
      type: 'object',
      properties: {
        promptId: { type: 'string', description: 'ID of the prompt' },
        prompt: { type: 'object', description: 'Prompt data' },
      },
      required: ['promptId', 'prompt'],
    },
  },
  {
    name: 'delete_prompt',
    description: 'Delete a prompt',
    inputSchema: {
      type: 'object',
      properties: {
        promptId: { type: 'string', description: 'ID of the prompt' },
      },
      required: ['promptId'],
    },
  },

  // ========== SCHEMAS ==========
  {
    name: 'create_schema',
    description: 'Create a new schema',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Schema name' },
        response_format: { type: 'object', description: 'Schema response format' },
      },
      required: ['name', 'response_format'],
    },
  },
  {
    name: 'list_schemas',
    description: 'List all schemas',
    inputSchema: {
      type: 'object',
      properties: {
        skip: { type: 'number', description: 'Number of schemas to skip', default: 0 },
        limit: { type: 'number', description: 'Number of schemas to return', default: 10 },
        nameSearch: { type: 'string', description: 'Search by schema name' },
      },
    },
  },
  {
    name: 'get_schema',
    description: 'Get schema by ID',
    inputSchema: {
      type: 'object',
      properties: {
        schemaRevId: { type: 'string', description: 'ID of the schema' },
      },
      required: ['schemaRevId'],
    },
  },
  {
    name: 'update_schema',
    description: 'Update a schema',
    inputSchema: {
      type: 'object',
      properties: {
        schemaId: { type: 'string', description: 'ID of the schema' },
        schema: { type: 'object', description: 'Schema data' },
      },
      required: ['schemaId', 'schema'],
    },
  },
  {
    name: 'delete_schema',
    description: 'Delete a schema',
    inputSchema: {
      type: 'object',
      properties: {
        schemaId: { type: 'string', description: 'ID of the schema' },
      },
      required: ['schemaId'],
    },
  },
  {
    name: 'validate_against_schema',
    description: 'Validate data against a schema',
    inputSchema: {
      type: 'object',
      properties: {
        schemaRevId: { type: 'string', description: 'ID of the schema' },
        data: { type: 'object', description: 'Data to validate' },
      },
      required: ['schemaRevId', 'data'],
    },
  },
  {
    name: 'validate_schema',
    description: 'Validate schema format for correctness and DocRouter compliance',
    inputSchema: {
      type: 'object',
      properties: {
        schema: { type: 'string', description: 'JSON string of the schema to validate' },
      },
      required: ['schema'],
    },
  },
  {
    name: 'validate_form',
    description: 'Validate Form.io form format for correctness and DocRouter compliance',
    inputSchema: {
      type: 'object',
      properties: {
        form: { type: 'string', description: 'JSON string of the form to validate' },
      },
      required: ['form'],
    },
  },



  // ========== LLM CHAT ==========
  {
    name: 'run_llm_chat',
    description: 'Run LLM chat',
    inputSchema: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          description: 'Chat messages',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', enum: ['system', 'user', 'assistant'] },
              content: { type: 'string' },
            },
            required: ['role', 'content'],
          },
        },
        model: { type: 'string', description: 'Model to use' },
        temperature: { type: 'number', description: 'Temperature setting' },
        max_tokens: { type: 'number', description: 'Maximum tokens' },
        stream: { type: 'boolean', description: 'Enable streaming' },
      },
      required: ['messages'],
    },
  },

  // ========== HELPER TOOLS ==========
  {
    name: 'help',
    description: 'Get help information about using the API',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'help_prompts',
    description: 'Get help information about creating and configuring prompts in DocRouter',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'help_schemas',
    description: 'Get help information about creating and configuring schemas in DocRouter',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'help_forms',
    description: 'Get help information about creating and configuring forms in DocRouter',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Call tool handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (!args) {
    throw new Error('No arguments provided');
  }

  try {
    switch (name) {
      case 'list_documents': {
        const result = await docrouterClient.listDocuments({
          skip: getOptionalArg(args, 'skip', 0),
          limit: getOptionalArg(args, 'limit', 10),
          nameSearch: getOptionalArg(args, 'nameSearch'),
          tagIds: getOptionalArg(args, 'tagIds'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'get_document': {
        const result = await docrouterClient.getDocument({
          documentId: getArg(args, 'documentId'),
          fileType: getArg(args, 'fileType', 'pdf'),
        });
        
        // Convert ArrayBuffer to base64 for transmission
        const base64Content = Buffer.from(result.content).toString('base64');
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                ...serializeDates(result),
                content: base64Content,
                content_type: 'base64',
                content_size: result.content.byteLength
              }, null, 2),
            },
          ],
        };
      }

      case 'get_ocr_text': {
        const result = await docrouterClient.getOCRText({
          documentId: getArg(args, 'documentId'),
          pageNum: getOptionalArg(args, 'pageNum'),
        });
        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      }

      case 'get_ocr_metadata': {
        const result = await docrouterClient.getOCRMetadata({
          documentId: getArg(args, 'documentId'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'list_tags': {
        const result = await docrouterClient.listTags({
          skip: getOptionalArg(args, 'skip', 0),
          limit: getOptionalArg(args, 'limit', 10),
          nameSearch: getOptionalArg(args, 'nameSearch'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'get_tag': {
        const result = await docrouterClient.getTag({
          tagId: getArg(args, 'tagId'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'list_prompts': {
        const result = await docrouterClient.listPrompts({
          skip: getOptionalArg(args, 'skip', 0),
          limit: getOptionalArg(args, 'limit', 10),
          nameSearch: getOptionalArg(args, 'nameSearch'),
          document_id: getOptionalArg(args, 'documentId'),
          tag_ids: getOptionalArg(args, 'tagIds'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'get_prompt': {
        const result = await docrouterClient.getPrompt({
          promptRevId: getArg(args, 'promptRevId'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'get_llm_result': {
        const result = await docrouterClient.getLLMResult({
          documentId: getArg(args, 'documentId'),
          promptRevId: getArg(args, 'promptRevId'),
          fallback: getOptionalArg(args, 'fallback', false),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }


      case 'run_llm': {
        const result = await docrouterClient.runLLM({
          documentId: getArg(args, 'documentId'),
          promptRevId: getArg(args, 'promptRevId'),
          force: getOptionalArg(args, 'force', false),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      // ========== DOCUMENTS ==========
      case 'upload_documents': {
        const documentsInput = getArg(args, 'documents') as Array<{ name: string; content: string; type: string; metadata?: Record<string, string>; }>;
        const documents = documentsInput.map(doc => ({
          ...doc,
          content: Buffer.from(doc.content, 'base64')
        }));
        const result = await docrouterClient.uploadDocuments({ documents });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'update_document': {
        const result = await docrouterClient.updateDocument({
          documentId: getArg(args, 'documentId'),
          documentName: getOptionalArg(args, 'documentName'),
          tagIds: getOptionalArg(args, 'tagIds'),
          metadata: getOptionalArg(args, 'metadata'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'delete_document': {
        const result = await docrouterClient.deleteDocument({
          documentId: getArg(args, 'documentId'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      // ========== OCR ==========
      case 'get_ocr_blocks': {
        const result = await docrouterClient.getOCRBlocks({
          documentId: getArg(args, 'documentId'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      // ========== LLM ==========
      case 'update_llm_result': {
        const result = await docrouterClient.updateLLMResult({
          documentId: getArg(args, 'documentId'),
          promptId: getArg(args, 'promptId'),
          result: getArg(args, 'result'),
          isVerified: getOptionalArg(args, 'isVerified', false),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'delete_llm_result': {
        const result = await docrouterClient.deleteLLMResult({
          documentId: getArg(args, 'documentId'),
          promptId: getArg(args, 'promptId'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }


      // ========== TAGS ==========
      case 'create_tag': {
        const result = await docrouterClient.createTag({
          tag: getArg(args, 'tag'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'update_tag': {
        const result = await docrouterClient.updateTag({
          tagId: getArg(args, 'tagId'),
          tag: getArg(args, 'tag'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'delete_tag': {
        const result = await docrouterClient.deleteTag({
          tagId: getArg(args, 'tagId'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      // ========== FORMS ==========
      case 'create_form': {
        const result = await docrouterClient.createForm({
          name: getArg(args, 'name'),
          response_format: getArg(args, 'response_format'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'list_forms': {
        const result = await docrouterClient.listForms({
          skip: getOptionalArg(args, 'skip', 0),
          limit: getOptionalArg(args, 'limit', 10),
          tag_ids: getOptionalArg(args, 'tag_ids'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'get_form': {
        const result = await docrouterClient.getForm({
          formRevId: getArg(args, 'formRevId'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'update_form': {
        const result = await docrouterClient.updateForm({
          formId: getArg(args, 'formId'),
          form: getArg(args, 'form'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'delete_form': {
        const result = await docrouterClient.deleteForm({
          formId: getArg(args, 'formId'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'submit_form': {
        const result = await docrouterClient.submitForm({
          documentId: getArg(args, 'documentId'),
          formRevId: getArg(args, 'formRevId'),
          submission_data: getArg(args, 'submission_data'),
          submitted_by: getOptionalArg(args, 'submitted_by'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'get_form_submission': {
        const result = await docrouterClient.getFormSubmission({
          documentId: getArg(args, 'documentId'),
          formRevId: getArg(args, 'formRevId'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'delete_form_submission': {
        const result = await docrouterClient.deleteFormSubmission({
          documentId: getArg(args, 'documentId'),
          formRevId: getArg(args, 'formRevId'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      // ========== PROMPTS ==========
      case 'create_prompt': {
        const result = await docrouterClient.createPrompt({
          prompt: getArg(args, 'prompt'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'update_prompt': {
        const result = await docrouterClient.updatePrompt({
          promptId: getArg(args, 'promptId'),
          prompt: getArg(args, 'prompt'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'delete_prompt': {
        const result = await docrouterClient.deletePrompt({
          promptId: getArg(args, 'promptId'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      // ========== SCHEMAS ==========
      case 'create_schema': {
        const result = await docrouterClient.createSchema({
          name: getArg(args, 'name'),
          response_format: getArg(args, 'response_format'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'list_schemas': {
        const result = await docrouterClient.listSchemas({
          skip: getOptionalArg(args, 'skip', 0),
          limit: getOptionalArg(args, 'limit', 10),
          nameSearch: getOptionalArg(args, 'nameSearch'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'get_schema': {
        const result = await docrouterClient.getSchema({
          schemaRevId: getArg(args, 'schemaRevId'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'update_schema': {
        const result = await docrouterClient.updateSchema({
          schemaId: getArg(args, 'schemaId'),
          schema: getArg(args, 'schema'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'delete_schema': {
        const result = await docrouterClient.deleteSchema({
          schemaId: getArg(args, 'schemaId'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'validate_against_schema': {
        const result = await docrouterClient.validateAgainstSchema({
          schemaRevId: getArg(args, 'schemaRevId'),
          data: getArg(args, 'data'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      case 'validate_schema': {
        const schemaString = getArg<string>(args, 'schema');
        try {
          const schema = JSON.parse(schemaString);
          const validationResult = validateSchemaFormat(schema);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(validationResult, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  valid: false,
                  errors: [`Invalid JSON string: ${error instanceof Error ? error.message : 'Unknown error'}`],
                  warnings: []
                }, null, 2),
              },
            ],
            isError: true,
          };
        }
      }

      case 'validate_form': {
        const formString = getArg<string>(args, 'form');
        try {
          const form = JSON.parse(formString);
          const validationResult = validateFormFormat(form);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(validationResult, null, 2),
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  valid: false,
                  errors: [`Invalid JSON string: ${error instanceof Error ? error.message : 'Unknown error'}`],
                  warnings: []
                }, null, 2),
              },
            ],
            isError: true,
          };
        }
      }



      // ========== LLM CHAT ==========
      case 'run_llm_chat': {
        const result = await docrouterClient.runLLMChat({
          messages: getArg(args, 'messages'),
          model: getOptionalArg(args, 'model'),
          temperature: getOptionalArg(args, 'temperature'),
          max_tokens: getOptionalArg(args, 'max_tokens'),
          stream: getOptionalArg(args, 'stream'),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(serializeDates(result), null, 2),
            },
          ],
        };
      }

      // ========== HELPER TOOLS ==========
      case 'help': {
        const helpText = `
# DocRouter API Help

This server provides access to DocRouter resources and tools.

## Available Tools

### Documents
- \`upload_documents(documents)\` - Upload documents
- \`list_documents(skip, limit, tagIds, nameSearch, metadataSearch)\` - List documents
- \`get_document(documentId, fileType)\` - Get document by ID
- \`update_document(documentId, documentName, tagIds, metadata)\` - Update document
- \`delete_document(documentId)\` - Delete document

### OCR
- \`get_ocr_blocks(documentId)\` - Get OCR blocks
- \`get_ocr_text(documentId, pageNum)\` - Get OCR text
- \`get_ocr_metadata(documentId)\` - Get OCR metadata

### LLM
- \`run_llm(documentId, promptRevId, force)\` - Run AI extraction
- \`get_llm_result(documentId, promptRevId, fallback)\` - Get extraction results
- \`update_llm_result(documentId, promptId, result, isVerified)\` - Update results
- \`delete_llm_result(documentId, promptId)\` - Delete results

### Tags
- \`create_tag(tag)\` - Create tag
- \`get_tag(tagId)\` - Get tag by ID
- \`list_tags(skip, limit, nameSearch)\` - List tags
- \`update_tag(tagId, tag)\` - Update tag
- \`delete_tag(tagId)\` - Delete tag

### Forms
- \`create_form(name, response_format)\` - Create form
- \`list_forms(skip, limit, tag_ids)\` - List forms
- \`get_form(formRevId)\` - Get form by ID
- \`update_form(formId, form)\` - Update form
- \`delete_form(formId)\` - Delete form
- \`submit_form(documentId, formRevId, submission_data, submitted_by)\` - Submit form
- \`get_form_submission(documentId, formRevId)\` - Get form submission
- \`delete_form_submission(documentId, formRevId)\` - Delete form submission

### Prompts
- \`create_prompt(prompt)\` - Create prompt
- \`list_prompts(skip, limit, document_id, tag_ids, nameSearch)\` - List prompts
- \`get_prompt(promptRevId)\` - Get prompt by ID
- \`update_prompt(promptId, prompt)\` - Update prompt
- \`delete_prompt(promptId)\` - Delete prompt

### Schemas
- \`create_schema(name, response_format)\` - Create schema
- \`list_schemas(skip, limit, nameSearch)\` - List schemas
- \`get_schema(schemaRevId)\` - Get schema by ID
- \`update_schema(schemaId, schema)\` - Update schema
- \`delete_schema(schemaId)\` - Delete schema
- \`validate_against_schema(schemaRevId, data)\` - Validate data
- \`validate_schema(schema)\` - Validate schema format for correctness (takes JSON string)


### LLM Chat
- \`run_llm_chat(messages, model, temperature, max_tokens, stream)\` - Run chat

### Help Tools
- \`help()\` - Get general API help information
- \`help_prompts()\` - Get detailed help on creating and configuring prompts
- \`help_schemas()\` - Get detailed help on creating and configuring schemas

## Example Workflows

1. List documents:
   \`\`\`
   list_documents()
   \`\`\`

2. Get OCR text for a document:
   \`\`\`
   get_ocr_text("doc123")
   \`\`\`

3. Run AI extraction:
   \`\`\`
   run_llm("doc123", "prompt456")
   \`\`\`

4. Get extraction results:
   \`\`\`
   get_llm_result("doc123", "prompt456")
   \`\`\`

5. Validate a schema format:
   \`\`\`
   validate_schema('{"type": "json_schema", "json_schema": {"name": "document_extraction", "schema": {"type": "object", "properties": {"name": {"type": "string", "description": "Document name"}}, "required": ["name"], "additionalProperties": false}, "strict": true}}')
   \`\`\`
        `;
        return {
          content: [
            {
              type: 'text',
              text: helpText,
            },
          ],
        };
      }

      case 'help_prompts': {
        try {
          // Get the directory of the current file
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = dirname(__filename);
          
          // Navigate to the knowledge base directory within the package
          const promptsPath = join(__dirname, 'docs/knowledge_base/prompts.md');
          const promptsContent = readFileSync(promptsPath, 'utf-8');
          
          return {
            content: [
              {
                type: 'text',
                text: promptsContent,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error reading prompts help file: ${handleError(error)}`,
              },
            ],
            isError: true,
          };
        }
      }

      case 'help_schemas': {
        try {
          // Get the directory of the current file
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = dirname(__filename);

          // Navigate to the knowledge base directory within the package
          const schemasPath = join(__dirname, 'docs/knowledge_base/schemas.md');
          const schemasContent = readFileSync(schemasPath, 'utf-8');

          return {
            content: [
              {
                type: 'text',
                text: schemasContent,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error reading schemas help file: ${handleError(error)}`,
              },
            ],
            isError: true,
          };
        }
      }

      case 'help_forms': {
        try {
          // Get the directory of the current file
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = dirname(__filename);

          // Navigate to the knowledge base directory within the package
          const formsPath = join(__dirname, 'docs/knowledge_base/forms.md');
          const formsContent = readFileSync(formsPath, 'utf-8');

          return {
            content: [
              {
                type: 'text',
                text: formsContent,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: 'text',
                text: `Error reading forms help file: ${handleError(error)}`,
              },
            ],
            isError: true,
          };
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: handleError(error),
        },
      ],
      isError: true,
    };
  }
});

// Main function
async function main() {
  try {
    const config = parseConfig();
    
    if (!config.organizationId || !config.orgToken) {
      console.error('Error: DOCROUTER_ORG_ID and DOCROUTER_ORG_API_TOKEN environment variables are required');
      console.error('Or provide them as command line arguments: --org-id <id> --org-token <token>');
      process.exit(1);
    }

    initializeClient(config);

    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error('DocRouter MCP server started successfully');
  } catch (error) {
    console.error('Failed to start DocRouter MCP server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('Shutting down DocRouter MCP server...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('Shutting down DocRouter MCP server...');
  process.exit(0);
});

// Start the server
if (require.main === module) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

