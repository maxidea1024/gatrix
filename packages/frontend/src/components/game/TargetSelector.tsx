import React, { useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  FormControlLabel,
  Checkbox,
  FormHelperText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
} from '@mui/material';

export interface TargetSelectorOption {
  label: string;
  value: string;
  subChannels?: Array<{ label: string; value: string }>;
}

export interface ChannelSubchannelData {
  channel: string;
  subchannels: string[];
}

export interface TargetSelectorConfig {
  // Display
  title: string;
  helperText?: string;
  placeholder?: string;

  // Data
  options: TargetSelectorOption[];
  selectedValues: string[] | ChannelSubchannelData[];
  isInverted: boolean;

  // Callbacks
  onSelectionChange: (values: string[] | ChannelSubchannelData[]) => void;
  onInvertedChange: (inverted: boolean) => void;

  // Features
  enableUserIdInput?: boolean;
  userIds?: string;
  onUserIdsChange?: (ids: string) => void;
  onUserIdsInvertedChange?: (inverted: boolean) => void;
  userIdsInverted?: boolean;

  // Type
  type?: 'simple' | 'channel' | 'userIds';
}

interface ChannelSubchannelData {
  channel: string;
  subchannels: string[];
}

const TargetSelector: React.FC<TargetSelectorConfig> = ({
  title,
  helperText,
  placeholder,
  options,
  selectedValues,
  isInverted,
  onSelectionChange,
  onInvertedChange,
  enableUserIdInput = false,
  userIds,
  onUserIdsChange,
  onUserIdsInvertedChange,
  userIdsInverted = false,
  type = 'simple',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = React.useState(false);

  const handleToggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  const handleNotClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInvertedChange(!isInverted);
  };

  const handleChipDelete = (value: string) => {
    onSelectionChange(selectedValues.filter((v) => v !== value));
  };

  const handleOptionChange = (value: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedValues, value]);
    } else {
      onSelectionChange(selectedValues.filter((v) => v !== value));
    }
  };

  const renderSelectedChips = () => {
    if (selectedValues.length === 0) {
      return !isInverted && (
        <Typography variant="body2" color="text.secondary">
          선택된 항목이 없습니다.
        </Typography>
      );
    }

    return selectedValues.map((value) => {
      const option = options.find((o) => o.value === value);
      return (
        <Chip
          key={value}
          label={option?.label || value}
          onDelete={(e) => {
            e.stopPropagation();
            handleChipDelete(value);
          }}
          size="small"
          variant="outlined"
          sx={{ borderRadius: 0.5 }}
        />
      );
    });
  };

  const renderDropdownContent = () => {
    return (
      <Box sx={{ p: 1 }}>
        {options.map((option) => {
          const isSelected = selectedValues.includes(option.value);
          return (
            <FormControlLabel
              key={option.value}
              control={
                <Checkbox
                  checked={isSelected}
                  onChange={(e) => handleOptionChange(option.value, e.target.checked)}
                  size="small"
                />
              }
              label={option.label}
              sx={{ display: 'block', mb: 1 }}
            />
          );
        })}
      </Box>
    );
  };

  const renderUserIdInput = () => {
    if (!enableUserIdInput || userIds === undefined) return null;

    const userIdList = userIds ? userIds.split(',').map((id) => id.trim()).filter((id) => id) : [];

    return (
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 500 }}>
          사용자 ID
        </Typography>

        <Box
          sx={{
            border: '1px solid',
            borderColor: 'action.disabled',
            borderRadius: 1,
            p: 1.5,
            minHeight: 56,
            display: 'flex',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 1,
            bgcolor: 'background.paper',
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: 'action.active',
              bgcolor: 'action.hover',
            },
            '&:focus-within': {
              borderColor: 'primary.main',
              boxShadow: '0 0 0 2px rgba(25, 103, 210, 0.1)',
            }
          }}
        >
          {userIds && userIds.trim() && (
            <Button
              variant="contained"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onUserIdsInvertedChange?.(!userIdsInverted);
              }}
              sx={{
                minWidth: 'auto',
                px: 1,
                py: 0.5,
                fontWeight: 600,
                textTransform: 'none',
                fontSize: '0.85rem',
                ...(userIdsInverted ? {
                  bgcolor: 'error.main',
                  color: 'white',
                  '&:hover': {
                    bgcolor: 'error.dark',
                  }
                } : {
                  bgcolor: 'action.disabled',
                  color: 'text.secondary',
                  '&:hover': {
                    bgcolor: 'action.disabled',
                    opacity: 0.8,
                  }
                })
              }}
            >
              NOT
            </Button>
          )}

          {userIdList.map((id, index) => (
            <Chip
              key={index}
              label={id}
              onDelete={() => {
                const filtered = userIdList.filter((_, i) => i !== index);
                onUserIdsChange?.(filtered.length > 0 ? filtered.join(', ') : '');
              }}
              size="small"
            />
          ))}

          <input
            type="text"
            placeholder={userIds && userIds.trim() ? '' : 'user1, user2, user3...'}
            onKeyDown={(e) => {
              const input = (e.currentTarget as HTMLInputElement).value.trim();
              if ((e.key === 'Enter' || e.key === ',') && input) {
                e.preventDefault();
                const newIds = input.split(',').map((id) => id.trim()).filter((id) => id);
                const uniqueIds = Array.from(new Set([...userIdList, ...newIds]));
                onUserIdsChange?.(uniqueIds.join(', '));
                (e.currentTarget as HTMLInputElement).value = '';
              }
            }}
            style={{
              flex: 1,
              minWidth: 150,
              border: 'none',
              outline: 'none',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
              backgroundColor: 'transparent',
              color: 'inherit',
              caretColor: 'inherit',
            }}
          />
        </Box>

        <FormHelperText sx={{ mt: 1 }}>
          쉼표(,)로 구분하여 여러 사용자 ID를 입력할 수 있습니다.
        </FormHelperText>
      </Box>
    );
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 500 }}>
        {title}
      </Typography>

      <Box ref={containerRef}>
        {/* Selected Items Display */}
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'action.disabled',
            borderRadius: 1,
            p: 1.5,
            minHeight: 56,
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 1,
            bgcolor: 'background.paper',
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: 'action.active',
              bgcolor: 'action.hover',
            }
          }}
          onClick={handleToggleDropdown}
        >
          {selectedValues.length > 0 && (
            <Button
              variant="contained"
              size="small"
              onClick={handleNotClick}
              sx={{
                minWidth: 'auto',
                px: 1,
                py: 0.5,
                fontWeight: 600,
                textTransform: 'none',
                fontSize: '0.85rem',
                ...(isInverted ? {
                  bgcolor: 'error.main',
                  color: 'white',
                  '&:hover': {
                    bgcolor: 'error.dark',
                  }
                } : {
                  bgcolor: 'action.disabled',
                  color: 'text.secondary',
                  '&:hover': {
                    bgcolor: 'action.disabled',
                    opacity: 0.8,
                  }
                })
              }}
            >
              NOT
            </Button>
          )}
          {renderSelectedChips()}
        </Box>

        {/* Dropdown */}
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'action.disabled',
            borderRadius: 1,
            overflow: showDropdown ? 'auto' : 'hidden',
            mt: 0,
            bgcolor: 'background.paper',
            position: 'relative',
            top: -1,
            maxHeight: showDropdown ? 300 : 0,
            opacity: showDropdown ? 1 : 0,
            transition: 'all 0.3s ease-in-out',
            visibility: showDropdown ? 'visible' : 'hidden',
          }}
        >
          {renderDropdownContent()}
        </Box>
      </Box>

      {helperText && (
        <FormHelperText sx={{ mt: 1 }}>{helperText}</FormHelperText>
      )}

      {renderUserIdInput()}
    </Box>
  );
};

export default TargetSelector;

