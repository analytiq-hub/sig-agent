'use client'

import React, { useState } from 'react';
import { TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

interface AccessToken {
  id: string;
  name: string;
  expiration: number | null;
  createdAt: string;
}

const AccessTokensPage: React.FC = () => {
  const [tokens, setTokens] = useState<AccessToken[]>([]);
  const [newTokenName, setNewTokenName] = useState('');
  const [newTokenExpiration, setNewTokenExpiration] = useState<string>('');

  const handleCreateToken = () => {
    const newToken: AccessToken = {
      id: Math.random().toString(36).substr(2, 9),
      name: newTokenName,
      expiration: newTokenExpiration ? parseInt(newTokenExpiration) : null,
      createdAt: new Date().toISOString(),
    };
    setTokens([...tokens, newToken]);
    setNewTokenName('');
    setNewTokenExpiration('');
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Manage Access Tokens</h1>
      <div className="mb-4">
        <TextField
          label="Token Name"
          value={newTokenName}
          onChange={(e) => setNewTokenName(e.target.value)}
          className="mr-2"
        />
        <TextField
          label="Expiration (days)"
          type="number"
          value={newTokenExpiration}
          onChange={(e) => setNewTokenExpiration(e.target.value)}
          className="mr-2"
        />
        <Button variant="contained" onClick={handleCreateToken}>
          Create Token
        </Button>
      </div>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Expiration</TableCell>
              <TableCell>Created At</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tokens.map((token) => (
              <TableRow key={token.id}>
                <TableCell>{token.name}</TableCell>
                <TableCell>{token.expiration ? `${token.expiration} days` : 'Never'}</TableCell>
                <TableCell>{new Date(token.createdAt).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
};

export default AccessTokensPage;
