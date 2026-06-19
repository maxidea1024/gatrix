import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Link,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export const WizardInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  isDark: boolean;
  type?: string;
  hint?: string;
  helpTextKey?: string;
  helpUrl?: string;
  required?: boolean;
  placeholder?: string;
}> = ({
  label,
  value,
  onChange,
  isDark,
  type = 'text',
  hint,
  helpTextKey,
  helpUrl,
  required,
  placeholder,
}) => {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  const helpText = helpTextKey ? t(helpTextKey) : undefined;

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
      {helpText && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            mt: 0.5,
          }}
        >
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: 'text.disabled',
            }}
          >
            {helpText}
          </Typography>
          {helpUrl && (
            <Link
              href={helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                color: 'primary.main',
                opacity: 0.7,
                '&:hover': { opacity: 1 },
              }}
            >
              <OpenInNewIcon sx={{ fontSize: 11 }} />
            </Link>
          )}
        </Box>
      )}
    </Box>
  );
};
