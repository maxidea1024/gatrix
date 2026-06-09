import React, { useState } from 'react';
import {
  Box,
  Typography,
  Tooltip,
  TextField,
  InputAdornment,
  IconButton,
  alpha,
} from '@mui/material';
import {
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export const CopyableUrl: React.FC<{
  label: string;
  value: string;
  isDark: boolean;
}> = ({ label, value, isDark }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Box sx={{ mb: 2 }}>
      <Typography
        sx={{
          fontSize: '0.7rem',
          fontWeight: 600,
          color: 'text.secondary',
          mb: 0.5,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </Typography>
      <Box
        onClick={handleCopy}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: '10px 14px',
          borderRadius: '8px',
          cursor: 'pointer',
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          backgroundColor: isDark
            ? 'rgba(255,255,255,0.03)'
            : 'rgba(0,0,0,0.02)',
          transition: 'all 0.15s ease',
          '&:hover': {
            borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.05)'
              : 'rgba(0,0,0,0.04)',
          },
        }}
      >
        <Typography
          sx={{
            flex: 1,
            fontSize: '0.82rem',
            color: isDark ? '#c9d1d9' : '#24292f',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </Typography>
        <Tooltip title={copied ? `✓ ${t('argus.settings.wizard.copied', 'Copied')}` : t('argus.settings.wizard.copyUrl', 'Click to copy')} placement="top">
          <Box
            sx={{
              color: copied ? '#2ea44f' : 'text.secondary',
              display: 'flex',
              alignItems: 'center',
              transition: 'color 0.15s',
            }}
          >
            {copied ? (
              <CheckIcon sx={{ fontSize: 16 }} />
            ) : (
              <CopyIcon sx={{ fontSize: 16 }} />
            )}
          </Box>
        </Tooltip>
      </Box>
    </Box>
  );
};

export const PermissionItem: React.FC<{
  title: string;
  items: string[];
  isDark: boolean;
  color: string;
}> = ({ title, items, isDark, color }) => (
  <Box
    sx={{
      p: 2,
      borderRadius: '10px',
      mb: 1.5,
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
    }}
  >
    <Typography
      sx={{
        fontSize: '0.72rem',
        fontWeight: 700,
        color: alpha(color, 0.8),
        mb: 1,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {title}
    </Typography>
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
      {items.map((item) => (
        <Box
          key={item}
          sx={{
            px: 1.2,
            py: 0.4,
            borderRadius: '6px',
            fontSize: '0.78rem',
            fontWeight: 500,
            backgroundColor: alpha(color, isDark ? 0.15 : 0.08),
            color: isDark ? alpha(color, 0.9) : color,
          }}
        >
          {item}
        </Box>
      ))}
    </Box>
  </Box>
);

export const WizardInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  isDark: boolean;
  type?: string;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  required?: boolean;
  placeholder?: string;
}> = ({
  label,
  value,
  onChange,
  isDark,
  type = 'text',
  multiline,
  rows,
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
        multiline={multiline}
        rows={rows}
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

export const WizardFormContainer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <form
    autoComplete="off"
    onSubmit={(e) => e.preventDefault()}
    style={{ display: 'contents' }}
  >
    {children}
  </form>
);
