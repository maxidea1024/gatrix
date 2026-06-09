import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';

export const WizardInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  isDark: boolean;
  type?: string;
  hint?: string;
  required?: boolean;
  placeholder?: string;
}> = ({
  label,
  value,
  onChange,
  isDark,
  type = 'text',
  hint,
  required,
  placeholder,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  return (
    <Box sx={{ mb: 2 }}>
      <Typography
        sx={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'text.secondary',
          mb: 0.5,
        }}
      >
        {label}{' '}
        {required && (
          <Box component="span" sx={{ color: '#ef4444' }}>
            *
          </Box>
        )}
      </Typography>
      <TextField
        fullWidth
        size="small"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        type={isPassword && !showPassword ? 'password' : 'text'}
        autoComplete={isPassword ? 'new-password' : 'off'}
        inputProps={{ autoComplete: isPassword ? 'new-password' : 'off' }}
        InputProps={{
          ...(isPassword
            ? {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      sx={{ opacity: 0.5 }}
                    >
                      {showPassword ? (
                        <VisibilityOffIcon sx={{ fontSize: 16 }} />
                      ) : (
                        <VisibilityIcon sx={{ fontSize: 16 }} />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }
            : {}),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            fontSize: '0.85rem',
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.04)'
              : 'rgba(0,0,0,0.02)',
          },
        }}
      />
      {hint && (
        <Typography
          sx={{
            fontSize: '0.7rem',
            color: 'text.disabled',
            mt: 0.4,
            fontStyle: 'italic',
          }}
        >
          {hint}
        </Typography>
      )}
    </Box>
  );
};
