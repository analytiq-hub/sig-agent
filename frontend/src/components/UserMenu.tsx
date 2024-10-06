import React, { useState } from 'react';
import { Avatar, Menu, MenuItem, IconButton, Divider, Typography, Tooltip } from '@mui/material';
import { Settings as SettingsIcon, ExitToApp as LogoutIcon } from '@mui/icons-material';
import { signOut } from 'next-auth/react';
import Link from 'next/link';

interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  } | undefined;
}

const UserMenu: React.FC<UserMenuProps> = ({ user }) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    signOut();
    handleClose();
  };

  const getInitials = (name: string | null | undefined): string => {
    if (!name) return 'U';
    return name.split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      <Tooltip title={user?.name || 'User'}>
        <IconButton 
          onClick={handleClick} 
          size="small" 
          sx={{ ml: 2 }}
          aria-label={`User menu for ${user?.name || 'User'}`}
        >
          <Avatar 
            alt={user?.name || 'User'} 
            src={user?.image || ''}
          >
            {getInitials(user?.name)}
          </Avatar>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        onClick={handleClose}
      >
        <MenuItem sx={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <Typography variant="subtitle1">{user?.name || 'User'}</Typography>
          <Typography variant="body2" color="text.secondary">{user?.email || ''}</Typography>
        </MenuItem>
        <Divider />
        <MenuItem component={Link} href="/userSettings">
          <SettingsIcon fontSize="small" sx={{ mr: 1 }} />
          Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
          Log out
        </MenuItem>
      </Menu>
    </>
  );
};

export default UserMenu;