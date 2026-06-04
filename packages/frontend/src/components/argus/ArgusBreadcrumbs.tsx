import React from 'react';
import { Breadcrumbs, Link as MuiLink, Typography, useTheme } from '@mui/material';
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

export interface ArgusBreadcrumbsProps {
  paths: { label: React.ReactNode; to?: string }[];
  size?: 'normal' | 'title';
}

const ArgusBreadcrumbs: React.FC<ArgusBreadcrumbsProps> = ({ paths, size = 'normal' }) => {
  const theme = useTheme();
  const isTitle = size === 'title';

  return (
    <Breadcrumbs
      separator={<NavigateNextIcon sx={{ color: 'text.secondary', fontSize: isTitle ? '1.2rem' : '1rem' }} />}
      sx={{
        fontSize: isTitle ? '1rem' : '0.8rem',
        '& .MuiBreadcrumbs-separator': { mx: 0.5 },
      }}
    >
      {paths.map((path, index) => {
        const isLast = index === paths.length - 1;
        if (isLast || !path.to) {
          return (
            <Typography key={index} component="div" color="text.primary" fontWeight={700} fontSize={isTitle ? '1.05rem' : '0.8rem'} sx={{ display: 'flex', alignItems: 'center' }}>
              {path.label}
            </Typography>
          );
        }
        return (
          <MuiLink
            key={index}
            component={RouterLink}
            to={path.to}
            color="text.secondary"
            underline="hover"
            sx={{ '&:hover': { color: 'primary.main' }, fontWeight: 500, display: 'flex', alignItems: 'center' }}
          >
            {path.label}
          </MuiLink>
        );
      })}
    </Breadcrumbs>
  );
};

export default ArgusBreadcrumbs;
