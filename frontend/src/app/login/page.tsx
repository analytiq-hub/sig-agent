"use client"

import React from 'react';
import { Box, Typography } from '@mui/material';
import LoginForm from '@/components/LoginForm';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoginMode, setIsLoginMode] = useState(true);
  const router = useRouter();

  const handleLogin = async (username: string, password: string) => {
    try {
      const response = await fetch('http://localhost:8000/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      console.log('Login successful:', data);
      
      // Sign in using NextAuth and store the token
      // const result = await signIn("credentials", {
      //   redirect: false,
      //   username,
      //   password,
      //   accessToken: data.access_token,
      // });
      // console.log('NextAuth signIn result:', result);

      // if (result?.error) {
      //   setError(result.error);
      // } else {
      //   router.push('/dashboard');
      // }
      router.push('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      setError('Login failed. Please try again.');
    }
  };

  const handleRegister = async (username: string, password: string) => {
    try {
      const response = await fetch('http://localhost:8000/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Registration successful:', data);
        setIsLoginMode(true); // Switch to login mode
        setError('Registration successful! Please log in with your new account.');
      } else {
        throw new Error(data.detail || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError('Registration failed. Please try again.');
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 8 }}>
      <Typography component="h1" variant="h5">
        {isLoginMode ? 'Login' : 'Register'}
      </Typography>
      {error && (
        <Typography color="error" sx={{ mt: 2 }}>
          {error}
        </Typography>
      )}
      <LoginForm 
        onLogin={handleLogin} 
        onRegister={handleRegister} 
        isLoginMode={isLoginMode} 
        setIsLoginMode={setIsLoginMode}
      />
    </Box>
  );
}
