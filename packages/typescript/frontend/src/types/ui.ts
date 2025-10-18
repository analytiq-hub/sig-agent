// Frontend-specific UI types that are not part of the SDK
// These types are used for UI components and form building

// ============================================================================
// Schema UI Types
// ============================================================================

/**
 * UI-friendly representation of schema fields for form building
 * This is different from the SDK's SchemaProperty which follows JSON Schema standard
 */
export interface SchemaField {
  name: string;
  type: 'str' | 'int' | 'float' | 'bool' | 'object' | 'array';
  description?: string;
  nestedFields?: SchemaField[];
  arrayItemType?: 'str' | 'int' | 'float' | 'bool' | 'object';
  arrayObjectFields?: SchemaField[];
}

// ============================================================================
// Form UI Types (Form.io specific)
// ============================================================================

/**
 * Represents a Form.io form component structure
 * Used for parsing and manipulating Form.io JSON structures
 */
export interface FormComponent {
  key?: string;
  type?: string;
  label?: string;
  components?: FormComponent[];
  columns?: FormComponent[];
  tabs?: FormComponent[];
}

/**
 * Flattened representation of form fields for easier UI manipulation
 * Used for drag & drop, field mapping, and form builder UI
 */
export interface FormField {
  key: string;
  label: string;
  type: string;
  path: string[];
}

