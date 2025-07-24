export interface FormSchemaConfig {
  name: string;
  description?: string;
  form_json_schema: Record<string, unknown>; // JSON Schema with UI positioning metadata
}

export interface FormSchema extends FormSchemaConfig {
  form_schema_revid: string; // MongoDB's _id for this revision
  form_schema_id: string;    // Stable identifier
  form_schema_version: number;
  organization_id: string;
  created_at: string;
  created_by: string;
  updated_at: string;
}

export interface CreateFormSchemaParams extends FormSchemaConfig {
  organizationId: string;
}

export interface ListFormSchemasParams {
  organizationId: string;
  skip?: number;
  limit?: number;
}

export interface ListFormSchemasResponse {
  forms: FormSchema[];
  total_count: number;
  skip: number;
}

export interface GetFormSchemaParams {
  organizationId: string;
  formSchemaRevid: string;
}

export interface UpdateFormSchemaParams {
  organizationId: string;
  formSchemaId: string;
  formSchema: FormSchemaConfig;
}

export interface DeleteFormSchemaParams {
  organizationId: string;
  formSchemaId: string;
}
