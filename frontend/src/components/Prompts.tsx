import React, { useState, useEffect } from 'react';
import { Prompt, PromptCreate, createPromptApi, getPromptsApi, deletePromptApi, updatePromptApi, Schema, getSchemasApi, getSchemaApi } from '@/utils/api';
import { getApiErrorMsg } from '@/utils/api';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { TextField, InputAdornment, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import colors from 'tailwindcss/colors';

const Prompts: React.FC = () => {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [currentPrompt, setCurrentPrompt] = useState<{id?: string; name: string; content: string}>({
    name: '',
    content: ''
  });
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [schemas, setSchemas] = useState<Schema[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<string>('');
  const [selectedSchemaDetails, setSelectedSchemaDetails] = useState<Schema | null>(null);

  const savePrompt = async (prompt: {name: string; content: string}) => {
    try {
      setIsLoading(true);
      let savedPrompt: Prompt;
      
      const promptData: PromptCreate = {
        name: prompt.name,
        content: prompt.content,
        schema_name: selectedSchema || undefined,
        schema_version: undefined
      };

      if (selectedSchema) {
        try {
          const schemaId = schemas.find(s => s.name === selectedSchema)?.id;
          if (schemaId) {
            const schema = await getSchemaApi(schemaId);
            promptData.schema_version = schema.version || undefined;
          }
        } catch (error) {
          console.error('Error fetching schema version:', error);
          setMessage('Error: Unable to fetch schema version');
          return;
        }
      }

      if (currentPrompt.id) {
        // Update existing prompt
        savedPrompt = await updatePromptApi(currentPrompt.id, promptData);
        // Reload all prompts to get the latest versions
        await loadPrompts();
      } else {
        // Create new prompt
        savedPrompt = await createPromptApi(promptData);
        setPrompts([...prompts, savedPrompt]);
      }

      // Clear the form
      setCurrentPrompt({ name: '', content: '' });
      setSelectedSchema('');
      setSelectedSchemaDetails(null);
      setMessage('Prompt saved successfully');
      
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error saving prompt';
      setMessage('Error: ' + errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPrompts = async () => {
    try {
      setIsLoading(true);
      const response = await getPromptsApi();
      setPrompts(response.prompts);
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error loading prompts';
      setMessage('Error: ' + errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (promptId: string) => {
    try {
      setIsLoading(true);
      await deletePromptApi(promptId);
      setPrompts(prompts.filter(prompt => prompt.id !== promptId));
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error deleting prompt';
      setMessage('Error: ' + errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSchemas = async () => {
    try {
      const response = await getSchemasApi();
      setSchemas(response.schemas);
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error loading schemas';
      setMessage('Error: ' + errorMsg);
    }
  };

  const handleSchemaSelect = async (schemaName: string) => {
    setSelectedSchema(schemaName);
    if (schemaName) {
      const schemaId = schemas.find(s => s.name === schemaName)?.id;
      if (schemaId) {
        try {
          const schema = await getSchemaApi(schemaId);
          setSelectedSchemaDetails(schema);
        } catch (error) {
          console.error('Error fetching schema details:', error);
          setMessage('Error: Unable to fetch schema details');
        }
      }
    } else {
      setSelectedSchemaDetails(null);
    }
  };

  useEffect(() => {
    loadPrompts();
    loadSchemas();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPrompt.name || !currentPrompt.content) {
      setMessage('Please fill in all fields');
      return;
    }

    savePrompt(currentPrompt);
    setCurrentPrompt({ name: '', content: '' });
  };

  // Add filtered prompts
  const filteredPrompts = prompts.filter(prompt =>
    prompt.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Define columns for the data grid
  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Prompt Name',
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
      field: 'content',
      headerName: 'Content',
      flex: 2,
      headerAlign: 'left',
      align: 'left',
      renderCell: (params) => (
        <div className="text-gray-600 truncate flex items-center h-full">
          {params.row.content}
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
              setCurrentPrompt({
                id: params.row.id,
                name: params.row.name,
                content: params.row.content
              });
              if (params.row.schema_name) {
                await handleSchemaSelect(params.row.schema_name);
              } else {
                setSelectedSchema('');
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

  return (
    <div className="p-4 max-w-4xl mx-auto">
      {/* Prompt Creation Form */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-bold mb-4">Create Prompt</h2>
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

          <div>
            <textarea
              className="w-full p-2 border rounded min-h-[200px]"
              value={currentPrompt.content}
              onChange={e => setCurrentPrompt({ ...currentPrompt, content: e.target.value })}
              placeholder="Prompt text content"
              disabled={isLoading}
            />
          </div>

          <div className="flex gap-4">
            <div className="w-1/2 space-y-2">
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

            {selectedSchemaDetails && (
              <div className="w-1/2 p-4 bg-gray-50 rounded-md">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Schema: {selectedSchemaDetails.name} (v{selectedSchemaDetails.version})
                </h3>
                <div className="space-y-1">
                  {selectedSchemaDetails.fields.map((field, index) => (
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
            }}
            pageSizeOptions={[5, 10, 20]}
            disableRowSelectionOnClick
            loading={isLoading}
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
