import React, { useState, useEffect, useCallback } from 'react';
import { createPromptApi, listPromptsApi, deletePromptApi, updatePromptApi, listSchemasApi, getSchemaApi, listTagsApi, listLLMModelsApi } from '@/utils/api';
import { Prompt, PromptConfig, Schema, Tag, LLMModel } from '@/types/index';
import { getApiErrorMsg } from '@/utils/api';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { TextField, InputAdornment, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import colors from 'tailwindcss/colors';
import { isColorLight } from '@/utils/colors';
import dynamic from 'next/dynamic';
import { ResponseFormat } from '@/types/schemas';

// Dynamically import MonacoEditor with no SSR
const MonacoEditor = dynamic(() => import('./MonacoEditor'), {
  ssr: false,
});

const Prompts: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
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
  const [searchTerm, setSearchTerm] = useState('');
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [selectedSchemaDetails, setSelectedSchemaDetails] = useState<Schema | null>(null);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [total, setTotal] = useState(0);
  const [llmModels, setLLMModels] = useState<LLMModel[]>([]);

  const savePrompt = async () => {
    try {
      setIsLoading(true);
      
      // Check for existing prompt with same name when creating new prompt
      if (!currentPromptId) {
        const existingPrompt = prompts.find(
          p => p.name.toLowerCase() === currentPrompt.name.toLowerCase()
        );
        if (existingPrompt) {
          setMessage('Error: A prompt with this name already exists. To modify it, please use the edit button in the table.');
          return;
        }
      }

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

      // After successful save, reset to first page and reload
      setPage(0);
      await loadPrompts();

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

  const loadPrompts = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await listPromptsApi({
        organizationId: organizationId,
        skip: page * pageSize,
        limit: pageSize
      });
      setPrompts(response.prompts);
      setTotal(response.total_count);
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error loading prompts';
      setMessage('Error: ' + errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, organizationId]);

  const handleDelete = async (promptId: string) => {
    try {
      setIsLoading(true);
      await deletePromptApi({organizationId: organizationId, promptId: promptId});
      setPrompts(prompts.filter(prompt => prompt.id !== promptId));
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error deleting prompt';
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

  const handleSchemaSelect = async (schemaName: string) => {
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
  };

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
      setLLMModels(response.models);
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error loading LLM models';
      setMessage('Error: ' + errorMsg);
    }
  }, []);

  useEffect(() => {
    loadPrompts();
    loadSchemas();
    loadTags();
    loadLLMModels();
  }, [loadPrompts, loadSchemas, loadTags, loadLLMModels]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPrompt.name || !currentPrompt.content) {
      setMessage('Please fill in all fields');
      return;
    }

    savePrompt();
  };

  // Add filtered prompts
  const filteredPrompts = prompts.filter(prompt =>
    prompt.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Define columns for the data grid
  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Prompt',
      flex: 1,
      headerAlign: 'left',
      align: 'left',
      renderCell: (params) => (
        <div className="text-blue-600 flex items-center h-full">
          {params.row.name}
        </div>
      ),
    },
    {
      field: 'version',
      headerName: 'Version',
      width: 100,
      headerAlign: 'left',
      align: 'left',
      renderCell: (params) => (
        <div className="text-gray-600 flex items-center h-full">
          v{params.row.version}
        </div>
      ),
    },
    {
      field: 'schema_name',
      headerName: 'Schema',
      width: 150,
      headerAlign: 'left',
      align: 'left',
      renderCell: (params) => (
        <div className="text-gray-600 flex items-center h-full">
          {params.row.schema_name 
            ? `${params.row.schema_name}:v${params.row.schema_version}`
            : '-'}
        </div>
      ),
    },
    {
      field: 'model',
      headerName: 'Model',
      width: 150,
      headerAlign: 'left',
      align: 'left',
      renderCell: (params) => (
        <div className="text-gray-600 flex items-center h-full">
          {params.row.model || 'gpt-4o-mini'}
        </div>
      ),
    },
    {
      field: 'tag_ids',
      headerName: 'Tags',
      width: 200,
      headerAlign: 'left',
      align: 'left',
      renderCell: (params) => {
        const promptTags = availableTags.filter(tag => 
          params.row.tag_ids?.includes(tag.id)
        );
        return (
          <div className="flex gap-1 flex-wrap">
            {promptTags.map(tag => (
              <div
                key={tag.id}
                className={`px-2 py-1 rounded text-xs ${
                  isColorLight(tag.color) ? 'text-gray-800' : 'text-white'
                }`}
                style={{ backgroundColor: tag.color }}
              >
                {tag.name}
              </div>
            ))}
          </div>
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      headerAlign: 'left',
      align: 'left',
      sortable: false,
      renderCell: (params) => (
        <div className="flex gap-2 items-center h-full">
          <IconButton
            onClick={async () => {
              setCurrentPromptId(params.row.id);
              setCurrentPrompt({
                name: params.row.name,
                content: params.row.content,
                schema_name: params.row.schema_name,
                schema_version: params.row.schema_version,
                tag_ids: params.row.tag_ids || [],
                model: params.row.model
              });
              
              setSelectedTagIds(params.row.tag_ids || []);
              
              setSelectedSchema(params.row.schema_name || '');
              
              if (params.row.schema_name) {
                await handleSchemaSelect(params.row.schema_name);
              } else {
                setSelectedSchemaDetails(null);
              }
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            disabled={isLoading}
            className="text-blue-600 hover:bg-blue-50"
          >
            <EditOutlinedIcon />
          </IconButton>
          <IconButton
            onClick={() => handleDelete(params.row.id)}
            disabled={isLoading}
            className="text-red-600 hover:bg-red-50"
          >
            <DeleteOutlineIcon />
          </IconButton>
        </div>
      ),
    },
  ];

  // Add this helper function
  const isJsonContent = (content: string): boolean => {
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  };

  // Add this helper function at the top of the file
  const jsonSchemaToFields = (responseFormat: ResponseFormat) => {
    const fields = [];
    const properties = responseFormat.json_schema.schema.properties;
    
    for (const [name, prop] of Object.entries(properties)) {
      const type = prop.type === 'string' && prop.format === 'date-time' ? 'datetime' :
                 prop.type === 'string' ? 'str' :
                 prop.type === 'integer' ? 'int' :
                 prop.type === 'number' ? 'float' :
                 prop.type === 'boolean' ? 'bool' : 'str';
                 
      fields.push({ name, type });
    }
    return fields;
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Prompt Creation Form */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-bold mb-4">
          {currentPromptId ? 'Edit Prompt' : 'Create Prompt'}
        </h2>
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
                <label className="block text-sm font-medium text-gray-700">
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
                <label className="block text-sm font-medium text-gray-700">
                  Model
                </label>
                <select
                  value={currentPrompt.model || 'gpt-4o-mini'}
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

      {/* Prompts List */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Prompts</h2>
        
        {/* Search Box */}
        <div className="mb-4">
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search prompts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
        </div>

        {/* Data Grid */}
        <div style={{ height: 400, width: '100%' }}>
          <DataGrid
            rows={filteredPrompts}
            columns={columns}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 5 }
              },
              sorting: {
                sortModel: [{ field: 'id', sort: 'desc' }]  // Sort by id descending by default
              }
            }}
            pageSizeOptions={[5, 10, 20]}
            disableRowSelectionOnClick
            loading={isLoading}
            paginationMode="server"
            rowCount={total}  // Add this to show total count
            onPaginationModelChange={(model) => {
              setPage(model.page);
              setPageSize(model.pageSize);
            }}
            sx={{
              '& .MuiDataGrid-cell': {
                padding: '8px',
              },
              '& .MuiDataGrid-row:nth-of-type(odd)': {
                backgroundColor: colors.gray[100],
              },
              '& .MuiDataGrid-row:hover': {
                backgroundColor: `${colors.gray[200]} !important`,
              },
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Prompts;
