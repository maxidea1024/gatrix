import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Box, CircularProgress } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  requiredPermissions?: string[];
  requireActive?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
  requiredPermissions,
  requireActive = true,
}) => {
  const { isAuthenticated, isLoading, user, canAccess, hasPermission } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check if user is suspended
  if (user?.status === 'suspended') {
    return <Navigate to="/account-suspended" replace />;
  }

  // Check if user account is active (if required)
  if (requireActive && user?.status !== 'active') {
    return <Navigate to="/pending" replace />;
  }

  // Check role-based access
  if (!canAccess(requiredRoles)) {
    return (
      <Navigate
        to="/unauthorized"
        state={{
          requiredRole: requiredRoles?.[0],
          requiredPermissions: requiredPermissions,
        }}
        replace
      />
    );
  }

  // Check permission-based access
  if (requiredPermissions && requiredPermissions.length > 0) {
    if (!hasPermission(requiredPermissions)) {
      return (
        <Navigate
          to="/unauthorized"
          state={{
            requiredPermissions,
          }}
          replace
        />
      );
    }
  }

  return <>{children}</>;
};

// Higher-order component for protecting routes
export const withProtectedRoute = (
  Component: React.ComponentType<any>,
  options?: {
    requiredRoles?: string[];
    requiredPermissions?: string[];
    requireActive?: boolean;
  }
) => {
  return (props: any) => (
    <ProtectedRoute {...options}>
      <Component {...props} />
    </ProtectedRoute>
  );
};

// Admin-only route wrapper
export const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <ProtectedRoute requiredRoles={['admin']}>{children}</ProtectedRoute>;
};

// Public route (redirect to dashboard if already authenticated)
export const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};
