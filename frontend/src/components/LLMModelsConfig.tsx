import React, { useState, useEffect } from 'react';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import Switch from '@mui/material/Switch';
import { listLLMProvidersApi, setLLMProviderConfigApi } from '@/utils/api';
import { LLMProvider } from '@/types/index';

const LLMModelsConfig: React.FC = () => {
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProvidersData = async () => {
      try {
        setLoading(true);
        const response = await listLLMProvidersApi();
        setProviders(response.providers);
      } catch (error) {
        console.error('Error fetching providers data:', error);
        setError('An error occurred while fetching providers data.');
      } finally {
        setLoading(false);
      }
    };

    fetchProvidersData();
  }, []);

  const handleToggleModel = async (providerName: string, model: string, enabled: boolean) => {
    const provider = providers.find(p => p.name === providerName);
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

      // Refresh providers data
      const response = await listLLMProvidersApi();
      setProviders(response.providers);
    } catch (error) {
      console.error('Error toggling model:', error);
      setError('An error occurred while updating the model.');
    }
  };

  const columns: GridColDef[] = [
    { field: 'provider', headerName: 'Provider', flex: 1 },
    { field: 'name', headerName: 'Model Name', flex: 1 },
    {
      field: 'enabled',
      headerName: 'Enabled',
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Switch
          checked={params.row.enabled}
          onChange={(e) => handleToggleModel(params.row.provider, params.row.name, e.target.checked)}
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

  const rows = providers.flatMap(provider =>
    provider.litellm_available_models.map(model => ({
      id: `${provider.name}-${model}`,
      provider: provider.name,
      name: model,
      enabled: provider.litellm_models.includes(model),
      max_input_tokens: provider.max_input_tokens,
      max_output_tokens: provider.max_output_tokens,
      input_cost_per_token: provider.input_cost_per_token,
      output_cost_per_token: provider.output_cost_per_token,
    }))
  );

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">All Language Models</h2>
      <DataGrid
        rows={rows}
        columns={columns}
        autoHeight
        disableRowSelectionOnClick
      />
    </div>
  );
};

export default LLMModelsConfig;
