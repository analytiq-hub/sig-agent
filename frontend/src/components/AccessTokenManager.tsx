import React, { useState, useEffect } from 'react';
import { Button, TextField, List, ListItem, ListItemText, IconButton } from '@mui/material';
import { Delete as DeleteIcon } from '@mui/icons-material';
import { useSession } from 'next-auth/react';
import { ApiSession } from '@/app/types/ApiSession';
import axios from 'axios';

interface ApiToken {
  id: string;
  name: string;
  token: string;
  created_at: string;
}

const AccessTokenManager: React.FC = () => {
  const { data: session } = useSession() as { data: ApiSession | null };
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [newTokenName, setNewTokenName] = useState('');

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
        { name: newTokenName.trim() }, 
        {   
          headers: { 
            Authorization: `Bearer ${session?.apiAccessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      setTokens([...tokens, response.data]);
      setNewTokenName('');
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
      <h2>API Tokens</h2>
      <TextField
        label="New Token Name"
        value={newTokenName}
        onChange={(e) => setNewTokenName(e.target.value)}
      />
      <Button onClick={createToken} disabled={!newTokenName}>Create Token</Button>
      <List>
        {tokens.map((token) => (
          <ListItem key={token.id} secondaryAction={
            <IconButton edge="end" aria-label="delete" onClick={() => handleDeleteToken(token.id)}>
              <DeleteIcon />
            </IconButton>
          }>
            <ListItemText primary={token.name} secondary={`Created: ${new Date(token.created_at).toLocaleString()}`} />
          </ListItem>
        ))}
      </List>
    </div>
  );
};

export default AccessTokenManager;
