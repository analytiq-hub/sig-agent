"use client"

import React from 'react';
import { Box, Typography } from '@mui/material';
import LoginForm from '@/components/LoginForm';

export default function LoginPage() {
  const handleLogin = (username: string, password: string) => {
    // TODO: Implement login logic
    console.log('Login:', username, password);
  };

  const handleRegister = (username: string, password: string) => {
    // TODO: Implement registration logic
    console.log('Register:', username, password);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8 }}>
      <Typography component="h1" variant="h5">
        Login or Register
      </Typography>
      <LoginForm onLogin={handleLogin} onRegister={handleRegister} />
    </Box>
  );
}
