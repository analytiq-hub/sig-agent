import React, { useState } from 'react';
import { TextField, Button, Typography, Box } from '@mui/material';

interface LoginFormProps {
  onLogin: (username: string, password: string) => void;
  onRegister: (username: string, password: string) => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onLogin, onRegister }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRegistering) {
      onRegister(username, password);
    } else {
      onLogin(username, password);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
      <TextField
        margin="normal"
        required
        fullWidth
        id="username"
        label="Username"
        name="username"
        autoComplete="username"
        autoFocus
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <TextField
        margin="normal"
        required
        fullWidth
        name="password"
        label="Password"
        type="password"
        id="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }}>
        {isRegistering ? 'Register' : 'Login'}
      </Button>
      <Typography variant="body2" align="center">
        {isRegistering ? 'Already have an account? ' : "Don't have an account? "}
        <Button onClick={() => setIsRegistering(!isRegistering)}>
          {isRegistering ? 'Login' : 'Register'}
        </Button>
      </Typography>
    </Box>
  );
};

export default LoginForm;