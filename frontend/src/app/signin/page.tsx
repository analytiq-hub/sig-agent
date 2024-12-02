"use client"

import React from 'react';
import { Box, Typography, Button, Divider } from '@mui/material';
import AuthForm from '@/components/AuthForm';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import GitHubIcon from '@mui/icons-material/GitHub';
import GoogleIcon from '@mui/icons-material/Google';

export default function SigninPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const router = useRouter();

  const handleLogin = async (email: string, password: string) => {
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
      } else {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Login failed. Please try again.');
    }
  };

  const handleRegister = async (email: string, password: string, name: string) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const responseText = await response.text();
      console.log('Server response:', responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error(`Failed to parse response: ${responseText} ${e}`);
        setError('Server returned invalid response');
        return;
      }

      if (response.ok) {
        await handleLogin(email, password);
      } else {
        throw new Error(data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError(error instanceof Error ? error.message : 'Registration failed');
    }
  };

  const handleSocialLogin = (provider: string) => {
    signIn(provider, { callbackUrl: '/dashboard' });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8 }}>
      <Typography component="h1" variant="h5">
        {isLoginMode ? 'Sign In' : 'Register'}
      </Typography>
      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}
      <AuthForm 
        onLogin={handleLogin} 
        onRegister={handleRegister} 
        isLoginMode={isLoginMode} 
        setIsLoginMode={setIsLoginMode}
      />
      <Divider sx={{ width: '100%', my: 2 }}>Or</Divider>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%', maxWidth: '300px' }}>
        <Button
          variant="contained"
          color="primary"
          onClick={() => handleSocialLogin('google')}
          fullWidth
          startIcon={<GoogleIcon />}
        >
          Sign in with Google
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => handleSocialLogin('github')}
          fullWidth
          startIcon={<GitHubIcon />}
        >
          Sign in with GitHub
        </Button>

      </Box>
    </Box>
  );
}
