import React, { useState, useEffect } from 'react';
import { IconButton, Paper, Alert, Snackbar } from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { getAWSCredentialsApi, createAWSCredentialsApi, deleteAWSCredentialsApi, AWSCredentials } from '@/utils/api';
import { getApiErrorMsg } from '@/utils/api';
const AWSCredentialsManager: React.FC = () => {
  const [credentials, setCredentials] = useState<AWSCredentials | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const getCredentials = async () => {
      try {
        const response = await getAWSCredentialsApi();
        setCredentials(response);
      } catch (error) {
        console.error('Error fetching AWS credentials:', error);
      }
    };

    getCredentials();
  }, []);

  const handleEditCredentials = () => {
    setAccessKeyId('');
    setSecretAccessKey('');
    setEditModalOpen(true);
  };

  const handleSaveCredentials = async () => {
    try {
      await createAWSCredentialsApi({
        access_key_id: accessKeyId,
        secret_access_key: secretAccessKey,
      });
      setEditModalOpen(false);
      // Refresh the credentials
      const response = await getAWSCredentialsApi();
      setCredentials(response);
    } catch (error: unknown) {
      const apiErrorMessage = getApiErrorMsg(error);
      const errorMessage = apiErrorMessage || 'An error occurred while saving the AWS credentials. Please try again.';

      setError(errorMessage);
    }
  };

  const handleDeleteCredentials = async () => {
    try {
      await deleteAWSCredentialsApi();
      setCredentials(null);
    } catch (error: unknown) {
      const apiErrorMessage = getApiErrorMsg(error);
      const errorMessage = apiErrorMessage || 'An error occurred while deleting the AWS credentials. Please try again.';

      setError(errorMessage);
    }
  };

  return (
    <div>
      <Paper className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="mb-2">
              <strong>Access Key ID: </strong>
              {credentials ? (
                <span>{credentials.access_key_id}</span>
              ) : (
                <span className="text-gray-400">Not set</span>
              )}
            </div>
            <div>
              <strong>Secret Access Key: </strong>
              {credentials ? (
                <span>••••••••••••••••</span>
              ) : (
                <span className="text-gray-400">Not set</span>
              )}
            </div>
          </div>
          <div>
            <IconButton
              aria-label="edit"
              onClick={handleEditCredentials}
              size="small"
            >
              <EditIcon />
            </IconButton>
            {credentials && (
              <IconButton
                aria-label="delete"
                onClick={handleDeleteCredentials}
                size="small"
              >
                <DeleteIcon />
              </IconButton>
            )}
          </div>
        </div>
      </Paper>

      {/* Edit Credentials Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Edit AWS Credentials</h2>
              <button
                onClick={() => setEditModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="accessKeyId" className="block text-sm font-medium text-gray-700 mb-1">
                  Access Key ID
                </label>
                <input
                  id="accessKeyId"
                  type="text"
                  value={accessKeyId}
                  onChange={(e) => setAccessKeyId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              
              <div>
                <label htmlFor="secretKey" className="block text-sm font-medium text-gray-700 mb-1">
                  Secret Access Key
                </label>
                <input
                  id="secretKey"
                  type="password"
                  value={secretAccessKey}
                  onChange={(e) => setSecretAccessKey(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6">
              <button
                onClick={() => setEditModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCredentials}
                disabled={!accessKeyId || !secretAccessKey}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)}>
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default AWSCredentialsManager;
