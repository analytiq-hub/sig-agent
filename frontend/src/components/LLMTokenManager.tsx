import React, { useState, useEffect } from 'react';
import { Button, TextField, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableContainer, TableHead, Paper, TableRow, TableCell, Alert, Snackbar } from '@mui/material';
import { Delete as DeleteIcon, ContentCopy as ContentCopyIcon, Edit as EditIcon } from '@mui/icons-material';
import { createTokenApi, getTokensApi, deleteTokenApi, CreateTokenRequest, getLLMTokensApi, LLMToken } from '@/utils/api';

export interface ApiToken {
  id: string;
  name: string;
  created_at: string;
  lifetime?: number;
  token?: string;
}

const LLMTokenManager: React.FC = () => {
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [tokenLifetime, setTokenLifetime] = useState('90');
  const [newToken, setNewToken] = useState<ApiToken | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [llmTokens, setLLMTokens] = useState<LLMToken[]>([]);

  useEffect(() => {
    const getTokensData = async () => {
      try {
        const tokensData = await getTokensApi();
        setTokens(tokensData);
      } catch (error) {
        console.error('Error fetching tokens:', error);
      }
    };

    const getLLMTokensData = async () => {
      try {
        const response = await getLLMTokensApi();
        setLLMTokens(response.llm_tokens);
      } catch (error) {
        console.error('Error fetching LLM tokens:', error);
      }
    };

    getTokensData();
    getLLMTokensData();
  }, []);

  const createToken = async () => {
    try {
      const trimmedName = newTokenName.trim();
      if (tokens.some(token => token.name === trimmedName)) {
        setError('A token with this name already exists. Please choose a different name.');
        return;
      }

      const lifetime = tokenLifetime.trim() === '' ? 0 : parseInt(tokenLifetime);

      const request: CreateTokenRequest = {
        name: trimmedName,
        lifetime: lifetime
      }
      const response = await createTokenApi(request)

      setNewToken(response);
      setShowTokenModal(true);
      setOpenModal(false);
      setNewTokenName('');
      setTokenLifetime('90');
    } catch (error) {
      console.error('Error creating token:', error);
      setError('An error occurred while creating the token. Please try again.');
    }
  };

  const saveToken = () => {
    if (newToken) {
      setTokens([...tokens, newToken]);
      setNewToken(null);
      setShowTokenModal(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      // Optionally, you can show a success message here
    });
  };

  const handleDeleteToken = (tokenId: string) => {
    deleteTokenApi(tokenId);
    setTokens(tokens.filter(token => token.id !== tokenId));
  };

  const handleEditLLMToken = (provider: string) => {
    // Implement edit functionality here
    console.log(`Edit ${provider} token`);
  };

  return (
    <div>
      <Button
        variant="outlined"
        color="secondary"
        className="mb-4"
        onClick={() => setOpenModal(true)}
      >
        Generate token
      </Button>
      <div className="mb-6"></div>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Comment</TableCell>
              <TableCell>Creation</TableCell>
              <TableCell>Expiration</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tokens.map((token, index) => (
              <TableRow 
                key={token.id} 
                sx={{ 
                  '&:last-child td, &:last-child th': { border: 0 }, 
                  height: '30px',
                  backgroundColor: index % 2 === 0 ? 'inherit' : '#f5f5f5'  // Add zebra striping
                }}
              >
                <TableCell sx={{ py: 0.5 }}>{token.name}</TableCell>
                <TableCell sx={{ py: 0.5 }}>{new Date(token.created_at).toLocaleString()}</TableCell>
                <TableCell sx={{ py: 0.5 }}>
                  {token.lifetime
                    ? new Date(new Date(token.created_at).getTime() + token.lifetime * 24 * 60 * 60 * 1000).toLocaleString()
                    : 'None'}
                </TableCell>
                <TableCell sx={{ py: 0.5 }} align="right">
                  <IconButton aria-label="delete" onClick={() => handleDeleteToken(token.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={openModal} onClose={() => setOpenModal(false)}>
        <DialogTitle>Generate token</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Comment"
            fullWidth
            variant="outlined"
            value={newTokenName}
            onChange={(e) => setNewTokenName(e.target.value)}
            placeholder="What's this token for?"
          />
          <TextField
            margin="dense"
            label="Lifetime (days)"
            type="number"
            fullWidth
            variant="outlined"
            value={tokenLifetime}
            onChange={(e) => setTokenLifetime(e.target.value)}
            placeholder="Leave empty for no expiration"
          />
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" color="secondary"
            onClick={() => setOpenModal(false)}>Cancel</Button>
          <Button variant="contained" color="secondary" onClick={createToken} disabled={!newTokenName.trim()}>Generate</Button>
        </DialogActions>
      </Dialog>

      {/* New Token Modal */}
      <Dialog open={showTokenModal} onClose={saveToken}>
        <DialogTitle>New Token Created</DialogTitle>
        <DialogContent>
          <p>Copy your new token. It is displayed only once.</p>
          <div className="flex items-center justify-between mt-2 p-2 bg-gray-100 rounded">
            <span className="font-mono">{newToken?.token}</span>
            <IconButton onClick={() => newToken?.token && copyToClipboard(newToken.token)}>
              <ContentCopyIcon />
            </IconButton>
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" color="secondary" onClick={saveToken}>Save token</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)}>
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>

      {/* New LLM Tokens section */}
      <h2 className="text-xl font-semibold mt-8 mb-4">LLM Tokens</h2>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Provider</TableCell>
              <TableCell>Token</TableCell>
              <TableCell>Created At</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {['OpenAI', 'Anthropic', 'Groq'].map((provider) => {
              const token = llmTokens.find(t => t.llm_vendor === provider);
              return (
                <TableRow key={provider}>
                  <TableCell>{provider}</TableCell>
                  <TableCell>
                    {token ? (
                      <span>••••••••{token.token.slice(-4)}</span>
                    ) : (
                      <span className="text-gray-400">Not set</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {token ? new Date(token.created_at).toLocaleString() : '-'}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      aria-label="edit"
                      onClick={() => handleEditLLMToken(provider)}
                      size="small"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

export default LLMTokenManager;
