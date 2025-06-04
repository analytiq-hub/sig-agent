import React, { useState, useEffect } from 'react';
import { Delete as DeleteIcon, Edit as EditIcon, MoreVert as MoreVertIcon } from '@mui/icons-material';
import { getLLMTokensApi, createLLMTokenApi, deleteLLMTokenApi } from '@/utils/api';
import { LLMToken } from '@/types/index';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

const LLMTokenManager: React.FC = () => {
  const [llmTokens, setLLMTokens] = useState<LLMToken[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [editTokenValue, setEditTokenValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);

  useEffect(() => {
    const getLLMTokensData = async () => {
      try {
        const response = await getLLMTokensApi();
        setLLMTokens(response.llm_tokens);
      } catch (error) {
        console.error('Error fetching LLM tokens:', error);
      }
    };

    getLLMTokensData();
  }, []);

  const handleEditLLMToken = (provider: string) => {
    setEditingProvider(provider);
    setEditTokenValue('');
    setEditModalOpen(true);
  };

  const handleSaveLLMToken = async () => {
    if (!editingProvider) return;

    try {
      await createLLMTokenApi({
        llm_vendor: editingProvider as 'OpenAI' | 'Anthropic' | 'Gemini' | 'Groq' | 'Mistral',
        token: editTokenValue,
      });
      setEditModalOpen(false);
      // Refresh the LLM tokens list
      const response = await getLLMTokensApi();
      setLLMTokens(response.llm_tokens);
    } catch (error) {
      console.error('Error saving LLM token:', error);
      setError('An error occurred while saving the LLM token. Please try again.');
    }
  };

  const handleDeleteLLMToken = async (tokenId: string) => {
    try {
      await deleteLLMTokenApi(tokenId);
      // Refresh the LLM tokens list
      const response = await getLLMTokensApi();
      setLLMTokens(response.llm_tokens);
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

  return (
    <div>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-1/5 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Provider
              </th>
              <th className="w-2/5 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Token
              </th>
              <th className="w-1/4 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created At
              </th>
              <th className="w-[15%] px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {['OpenAI', 'Anthropic', 'Gemini', 'Groq', 'Mistral'].map((provider) => {
              const token = llmTokens.find(t => t.llm_vendor === provider);
              return (
                <tr 
                  key={provider}
                  className="even:bg-gray-50"
                >
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                    {provider}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                    {token ? (
                      <span>{token.token.slice(0, 16)}••••••••</span>
                    ) : (
                      <span className="text-gray-400">Not set</span>
                    )}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                    {token ? new Date(token.created_at).toLocaleString() : '-'}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm">
                    <button
                      onClick={(e) => handleMenuOpen(e, provider)}
                      className="p-1 text-gray-600 hover:text-gray-900 rounded-full hover:bg-gray-100"
                    >
                      <MoreVertIcon className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
        {selectedProvider && llmTokens.find(t => t.llm_vendor === selectedProvider) && (
          <MenuItem
            onClick={() => {
              const token = llmTokens.find(t => t.llm_vendor === selectedProvider);
              if (token) handleDeleteLLMToken(token.id);
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
