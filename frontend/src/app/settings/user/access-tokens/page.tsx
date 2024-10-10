'use client'

import React, { useState } from 'react';
import { TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import AccessTokenManager from '@/components/AccessTokenManager';

interface AccessToken {
  id: string;
  name: string;
  expiration: number | null;
  createdAt: string;
}

const AccessTokensPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Manage Access Tokens</h1>
      <AccessTokenManager />
    </div>
  );
};

export default AccessTokensPage;
