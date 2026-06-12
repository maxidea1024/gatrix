import React from 'react';
import { Box, Typography, alpha, useTheme } from '@mui/material';

interface ContextCardProps {
  title: string;
  icon?: React.ReactNode;
  items: { label: string; value: string; isLink?: boolean }[];
  isDark: boolean;
}

const ContextCard: React.FC<ContextCardProps> = ({
  title,
  icon,
  items,
  isDark,
}) => {
  const theme = useTheme();

  if (items.length === 0) return null;

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
        backgroundColor: isDark
          ? 'rgba(255,255,255,0.02)'
          : 'rgba(0,0,0,0.012)',
        overflow: 'hidden',
      }}
    >
      {/* Card Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 1,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`,
        }}
      >
        <Typography
          sx={{
            fontSize: '0.78rem',
            fontWeight: 700,
            color: 'text.primary',
            textTransform: 'capitalize',
          }}
        >
          {title}
        </Typography>
        {icon && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: '6px',
              backgroundColor: alpha(
                theme.palette.primary.main,
                isDark ? 0.12 : 0.08
              ),
              color: theme.palette.primary.main,
              '& svg': { fontSize: '0.85rem' },
            }}
          >
            {icon}
          </Box>
        )}
      </Box>

      {/* Card Body — key-value pairs */}
      <Box sx={{ px: 1.5, py: 1 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '3px 14px',
          }}
        >
          {items.map((item, idx) => (
            <React.Fragment key={`${item.label}-${idx}`}>
              <Typography
                sx={{
                  fontSize: '0.72rem',
                  color: 'text.disabled',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  py: 0.2,
                }}
              >
                {item.label}
              </Typography>
              <Typography
                component={item.isLink ? 'a' : 'span'}
                {...(item.isLink
                  ? {
                      href: item.value,
                      target: '_blank',
                      rel: 'noopener noreferrer',
                    }
                  : {})}
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: item.isLink ? theme.palette.info.main : 'text.primary',
                  wordBreak: 'break-all',
                  py: 0.2,
                  textDecoration: item.isLink ? 'none' : undefined,
                  '&:hover': item.isLink
                    ? { textDecoration: 'underline' }
                    : undefined,
                }}
              >
                {item.value}
              </Typography>
            </React.Fragment>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default ContextCard;
