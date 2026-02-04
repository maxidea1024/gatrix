/**
 * EnvironmentAwareLayout
 *
 * A wrapper around MainLayout that remounts children when environment changes.
 * The MainLayout (including AppBar) stays mounted to prevent flickering,
 * while the content area is remounted to reload data for the new environment.
 */
import React from 'react';
import { Box } from '@mui/material';
import { MainLayout } from './MainLayout';
import { useEnvironment } from '../../contexts/EnvironmentContext';

interface EnvironmentAwareLayoutProps {
  children: React.ReactNode;
}

export const EnvironmentAwareLayout: React.FC<EnvironmentAwareLayoutProps> = ({ children }) => {
  const { currentEnvironmentId } = useEnvironment();

  // Apply key only to children wrapper, not MainLayout
  // This keeps AppBar stable while remounting page content on environment change
  return (
    <MainLayout>
      <Box key={currentEnvironmentId || 'default'} sx={{ height: '100%' }}>
        {children}
      </Box>
    </MainLayout>
  );
};

export default EnvironmentAwareLayout;
