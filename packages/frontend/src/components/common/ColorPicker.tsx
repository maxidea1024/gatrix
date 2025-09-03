import React, { useState } from 'react';
import {
  Box,
  Button,
  Grid,
  IconButton,
  Popover,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Palette as PaletteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
  size?: 'small' | 'medium';
  disabled?: boolean;
}

// 미리 정의된 색상 팔레트
const PRESET_COLORS = [
  '#F44336', '#E91E63', '#9C27B0', '#673AB7',
  '#3F51B5', '#2196F3', '#03A9F4', '#00BCD4',
  '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
  '#FFEB3B', '#FFC107', '#FF9800', '#FF5722',
  '#795548', '#9E9E9E', '#607D8B', '#000000',
];

// 랜덤 색상 생성
const generateRandomColor = () => 
  `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value,
  onChange,
  label = 'Color',
  size = 'medium',
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [customColor, setCustomColor] = useState(value);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
    setCustomColor(value);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleColorSelect = (color: string) => {
    onChange(color);
    setCustomColor(color);
    handleClose();
  };

  const handleCustomColorChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = event.target.value;
    setCustomColor(newColor);
    onChange(newColor);
  };

  const handleRandomColor = () => {
    const randomColor = generateRandomColor();
    setCustomColor(randomColor);
    onChange(randomColor);
  };

  const open = Boolean(anchorEl);
  const buttonSize = size === 'small' ? 32 : 40;

  return (
    <>
      <Tooltip title={`${label}: ${value}`}>
        <IconButton
          onClick={handleOpen}
          disabled={disabled}
          sx={{
            width: buttonSize,
            height: buttonSize,
            bgcolor: value,
            border: '2px solid',
            borderColor: 'divider',
            '&:hover': {
              bgcolor: value,
              opacity: 0.8,
            },
            '&.Mui-disabled': {
              bgcolor: value,
              opacity: 0.5,
            },
          }}
        >
          <PaletteIcon 
            sx={{ 
              color: 'white',
              fontSize: size === 'small' ? 16 : 20,
              filter: 'drop-shadow(0 0 2px rgba(0,0,0,0.5))',
            }} 
          />
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        PaperProps={{
          sx: {
            p: 2,
            minWidth: 300,
            maxWidth: 320,
            boxShadow: 3,
            border: '1px solid',
            borderColor: 'divider'
          },
        }}
        BackdropProps={{
          sx: {
            backgroundColor: 'transparent',
            backdropFilter: 'none'
          }
        }}
        disableScrollLock
      >
        <Stack spacing={2}>
          <Typography variant="subtitle2" fontWeight="bold">
            {t('common.colorPicker.selectColor')}
          </Typography>

          {/* 미리 정의된 색상 팔레트 */}
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              {t('common.colorPicker.presetColors')}
            </Typography>
            <Grid container spacing={0.5}>
              {PRESET_COLORS.map((color) => (
                <Grid item key={color}>
                  <Tooltip title={color}>
                    <IconButton
                      onClick={() => handleColorSelect(color)}
                      sx={{
                        width: 28,
                        height: 28,
                        bgcolor: color,
                        border: value === color ? '2px solid' : '1px solid',
                        borderColor: value === color ? 'primary.main' : 'divider',
                        borderRadius: 0.5,
                        '&:hover': {
                          bgcolor: color,
                          opacity: 0.8,
                          transform: 'scale(1.1)',
                        },
                      }}
                    />
                  </Tooltip>
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* 커스텀 색상 선택 */}
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              {t('common.colorPicker.customColor')}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                type="color"
                value={customColor}
                onChange={handleCustomColorChange}
                sx={{ width: 50 }}
                size="small"
              />
              <TextField
                value={customColor}
                onChange={(e) => {
                  const newColor = e.target.value;
                  if (/^#[0-9A-Fa-f]{6}$/.test(newColor)) {
                    setCustomColor(newColor);
                    onChange(newColor);
                  }
                }}
                placeholder="#000000"
                size="small"
                sx={{ flex: 1 }}
              />
              <Tooltip title={t('common.colorPicker.randomColor')}>
                <IconButton onClick={handleRandomColor} size="small">
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          {/* 액션 버튼 */}
          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ pt: 1 }}>
            <Button onClick={handleClose} size="small" sx={{ minWidth: 60 }}>
              {t('common.colorPicker.cancel')}
            </Button>
            <Button
              onClick={() => handleColorSelect(customColor)}
              variant="contained"
              size="small"
              sx={{ minWidth: 60 }}
            >
              {t('common.colorPicker.apply')}
            </Button>
          </Stack>
        </Stack>
      </Popover>
    </>
  );
};

export default ColorPicker;
