"use client"

import { signOut, useSession } from "next-auth/react";
import { Typography, Button, Link, Box } from '@mui/material';
import { ExitToApp as LogoutIcon, Login as LoginIcon } from '@mui/icons-material';

function AuthButton() {
  const { data: session } = useSession();

  const handleLogout = () => {
    signOut(); // Use next-auth signOut function
  };

  if (session) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="body1" sx={{ mr: 2 }}>
          {session?.user?.name}
        </Typography>
        <Button color="inherit" onClick={handleLogout} startIcon={<LogoutIcon />}>
          Sign Out
        </Button>
      </Box>
    );
  } else {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="body1" sx={{ mr: 2 }}>
        </Typography>
        <Button color="inherit" component={Link} href="/auth/signin" startIcon={<LoginIcon />}>
          Sign In
        </Button>
      </Box>
    );
  }
}

export default AuthButton;