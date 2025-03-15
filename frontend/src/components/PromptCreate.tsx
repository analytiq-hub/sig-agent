import React, { useState, useEffect, useCallback } from 'react';
import { createPromptApi, updatePromptApi, listSchemasApi, getSchemaApi, listTagsApi, listLLMModelsApi } from '@/utils/api';
import { PromptConfig, Schema, Tag, LLMModel } from '@/types/index';
import { getApiErrorMsg } from '@/utils/api';
import { isColorLight } from '@/utils/colors';
import dynamic from 'next/dynamic';
import { ResponseFormat } from '@/types/schemas';
import InfoTooltip from '@/components/InfoTooltip';
import { usePromptContext } from '@/contexts/PromptContext';

// Define default model constant
const DEFAULT_LLM_MODEL = 'gemini-2.0-flash';

// Dynamically import MonacoEditor with no SSR
const MonacoEditor = dynamic(() => import('./MonacoEditor'), {
  ssr: false,
});

const PromptCreate: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const { editingPrompt, setEditingPrompt } = usePromptContext();
  
  const [currentPromptId, setCurrentPromptId] = useState<string | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<PromptConfig>({
    name: '',
    content: '',
    schema_name: undefined,
    schema_version: undefined,
    tag_ids: [],
    model: undefined
  });
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [selectedSchemaDetails, setSelectedSchemaDetails] = useState<Schema | null>(null);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [llmModels, setLLMModels] = useState<LLMModel[]>([]);

  const handleSchemaSelect = useCallback(async (schemaName: string) => {
    setSelectedSchema(schemaName);
    
    // Update currentPrompt with the new schema name (or undefined if no schema selected)
    setCurrentPrompt(prev => ({
      ...prev,
      schema_name: schemaName || undefined,
      schema_version: undefined  // Reset version until we load schema details
    }));

    if (schemaName) {
      const schemaId = schemas.find(s => s.name === schemaName)?.id;
      if (schemaId) {
        try {
          const schema = await getSchemaApi({ organizationId: organizationId, schemaId });
          setSelectedSchemaDetails(schema);
          // Update currentPrompt with the schema version
          setCurrentPrompt(prev => ({
            ...prev,
            schema_version: schema.version
          }));
        } catch (error) {
          console.error('Error fetching schema details:', error);
          setMessage('Error: Unable to fetch schema details');
        }
      }
    } else {
      setSelectedSchemaDetails(null);
    }
  }, [schemas, organizationId, setMessage, setSelectedSchema, setSelectedSchemaDetails, setCurrentPrompt]);

  // Load editing prompt if available
  useEffect(() => {
    if (editingPrompt) {
      setCurrentPromptId(editingPrompt.id);
      setCurrentPrompt({
        name: editingPrompt.name,
        content: editingPrompt.content,
        schema_name: editingPrompt.schema_name,
        schema_version: editingPrompt.schema_version,
        tag_ids: editingPrompt.tag_ids || [],
        model: editingPrompt.model
      });
      
      setSelectedTagIds(editingPrompt.tag_ids || []);
      setSelectedSchema(editingPrompt.schema_name || '');
      
      if (editingPrompt.schema_name) {
        handleSchemaSelect(editingPrompt.schema_name);
      } else {
        setSelectedSchemaDetails(null);
      }
      
      // Clear the editing prompt after loading
      setEditingPrompt(null);
    }
  }, [editingPrompt, setEditingPrompt, handleSchemaSelect]);

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
        schema_name: undefined,
        schema_version: undefined,
        tag_ids: [],
        model: undefined
      });
      setCurrentPromptId(null);
      setSelectedSchema('');
      setSelectedSchemaDetails(null);
      setSelectedTagIds([]);
      setMessage('Prompt saved successfully');
      
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error saving prompt';
      setMessage('Error: ' + errorMsg);
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
      setMessage('Error: ' + errorMsg);
    }
  }, [organizationId]);

  const loadTags = useCallback(async () => {
    try {
      const response = await listTagsApi({ organizationId: organizationId });
      setAvailableTags(response.tags);
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error loading tags';
      setMessage('Error: ' + errorMsg);
    }
  }, [organizationId]);

  const loadLLMModels = useCallback(async () => {
    try {
      const response = await listLLMModelsApi();
      
      // Sort models: Gemini models first (alphabetically), then other models alphabetically
      const sortedModels = [...response.models].sort((a, b) => {
        const aIsGemini = a.name.toLowerCase().includes(DEFAULT_LLM_MODEL);
        const bIsGemini = b.name.toLowerCase().includes(DEFAULT_LLM_MODEL);
        
        // If one is Gemini and the other isn't, prioritize Gemini
        if (aIsGemini && !bIsGemini) return -1;
        if (!aIsGemini && bIsGemini) return 1;
        
        // If both are Gemini or both are non-Gemini, sort alphabetically
        return a.name.localeCompare(b.name);
      });
      
      setLLMModels(sortedModels);
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error loading LLM models';
      setMessage('Error: ' + errorMsg);
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
      setMessage('Please fill in all fields');
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
  const jsonSchemaToFields = (responseFormat: ResponseFormat) => {
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
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-xl font-bold" data-tour="prompts">
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
          <div>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={currentPrompt.name}
              onChange={e => setCurrentPrompt({ ...currentPrompt, name: e.target.value })}
              placeholder="Prompt Name"
              disabled={isLoading}
            />
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
                <label className="block text-sm font-medium text-gray-700" data-tour="prompts-schema-select">
                  Schema (Optional)
                </label>
                <select
                  value={selectedSchema}
                  onChange={(e) => handleSchemaSelect(e.target.value)}
                  disabled={isLoading}
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  <option value="">None</option>
                  {schemas.map((schema) => (
                    <option key={schema.id} value={schema.name}>
                      {schema.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700" data-tour="prompts-model-select">
                  Model
                </label>
                <select
                  value={currentPrompt.model || DEFAULT_LLM_MODEL}
                  onChange={(e) => setCurrentPrompt(prev => ({ ...prev, model: e.target.value }))}
                  disabled={isLoading}
                  className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {llmModels.map((model) => (
                    <option key={model.id} value={model.name}>
                      {model.name} ({model.provider})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableTags.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => {
                        setSelectedTagIds(prev => 
                          prev.includes(tag.id)
                            ? prev.filter(id => id !== tag.id)
                            : [...prev, tag.id]
                        )
                      }}
                      className={`group transition-all ${
                        selectedTagIds.includes(tag.id)
                          ? 'ring-2 ring-blue-500 ring-offset-2'
                          : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-2'
                      }`}
                    >
                      <div className="flex items-center h-full w-full">
                        <div 
                          className={`px-2 py-1 leading-none rounded shadow-sm flex items-center gap-2 text-sm ${
                            isColorLight(tag.color) ? 'text-gray-800' : 'text-white'
                          }`}
                          style={{ backgroundColor: tag.color }}
                        >
                          {tag.name}
                          {selectedTagIds.includes(tag.id) && (
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {selectedSchemaDetails && (
              <div className="w-1/2 p-4 bg-gray-50 rounded-md">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Schema: {selectedSchemaDetails.name} (v{selectedSchemaDetails.version})
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

          {/* Submit Button */}
          <div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={isLoading}
            >
              Save Prompt
            </button>
          </div>
        </form>

        {/* Message */}
        {message && (
          <div className={`mt-4 p-3 rounded ${
            message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
          }`}>
            {message}
            {message.includes('dependent prompts') && (
              <div className="mt-2">
                <div className="font-semibold">Dependent prompts:</div>
                <ul className="list-disc pl-5">
                  {(JSON.parse(message.split('dependent prompts:')[1]) as Array<{name: string; version: number}>)
                    .map((prompt, idx) => (
                      <li key={idx}>
                        {prompt.name} (v{prompt.version})
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PromptCreate; 