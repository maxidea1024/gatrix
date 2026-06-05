import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, TextField } from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';

interface EditablePageTitleProps {
  value: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
}

const EditablePageTitle: React.FC<EditablePageTitleProps> = ({ value, onChange, placeholder = 'Untitled' }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = () => {
    if (tempValue.trim() && tempValue !== value) {
      onChange(tempValue.trim());
    } else {
      setTempValue(value);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempValue(value);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  if (isEditing) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        <TextField
          inputRef={inputRef}
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          size="small"
          placeholder={placeholder}
          variant="outlined"
          sx={{
            minWidth: 200,
            '& .MuiInputBase-root': {
              borderRadius: '6px',
            },
            '& .MuiInputBase-input': {
              py: 0.2,
              px: 0.8,
              fontSize: '1rem',
              fontWeight: 700,
              height: 'auto',
            }
          }}
        />
      </Box>
    );
  }

  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 0.5,
        cursor: 'text',
        borderRadius: '6px',
        px: 0.5,
        py: 0.2,
        ml: -0.5,
        transition: 'background-color 0.2s',
        '&:hover': {
          bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
        },
        '&:hover .edit-icon': {
          opacity: 0.7,
        }
      }}
      onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
    >
      <Typography
        variant="subtitle1"
        sx={{
          fontWeight: 700,
          fontSize: '1rem',
          lineHeight: 1.4,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 400,
        }}
      >
        {value || placeholder}
      </Typography>
      <EditIcon 
        className="edit-icon"
        sx={{ 
          fontSize: 16, 
          opacity: 0,
          transition: 'opacity 0.2s',
          color: 'text.secondary',
        }} 
      />
    </Box>
  );
};

export default EditablePageTitle;
