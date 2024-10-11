import React, { useState, useEffect } from 'react';
import { Button, TextField, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableContainer, TableHead, Paper, TableRow, TableCell } from '@mui/material';
import { Delete as DeleteIcon, ContentCopy as ContentCopyIcon } from '@mui/icons-material';
import { useSession } from 'next-auth/react';
import { ApiSession } from '@/app/types/ApiSession';
import axios from 'axios';

interface ApiToken {
  id: string;
  name: string;
  created_at: string;
  lifetime?: number;
  token?: string; // Add this line
}

const AccessTokenManager: React.FC = () => {
  const { data: session } = useSession() as { data: ApiSession | null };
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [tokenLifetime, setTokenLifetime] = useState('90');
  const [newToken, setNewToken] = useState<ApiToken | null>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        const response = await axios.get('http://localhost:8000/api/tokens', {
          headers: { Authorization: `Bearer ${session?.apiAccessToken}` }
        });
        setTokens(response.data);
      } catch (error) {
        console.error('Error fetching tokens:', error);
      }
    };

    fetchTokens();
  }, [session]);

  const createToken = async () => {
    try {
      const lifetime = tokenLifetime.trim() === '' ? 0 : parseInt(tokenLifetime);
      const response = await axios.post('http://localhost:8000/api/tokens', 
        { 
          name: newTokenName.trim(),
          lifetime: lifetime
        }, 
        {   
          headers: { 
            Authorization: `Bearer ${session?.apiAccessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      setNewToken(response.data);
      setShowTokenModal(true);
      setOpenModal(false);
      setNewTokenName('');
      setTokenLifetime('90');
    } catch (error) {
      console.error('Error creating token:', error);
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

  const deleteToken = async (tokenId: string) => {
    try {
      await axios.delete(`http://localhost:8000/api/tokens/${tokenId}`, {
        headers: { Authorization: `Bearer ${session?.apiAccessToken}` }
      });
      setTokens(tokens.filter(token => token.id !== tokenId));
    } catch (error) {
      console.error('Error deleting token:', error);
    }
  };

  const handleDeleteToken = (tokenId: string) => {
    deleteToken(tokenId);
  };

  return (
    <div>
      <Button className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded mb-4" onClick={() => setOpenModal(true)}>
        Generate new token
      </Button>
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
        <DialogTitle>Generate new token</DialogTitle>
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
          <Button onClick={() => setOpenModal(false)}>Cancel</Button>
          <Button onClick={createToken} disabled={!newTokenName.trim()}>Generate</Button>
        </DialogActions>
      </Dialog>

      {/* New Token Modal */}
      <Dialog open={showTokenModal} onClose={saveToken}>
        <DialogTitle>New Token Created</DialogTitle>
        <DialogContent>
          <p>Please copy your new token. You won't be able to see it again!</p>
          <div className="flex items-center justify-between mt-2 p-2 bg-gray-100 rounded">
            <span className="font-mono">{newToken?.token}</span>
            <IconButton onClick={() => newToken?.token && copyToClipboard(newToken.token)}>
              <ContentCopyIcon />
            </IconButton>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={saveToken}>I've copied it, save token</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default AccessTokenManager;
