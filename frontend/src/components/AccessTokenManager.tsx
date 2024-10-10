import React, { useState, useEffect } from 'react';
import { Button, TextField, List, ListItem, ListItemText, IconButton, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { useSession } from 'next-auth/react';
import { ApiSession } from '@/app/types/ApiSession';
import axios from 'axios';
import styled from '@emotion/styled';

interface ApiToken {
  id: string;
  name: string;
  token: string;
  created_at: string;
  expiration?: string;
}

// Styled button component
const StyledButton = styled(Button)`
  background-color: #007bff;
  color: white;
  padding: 10px 20px;
  font-size: 16px;
  font-weight: bold;
  text-transform: none;
  border-radius: 5px;
  &:hover {
    background-color: #0056b3;
  }
`;

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
      <StyledButton onClick={() => setOpenModal(true)}>Generate new token</StyledButton>
      <List>
        {tokens.map((token) => (
          <ListItem key={token.id} secondaryAction={
            <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteToken(token.id)}>
              <DeleteIcon />
            </IconButton>
          }>
            <ListItemText 
              primary={token.name} 
              secondary={`Created: ${new Date(token.created_at).toLocaleString()} | Expiration: ${token.expiration ? new Date(token.expiration).toLocaleString() : 'Never'}`} 
            />
          </ListItem>
        ))}
      </List>

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
          <StyledButton 
            onClick={createToken} 
            disabled={!newTokenName}
          >
            Generate
          </StyledButton>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default AccessTokenManager;
