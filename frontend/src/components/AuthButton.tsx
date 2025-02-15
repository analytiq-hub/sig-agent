"use client"

import { signOut, useSession } from "next-auth/react";
import { Typography, Button, Box } from '@mui/material';
import { ExitToApp as LogoutIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';

function AuthButton() {
  const { data: session } = useSession();
  const router = useRouter();

  const handleLogin = () => {
    // Directly navigate to our custom signin page instead of using signIn()
    router.push('/auth/signin');
  };

  const handleLogout = () => {
    signOut({
      callbackUrl: '/auth/signin'
    });
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
        onClick={handleLogin}
        className="text-white hover:bg-blue-500 dark:hover:bg-blue-700 px-4 py-2 rounded-md cursor-pointer"
      >
        Sign in
      </div>
    );
  }
}
export default AuthButton;
