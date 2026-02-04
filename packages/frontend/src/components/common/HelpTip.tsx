import React, { useState } from 'react';
import {
  IconButton,
  Popper,
  Paper,
  Box,
  Typography,
  Divider,
  ClickAwayListener,
  Fade,
  useTheme,
} from '@mui/material';
import { HelpOutline as HelpIcon, Close as CloseIcon } from '@mui/icons-material';

interface HelpTipProps {
  title: string;
  children: React.ReactNode;
  iconSize?: 'small' | 'medium';
}

/**
 * HelpTip component - displays a help icon that shows a popover with detailed help content
 * Uses Popper + ClickAwayListener instead of Popover to avoid backdrop
 */
const HelpTip: React.FC<HelpTipProps> = ({ title, children, iconSize = 'small' }) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(anchorEl ? null : event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);

  return (
    <>
      <IconButton
        size={iconSize}
        onClick={handleClick}
        sx={{
          color: 'text.secondary',
          p: 0.5,
          '&:hover': {
            color: 'primary.main',
          },
        }}
      >
        <HelpIcon fontSize={iconSize} />
      </IconButton>
      <Popper
        open={open}
        anchorEl={anchorEl}
        placement="bottom-start"
        transition
        style={{ zIndex: theme.zIndex.modal }}
      >
        {({ TransitionProps }) => (
          <ClickAwayListener onClickAway={handleClose}>
            <Fade {...TransitionProps} timeout={200}>
              <Paper
                sx={{
                  maxWidth: 400,
                  boxShadow: theme.shadows[8],
                  border: `1px solid ${theme.palette.divider}`,
                  mt: 1,
                }}
              >
                <Box sx={{ p: 2 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      mb: 1,
                    }}
                  >
                    <Typography variant="subtitle1" fontWeight={600}>
                      {title}
                    </Typography>
                    <IconButton size="small" onClick={handleClose} sx={{ ml: 1 }}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  <Divider sx={{ mb: 1.5 }} />
                  <Box
                    sx={{
                      '& p': { mb: 1, fontSize: '0.875rem' },
                      '& ul': { pl: 2, mb: 1 },
                      '& li': { fontSize: '0.875rem', mb: 0.5 },
                      '& code': {
                        bgcolor: 'action.hover',
                        px: 0.5,
                        py: 0.25,
                        borderRadius: 0.5,
                        fontFamily: 'monospace',
                        fontSize: '0.8rem',
                      },
                      '& .good': { color: 'success.main' },
                      '& .bad': { color: 'error.main' },
                      '& .warning': {
                        bgcolor: 'warning.light',
                        color: 'warning.dark',
                        p: 1,
                        borderRadius: 1,
                        mb: 1,
                      },
                    }}
                  >
                    {children}
                  </Box>
                </Box>
              </Paper>
            </Fade>
          </ClickAwayListener>
        )}
      </Popper>
    </>
  );
};

export default HelpTip;
