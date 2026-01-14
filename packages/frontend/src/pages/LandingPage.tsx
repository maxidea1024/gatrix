import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Autocomplete,
  TextField,
  alpha,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTheme as useAppTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import moment from 'moment-timezone';
import { setStoredTimezone } from '@/utils/dateFormat';
import { ThemeMode } from '@/types';

const LandingPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { mode, setTheme, isDark } = useAppTheme();
  const { language, changeLanguage } = useI18n();

  // Get browser's default timezone
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const [selectedTimezone, setSelectedTimezone] = useState(browserTimezone);
  const [selectedTheme, setSelectedTheme] = useState<ThemeMode>(mode);

  // Get all timezone options from moment-timezone
  const timezoneOptions = moment.tz.names();

  const formatTimezone = (tz: string) => {
    const offset = moment.tz(tz).format('Z');
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
      changeLanguage(selectedLanguage);
      i18n.changeLanguage(selectedLanguage);
    }
  }, [selectedLanguage, language, changeLanguage, i18n]);

  const handleProceed = () => {
    // Save timezone
    setStoredTimezone(selectedTimezone);

    // Mark as visited (skip landing page next time)
    localStorage.setItem('hasVisitedBefore', 'true');

    // Navigate to login page
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
        background: isDark
          ? 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)'
          : 'linear-gradient(135deg, #134e4a 0%, #0f766e 25%, #0d9488 50%, #0e7490 75%, #164e63 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
        position: 'relative',
        overflow: 'hidden',
        transition: 'background 0.5s ease',
      }}
    >
      {/* Animated Bubbles */}
      <Box
        sx={{
          position: 'absolute',
          top: '15%',
          right: '15%',
          width: 150,
          height: 150,
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle at 30% 30%, rgba(100, 150, 255, 0.15), rgba(45, 100, 191, 0.05))'
            : 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.25), rgba(45, 212, 191, 0.1))',
          zIndex: 1,
          animation: 'bubbleFloat1 6s ease-in-out infinite',
          transition: 'background 0.5s ease',
          '@keyframes bubbleFloat1': {
            '0%': { transform: 'translateY(0px) translateX(0px) scale(1)', opacity: 0.8 },
            '33%': { transform: 'translateY(-25px) translateX(15px) scale(1.05)', opacity: 0.9 },
            '66%': { transform: 'translateY(15px) translateX(-20px) scale(0.95)', opacity: 0.7 },
            '100%': { transform: 'translateY(0px) translateX(0px) scale(1)', opacity: 0.8 },
          },
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '20%',
          left: '10%',
          width: 100,
          height: 100,
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle at 40% 40%, rgba(100, 150, 255, 0.12), rgba(72, 100, 180, 0.04))'
            : 'radial-gradient(circle at 40% 40%, rgba(255, 255, 255, 0.2), rgba(72, 187, 120, 0.08))',
          zIndex: 1,
          animation: 'bubbleFloat2 8s ease-in-out infinite',
          transition: 'background 0.5s ease',
          '@keyframes bubbleFloat2': {
            '0%': { transform: 'translateY(0px) translateX(0px) scale(1)', opacity: 0.7 },
            '25%': { transform: 'translateY(20px) translateX(-15px) scale(1.1)', opacity: 0.8 },
            '50%': { transform: 'translateY(-15px) translateX(25px) scale(0.9)', opacity: 0.6 },
            '75%': { transform: 'translateY(10px) translateX(-10px) scale(1.05)', opacity: 0.9 },
            '100%': { transform: 'translateY(0px) translateX(0px) scale(1)', opacity: 0.7 },
          },
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: '60%',
          right: '8%',
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle at 35% 35%, rgba(100, 150, 255, 0.1), rgba(56, 100, 172, 0.03))'
            : 'radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.18), rgba(56, 178, 172, 0.06))',
          zIndex: 1,
          animation: 'bubbleFloat3 4s ease-in-out infinite',
          transition: 'background 0.5s ease',
          '@keyframes bubbleFloat3': {
            '0%': { transform: 'translateY(0px) translateX(0px) scale(1)', opacity: 0.6 },
            '50%': { transform: 'translateY(-30px) translateX(20px) scale(1.2)', opacity: 0.8 },
            '100%': { transform: 'translateY(0px) translateX(0px) scale(1)', opacity: 0.6 },
          },
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: '25%',
          left: '20%',
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle at 30% 30%, rgba(100, 150, 255, 0.08), rgba(20, 80, 166, 0.02))'
            : 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.15), rgba(20, 184, 166, 0.05))',
          zIndex: 1,
          animation: 'bubbleFloat4 7s ease-in-out infinite',
          transition: 'background 0.5s ease',
          '@keyframes bubbleFloat4': {
            '0%': { transform: 'translateY(0px) translateX(0px) scale(1)', opacity: 0.5 },
            '40%': { transform: 'translateY(25px) translateX(-12px) scale(1.3)', opacity: 0.7 },
            '80%': { transform: 'translateY(-20px) translateX(18px) scale(0.8)', opacity: 0.4 },
            '100%': { transform: 'translateY(0px) translateX(0px) scale(1)', opacity: 0.5 },
          },
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: '35%',
          right: '25%',
          width: 50,
          height: 50,
          borderRadius: '50%',
          background: isDark
            ? 'radial-gradient(circle at 25% 25%, rgba(100, 150, 255, 0.1), rgba(6, 80, 180, 0.04))'
            : 'radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.16), rgba(6, 182, 212, 0.07))',
          zIndex: 1,
          animation: 'bubbleFloat5 5s ease-in-out infinite',
          transition: 'background 0.5s ease',
          '@keyframes bubbleFloat5': {
            '0%': { transform: 'translateY(0px) translateX(0px) scale(1)', opacity: 0.6 },
            '30%': { transform: 'translateY(-22px) translateX(-16px) scale(1.15)', opacity: 0.8 },
            '70%': { transform: 'translateY(16px) translateX(22px) scale(0.85)', opacity: 0.5 },
            '100%': { transform: 'translateY(0px) translateX(0px) scale(1)', opacity: 0.6 },
          },
        }}
      />

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 2 }}>
        <Paper
          elevation={0}
          sx={{
            p: 5,
            borderRadius: 3,
            backgroundColor: isDark ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)'}`,
            boxShadow: isDark
              ? '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
            transition: 'all 0.5s ease',
          }}
        >
          {/* Header */}
          <Box textAlign="center" mb={5}>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: isDark ? '#ffffff' : '#1a1a1a',
                mb: 1.5,
              }}
            >
              {t('landing.welcome')}
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: isDark ? alpha('#ffffff', 0.7) : alpha('#000000', 0.6),
              }}
            >
              {t('landing.subtitle')}
            </Typography>
          </Box>

          {/* Settings */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 4 }}>
            {/* Language */}
            <FormControl fullWidth>
              <InputLabel>{t('landing.language')}</InputLabel>
              <Select
                value={selectedLanguage}
                label={t('landing.language')}
                onChange={(e) => setSelectedLanguage(e.target.value)}
              >
                {languages.map((lang) => (
                  <MenuItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Theme */}
            <FormControl fullWidth>
              <InputLabel>{t('theme')}</InputLabel>
              <Select
                value={selectedTheme}
                label={t('theme')}
                onChange={(e) => setSelectedTheme(e.target.value as ThemeMode)}
              >
                {themeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Timezone */}
            <Autocomplete
              value={selectedTimezone}
              onChange={(_, newValue) => {
                if (newValue) {
                  setSelectedTimezone(newValue);
                }
              }}
              options={timezoneOptions}
              getOptionLabel={formatTimezone}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('landing.timezone')}
                  placeholder={t('common.searchTimezone')}
                />
              )}
              renderOption={(props, option) => (
                <li {...props}>
                  <Box>
                    <Typography variant="body2">{option}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      UTC{moment.tz(option).format('Z')}
                    </Typography>
                  </Box>
                </li>
              )}
              fullWidth
            />
          </Box>

          {/* Info Note */}
          <Typography
            variant="body2"
            sx={{
              textAlign: 'center',
              mb: 4,
              color: isDark ? alpha('#ffffff', 0.5) : alpha('#000000', 0.5),
              fontSize: '0.85rem',
            }}
          >
            {t('landing.settingsNote')}
          </Typography>

          {/* Proceed Button */}
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={handleProceed}
            sx={{
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              borderRadius: 1,
              mb: 3,
            }}
          >
            {t('landing.proceedToLogin')}
          </Button>

          {/* Version */}
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              textAlign: 'center',
              color: isDark ? alpha('#ffffff', 0.3) : alpha('#000000', 0.3),
              fontSize: '0.75rem',
            }}
          >
            Gatrix {__APP_VERSION__}
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
};

export default LandingPage;
