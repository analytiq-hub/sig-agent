import React, { useState, useEffect } from 'react';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import Switch from '@mui/material/Switch';
import { listLLMProvidersApi, setLLMProviderConfigApi } from '@/utils/api';
import { LLMProvider } from '@/types/index';

interface LLMProviderConfigProps {
  providerName: string;
}

const LLMProviderConfig: React.FC<LLMProviderConfigProps> = ({ providerName }) => {
  const [provider, setProvider] = useState<LLMProvider | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProviderData = async () => {
      try {
        setLoading(true);
        const response = await listLLMProvidersApi();
        const foundProvider = response.providers.find(p => p.name === providerName);
        if (foundProvider) {
          setProvider(foundProvider);
        } else {
          setError('Provider not found');
        }
      } catch (error) {
        console.error('Error fetching provider data:', error);
        setError('An error occurred while fetching provider data.');
      } finally {
        setLoading(false);
      }
    };

    fetchProviderData();
  }, [providerName]);

  const handleToggleModel = async (model: string, enabled: boolean) => {
    if (!provider) return;

    try {
      const updatedModels = enabled
        ? [...provider.litellm_models, model]
        : provider.litellm_models.filter(m => m !== model);

      await setLLMProviderConfigApi(providerName, {
        enabled: provider.enabled,
        token: provider.token,
        litellm_models: updatedModels
      });

      // Refresh provider data
      const response = await listLLMProvidersApi();
      const updatedProvider = response.providers.find(p => p.name === providerName);
      if (updatedProvider) {
        setProvider(updatedProvider);
      }
    } catch (error) {
      console.error('Error toggling model:', error);
      setError('An error occurred while updating the model.');
    }
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Model Name', flex: 1 },
    {
      field: 'enabled',
      headerName: 'Enabled',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Switch
          checked={provider?.litellm_models.includes(params.row.name)}
          onChange={(e) => handleToggleModel(params.row.name, e.target.checked)}
          size="small"
          color="primary"
        />
      ),
    },
    { field: 'max_input_tokens', headerName: 'Max Input Tokens', width: 150 },
    { field: 'max_output_tokens', headerName: 'Max Output Tokens', width: 150 },
    { field: 'input_cost_per_token', headerName: 'Input Cost', width: 120 },
    { field: 'output_cost_per_token', headerName: 'Output Cost', width: 120 },
  ];

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!provider) return <div>Provider not found</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Provider: {provider.name}</h2>
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Provider Details</h3>
        <p>Token: {provider.token ? `${provider.token.slice(0, 16)}••••••••` : 'Not set'}</p>
        <p>Enabled: {provider.enabled ? 'Yes' : 'No'}</p>
      </div>
      <h3 className="text-lg font-semibold mb-2">Models</h3>
      <DataGrid
        rows={provider.litellm_available_models.map(model => ({
          id: model,
          name: model,
          max_input_tokens: provider.max_input_tokens,
          max_output_tokens: provider.max_output_tokens,
          input_cost_per_token: provider.input_cost_per_token,
          output_cost_per_token: provider.output_cost_per_token,
        }))}
        columns={columns}
        autoHeight
        disableRowSelectionOnClick
      />
    </div>
  );
};

export default LLMProviderConfig;
