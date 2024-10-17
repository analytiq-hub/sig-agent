import React, { useState, useEffect } from 'react';
import { Button, TextField, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableContainer, TableHead, Paper, TableRow, TableCell, Alert, Snackbar } from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon } from '@mui/icons-material';
import { getLLMTokensApi, LLMToken, createLLMTokenApi, deleteLLMTokenApi } from '@/utils/api';

const LLMTokenManager: React.FC = () => {
  const [llmTokens, setLLMTokens] = useState<LLMToken[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [editTokenValue, setEditTokenValue] = useState('');
  const [error, setError] = useState<string | null>(null);

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
        llm_vendor: editingProvider as 'OpenAI' | 'Anthropic' | 'Groq',
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

  return (
    <div>
      <h2 className="text-xl font-semibold mt-8 mb-4">LLM Tokens</h2>
      <TableContainer component={Paper}>
        <Table size="small" style={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              <TableCell style={{ width: '20%' }}>Provider</TableCell>
              <TableCell style={{ width: '40%' }}>Token</TableCell>
              <TableCell style={{ width: '25%' }}>Created At</TableCell>
              <TableCell style={{ width: '7.5%' }}>Edit</TableCell>
              <TableCell style={{ width: '7.5%' }}>Delete</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {['OpenAI', 'Anthropic', 'Groq'].map((provider, index) => {
              const token = llmTokens.find(t => t.llm_vendor === provider);
              return (
                <TableRow 
                  key={provider} 
                  sx={{ 
                    '&:nth-of-type(odd)': { backgroundColor: 'rgba(0, 0, 0, 0.04)' },
                    '&:last-child td, &:last-child th': { border: 0 },
                    height: '30px'
                  }}
                >
                  <TableCell style={{ width: '20%' }}>{provider}</TableCell>
                  <TableCell style={{ width: '40%' }}>
                    {token ? (
                      <span>{token.token.slice(0, 16)}••••••••</span>
                    ) : (
                      <span className="text-gray-400">Not set</span>
                    )}
                  </TableCell>
                  <TableCell style={{ width: '25%' }}>
                    {token ? new Date(token.created_at).toLocaleString() : '-'}
                  </TableCell>
                  <TableCell style={{ width: '7.5%' }}>
                    <IconButton
                      aria-label="edit"
                      onClick={() => handleEditLLMToken(provider)}
                      size="small"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                  <TableCell style={{ width: '7.5%' }}>
                    {token && (
                      <IconButton
                        aria-label="delete"
                        onClick={() => handleDeleteLLMToken(token.id)}
                        size="small"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* LLM Token Edit Modal */}
      <Dialog open={editModalOpen} onClose={() => setEditModalOpen(false)}>
        <DialogTitle>Edit {editingProvider} Token</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Token"
            fullWidth
            variant="outlined"
            value={editTokenValue}
            onChange={(e) => setEditTokenValue(e.target.value)}
            placeholder="Enter your token"
          />
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="secondary" onClick={() => setEditModalOpen(false)}>Cancel</Button>
          <Button variant="contained" color="secondary" onClick={handleSaveLLMToken}>Save</Button>
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

export default LLMTokenManager;
