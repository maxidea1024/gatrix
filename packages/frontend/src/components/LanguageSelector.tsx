import React, { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Box,
  Typography,
} from '@mui/material';
import {
  Language as LanguageIcon,
  Check,
} from '@mui/icons-material';
import { useI18n, getLanguageDisplayName } from '@/contexts/I18nContext';
import { Language } from '@/types';

interface LanguageSelectorProps {
  variant?: 'icon' | 'text' | 'full';
  size?: 'small' | 'medium' | 'large';
}

// Language flag emojis
const languageFlags: Record<Language, string> = {
  en: '🇺🇸',
  ko: '🇰🇷',
  zh: '🇨🇳',
};

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'icon',
  size = 'medium',
}) => {
  const { language, changeLanguage, supportedLanguages, t } = useI18n();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLanguageChange = (lang: Language) => {
    changeLanguage(lang);
    handleClose();
  };

  const renderTrigger = () => {
    switch (variant) {
      case 'text':
        return (
          <Box
            onClick={handleClick}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
              px: 1,
              py: 0.5,
              borderRadius: 1,
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <Typography variant="body2">
              {languageFlags[language]} {getLanguageDisplayName(language)}
            </Typography>
          </Box>
        );
      case 'full':
        return (
          <Box
            onClick={handleClick}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
              px: 2,
              py: 1,
              borderRadius: 1,
              border: 1,
              borderColor: 'divider',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <LanguageIcon fontSize="small" />
            <Typography variant="body2">
              {languageFlags[language]} {getLanguageDisplayName(language)}
            </Typography>
          </Box>
        );
      default:
        return (
          <Tooltip title={t('language.changeLanguage')}>
            <IconButton
              onClick={handleClick}
              size={size}
              aria-label="change language"
            >
              <LanguageIcon />
            </IconButton>
          </Tooltip>
        );
    }
  };

  return (
    <>
      {renderTrigger()}
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: { minWidth: 180 },
        }}
      >
        {supportedLanguages.map((lang) => (
          <MenuItem
            key={lang}
            onClick={() => handleLanguageChange(lang)}
            selected={language === lang}
          >
            <ListItemIcon>
              <Box sx={{ fontSize: '1.2rem', minWidth: 'auto', mr: 1 }}>
                {languageFlags[lang]}
              </Box>
              {language === lang && <Check fontSize="small" />}
            </ListItemIcon>
            <ListItemText>
              {getLanguageDisplayName(lang)}
            </ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};

// Compact language selector for mobile
export const CompactLanguageSelector: React.FC = () => {
  const { language, changeLanguage, supportedLanguages } = useI18n();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLanguageChange = (lang: Language) => {
    changeLanguage(lang);
    handleClose();
  };

  return (
    <>
      <IconButton
        onClick={handleClick}
        size="small"
        sx={{
          fontSize: '1.2rem',
          minWidth: 'auto',
        }}
      >
        {languageFlags[language]}
      </IconButton>
      
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'center', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
      >
        {supportedLanguages.map((lang) => (
          <MenuItem
            key={lang}
            onClick={() => handleLanguageChange(lang)}
            selected={language === lang}
            sx={{ minHeight: 'auto', py: 1 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ fontSize: '1.2rem' }}>
                {languageFlags[lang]}
              </Box>
              <Typography variant="body2">
                {getLanguageDisplayName(lang)}
              </Typography>
              {language === lang && (
                <Check fontSize="small" color="primary" />
              )}
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
};
