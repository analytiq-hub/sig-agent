"use client"

import { signOut, useSession, signIn } from "next-auth/react";
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
      <div 
        onClick={() => signIn()}
        className="text-white hover:bg-blue-500 dark:hover:bg-blue-700 px-4 py-2 rounded-md cursor-pointer"
      >
        Sign in
      </div>
    );
  }
}

export default AuthButton;