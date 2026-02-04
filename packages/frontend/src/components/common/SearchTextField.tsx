import React from 'react';
import { TextField, InputAdornment, IconButton, TextFieldProps } from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';

interface SearchTextFieldProps extends Omit<TextFieldProps, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
}

/**
 * Reusable search text field with clear button
 */
const SearchTextField: React.FC<SearchTextFieldProps> = ({
  value,
  onChange,
  onClear,
  placeholder,
  sx,
  ...rest
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleClear = () => {
    onChange('');
    onClear?.();
  };

  return (
    <TextField
      placeholder={placeholder}
      value={value}
      onChange={handleChange}
      size="small"
      sx={{
        minWidth: 200,
        flexGrow: 1,
        maxWidth: 320,
        '& .MuiOutlinedInput-root': {
          height: '40px',
          borderRadius: '20px',
          bgcolor: 'background.paper',
          transition: 'all 0.2s ease-in-out',
          '& fieldset': {
            borderColor: 'divider',
          },
          '&:hover': {
            bgcolor: 'action.hover',
            '& fieldset': {
              borderColor: 'primary.light',
            },
          },
          '&.Mui-focused': {
            bgcolor: 'background.paper',
            boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)',
            '& fieldset': {
              borderColor: 'primary.main',
              borderWidth: '1px',
            },
          },
        },
        '& .MuiInputBase-input': {
          fontSize: '0.875rem',
        },
        ...sx,
      }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          </InputAdornment>
        ),
        endAdornment: value ? (
          <InputAdornment position="end">
            <IconButton
              size="small"
              onClick={handleClear}
              sx={{ p: 0.5 }}
              aria-label="clear search"
            >
              <ClearIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </InputAdornment>
        ) : null,
      }}
      {...rest}
    />
  );
};

export default SearchTextField;
