import React, { useState, useEffect } from 'react';
import { Prompt, createPromptApi, getPromptsApi, deletePromptApi, updatePromptApi } from '@/utils/api';
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

  const savePrompt = async (prompt: {name: string; content: string}) => {
    try {
      setIsLoading(true);
      let savedPrompt: Prompt;
      
      const promptData = {
        name: prompt.name,
        content: prompt.content
        // Not including schema info for now
      };

      if (currentPrompt.id) {
        savedPrompt = await updatePromptApi(currentPrompt.id, promptData);
        setPrompts(prompts.map(p => p.name === savedPrompt.name ? savedPrompt : p));
      } else {
        savedPrompt = await createPromptApi(promptData);
        const existingIndex = prompts.findIndex(p => 
          p.name.toLowerCase() === savedPrompt.name.toLowerCase()
        );
        
        if (existingIndex >= 0) {
          setPrompts(prompts.map(p => 
            p.name.toLowerCase() === savedPrompt.name.toLowerCase() ? savedPrompt : p
          ));
        } else {
          setPrompts([...prompts, savedPrompt]);
        }
      }
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

  useEffect(() => {
    loadPrompts();
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
        <div className="text-blue-600">
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
        <div className="text-gray-600 truncate">
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
        <div className="text-gray-600">
          v{params.row.version}
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
            onClick={() => {
              setCurrentPrompt({
                id: params.row.id,
                name: params.row.name,
                content: params.row.content
              });
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
            <label className="block text-sm font-medium mb-1">Prompt Name</label>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={currentPrompt.name}
              onChange={e => setCurrentPrompt({ ...currentPrompt, name: e.target.value })}
              placeholder="PromptName"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Prompt Content</label>
            <textarea
              className="w-full p-2 border rounded min-h-[200px]"
              value={currentPrompt.content}
              onChange={e => setCurrentPrompt({ ...currentPrompt, content: e.target.value })}
              placeholder="Enter your prompt text here..."
              disabled={isLoading}
            />
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
