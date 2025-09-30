export interface SchemaProperty {
  type: 'string' | 'integer' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  items?: SchemaProperty;  // For array types
  properties?: Record<string, SchemaProperty>;  // For object types
  additionalProperties?: boolean;  // Add this for object types
  required?: string[];  // Add this for object types to specify required properties
}

export interface SchemaResponseFormat {
  type: 'json_schema';
  json_schema: {
    name: string;
    schema: {
      type: 'object';
      properties: Record<string, SchemaProperty>;
      required: string[];
      additionalProperties: boolean;
    };
    strict: boolean;
  };
}

export interface Schema {
  schema_revid: string; // MongoDB's _id
  schema_id: string;  // Stable identifier
  name: string;
  response_format: SchemaResponseFormat;
  schema_version: number;
  created_at: string;
  created_by: string;
}

export interface SchemaField {
  name: string;
  type: 'str' | 'int' | 'float' | 'bool' | 'object' | 'array';
  description?: string;
  nestedFields?: SchemaField[]; // For object types
  arrayItemType?: 'str' | 'int' | 'float' | 'bool' | 'object'; // For array types
  arrayObjectFields?: SchemaField[]; // For array of objects
}

export interface SchemaConfig {
  name: string;
  response_format: SchemaResponseFormat;
}

export interface CreateSchemaParams extends SchemaConfig {
  organizationId: string;
}

export interface ListSchemasParams {
  organizationId: string;
  skip?: number;
  limit?: number;
  nameSearch?: string;
}

export interface ListSchemasResponse {
  schemas: Schema[];
  total_count: number;
  skip: number;
}

export interface GetSchemaParams {
  organizationId: string;
  schemaRevId: string;
}

export interface UpdateSchemaParams {
  organizationId: string;
  schemaId: string;
  schema: SchemaConfig;
}

export interface DeleteSchemaParams {
  organizationId: string;
  schemaId: string;
}
