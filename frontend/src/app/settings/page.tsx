'use client'

import React, { useState } from 'react';
import Link from 'next/link';
import { Paper, List, ListSubheader, ListItemButton, ListItemText, Divider, Button, useTheme } from '@mui/material';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import PersonIcon from '@mui/icons-material/Person';

const SettingsPage: React.FC = () => {
  const theme = useTheme();
  const [selectedMenu, setSelectedMenu] = useState<string | null>(null);

  const renderContent = () => {
    switch (selectedMenu) {
      case 'system_development':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">LLM tokens</h2>
                <p className="text-gray-600 mb-2">
                  Manage your Large Language Model (LLM) API tokens.
                </p>
              </div>
              <Link href="/settings/admin/development/llm-tokens" passHref>
                <Button variant="contained" color="secondary">
                  Manage
                </Button>
              </Link>
            </div>

            <Divider />

            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">AWS Credentials</h2>
                <p className="text-gray-600 mb-2">
                  Configure your AWS access keys and region settings.
                </p>
              </div>
              <Link href="/settings/admin/development/aws-credentials" passHref>
                <Button variant="contained" color="secondary">
                  Manage
                </Button>
              </Link>
            </div>
          </div>
        );
      case 'user_developer':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">Access tokens</h2>
                <p className="text-gray-600 mb-2">
                  Use Access Tokens to authenticate with our API.
                </p>
              </div>
              <Link href="/settings/user/developer" passHref>
                <Button variant="contained" color="secondary">
                  Manage
                </Button>
              </Link>
            </div>
          </div>
        );
      default:
        return (
          <>
            <h2 className="text-xl mb-4">Settings Overview</h2>
            <p>Select a settings category from the menu to get started.</p>
          </>
        );
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Paper className="md:col-span-1">
          <List
            component="nav"
            subheader={
              <>
                <ListSubheader 
                  sx={{ 
                    color: theme.palette.text.primary,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <AdminPanelSettingsIcon />
                  Admin Settings
                </ListSubheader>
              </>
            }
          >
            <ListItemButton 
              onClick={() => setSelectedMenu('system_development')}
              selected={selectedMenu === 'system_development'}
              sx={{ pl: 5 }}
            >
              <ListItemText primary="Development" />
            </ListItemButton>
            
            <Divider sx={{ my: 2 }} />
            
            <ListSubheader 
              sx={{ 
                color: theme.palette.text.primary,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <PersonIcon />
              User Settings
            </ListSubheader>
            <ListItemButton 
              onClick={() => setSelectedMenu('user_developer')}
              selected={selectedMenu === 'user_developer'}
              sx={{ pl: 5 }}
            >
              <ListItemText primary="Developer" />
            </ListItemButton>
            <ListItemButton 
              component={Link} 
              href="/settings/user/profile"
              sx={{ pl: 5 }}
            >
              <ListItemText primary="Profile" />
            </ListItemButton>
          </List>
        </Paper>
        
        <div className="md:col-span-3">
          <Paper className="p-4">
            {renderContent()}
          </Paper>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
