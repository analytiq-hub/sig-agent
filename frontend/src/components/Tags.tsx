"use client";

import React, { useState, useEffect } from 'react';
import { Tag, TagCreate, createTagApi, getTagsApi, deleteTagApi, getApiErrorMsg } from '@/utils/api';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { TextField, InputAdornment, IconButton } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import colors from 'tailwindcss/colors';

const Tags = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [currentTag, setCurrentTag] = useState<{id?: string; name: string; color: string; description: string}>({
    name: '',
    color: colors.blue[500], // default blue color
    description: ''
  });
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const saveTag = async (tag: TagCreate) => {
    try {
      setIsLoading(true);
      const savedTag = await createTagApi(tag);
      
      // Check if we already have a tag with this name
      const existingIndex = tags.findIndex(t => 
        t.name.toLowerCase() === savedTag.name.toLowerCase()
      );
      
      if (existingIndex >= 0) {
        // Update existing tag in the list
        setTags(tags.map(t => 
          t.name.toLowerCase() === savedTag.name.toLowerCase() ? savedTag : t
        ));
      } else {
        // Add new tag to the list
        setTags([...tags, savedTag]);
      }
      setMessage('Tag saved successfully');
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error saving tag';
      setMessage('Error: ' + errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      setIsLoading(true);
      const response = await getTagsApi();
      setTags(response.tags);
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error loading tags';
      setMessage('Error: ' + errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (tagId: string) => {
    try {
      setIsLoading(true);
      await deleteTagApi(tagId);
      setTags(tags.filter(tag => tag.id !== tagId));
      setMessage('Tag deleted successfully');
    } catch (error) {
      const errorMsg = getApiErrorMsg(error) || 'Error deleting tag';
      setMessage('Error: ' + errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTags();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTag.name) {
      setMessage('Please fill in the tag name');
      return;
    }

    saveTag(currentTag);
    setCurrentTag({ name: '', color: '#3B82F6', description: '' });
  };

  // Filter tags based on search term
  const filteredTags = tags.filter(tag =>
    tag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tag.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Define columns for the data grid
  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Tag Name',
      flex: 1,
      renderCell: (params) => (
        <div className="flex items-center gap-2">
          <div 
            className="w-4 h-4 rounded-full" 
            style={{ backgroundColor: params.row.color || '#3B82F6' }}
          />
          <span>{params.row.name}</span>
        </div>
      ),
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 2,
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <div className="flex gap-2">
          <IconButton
            onClick={() => {
              setCurrentTag({
                id: params.row.id,
                name: params.row.name,
                color: params.row.color || '#3B82F6',
                description: params.row.description || ''
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
      {/* Tag Creation Form */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-bold mb-4">Create Tag</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                className="w-full p-2 border rounded"
                value={currentTag.name}
                onChange={e => setCurrentTag({ ...currentTag, name: e.target.value })}
                placeholder="Tag Name"
                disabled={isLoading}
              />
            </div>
            <div className="w-32">
              <input
                type="color"
                className="w-full h-10 p-1 border rounded cursor-pointer"
                value={currentTag.color}
                onChange={e => setCurrentTag({ ...currentTag, color: e.target.value })}
                disabled={isLoading}
              />
            </div>
          </div>

          <div>
            <input
              type="text"
              className="w-full p-2 border rounded"
              value={currentTag.description}
              onChange={e => setCurrentTag({ ...currentTag, description: e.target.value })}
              placeholder="Description (optional)"
              disabled={isLoading}
            />
          </div>

          <div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              disabled={isLoading}
            >
              Save Tag
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

      {/* Tags List */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold mb-4">Tags</h2>
        
        {/* Search Box */}
        <div className="mb-4">
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search tags..."
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
            rows={filteredTags}
            columns={columns}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 5 }
              },
            }}
            pageSizeOptions={[5, 10, 20]}
            disableRowSelectionOnClick
            loading={isLoading}
            getRowId={(row) => row.id}
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

export default Tags; 