export interface SchemaField {
  name: string;
  type: 'str' | 'int' | 'float' | 'bool' | 'datetime';
}

export interface SchemaConfig {
  name: string;
  fields: SchemaField[];
}

export interface Schema extends SchemaConfig {
  id: string;
  version: number;
  created_at: string;
  created_by: string;
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
