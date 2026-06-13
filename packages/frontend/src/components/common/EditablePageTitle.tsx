import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Box, Typography, TextField } from '@mui/material';
import { Edit as EditIcon, Warning as WarningIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface EditablePageTitleProps {
  value: string;
  onChange: (newValue: string) => void;
  placeholder?: string;
  /** Optional list of existing names to check for duplicates */
  existingNames?: string[];
}

const EditablePageTitle: React.FC<EditablePageTitleProps> = ({
  value,
  onChange,
  placeholder = 'Untitled',
  existingNames,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const isSavingRef = useRef(false);

  useEffect(() => {
    setTempValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      isSavingRef.current = false;
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const isDuplicate = useMemo(() => {
    if (!existingNames || !tempValue.trim()) return false;
    const trimmed = tempValue.trim().toLowerCase();
    // Exclude the current value (renaming to the same name is fine)
    if (trimmed === value.toLowerCase()) return false;
    return existingNames.some((n) => n.toLowerCase() === trimmed);
  }, [tempValue, existingNames, value]);

  const handleSave = () => {
    if (isSavingRef.current) return; // Prevent double invocation (Enter + blur)
    isSavingRef.current = true;
    if (isDuplicate) return; // Block save on duplicate
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
      <Box
        sx={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <TextField
          inputRef={inputRef}
          value={tempValue}
          onChange={(e) => setTempValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          size="small"
          placeholder={placeholder}
          variant="outlined"
          error={isDuplicate}
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
            },
          }}
        />
        {isDuplicate && (
          <Typography
            variant="caption"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.3,
              mt: 0.3,
              color: 'warning.main',
              fontSize: '0.7rem',
            }}
          >
            <WarningIcon sx={{ fontSize: 12 }} />
            {t(
              'argus.common.duplicateNameWarning',
              'A query with this name already exists.'
            )}
          </Typography>
        )}
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
          bgcolor: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.05)'
              : 'rgba(0,0,0,0.03)',
        },
        '&:hover .edit-icon': {
          opacity: 0.7,
        },
      }}
      onClick={(e) => {
        e.stopPropagation();
        setIsEditing(true);
      }}
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
