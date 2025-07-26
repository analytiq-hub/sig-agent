export interface FormResponseFormat {
  json_formio?: object | null; // Just use any for the free-form dict
}

export interface Form {
  form_revid: string; // MongoDB's _id
  form_id: string;  // Stable identifier
  name: string;
  response_format: FormResponseFormat;
  form_version: number;
  created_at: string;
  created_by: string;
  tag_ids?: string[]; // Add tag_ids to match backend model
}

export interface FormConfig {
  name: string;
  response_format: FormResponseFormat;
  tag_ids?: string[]; // Add tag_ids support
}

export interface CreateFormParams extends FormConfig {
  organizationId: string;
}

export interface ListFormsParams {
  organizationId: string;
  skip?: number;
  limit?: number;
  tag_ids?: string; // Add tag_ids support for filtering
}

export interface ListFormsResponse {
  forms: Form[];
  total_count: number;
  skip: number;
}

export interface GetFormParams {
  organizationId: string;
  formRevId: string; // GET uses form revision ID
}

export interface UpdateFormParams {
  organizationId: string;
  formId: string; // UPDATE uses form ID
  form: FormConfig;
}

export interface DeleteFormParams {
  organizationId: string;
  formId: string; // DELETE uses form ID
}