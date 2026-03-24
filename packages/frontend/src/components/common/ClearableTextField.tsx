import React from 'react';
import {
  TextField,
  TextFieldProps,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { Clear as ClearIcon } from '@mui/icons-material';

type ClearableTextFieldProps = TextFieldProps & {
  /** Called when the clear button is clicked */
  onClear?: () => void;
};

/**
 * A TextField wrapper that shows a clear (x) button when the field has a value.
 * Useful for optional input fields to allow users to quickly clear the input.
 */
const ClearableTextField = React.forwardRef<
  HTMLDivElement,
  ClearableTextFieldProps
>(({ value, onClear, slotProps, InputProps, disabled, ...rest }, ref) => {
  const hasValue = value !== undefined && value !== null && value !== '';

  const clearButton =
    hasValue && !disabled ? (
      <InputAdornment position="end">
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onClear?.();
          }}
          edge="end"
          tabIndex={-1}
          sx={{ opacity: 0.5, '&:hover': { opacity: 1 } }}
        >
          <ClearIcon fontSize="small" />
        </IconButton>
      </InputAdornment>
    ) : null;

  return (
    <TextField
      ref={ref}
      value={value}
      disabled={disabled}
      InputProps={{
        ...InputProps,
        endAdornment: (
          <>
            {clearButton}
            {InputProps?.endAdornment}
          </>
        ),
      }}
      slotProps={slotProps}
      {...rest}
    />
  );
});

ClearableTextField.displayName = 'ClearableTextField';

export default ClearableTextField;
