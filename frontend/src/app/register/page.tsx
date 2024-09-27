"use client"
"use client";

import React from 'react';
import { Box, Typography } from '@mui/material';
import RegisterForm from '../../components/RegisterForm';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();

  const handleRegisterSuccess = () => {
    router.push('/login');
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8 }}>
      <Typography component="h1" variant="h5">
        Register
      </Typography>
      <RegisterForm onRegisterSuccess={handleRegisterSuccess} />
    </Box>
  );
}