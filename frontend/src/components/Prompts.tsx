import React, { useState, useEffect, useCallback } from 'react';
import { listPromptsApi, deletePromptApi, listTagsApi, getSchemaApi, listSchemasApi, updatePromptApi } from '@/utils/api';
import { Prompt, Tag, Schema } from '@/types/index';
import { getApiErrorMsg } from '@/utils/api';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { TextField, InputAdornment, IconButton, Menu, MenuItem } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DownloadIcon from '@mui/icons-material/Download';
import DriveFileRenameOutlineIcon from '@mui/icons-material/DriveFileRenameOutline';
import colors from 'tailwindcss/colors';
import { isColorLight } from '@/utils/colors';
import { usePromptContext } from '@/contexts/PromptContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PromptRenameModal from './PromptRename';

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
  const [availableSchemas, setAvailableSchemas] = useState<Schema[]>([]);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);
  const [total, setTotal] = useState(0);
  
  // Add state for menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);

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

  const loadSchemas = useCallback(async () => {
    try {
      const response = await listSchemasApi({ organizationId: organizationId });
      setAvailableSchemas(response.schemas);
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error loading schemas';
      setMessage('Error: ' + errorMsg);
    }
  }, [organizationId]);

  useEffect(() => {
    // Load all required data at once
    const loadData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([loadPrompts(), loadTags(), loadSchemas()]);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadData();
  }, [loadPrompts, loadTags, loadSchemas]);

  // Menu handlers
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, prompt: Prompt) => {
    setAnchorEl(event.currentTarget);
    setSelectedPrompt(prompt);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    if (!isRenameModalOpen) {
      setSelectedPrompt(null);
    }
  };

  // Update the edit handler
  const handleEdit = (prompt: Prompt) => {
    // Store the prompt in context
    setEditingPrompt(prompt);
    
    // Navigate to the create-prompt tab
    router.push(`/orgs/${organizationId}/prompts?tab=prompt-create`);
    handleMenuClose();
  };

  // Add rename handler
  const handleRenamePrompt = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setIsRenameModalOpen(true);
    setAnchorEl(null);
  };

  const handleRenameSubmit = async (newName: string) => {
    if (!selectedPrompt) return;
    
    try {
      // Create a new prompt config with the updated name
      const promptConfig = {
        name: newName,
        content: selectedPrompt.content,
        schema_id: selectedPrompt.schema_id,
        schema_version: selectedPrompt.schema_version,
        tag_ids: selectedPrompt.tag_ids,
        model: selectedPrompt.model
      };
      
      await updatePromptApi({
        organizationId: organizationId,
        promptId: selectedPrompt.prompt_id,
        prompt: promptConfig
      });
      
      // Refresh the prompt list to show the updated name
      await loadPrompts();
    } catch (error) {
      console.error('Error renaming prompt:', error);
      throw error; // Rethrow to handle in the component
    }
  };

  const handleCloseRenameModal = () => {
    setIsRenameModalOpen(false);
    setSelectedPrompt(null);
  };

  const handleDelete = async (promptId: string) => {
    try {
      setIsLoading(true);
      await deletePromptApi({organizationId: organizationId, promptId: promptId});
      setPrompts(prompts.filter(prompt => prompt.prompt_revid !== promptId));
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
      let schema;

      // Fetch the schema using schema_id instead of name+version
      if (prompt.schema_id && prompt.schema_version) {
        // Find schema with matching schema_id and version from preloaded schemas
        const matchingSchema = availableSchemas.find(
          schema => schema.schema_id === prompt.schema_id
        );
        
        if (!matchingSchema) {
          console.warn('Could not find matching schema:', prompt.schema_id, prompt.schema_version);
          setMessage('Warning: Could not find the referenced schema for download');
          return;
        }

        // Fetch the full schema details
        schema = await getSchemaApi({
          organizationId: organizationId,
          schemaId: matchingSchema.schema_revid
        });
      }
      
      // Create export format with template support
      const promptExport = {
        name: prompt.name,
        model: prompt.model || DEFAULT_LLM_MODEL,
        tags: prompt.tag_ids?.map(id => {
          const tag = availableTags.find(t => t.id === id);
          return tag ? tag.name : null;
        }) || [],
        content: prompt.content,
        schema: schema ? {
          name: schema.name,
          response_format: schema.response_format
        } : null,
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
      a.download = `${prompt.name.replace(/\s+/g, '_')}_v${prompt.prompt_version}.json`;
      
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

  // Synchronous schema name lookup from preloaded schemas
  const getSchemaName = (schemaId: string, schemaVersion: number) => {
    if (!schemaId || !schemaVersion) return '-';

    console.log('getSchemaName', schemaId, schemaVersion);
    
    const schema = availableSchemas.find(
      s => s.schema_id === schemaId
    );

    console.log('getSchemaName2', schema);
    return schema ? schema.name : '-';
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
        <div 
          className="text-blue-600 cursor-pointer hover:underline flex items-center h-full"
          onClick={() => handleEdit(params.row)}
        >
          {params.row.name}
        </div>
      ),
    },
    {
      field: 'prompt_version',
      headerName: 'Version',
      width: 100,
      headerAlign: 'left',
      align: 'left',
      renderCell: (params) => (
        <div className="text-gray-600 flex items-center h-full">
          v{params.row.prompt_version}
        </div>
      ),
    },
    {
      field: 'schema_id',
      headerName: 'Schema',
      width: 150,
      headerAlign: 'left',
      align: 'left',
      renderCell: (params) => {
        // Retrieve schema name using schema_id and schema_version from preloaded schemas
        const schemaName = getSchemaName(params.row.schema_id, params.row.schema_version);
        return (
          <div className="text-gray-600 flex items-center h-full">
            {(params.row.schema_id && (schemaName !== '-')) 
              ? `${schemaName}:v${params.row.schema_version}`
              : '-'}
          </div>
        );
      },
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
          <div className="flex gap-1 flex-wrap items-center h-full">
            {promptTags.map(tag => (
              <div
                key={tag.id}
                className={`px-2 py-1 rounded text-xs ${
                  isColorLight(tag.color) ? 'text-gray-800' : 'text-white'
                } flex items-center`}
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
            getRowId={(row) => row.prompt_revid}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 5 }
              },
              sorting: {
                sortModel: [{ field: 'prompt_revid', sort: 'desc' }]  // Sort by prompt_revid descending by default
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
              if (selectedPrompt) handleRenamePrompt(selectedPrompt);
            }}
            className="flex items-center gap-2"
          >
            <DriveFileRenameOutlineIcon fontSize="small" className="text-indigo-800" />
            <span>Rename</span>
          </MenuItem>
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
              if (selectedPrompt) handleDelete(selectedPrompt.prompt_revid);
            }}
            className="flex items-center gap-2"
          >
            <DeleteOutlineIcon fontSize="small" className="text-red-600" />
            <span>Delete</span>
          </MenuItem>
        </Menu>
        
        {/* Rename Modal */}
        {selectedPrompt && (
          <PromptRenameModal
            isOpen={isRenameModalOpen}
            onClose={handleCloseRenameModal}
            promptName={selectedPrompt.name}
            onSubmit={handleRenameSubmit}
          />
        )}
      </div>
    </div>
  );
};

export default Prompts;
