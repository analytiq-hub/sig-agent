"use client"

import { signOut, useSession } from "next-auth/react";
import { Typography, Box, Button } from '@mui/material';
import { ExitToApp as LogoutIcon, Login as LoginIcon } from '@mui/icons-material';
import { useRouter } from 'next/navigation';

function AuthButtonSocialMediaOnly() {
  const { data: session } = useSession();
  const router = useRouter();

  const buttonStyle = {
    color: 'inherit',
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
  };

  const handleLogin = () => {
    router.push('/auth/signin');
  };

  if (session) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="body1" sx={{ mr: 2 }}>
          {session?.user?.name}
        </Typography>
        <Button sx={buttonStyle} startIcon={<LogoutIcon />} onClick={() => signOut()}>Sign out</Button>
      </Box>
    );
  }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <Typography variant="body1" sx={{ mr: 2 }}>
      </Typography>
      <Button sx={buttonStyle} startIcon={<LoginIcon />} onClick={handleLogin}>Sign in</Button>
    </Box>
  );
}

export default AuthButtonSocialMediaOnly;