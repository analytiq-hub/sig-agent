import React, { useState, useEffect } from 'react';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import Switch from '@mui/material/Switch';
import { listLLMModelsApi, listLLMProvidersApi, setLLMProviderConfigApi } from '@/utils/api';
import { LLMProvider, LLMModel } from '@/types/index';
import colors from 'tailwindcss/colors';

const LLMModelsConfig: React.FC = () => {
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [models, setModels] = useState<LLMModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [providersResponse, modelsResponse] = await Promise.all([
          listLLMProvidersApi(),
          listLLMModelsApi({providerName: null, providerEnabled: null, llmEnabled: null})
        ]);
        setProviders(providersResponse.providers);
        setModels(modelsResponse.models);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('An error occurred while fetching data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleToggleModel = async (providerName: string, model: string, enabled: boolean) => {
    const provider = providers.find(p => p.name === providerName);
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
    provider.litellm_models_available.map(modelName => {
      // Find the model info by matching both provider and model name
      const modelInfo = models.find(m => 
        m.litellm_model === modelName && 
        m.litellm_provider === provider.litellm_provider
      );
      
      if (!modelInfo) {
        console.warn(`No model info found for ${provider.litellm_provider}/${modelName}`);
      }
      
      return {
        id: `${provider.name}-${modelName}`,
        provider: provider.name,
        name: modelName,
        enabled: provider.litellm_models_enabled.includes(modelName),
        max_input_tokens: modelInfo?.max_input_tokens ?? 0,
        max_output_tokens: modelInfo?.max_output_tokens ?? 0,
        input_cost_per_token: modelInfo?.input_cost_per_token ?? 0,
        output_cost_per_token: modelInfo?.output_cost_per_token ?? 0,
      };
    })
  );

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">All Language Models</h2>
      <DataGrid
        rows={rows}
        columns={columns}
        autoHeight
        disableRowSelectionOnClick
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
          },
        }}
      />
    </div>
  );
};

export default LLMModelsConfig;
