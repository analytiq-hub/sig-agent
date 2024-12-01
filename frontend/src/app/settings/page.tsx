'use client'

import React from 'react';
import Link from 'next/link';
import { Paper, List, ListSubheader, ListItemButton, ListItemText, Divider } from '@mui/material';

const SettingsPage: React.FC = () => {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Paper className="md:col-span-1">
          <List
            component="nav"
            subheader={
              <>
                <ListSubheader component="div">Admin Settings</ListSubheader>
              </>
            }
          >
            <ListItemButton component={Link} href="/settings/admin/development">
              <ListItemText primary="Development" />
            </ListItemButton>
            
            <Divider sx={{ my: 2 }} />
            
            <ListSubheader component="div">User Settings</ListSubheader>
            <ListItemButton component={Link} href="/settings/user/profile">
              <ListItemText primary="Profile" />
            </ListItemButton>
            <ListItemButton component={Link} href="/settings/user/developer">
              <ListItemText primary="Developer" />
            </ListItemButton>
          </List>
        </Paper>
        
        <div className="md:col-span-3">
          <Paper className="p-4">
            <h2 className="text-xl mb-4">Settings Overview</h2>
            <p>Select a settings category from the menu to get started.</p>
          </Paper>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
