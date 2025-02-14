export interface JsonSchemaProperty {
  type: 'string' | 'integer' | 'number' | 'boolean' | 'array' | 'object';
  format?: 'date-time';
  description?: string;
  items?: JsonSchemaProperty;  // For array types
  properties?: Record<string, JsonSchemaProperty>;  // For object types
}

export interface JsonSchema {
  type: 'json_schema';
  json_schema: {
    name: string;
    schema: {
      type: 'object';
      properties: Record<string, JsonSchemaProperty>;
      required: string[];
      additionalProperties: boolean;
    };
    strict: boolean;
  };
}

export interface Schema {
  id: string;
  name: string;
  json_schema: JsonSchema;
  version: number;
  created_at: string;
  created_by: string;
}

export interface SchemaField {
  name: string;
  type: 'str' | 'int' | 'float' | 'bool' | 'datetime';
}

export interface SchemaConfig {
  name: string;
  json_schema: JsonSchema;
}

export interface CreateSchemaParams extends SchemaConfig {
  organizationId: string;
}

export interface ListSchemasParams {
  organizationId: string;
  skip?: number;
  limit?: number;
}

export interface ListSchemasResponse {
  schemas: Schema[];
  total_count: number;
  skip: number;
}

export interface GetSchemaParams {
  organizationId: string;
  schemaId: string;
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
