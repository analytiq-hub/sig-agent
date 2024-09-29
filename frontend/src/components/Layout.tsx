"use client";

import React, { useState, ReactNode, useEffect } from 'react';
import { useSession, signOut } from "next-auth/react";
import { AppBar, Toolbar, Typography, Drawer, List, ListItem, ListItemIcon, ListItemText, IconButton, Box } from '@mui/material';
import { Menu as MenuIcon, Upload as UploadIcon, List as ListIcon, ExitToApp as LogoutIcon, Login as LoginIcon, PersonAdd as PersonAddIcon, Dashboard as DashboardIcon } from '@mui/icons-material';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    console.log('Session status:', status);
    console.log('Session data:', session);
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [session, status, router]);

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleLogout = () => {
    signOut();
  };

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, href: '/dashboard' },
    { text: 'Upload', icon: <UploadIcon />, href: '/upload' },
    { text: 'List Files', icon: <ListIcon />, href: '/list' },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            aria-label="menu"
            onClick={toggleDrawer}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Doc Proxy
          </Typography>
          {session && (
            <IconButton color="inherit" onClick={handleLogout}>
              <LogoutIcon />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>
      <Drawer
        variant="persistent"
        anchor="left"
        open={drawerOpen}
        sx={{
          width: 240,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: 240,
            boxSizing: 'border-box',
          },
        }}
      >
        <Toolbar /> {/* This empty Toolbar acts as a spacer */}
        <List>
          {status === 'authenticated' ? (
            menuItems.map((item) => (
              <ListItem
                key={item.text}
                component={Link}
                href={item.href}
                sx={{ textDecoration: 'none', color: 'inherit' }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItem>
            ))
          ) : (
            <ListItem
              component={Link}
              href="/login"
              sx={{ textDecoration: 'none', color: 'inherit' }}
            >
              <ListItemIcon><LoginIcon /></ListItemIcon>
              <ListItemText primary="Login" />
            </ListItem>
          )}
        </List>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - 240px)` } }}>
        <Toolbar /> {/* This empty Toolbar acts as a spacer */}
        {children}
      </Box>
    </Box>
  );
};

export default Layout;