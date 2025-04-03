import React, { useState, useEffect, useCallback } from 'react';
import { listPromptsApi, deletePromptApi, listTagsApi, getSchemaApi, listSchemasApi } from '@/utils/api';
import { Prompt, Tag } from '@/types/index';
import { getApiErrorMsg } from '@/utils/api';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { TextField, InputAdornment, IconButton, Menu, MenuItem } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DownloadIcon from '@mui/icons-material/Download';
import colors from 'tailwindcss/colors';
import { isColorLight } from '@/utils/colors';
import { usePromptContext } from '@/contexts/PromptContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Define default model constant
const DEFAULT_LLM_MODEL = 'gemini-2.0-flash';

const Prompts: React.FC<{ organizationId: string }> = ({ organizationId }) => {
  const router = useRouter();
  const { setEditingPrompt } = usePromptContext();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [total, setTotal] = useState(0);
  
  // Add state for menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);

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

  const loadTags = useCallback(async () => {
    try {
      const response = await listTagsApi({ organizationId: organizationId });
      setAvailableTags(response.tags);
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error loading tags';
      setMessage('Error: ' + errorMsg);
    }
  }, [organizationId]);

  useEffect(() => {
    loadPrompts();
    loadTags();
  }, [loadPrompts, loadTags]);

  // Menu handlers
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, prompt: Prompt) => {
    setAnchorEl(event.currentTarget);
    setSelectedPrompt(prompt);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedPrompt(null);
  };

  // Update the edit handler
  const handleEdit = (prompt: Prompt) => {
    // Store the prompt in context
    setEditingPrompt(prompt);
    
    // Navigate to the create-prompt tab
    router.push(`/orgs/${organizationId}/prompts?tab=prompt-create`);
    handleMenuClose();
  };

  const handleDelete = async (promptId: string) => {
    try {
      setIsLoading(true);
      await deletePromptApi({organizationId: organizationId, promptId: promptId});
      setPrompts(prompts.filter(prompt => prompt.id !== promptId));
      handleMenuClose();
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error deleting prompt';
      setMessage('Error: ' + errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Add download handler
  const handleDownload = async (prompt: Prompt) => {
    try {
      setIsLoading(true);

      // Get the schema name and version
      const schemaName = prompt.schema_name;
      const schemaVersion = prompt.schema_version;

      // Fetch the schema
      const schemasResponse = await listSchemasApi({
        organizationId: organizationId
      });
      const matchingSchema = schemasResponse.schemas.find(
        schema => schema.name === schemaName && schema.version === schemaVersion
      );
      
      if (!matchingSchema) {
        console.warn('Could not find matching schema:', schemaName, schemaVersion);
        setMessage('Warning: Could not find the referenced schema for download');
        return;
      }
      // Fetch the full schema details
      const schema = await getSchemaApi({
        organizationId: organizationId,
        schemaId: matchingSchema.id
      });   
      
      // Create export format with template support
      const promptExport = {
        name: prompt.name,
        model: prompt.model || DEFAULT_LLM_MODEL,
        tags: prompt.tag_ids?.map(id => {
          const tag = availableTags.find(t => t.id === id);
          return tag ? tag.name : null;
        }) || [],
        content: prompt.content,
        schema: {
          name: schema.name,
          response_format: schema.response_format
        },
      };
      
      // Convert to JSON string with pretty formatting
      const promptJson = JSON.stringify(promptExport, null, 2);
      
      // Create a blob from the JSON string
      const blob = new Blob([promptJson], { type: 'application/json' });
      
      // Create a URL for the blob
      const url = URL.createObjectURL(blob);
      
      // Create a temporary anchor element to trigger the download
      const a = document.createElement('a');
      a.href = url;
      a.download = `${prompt.name.replace(/\s+/g, '_')}_v${prompt.version}.json`;
      
      // Append to the document, click, and remove
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      handleMenuClose();
    } catch (error) {
      console.error('Error downloading prompt:', error);
      setMessage('Error: Failed to download prompt');
    } finally {
      setIsLoading(false);
    }
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
          {params.row.model || DEFAULT_LLM_MODEL}
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
      width: 100,
      headerAlign: 'left',
      align: 'left',
      sortable: false,
      renderCell: (params) => (
        <div className="flex gap-2 items-center h-full">
          <IconButton
            onClick={(e) => handleMenuOpen(e, params.row)}
            className="text-gray-600 hover:bg-gray-50"
          >
            <MoreVertIcon />
          </IconButton>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 w-full">
      {/* Prompts List */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200 text-blue-800 hidden md:block">
          <p className="text-sm">
            Prompts define extraction instructions for your documents. They can be linked to schemas to ensure structured output format. 
            If none are available, <Link href={`/orgs/${organizationId}/prompts?tab=prompt-create`} className="text-blue-600 font-medium hover:underline">click here</Link> or use the tab above to create a new prompt.
          </p>
        </div>
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

        {/* Message */}
        {message && (
          <div className={`mb-4 p-3 rounded ${
            message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'
          }`}>
            {message}
          </div>
        )}

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
        
        {/* Actions Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem 
            onClick={() => {
              if (selectedPrompt) handleEdit(selectedPrompt);
            }}
            className="flex items-center gap-2"
          >
            <EditOutlinedIcon fontSize="small" className="text-blue-600" />
            <span>Edit</span>
          </MenuItem>
          <MenuItem 
            onClick={() => {
              if (selectedPrompt) handleDownload(selectedPrompt);
            }}
            className="flex items-center gap-2"
          >
            <DownloadIcon fontSize="small" className="text-green-600" />
            <span>Download</span>
          </MenuItem>
          <MenuItem 
            onClick={() => {
              if (selectedPrompt) handleDelete(selectedPrompt.id);
            }}
            className="flex items-center gap-2"
          >
            <DeleteOutlineIcon fontSize="small" className="text-red-600" />
            <span>Delete</span>
          </MenuItem>
        </Menu>
      </div>
    </div>
  );
};

export default Prompts;
