import React from 'react';
import { DialogTitle, Typography, Divider, Box } from '@mui/material';

interface FormDialogHeaderProps {
  title: string;
  description: string;
}

const FormDialogHeader: React.FC<FormDialogHeaderProps> = ({ title, description }) => {
  return (
    <>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography component="div" variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400 }}>
          {description}
        </Typography>
      </DialogTitle>
      <Divider />
    </>
  );
};

export default FormDialogHeader;
