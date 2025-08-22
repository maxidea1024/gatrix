import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Box,
  Tooltip,
  Divider,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Menu as MenuIcon,
  AccountCircle,
  Settings,
  Logout,
  Brightness4,
  Brightness7,
  BrightnessAuto,
} from '@mui/icons-material';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
// // import { useTranslations } from '@/contexts/I18nContext';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
  onMenuClick: () => void;
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick, title = 'Admin Panel' }) => {
  const { user, logout } = useAuth();
  const { mode, setTheme } = useTheme();
  // // const { t } = useTranslations(); // TODO: Implement translations
  const navigate = useNavigate();
  
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [themeMenuAnchor, setThemeMenuAnchor] = useState<null | HTMLElement>(null);

  const handleProfileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleThemeMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setThemeMenuAnchor(event.currentTarget);
  };

  const handleThemeMenuClose = () => {
    setThemeMenuAnchor(null);
  };

  const handleProfileClick = () => {
    navigate('/profile');
    handleProfileMenuClose();
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
    handleProfileMenuClose();
  };

  const getThemeIcon = () => {
    switch (mode) {
      case 'light':
        return <Brightness7 />;
      case 'dark':
        return <Brightness4 />;
      case 'auto':
        return <BrightnessAuto />;
      default:
        return <BrightnessAuto />;
    }
  };

  const getThemeLabel = () => {
    switch (mode) {
      case 'light':
        return 'Light Theme';
      case 'dark':
        return 'Dark Theme';
      case 'auto':
        return 'Auto Theme';
      default:
        return 'Auto Theme';
    }
  };

  return (
    <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          onClick={onMenuClick}
          edge="start"
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>

        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {title}
        </Typography>

        {user && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* User info display */}
            <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="inherit">
                {user.name}
              </Typography>
              <Typography variant="caption" color="inherit" sx={{ opacity: 0.7 }}>
                ({user.role})
              </Typography>
            </Box>

            {/* Language selector */}
            <LanguageSelector variant="text" />

            {/* Theme toggle button */}
            <Tooltip title={getThemeLabel()}>
              <IconButton
                color="inherit"
                onClick={handleThemeMenuOpen}
                aria-label="change theme"
              >
                {getThemeIcon()}
              </IconButton>
            </Tooltip>

            {/* Profile menu button */}
            <Tooltip title="Account">
              <IconButton
                color="inherit"
                onClick={handleProfileMenuOpen}
                aria-label="account menu"
              >
                {user.avatar_url ? (
                  <Avatar
                    src={user.avatar_url}
                    alt={user.name}
                    sx={{ width: 32, height: 32 }}
                  />
                ) : (
                  <AccountCircle />
                )}
              </IconButton>
            </Tooltip>
          </Box>
        )}

        {/* Theme Menu */}
        <Menu
          anchorEl={themeMenuAnchor}
          open={Boolean(themeMenuAnchor)}
          onClose={handleThemeMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <MenuItem onClick={() => { setTheme('light'); handleThemeMenuClose(); }}>
            <ListItemIcon>
              <Brightness7 fontSize="small" />
            </ListItemIcon>
            <ListItemText>Light</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { setTheme('dark'); handleThemeMenuClose(); }}>
            <ListItemIcon>
              <Brightness4 fontSize="small" />
            </ListItemIcon>
            <ListItemText>Dark</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { setTheme('auto'); handleThemeMenuClose(); }}>
            <ListItemIcon>
              <BrightnessAuto fontSize="small" />
            </ListItemIcon>
            <ListItemText>Auto</ListItemText>
          </MenuItem>
        </Menu>

        {/* Profile Menu */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleProfileMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <MenuItem onClick={handleProfileClick}>
            <ListItemIcon>
              <AccountCircle fontSize="small" />
            </ListItemIcon>
            <ListItemText>Profile</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => { navigate('/settings'); handleProfileMenuClose(); }}>
            <ListItemIcon>
              <Settings fontSize="small" />
            </ListItemIcon>
            <ListItemText>Settings</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <Logout fontSize="small" />
            </ListItemIcon>
            <ListItemText>Logout</ListItemText>
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};
