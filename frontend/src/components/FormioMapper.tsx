'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { listPromptsApi, getSchemaApi, listSchemasApi } from '@/utils/api';
import { Prompt } from '@/types/prompts';
import { Schema, SchemaProperty } from '@/types/schemas';
import { FieldMapping, FieldMappingSource } from '@/types/forms';
import { getApiErrorMsg } from '@/utils/api';
import { toast } from 'react-toastify';
import { 
  ChevronDownIcon, 
  ChevronRightIcon,
  MagnifyingGlassIcon,
  ArrowPathIcon,
  LinkIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface FormioMapperProps {
  organizationId: string;
  selectedTagIds: string[];
  formComponents: any[];
  fieldMappings: Record<string, FieldMapping>;
  onMappingChange: (mappings: Record<string, FieldMapping>) => void;
}

interface SchemaField {
  name: string;
  path: string;
  type: string;
  description?: string;
  promptId: string;
  promptName: string;
}

interface FormField {
  key: string;
  label: string;
  type: string;
  path: string[];
}

const FormioMapper: React.FC<FormioMapperProps> = ({
  organizationId,
  selectedTagIds,
  formComponents,
  fieldMappings,
  onMappingChange
}) => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [schemas, setSchemas] = useState<Record<string, Schema>>({});
  const [allSchemas, setAllSchemas] = useState<Schema[]>([]);
  const [schemaFields, setSchemaFields] = useState<SchemaField[]>([]);
  const [formFields, setFormFields] = useState<FormField[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedPrompts, setExpandedPrompts] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedField, setDraggedField] = useState<SchemaField | null>(null);

  // Load prompts and schemas based on selected tags
  const loadPromptsAndSchemas = useCallback(async () => {
    if (selectedTagIds.length === 0) {
      setPrompts([]);
      setSchemas({});
      setSchemaFields([]);
      return;
    }

    setLoading(true);
    try {
      // First, fetch all schemas to get schema_revid mappings
      const allSchemasResponse = await listSchemasApi({
        organizationId,
        limit: 100 // Maximum allowed by backend
      });
      setAllSchemas(allSchemasResponse.schemas);

      // Fetch prompts with matching tags
      const promptsResponse = await listPromptsApi({
        organizationId,
        tag_ids: selectedTagIds.join(','),
        limit: 100
      });

      setPrompts(promptsResponse.prompts);

      // Fetch schemas for prompts that have schema_id
      const schemaPromises = promptsResponse.prompts
        .filter(prompt => prompt.schema_id)
        .map(async (prompt) => {
          try {
            // Find the matching schema with the latest version
            const matchingSchemas = allSchemasResponse.schemas.filter(s => 
              s.schema_id === prompt.schema_id
            );
            
            if (matchingSchemas.length === 0) {
              console.warn(`No schema found with id ${prompt.schema_id}`);
              return {};
            }

            // Fetch the full schema using schema_revid
            const schema = await getSchemaApi({
              organizationId,
              schemaId: matchingSchemas[0].schema_revid
            });
            return { [prompt.schema_id!]: schema };
          } catch (error) {
            console.error(`Error loading schema ${prompt.schema_id}:`, error);
            return {};
          }
        });

      const schemaResults = await Promise.all(schemaPromises);
      const combinedSchemas = schemaResults.reduce((acc, curr) => ({ ...acc, ...curr }), {});
      setSchemas(combinedSchemas);

      // Parse schema fields recursively
      const allSchemaFields: SchemaField[] = [];
      promptsResponse.prompts.forEach(prompt => {
        if (prompt.schema_id && combinedSchemas[prompt.schema_id]) {
          const schema = combinedSchemas[prompt.schema_id];
          const properties = schema.response_format.json_schema.schema.properties;
          
          // Recursive function to parse nested properties
          const parseProperties = (props: Record<string, any>, basePath: string = '') => {
            Object.entries(props).forEach(([fieldName, fieldDef]) => {
              const fullPath = basePath ? `${basePath}.${fieldName}` : fieldName;
              const displayName = basePath ? `${basePath}.${fieldName}` : fieldName;
              
              // Add the current field
              allSchemaFields.push({
                name: displayName,
                path: fullPath,
                type: fieldDef.type,
                description: fieldDef.description,
                promptId: prompt.prompt_revid,
                promptName: prompt.name
              });

              // Recursively handle nested object properties
              if (fieldDef.type === 'object' && fieldDef.properties) {
                parseProperties(fieldDef.properties, fullPath);
              }

              // Handle array of objects
              if (fieldDef.type === 'array' && fieldDef.items?.type === 'object' && fieldDef.items.properties) {
                // Add array item properties with [n] notation
                parseProperties(fieldDef.items.properties, `${fullPath}[0]`);
              }
            });
          };

          parseProperties(properties);
        }
      });

      setSchemaFields(allSchemaFields);
    } catch (error) {
      console.error('Error loading prompts and schemas:', error);
      toast.error(`Error loading data: ${getApiErrorMsg(error)}`);
    } finally {
      setLoading(false);
    }
  }, [organizationId, selectedTagIds]);

  // Parse form components into flat field list
  const parseFormFields = useCallback((components: any[], path: string[] = []): FormField[] => {
    const fields: FormField[] = [];

    components.forEach(component => {
      if (component.key && component.type) {
        // Skip layout components without data
        if (!['panel', 'fieldset', 'columns', 'tabs', 'well'].includes(component.type)) {
          fields.push({
            key: component.key,
            label: component.label || component.key,
            type: component.type,
            path: [...path, component.key]
          });
        }
      }

      // Recursively parse nested components
      if (component.components) {
        fields.push(...parseFormFields(component.components, [...path, component.key || '']));
      }
      if (component.columns) {
        component.columns.forEach((column: any) => {
          if (column.components) {
            fields.push(...parseFormFields(column.components, [...path, component.key || '']));
          }
        });
      }
      if (component.tabs) {
        component.tabs.forEach((tab: any) => {
          if (tab.components) {
            fields.push(...parseFormFields(tab.components, [...path, component.key || '']));
          }
        });
      }
    });

    return fields;
  }, []);

  // Update form fields when components change
  useEffect(() => {
    setFormFields(parseFormFields(formComponents));
  }, [formComponents, parseFormFields]);

  // Load data when tags change
  useEffect(() => {
    loadPromptsAndSchemas();
  }, [loadPromptsAndSchemas]);

  // Filter schema fields based on search
  const filteredSchemaFields = schemaFields.filter(field =>
    field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    field.promptName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    field.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group schema fields by prompt
  const groupedSchemaFields = filteredSchemaFields.reduce((acc, field) => {
    if (!acc[field.promptId]) {
      acc[field.promptId] = {
        promptName: field.promptName,
        fields: []
      };
    }
    acc[field.promptId].fields.push(field);
    return acc;
  }, {} as Record<string, { promptName: string; fields: SchemaField[] }>);

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, field: SchemaField) => {
    setDraggedField(field);
    e.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'schema-field',
      field
    }));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Handle drop on form field
  const handleDrop = (e: React.DragEvent, formField: FormField) => {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    
    if (data.type === 'schema-field') {
      const schemaField = data.field as SchemaField;
      
      // Check type compatibility for string fields (most flexible for concatenation)
      if (!isCompatibleType(schemaField.type, formField.type)) {
        toast.error(`Cannot map ${schemaField.type} field to ${formField.type} component`);
        return;
      }

      // Create new source
      const newSource: FieldMappingSource = {
        promptId: schemaField.promptId,
        promptName: schemaField.promptName,
        schemaFieldPath: schemaField.path,
        schemaFieldName: schemaField.name,
        schemaFieldType: schemaField.type
      };

      // Get existing mapping or create new one
      const existingMapping = fieldMappings[formField.key];
      
      if (existingMapping) {
        // Add to existing mapping (concatenation)
        const updatedMapping: FieldMapping = {
          ...existingMapping,
          sources: [...existingMapping.sources, newSource],
          mappingType: existingMapping.sources.length > 0 ? 'concatenated' : 'direct',
          concatenationSeparator: existingMapping.concatenationSeparator || ' '
        };
        
        onMappingChange({
          ...fieldMappings,
          [formField.key]: updatedMapping
        });
        
        toast.success(`Added ${schemaField.name} to ${formField.label} (${existingMapping.sources.length + 1} fields)`);
      } else {
        // Create new mapping
        const newMapping: FieldMapping = {
          sources: [newSource],
          mappingType: 'direct',
          concatenationSeparator: ' '
        };

        onMappingChange({
          ...fieldMappings,
          [formField.key]: newMapping
        });

        toast.success(`Mapped ${schemaField.name} to ${formField.label}`);
      }
    }
    setDraggedField(null);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, formField: FormField) => {
    e.preventDefault();
    if (draggedField && isCompatibleType(draggedField.type, formField.type)) {
      e.dataTransfer.dropEffect = 'copy';
    } else {
      e.dataTransfer.dropEffect = 'none';
    }
  };

  // Remove entire mapping
  const removeMapping = (formFieldKey: string) => {
    const newMappings = { ...fieldMappings };
    delete newMappings[formFieldKey];
    onMappingChange(newMappings);
    toast.success('Mapping removed');
  };

  // Remove specific source from mapping
  const removeSource = (formFieldKey: string, sourceIndex: number) => {
    const mapping = fieldMappings[formFieldKey];
    if (!mapping) return;

    const newSources = mapping.sources.filter((_, index) => index !== sourceIndex);
    
    if (newSources.length === 0) {
      // Remove entire mapping if no sources left
      removeMapping(formFieldKey);
    } else {
      // Update mapping with remaining sources
      const updatedMapping: FieldMapping = {
        ...mapping,
        sources: newSources,
        mappingType: newSources.length === 1 ? 'direct' : 'concatenated'
      };
      
      onMappingChange({
        ...fieldMappings,
        [formFieldKey]: updatedMapping
      });
      
      toast.success('Source removed from mapping');
    }
  };

  // Check type compatibility
  const isCompatibleType = (schemaType: string, formType: string): boolean => {
    const typeMapping: Record<string, string[]> = {
      'string': ['textfield', 'textarea', 'email', 'url', 'phoneNumber', 'select', 'radio', 'selectboxes'],
      'number': ['number', 'currency'],
      'integer': ['number', 'currency'],
      'boolean': ['checkbox', 'radio'],
      'array': ['select', 'selectboxes', 'datagrid', 'editgrid'],
      'object': ['container', 'datagrid', 'editgrid']
    };

    return typeMapping[schemaType]?.includes(formType) || false;
  };

  // Get type badge color
  const getTypeBadgeColor = (type: string): string => {
    const colors: Record<string, string> = {
      'string': 'bg-blue-100 text-blue-800',
      'number': 'bg-green-100 text-green-800',
      'integer': 'bg-green-100 text-green-800',
      'boolean': 'bg-purple-100 text-purple-800',
      'array': 'bg-orange-100 text-orange-800',
      'object': 'bg-gray-100 text-gray-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="h-[calc(100vh-300px)] flex gap-4">
      {/* Left Panel - Schema Fields */}
      <div className="w-1/2 border rounded-lg bg-white overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-900 mb-3">Schema Fields</h3>
          
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search fields..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-500" />
              <span className="ml-2 text-gray-500">Loading schemas...</span>
            </div>
          ) : selectedTagIds.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>Select tags in the form to see available schema fields</p>
            </div>
          ) : Object.keys(groupedSchemaFields).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No prompts with schemas found for selected tags</p>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(groupedSchemaFields).map(([promptId, { promptName, fields }]) => (
                <div key={promptId} className="border rounded-lg">
                  <button
                    onClick={() => setExpandedPrompts(prev => 
                      prev.has(promptId) 
                        ? new Set([...prev].filter(id => id !== promptId))
                        : new Set([...prev, promptId])
                    )}
                    className="w-full px-3 py-2 flex items-center justify-between bg-gray-50 hover:bg-gray-100 text-left"
                  >
                    <span className="font-medium text-sm">{promptName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{fields.length} fields</span>
                      {expandedPrompts.has(promptId) ? (
                        <ChevronDownIcon className="h-4 w-4" />
                      ) : (
                        <ChevronRightIcon className="h-4 w-4" />
                      )}
                    </div>
                  </button>
                  
                  {expandedPrompts.has(promptId) && (
                    <div className="p-2 space-y-1">
                      {fields.map((field) => (
                        <div
                          key={field.path}
                          draggable
                          onDragStart={(e) => handleDragStart(e, field)}
                          className="flex items-center justify-between p-2 bg-white border rounded cursor-move hover:bg-blue-50 hover:border-blue-300 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{field.name}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${getTypeBadgeColor(field.type)}`}>
                                {field.type}
                              </span>
                            </div>
                            {field.description && (
                              <p className="text-xs text-gray-500 mt-1 truncate">{field.description}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Form Fields */}
      <div className="w-1/2 border rounded-lg bg-white overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-900">Form Fields</h3>
          <p className="text-sm text-gray-500 mt-1">Drop schema fields here to create mappings</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {formFields.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No form fields available</p>
              <p className="text-sm mt-1">Create fields in the Form Builder tab</p>
            </div>
          ) : (
            <div className="space-y-2">
              {formFields.map((formField) => {
                const mapping = fieldMappings[formField.key];
                const isDropTarget = draggedField && isCompatibleType(draggedField.type, formField.type);
                
                return (
                  <div
                    key={formField.key}
                    onDrop={(e) => handleDrop(e, formField)}
                    onDragOver={(e) => handleDragOver(e, formField)}
                    className={`p-3 border-2 border-dashed rounded-lg transition-colors ${
                      mapping 
                        ? 'border-green-300 bg-green-50' 
                        : isDropTarget 
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{formField.label}</span>
                          <span className="text-xs text-gray-500">({formField.type})</span>
                          {mapping && <LinkIcon className="h-4 w-4 text-green-600" />}
                        </div>
                        
                        {mapping && (
                          <div className="mt-2 p-2 bg-white border rounded text-xs">
                            {mapping.sources.length > 1 && (
                              <div className="mb-2 flex items-center justify-between">
                                <span className="text-blue-600 font-medium">
                                  {mapping.mappingType === 'concatenated' ? 'Concatenated' : 'Multiple'} mapping
                                </span>
                                <button
                                  onClick={() => removeMapping(formField.key)}
                                  className="text-red-500 hover:text-red-700"
                                  title="Remove all mappings"
                                >
                                  <XMarkIcon className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                            
                            <div className="space-y-1">
                              {mapping.sources.map((source, index) => (
                                <div key={index} className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <span className="font-medium text-green-700">
                                      {source.schemaFieldName}
                                    </span>
                                    <span className="text-gray-500 ml-2">
                                      from {source.promptName}
                                    </span>
                                  </div>
                                  <button
                                    onClick={() => mapping.sources.length === 1 
                                      ? removeMapping(formField.key) 
                                      : removeSource(formField.key, index)
                                    }
                                    className="text-red-500 hover:text-red-700"
                                    title={mapping.sources.length === 1 ? "Remove mapping" : "Remove this source"}
                                  >
                                    <XMarkIcon className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                            
                            {mapping.mappingType === 'concatenated' && (
                              <div className="mt-2 pt-2 border-t">
                                <span className="text-gray-600">
                                  Separator: "{mapping.concatenationSeparator || ' '}"
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FormioMapper;