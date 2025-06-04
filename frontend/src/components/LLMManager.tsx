import React, { useState, useEffect } from 'react';
import { Delete as DeleteIcon, Edit as EditIcon, MoreVert as MoreVertIcon } from '@mui/icons-material';
import { listLLMProvidersApi, setLLMProviderConfigApi } from '@/utils/api';
import { LLMProvider } from '@/types/index';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import colors from 'tailwindcss/colors';

const LLMTokenManager: React.FC = () => {
  const [llmProviders, setLLMProviders] = useState<LLMProvider[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [editTokenValue, setEditTokenValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getLLMProvidersData = async () => {
      try {
        setLoading(true);
        const response = await listLLMProvidersApi();
        setLLMProviders(response.providers);
      } catch (error) {
        console.error('Error fetching LLM providers:', error);
      } finally {
        setLoading(false);
      }
    };

    getLLMProvidersData();
  }, []);

  const handleEditLLMToken = (provider: string) => {
    setEditingProvider(provider);
    setEditTokenValue('');
    setEditModalOpen(true);
  };

  const handleSaveLLMToken = async () => {
    if (!editingProvider) return;

    try {
      await setLLMProviderConfigApi(editingProvider, {
        token: editTokenValue,
        enabled: true,
        litellm_model_default: null,
        litellm_models: null
      });
      setEditModalOpen(false);
      // Refresh the LLM providers list
      const response = await listLLMProvidersApi();
      setLLMProviders(response.providers);
    } catch (error) {
      console.error('Error saving LLM token:', error);
      setError('An error occurred while saving the LLM token. Please try again.');
    }
  };

  const handleDeleteLLMToken = async (providerName: string) => {
    try {
      await setLLMProviderConfigApi(providerName, {
        token: null,
        enabled: false,
        litellm_model_default: null,
        litellm_models: null
      });
      // Refresh the LLM providers list
      const response = await listLLMProvidersApi();
      setLLMProviders(response.providers);
    } catch (error) {
      console.error('Error deleting LLM token:', error);
      setError('An error occurred while deleting the LLM token. Please try again.');
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, provider: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedProvider(provider);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedProvider(null);
  };

  // Filter providers based on search
  const filteredProviders = llmProviders.filter(provider => 
    searchQuery === '' || 
    provider.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Provider',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'token',
      headerName: 'Token',
      flex: 1,
      minWidth: 200,
      renderCell: (params: GridRenderCellParams) => (
        <span>{params.value ? `${params.value.slice(0, 16)}••••••••` : 'Not set'}</span>
      ),
    },
    {
      field: 'token_created_at',
      headerName: 'Created At',
      flex: 1,
      minWidth: 150,
      renderCell: (params: GridRenderCellParams) => (
        <span>{params.value ? new Date(params.value).toLocaleString() : '-'}</span>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 80,
      renderCell: (params) => (
        <div>
          <button
            onClick={(e) => handleMenuOpen(e, params.row.name)}
            className="p-1 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100"
          >
            <MoreVertIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="mb-4">
        <input
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          placeholder="Search providers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div style={{ height: 400, width: '100%' }}>
        <DataGrid
          rows={filteredProviders}
          columns={columns}
          loading={loading}
          disableRowSelectionOnClick
          getRowId={(row) => row.name}
          sx={{
            '& .MuiDataGrid-cell': {
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              height: '100%',
            },
            '& .MuiDataGrid-row': {
              height: '48px !important',
            },
            '& .MuiDataGrid-row:nth-of-type(odd)': {
              backgroundColor: colors.gray[100],
            },
            '& .MuiDataGrid-row:hover': {
              backgroundColor: `${colors.gray[200]} !important`,
            }
          }}
        />
      </div>

      {/* Edit Token Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Edit {editingProvider} Token</h2>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mt-4">
              <label htmlFor="token" className="block text-sm font-medium text-gray-700 mb-1">
                Token
              </label>
              <input
                id="token"
                type="text"
                value={editTokenValue}
                onChange={(e) => setEditTokenValue(e.target.value)}
                placeholder="Enter your token"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveLLMToken}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            if (selectedProvider) handleEditLLMToken(selectedProvider);
            handleMenuClose();
          }}
          className="flex items-center gap-2"
        >
          <EditIcon fontSize="small" className="text-blue-600" />
          <span>Edit</span>
        </MenuItem>
        {selectedProvider && llmProviders.find(p => p.name === selectedProvider) && (
          <MenuItem
            onClick={() => {
              const provider = llmProviders.find(p => p.name === selectedProvider);
              if (provider) handleDeleteLLMToken(provider.name);
              handleMenuClose();
            }}
            className="flex items-center gap-2"
          >
            <DeleteIcon fontSize="small" className="text-red-600" />
            <span>Delete</span>
          </MenuItem>
        )}
      </Menu>

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white border-l-4 border-red-500 shadow-lg rounded-lg p-4 animate-slide-up">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3 w-full">
              <p className="text-sm text-gray-800">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-auto flex-shrink-0 text-gray-400 hover:text-gray-500"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LLMTokenManager;
