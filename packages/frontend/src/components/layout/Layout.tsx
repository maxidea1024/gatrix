import React, { useState } from 'react';
import { Box, Toolbar, useMediaQuery, useTheme } from '@mui/material';
import { Header } from './Header';
import { Sidebar, DesktopSidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

const DRAWER_WIDTH = 280;

export const Layout: React.FC<LayoutProps> = ({ children, title }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDrawerClose = () => {
    setMobileOpen(false);
  };

  return (
    <Box sx={{ display: 'flex' }}>
      {/* Header */}
      <Header onMenuClick={handleDrawerToggle} title={title} />

      {/* Sidebar */}
      {isMobile ? (
        <Sidebar open={mobileOpen} onClose={handleDrawerClose} width={DRAWER_WIDTH} />
      ) : (
        <DesktopSidebar width={DRAWER_WIDTH} />
      )}

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        <Toolbar />
        <Box sx={{ p: 3 }}>{children}</Box>
      </Box>
    </Box>
  );
};

// HOC for wrapping pages with layout
export const withLayout = (Component: React.ComponentType<any>, title?: string) => {
  return (props: any) => (
    <Layout title={title}>
      <Component {...props} />
    </Layout>
  );
};
