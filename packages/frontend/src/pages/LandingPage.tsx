import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  TextField,
} from '@mui/material';
import {
  Language as LanguageIcon,
  Palette as PaletteIcon,
  Schedule as TimezoneIcon,
  ArrowForward as ArrowIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTheme as useAppTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import dayjsTimezone from 'dayjs/plugin/timezone';
import { setStoredTimezone } from '@/utils/dateFormat';
import { ThemeMode } from '@/types';

dayjs.extend(utc);
dayjs.extend(dayjsTimezone);

const LandingPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { mode, setTheme, isDark } = useAppTheme();
  const { language, changeLanguage } = useI18n();

  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const supportedLanguages = ['en', 'ko', 'zh'];
  const normalizedLanguage = supportedLanguages.includes(language)
    ? language
    : supportedLanguages.find((l) => language.startsWith(l)) || 'en';
  const [selectedLanguage, setSelectedLanguage] = useState(normalizedLanguage);
  const [selectedTimezone, setSelectedTimezone] = useState(browserTimezone);
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>(mode);

  const timezoneOptions = Intl.supportedValuesOf('timeZone');

  const formatTimezone = (tz: string) => {
    const offset = dayjs().tz(tz).format('Z');
    return `${tz} (UTC${offset})`;
  };

  // Apply theme immediately when changed
  useEffect(() => {
    if (selectedTheme !== mode) {
      setTheme(selectedTheme);
    }
  }, [selectedTheme, mode, setTheme]);

  // Apply language immediately when changed
  useEffect(() => {
    if (selectedLanguage !== language) {
      changeLanguage(selectedLanguage as any);
      i18n.changeLanguage(selectedLanguage);
    }
  }, [selectedLanguage, language, changeLanguage, i18n]);

  const handleProceed = () => {
    setStoredTimezone(selectedTimezone);
    localStorage.setItem('hasVisitedBefore', 'true');
    navigate('/login');
  };

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'ko', name: '한국어' },
    { code: 'zh', name: '中文' },
  ];

  const themeOptions: { value: ThemeMode; label: string }[] = [
    { value: 'light', label: t('common.themeLight') },
    { value: 'dark', label: t('common.themeDark') },
    { value: 'auto', label: t('common.themeAuto') },
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        py: 4,
      }}
    >
      <Box
        sx={{
          maxWidth: 480,
          width: '100%',
          mx: 2,
        }}
      >
        {/* Logo + Branding */}
        <Box sx={{ textAlign: 'center', mb: 5 }}>
          <Typography
            sx={{
              fontSize: 48,
              fontWeight: 800,
              letterSpacing: -2,
              color: 'primary.main',
              mb: 1.5,
            }}
          >
            GATRIX
          </Typography>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 600,
              color: 'text.primary',
              mb: 1,
              letterSpacing: -0.3,
            }}
          >
            {t('landing.welcome')}
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              lineHeight: 1.6,
            }}
          >
            {t('landing.subtitle')}
          </Typography>
        </Box>

        {/* Settings Card */}
        <Box
          sx={{
            p: { xs: 3.5, sm: 4 },
            borderRadius: 4,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: isDark
              ? '0 8px 32px rgba(0,0,0,0.3)'
              : '0 8px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          {/* Settings fields */}
          <Box
            sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mb: 3.5 }}
          >
            {/* Language */}
            <Box>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
              >
                <LanguageIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                  }}
                >
                  {t('landing.language')}
                </Typography>
              </Box>
              <FormControl fullWidth size="small">
                <Select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                >
                  {languages.map((lang) => (
                    <MenuItem key={lang.code} value={lang.code}>
                      {lang.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Theme */}
            <Box>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
              >
                <PaletteIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                  }}
                >
                  {t('theme')}
                </Typography>
              </Box>
              <FormControl fullWidth size="small">
                <Select
                  value={selectedTheme}
                  onChange={(e) =>
                    setSelectedTheme(e.target.value as ThemeMode)
                  }
                >
                  {themeOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Timezone */}
            <Box>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}
              >
                <TimezoneIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 600,
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                  }}
                >
                  {t('landing.timezone')}
                </Typography>
              </Box>
              <Autocomplete
                value={selectedTimezone}
                onChange={(_, newValue) => {
                  if (newValue) setSelectedTimezone(newValue);
                }}
                options={timezoneOptions}
                getOptionLabel={formatTimezone}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    placeholder={t('common.searchTimezone')}
                    size="small"
                  />
                )}
                renderOption={(props, option) => (
                  <li {...props}>
                    <Box>
                      <Typography variant="body2">{option}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        UTC{dayjs().tz(option).format('Z')}
                      </Typography>
                    </Box>
                  </li>
                )}
                fullWidth
              />
            </Box>
          </Box>

          {/* Info note */}
          <Typography
            variant="body2"
            sx={{
              textAlign: 'center',
              mb: 3,
              color: 'text.disabled',
              fontSize: '0.8rem',
            }}
          >
            {t('landing.settingsNote')}
          </Typography>

          {/* Proceed Button */}
          <Button
            variant="contained"
            size="large"
            fullWidth
            endIcon={<ArrowIcon />}
            onClick={handleProceed}
            sx={{
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              borderRadius: 2,
            }}
          >
            {t('landing.proceedToLogin')}
          </Button>
        </Box>

        {/* Version */}
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'center',
            mt: 3,
            color: 'text.disabled',
            fontSize: '0.75rem',
          }}
        >
          Gatrix {__APP_VERSION__}
        </Typography>
      </Box>
    </Box>
  );
};

export default LandingPage;
