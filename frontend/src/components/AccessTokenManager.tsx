import React, { useState, useEffect } from 'react';
import { Button, TextField, List, ListItem, ListItemText, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableBody, TableContainer, TableHead, Paper, TableRow, TableCell } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { useSession } from 'next-auth/react';
import { ApiSession } from '@/app/types/ApiSession';
import axios from 'axios';

interface ApiToken {
  id: string;
  name: string;
  token: string;
  created_at: string;
  expiration?: string;
}

const AccessTokenManager: React.FC = () => {
  const { data: session } = useSession() as { data: ApiSession | null };
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [openModal, setOpenModal] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');
  const [tokenLifetime, setTokenLifetime] = useState('90');

  useEffect(() => {
    fetchTokens();
  }, []);

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

  const createToken = async () => {
    try {
      const response = await axios.post('http://localhost:8000/api/tokens', 
        { 
          name: newTokenName.trim(),
          lifetime: parseInt(tokenLifetime)
        }, 
        {   
          headers: { 
            Authorization: `Bearer ${session?.apiAccessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      setTokens([...tokens, response.data]);
      setOpenModal(false);
      setNewTokenName('');
      setTokenLifetime('90');
    } catch (error) {
      console.error('Error creating token:', error);
    }
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
            {tokens.map((token) => (
              <TableRow key={token.id} sx={{ '&:last-child td, &:last-child th': { border: 0 }, height: '30px' }}>
                <TableCell sx={{ py: 0.5 }}>{token.name}</TableCell>
                <TableCell sx={{ py: 0.5 }}>{new Date(token.created_at).toLocaleString()}</TableCell>
                <TableCell sx={{ py: 0.5 }}>{token.expiration ? new Date(token.expiration).toLocaleString() : 'Never'}</TableCell>
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
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenModal(false)}>Cancel</Button>
          <Button onClick={createToken} disabled={!newTokenName}>Generate</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default AccessTokenManager;
