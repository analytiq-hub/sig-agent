"use client";

import React, { ReactNode, useState } from 'react';
import { AppBar, Toolbar, Typography, Drawer, List, ListItem, ListItemIcon, ListItemText, IconButton, Box } from '@mui/material';
import { Menu as MenuIcon, Upload as UploadIcon, List as ListIcon, ExitToApp as LogoutIcon, Login as LoginIcon } from '@mui/icons-material';
import Link from 'next/link';

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false); // This should be managed by your auth system

  const toggleDrawer = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleLogout = () => {
    // Implement logout logic here
    setIsLoggedIn(false);
  };

  const menuItems = [
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
            File Proxy
          </Typography>
          {isLoggedIn && (
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
          {isLoggedIn ? (
            menuItems.map((item) => (
              <Link href={item.href} key={item.text} passHref legacyBehavior>
                <ListItem button component="a" onClick={toggleDrawer}>
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItem>
              </Link>
            ))
          ) : (
            <Link href="/login" passHref legacyBehavior>
              <ListItem button component="a" onClick={toggleDrawer}>
                <ListItemIcon><LoginIcon /></ListItemIcon>
                <ListItemText primary="Login" />
              </ListItem>
            </Link>
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