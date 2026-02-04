import React, { useId } from 'react';
import { FormControl, InputLabel, Select, type SelectProps } from '@mui/material';
import type { FormControlProps } from '@mui/material/FormControl';
import type { SxProps, Theme } from '@mui/material/styles';

export interface SelectFieldProps {
  id?: string;
  label: React.ReactNode;
  value: any;
  onChange?: SelectProps['onChange'];
  children: React.ReactNode;
  size?: 'small' | 'medium';
  fullWidth?: boolean;
  displayEmpty?: boolean;
  sx?: SxProps<Theme>;
  formControlProps?: Omit<FormControlProps, 'fullWidth' | 'size' | 'variant' | 'sx'>;
  selectProps?: Omit<SelectProps, 'label' | 'value' | 'onChange' | 'displayEmpty' | 'labelId'>;
}

const SelectField: React.FC<SelectFieldProps> = ({
  id,
  label,
  value,
  onChange,
  children,
  size = 'small',
  fullWidth = true,
  displayEmpty = true,
  sx,
  formControlProps,
  selectProps,
}) => {
  const autoId = useId();
  const labelId = id ? `${id}-label` : `${autoId}-label`;

  return (
    <FormControl fullWidth={fullWidth} size={size} variant="outlined" sx={sx} {...formControlProps}>
      <InputLabel id={labelId} shrink={true}>
        {label}
      </InputLabel>
      <Select
        labelId={labelId}
        value={value}
        onChange={onChange}
        label={typeof label === 'string' ? label : undefined}
        displayEmpty={displayEmpty}
        {...selectProps}
      >
        {children}
      </Select>
    </FormControl>
  );
};

export default SelectField;
