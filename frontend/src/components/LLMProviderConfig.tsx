import React, { useState, useEffect } from 'react';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import Switch from '@mui/material/Switch';
import { listLLMProvidersApi, setLLMProviderConfigApi, listLLMModelsApi } from '@/utils/api';
import { LLMProvider, LLMModel } from '@/types/index';

interface LLMProviderConfigProps {
  providerName: string;
}

const LLMProviderConfig: React.FC<LLMProviderConfigProps> = ({ providerName }) => {
  const [provider, setProvider] = useState<LLMProvider | null>(null);
  const [models, setModels] = useState<LLMModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch provider data
        const providerResponse = await listLLMProvidersApi();
        const foundProvider = providerResponse.providers.find(p => p.name === providerName);
        if (foundProvider) {
          setProvider(foundProvider);
          // Fetch model data for this provider
          const modelsResponse = await listLLMModelsApi({
            providerName: providerName,
            providerEnabled: false,
            llmEnabled: false
          });
          setModels(modelsResponse.models);
        } else {
          setError('Provider not found');
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('An error occurred while fetching data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [providerName]);

  const handleToggleModel = async (model: string, enabled: boolean) => {
    if (!provider) return;

    try {
      const updatedModels = enabled
        ? [...provider.litellm_models_enabled, model]
        : provider.litellm_models_enabled.filter(m => m !== model);

      await setLLMProviderConfigApi(providerName, {
        enabled: provider.enabled,
        token: provider.token,
        litellm_models_enabled: updatedModels
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
    { field: 'litellm_model', headerName: 'Model Name', flex: 1 },
    {
      field: 'enabled',
      headerName: 'Enabled',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Switch
          checked={provider?.litellm_models_enabled.includes(params.row.litellm_model)}
          onChange={(e) => handleToggleModel(params.row.litellm_model, e.target.checked)}
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
      <h2 className="text-2xl font-bold mb-4">Provider: {provider.display_name}{!provider.enabled && <span className="text-gray-500 italic"> (disabled)</span>}</h2>      
      <div className="mb-4">
      <p><b>Enabled:</b> {provider.enabled ? 'Yes' : 'No'}</p>
      <p><b>Token:</b> {provider.token ? `${provider.token.slice(0, 16)}••••••••` : 'Not set'}</p>
      </div>
      <h3 className="text-lg font-semibold mb-2">Models</h3>
      <DataGrid
        rows={models}
        columns={columns}
        autoHeight
        disableRowSelectionOnClick
        getRowId={(row) => row.litellm_model}
      />
    </div>
  );
};

export default LLMProviderConfig;
