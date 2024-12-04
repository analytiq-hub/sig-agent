import React, { useState, useEffect } from 'react';
import { Button, TextField, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Paper, Alert, Snackbar } from '@mui/material';
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
      <Dialog open={editModalOpen} onClose={() => setEditModalOpen(false)}>
        <DialogTitle>Edit AWS Credentials</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Access Key ID"
            fullWidth
            variant="outlined"
            value={accessKeyId}
            onChange={(e) => setAccessKeyId(e.target.value)}
            className="mb-4"
          />
          <TextField
            margin="dense"
            label="Secret Access Key"
            fullWidth
            variant="outlined"
            value={secretAccessKey}
            onChange={(e) => setSecretAccessKey(e.target.value)}
            type="password"
          />
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="primary" onClick={() => setEditModalOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleSaveCredentials}
            disabled={!accessKeyId || !secretAccessKey}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)}>
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default AWSCredentialsManager;
