export interface FormProperty {
  type: 'string' | 'integer' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  items?: FormProperty;  // For array types
  properties?: Record<string, FormProperty>;  // For object types
  additionalProperties?: boolean;  // Add this for object types
  required?: string[];  // Add this for object types to specify required properties
}

export interface FormResponseFormat {
  type: 'json_form';
  json_form: {
    name: string;
    form: {
      type: 'object';
      properties: Record<string, FormProperty>;
      required: string[];
      additionalProperties: boolean;
    };
    strict: boolean;
  };
}

export interface Form {
  form_revid: string; // MongoDB's _id
  form_id: string;  // Stable identifier
  name: string;
  response_format: FormResponseFormat;
  form_version: number;
  created_at: string;
  created_by: string;
}

export interface FormField {
  name: string;
  type: 'str' | 'int' | 'float' | 'bool' | 'object' | 'array';
  description?: string;
  nestedFields?: FormField[]; // For object types
  arrayItemType?: 'str' | 'int' | 'float' | 'bool' | 'object'; // For array types
  arrayObjectFields?: FormField[]; // For array of objects
}

export interface FormConfig {
  name: string;
  response_format: FormResponseFormat;
}

export interface CreateFormParams extends FormConfig {
  organizationId: string;
}

export interface ListFormsParams {
  organizationId: string;
  skip?: number;
  limit?: number;
}

export interface ListFormsResponse {
  forms: Form[];
  total_count: number;
  skip: number;
}

export interface GetFormParams {
  organizationId: string;
  formId: string;
}

export interface UpdateFormParams {
  organizationId: string;
  formId: string;
  form: FormConfig;
}

export interface DeleteFormParams {
  organizationId: string;
  formId: string;
}