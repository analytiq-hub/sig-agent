'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPromptApi, updatePromptApi, listSchemasApi, getSchemaApi, listTagsApi, listLLMModelsApi, getPromptApi } from '@/utils/api';
import { PromptConfig, Schema, Tag, LLMModel } from '@/types/index';
import { getApiErrorMsg } from '@/utils/api';
import dynamic from 'next/dynamic';
import { SchemaResponseFormat } from '@/types/schemas';
import InfoTooltip from '@/components/InfoTooltip';
import TagSelector from './TagSelector';
import { toast } from 'react-toastify';
import { useRouter } from 'next/navigation';

// Define default model constant
const DEFAULT_LLM_MODEL = 'gemini-2.0-flash';

// Dynamically import MonacoEditor with no SSR
const MonacoEditor = dynamic(() => import('./MonacoEditor'), {
  ssr: false,
});

const PromptCreate: React.FC<{ organizationId: string, promptId?: string }> = ({ organizationId, promptId }) => {
  const router = useRouter();
  const [currentPromptId, setCurrentPromptId] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<PromptConfig>({
    name: '',
    content: '',
    schema_id: undefined,
    schema_version: undefined,
    tag_ids: [],
    model: undefined
  });
  const [isLoading, setIsLoading] = useState(false);
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [selectedSchemaDetails, setSelectedSchemaDetails] = useState<Schema | null>(null);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [llmModels, setLLMModels] = useState<LLMModel[]>([]);

  const handleSchemaSelect = useCallback(async (schemaId: string) => {
    setSelectedSchema(schemaId);
    
    // Update currentPrompt with schema_id
    setCurrentPrompt(prev => ({
      ...prev,
      schema_id: schemaId || undefined,
      schema_version: undefined  // Reset version until we load schema details
    }));

    if (schemaId) {
      try {
        // Find schema with matching schema_id and highest schema_version
        const matchingSchemas = schemas.filter(s => s.schema_id === schemaId);
        if (matchingSchemas.length > 0) {
          // Sort by schema_version in descending order and take the first one
          const schemaDoc = matchingSchemas.sort((a, b) => 
            (b.schema_version || 0) - (a.schema_version || 0)
          )[0];
          
          const schema = await getSchemaApi({ 
            organizationId: organizationId, 
            schemaRevId: schemaDoc.schema_revid 
          });

          setSelectedSchemaDetails(schema);
          // Update currentPrompt with the schema_id and version
          setCurrentPrompt(prev => ({
            ...prev,
            schema_id: schema.schema_id,
            schema_version: schema.schema_version
          }));
        }
      } catch (error) {
        toast.error(`Error fetching schema details: ${getApiErrorMsg(error)}`);
      }
    } else {
      setSelectedSchemaDetails(null);
    }
  }, [schemas, organizationId, setSelectedSchema, setSelectedSchemaDetails, setCurrentPrompt])

  // Load editing prompt if available
  useEffect(() => {
    const loadPrompt = async () => {
      if (promptId) {
        try {
          setIsLoading(true);
          const prompt = await getPromptApi({ organizationId, promptRevId: promptId });
          setCurrentPromptId(prompt.prompt_id);
          setCurrentPrompt({
            name: prompt.name,
            content: prompt.content,
            schema_id: prompt.schema_id,
            schema_version: prompt.schema_version,
            tag_ids: prompt.tag_ids || [],
            model: prompt.model
          });
          setSelectedTagIds(prompt.tag_ids || []);
          setSelectedSchema(prompt.schema_id || '');
          // Optionally, load schema details if needed
          if (prompt.schema_id) {
            await handleSchemaSelect(prompt.schema_id);
          } else {
            setSelectedSchemaDetails(null);
          }
        } catch (error) {
          toast.error(`Error loading prompt for editing: ${getApiErrorMsg(error)}`);
        } finally {
          setIsLoading(false);
        }
      }
    };
    loadPrompt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptId, organizationId]);

  // Initialize schema details when form is loaded with a schema
  useEffect(() => {
    const initSchema = async () => {
      if (currentPrompt.schema_id && schemas.length > 0) {
        // Find schema with matching schema_id and highest schema_version
        const matchingSchemas = schemas.filter(s => s.schema_id === currentPrompt.schema_id);
        if (matchingSchemas.length > 0) {
          // Sort by schema_version in descending order and take the first one
          const schemaDoc = matchingSchemas.sort((a, b) => 
            (b.schema_version || 0) - (a.schema_version || 0)
          )[0];
          
          try {
            const schema = await getSchemaApi({ 
              organizationId: organizationId, 
              schemaRevId: schemaDoc.schema_revid 
            });
            setSelectedSchemaDetails(schema);
            // Ensure currentPrompt has the latest schema_version
            setCurrentPrompt(prev => ({
              ...prev,
              schema_version: schema.schema_version
            }));
          } catch (error) {
            toast.error(`Error fetching schema details: ${getApiErrorMsg(error)}`);
          }
        }
      }
    };
    
    initSchema();
  }, [schemas, currentPrompt.schema_id, organizationId]);

  const savePrompt = async () => {
    try {
      setIsLoading(true);
      
      // Create the prompt object with tag_ids
      const promptToSave = {
        ...currentPrompt,
        tag_ids: selectedTagIds
      };

      if (currentPromptId) {
        // Update existing prompt
        await updatePromptApi({organizationId: organizationId, promptId: currentPromptId, prompt: promptToSave});
      } else {
        // Create new prompt
        await createPromptApi({organizationId: organizationId, prompt: promptToSave});
      }

      // Clear the form
      setCurrentPrompt({
        name: '',
        content: '',
        schema_id: undefined,
        schema_version: undefined,
        tag_ids: [],
        model: undefined
      });
      setCurrentPromptId(null);
      setSelectedSchema('');
      setSelectedSchemaDetails(null);
      setSelectedTagIds([]);

      router.push(`/orgs/${organizationId}/prompts`);
      
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error saving prompt';
      toast.error('Error: ' + errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSchemas = useCallback(async () => {
    try {
      const response = await listSchemasApi({ organizationId: organizationId });
      setSchemas(response.schemas);
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error loading schemas';
      toast.error('Error: ' + errorMsg);
    }
  }, [organizationId]);

  const loadTags = useCallback(async () => {
    try {
      const response = await listTagsApi({ organizationId: organizationId });
      setAvailableTags(response.tags);
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error loading tags';
      toast.error('Error: ' + errorMsg);
    }
  }, [organizationId]);

  const loadLLMModels = useCallback(async () => {
    try {
      const response = await listLLMModelsApi({
        providerName: null,
        providerEnabled: true,
        llmEnabled: true
      });
      setLLMModels(response.models);
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error loading LLM models';
      toast.error('Error: ' + errorMsg);
    }
  }, []);

  useEffect(() => {
    loadSchemas();
    loadTags();
    loadLLMModels();
  }, [loadSchemas, loadTags, loadLLMModels]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPrompt.name || !currentPrompt.content) {
      toast.error('Please fill in all fields');
      return;
    }

    savePrompt();
  };

  // Helper function
  const isJsonContent = (content: string): boolean => {
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  };

  // Helper function
  const jsonSchemaToFields = (responseFormat: SchemaResponseFormat) => {
    const fields = [];
    const properties = responseFormat.json_schema.schema.properties;
    
    for (const [name, prop] of Object.entries(properties)) {
      const type = prop.type === 'string' ? 'str' :
                 prop.type === 'integer' ? 'int' :
                 prop.type === 'number' ? 'float' :
                 prop.type === 'boolean' ? 'bool' : 'str';
                 
      fields.push({ name, type });
    }
    return fields;
  };

  return (
    <div className="p-4 w-full">
      {/* Prompt Creation Form */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="hidden md:flex items-center gap-2 mb-4">
          <h2 className="text-xl font-bold">
            {currentPromptId ? 'Edit Prompt' : 'Create Prompt'}
          </h2>
          <InfoTooltip 
            title="Configuring Prompts"
            content={
              <>
                <p className="mb-2">
                  Prompts are instructions that guide AI models to perform specific tasks. An effective prompt should be clear, specific, and provide necessary context.
                </p>
                <p className="mb-2">
                  <strong>Schema:</strong> Link a schema to ensure structured output in a consistent format.
                </p>
                <p className="mb-2">
                  <strong>Model:</strong> Choose the appropriate model based on task complexity and performance requirements.
                </p>
                <p>
                  <strong>Tags:</strong> Only files with the selected tags will be processed by this prompt.
                </p>
              </>
            }
          />
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Prompt Name Input and Action Buttons in a flex container */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 md:w-1/2 md:max-w-[calc(50%-1rem)]">
              <input
                type="text"
                className="w-full p-2 border rounded"
                value={currentPrompt.name}
                onChange={e => setCurrentPrompt({ ...currentPrompt, name: e.target.value })}
                placeholder="Prompt Name"
                disabled={isLoading}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  // Clear the form
                  setCurrentPromptId(null);
                  setCurrentPrompt({
                    name: '',
                    content: '',
                    schema_id: undefined,
                    schema_version: undefined,
                    tag_ids: [],
                    model: undefined
                  });
                  setSelectedSchema('');
                  setSelectedSchemaDetails(null);
                  setSelectedTagIds([]);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
                disabled={isLoading}
              >
                Clear
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                disabled={isLoading}
              >
                {currentPromptId ? 'Update Prompt' : 'Save Prompt'}
              </button>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden bg-white">
            <MonacoEditor
              value={currentPrompt.content}
              onChange={(value) => setCurrentPrompt(prev => ({ ...prev, content: value }))}
              language={isJsonContent(currentPrompt.content) ? 'json' : 'markdown'}
              height="400px"
            />
          </div>

          <div className="flex gap-4">
            <div className="w-1/2 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700" data-tour="prompt-schema-select">
                  Schema (Optional)
                </label>
                <select
                  value={selectedSchema}
                  onChange={(e) => handleSchemaSelect(e.target.value)}
                  disabled={isLoading}
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm"
                >
                  <option value="">None</option>
                  {schemas.map((schema) => (
                    <option key={schema.schema_id} value={schema.schema_id}>
                      {schema.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700" data-tour="prompt-model-select">
                  Model
                </label>
                <select
                  value={currentPrompt.model || DEFAULT_LLM_MODEL}
                  onChange={(e) => setCurrentPrompt(prev => ({ ...prev, model: e.target.value }))}
                  disabled={isLoading}
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {llmModels.map((model) => (
                    <option key={model.litellm_model} value={model.litellm_model}>
                      {model.litellm_model} ({model.litellm_provider})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Tags
                </label>
                <TagSelector
                  availableTags={availableTags}
                  selectedTagIds={selectedTagIds}
                  onChange={setSelectedTagIds}
                  disabled={isLoading}
                />
              </div>
            </div>

            {selectedSchemaDetails && (
              <div className="w-1/2 p-4 bg-gray-50 rounded-md">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Schema: {selectedSchemaDetails.name} (v{selectedSchemaDetails.schema_version})
                </h3>
                <div className="space-y-1">
                  {jsonSchemaToFields(selectedSchemaDetails.response_format).map((field, index) => (
                    <div key={index} className="text-sm text-gray-600">
                      • {field.name}: <span className="text-gray-500">{field.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default PromptCreate; 