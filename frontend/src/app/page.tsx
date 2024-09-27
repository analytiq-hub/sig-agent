import React from 'react';
import { Typography, Container } from '@mui/material';
import Layout from '@/components/Layout';

export default function Home() {
  return (
    <Layout>
      <Container maxWidth="sm">
        <Typography variant="h4" component="h1" gutterBottom>
          Welcome to PDF Manager
        </Typography>
        <Typography variant="body1">
          Please log in to start managing your PDF files.
        </Typography>
      </Container>
    </Layout>
  );
}