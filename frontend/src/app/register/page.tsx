import React from 'react';
import { Box, Typography } from '@mui/material';
import RegisterForm from '../../components/RegisterForm';

export default function RegisterPage() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8 }}>
      <Typography component="h1" variant="h5">
        Register
      </Typography>
      <RegisterForm />
    </Box>
  );
}