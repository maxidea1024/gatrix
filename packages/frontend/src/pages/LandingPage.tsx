import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Divider,
  Paper,
  Alert,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@/contexts/I18nContext';
import { Language, Settings, Schedule, Palette } from '@mui/icons-material';

const LandingPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { toggleTheme, isDark } = useTheme();
  const { language, changeLanguage } = useI18n();

  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const [selectedTimezone, setSelectedTimezone] = useState('UTC');
  const [selectedDateFormat, setSelectedDateFormat] = useState('YYYY-MM-DD HH:mm:ss');
  const [selectedTheme, setSelectedTheme] = useState(isDark ? 'dark' : 'light');

  const handleSaveSettings = () => {
    // 설정 저장
    if (selectedLanguage !== language) {
      changeLanguage(selectedLanguage);
      i18n.changeLanguage(selectedLanguage);
    }

    // 타임존과 날짜 형식은 localStorage에 저장
    localStorage.setItem('timezone', selectedTimezone);
    localStorage.setItem('dateFormat', selectedDateFormat);

    if ((selectedTheme === 'dark') !== isDark) {
      toggleTheme();
    }

    // 로그인 페이지로 이동
    navigate('/login');
  };

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'ko', name: '한국어' },
    { code: 'zh', name: '中文' },
  ];

  const timezones = [
    'UTC',
    'Asia/Seoul',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'America/New_York',
    'America/Los_Angeles',
    'Europe/London',
    'Europe/Paris',
  ];

  const dateFormats = [
    'YYYY-MM-DD HH:mm:ss',
    'MM/DD/YYYY HH:mm:ss',
    'DD/MM/YYYY HH:mm:ss',
    'YYYY년 MM월 DD일 HH:mm:ss',
  ];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: isDark 
          ? 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)'
          : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 4,
      }}
    >
      <Container maxWidth="md">
        <Paper
          elevation={24}
          sx={{
            p: 4,
            borderRadius: 3,
            background: isDark ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
          }}
        >
          {/* 헤더 */}
          <Box textAlign="center" mb={4}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 700,
                background: 'linear-gradient(45deg, #667eea, #764ba2)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 2,
              }}
            >
              {t('landing.welcome')}
            </Typography>
            <Typography variant="h5" color="text.secondary" sx={{ mb: 1 }}>
              Gatrix for UWO
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {t('landing.subtitle')}
            </Typography>
          </Box>

          {/* 설정 섹션 */}
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Box display="flex" alignItems="center" mb={3}>
                <Settings sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  {t('landing.initialSettings')}
                </Typography>
              </Box>

              <Grid container spacing={3}>
                {/* 언어 설정 */}
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>{t('landing.language')}</InputLabel>
                    <Select
                      value={selectedLanguage}
                      label={t('landing.language')}
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                      startAdornment={<Language sx={{ mr: 1, color: 'action.active' }} />}
                    >
                      {languages.map((lang) => (
                        <MenuItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* 타임존 설정 */}
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>{t('landing.timezone')}</InputLabel>
                    <Select
                      value={selectedTimezone}
                      label={t('landing.timezone')}
                      onChange={(e) => setSelectedTimezone(e.target.value)}
                      startAdornment={<Schedule sx={{ mr: 1, color: 'action.active' }} />}
                    >
                      {timezones.map((tz) => (
                        <MenuItem key={tz} value={tz}>
                          {tz}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* 날짜 형식 설정 */}
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>{t('landing.dateFormat')}</InputLabel>
                    <Select
                      value={selectedDateFormat}
                      label={t('landing.dateFormat')}
                      onChange={(e) => setSelectedDateFormat(e.target.value)}
                    >
                      {dateFormats.map((format) => (
                        <MenuItem key={format} value={format}>
                          {format}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* 테마 설정 */}
                <Grid item xs={12} sm={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={selectedTheme === 'dark'}
                        onChange={(e) => setSelectedTheme(e.target.checked ? 'dark' : 'light')}
                        color="primary"
                      />
                    }
                    label={
                      <Box display="flex" alignItems="center">
                        <Palette sx={{ mr: 1, color: 'action.active' }} />
                        {t('landing.darkTheme')}
                      </Box>
                    }
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* 안내 메시지 */}
          <Alert severity="info" sx={{ mb: 4 }}>
            {t('landing.settingsNote')}
          </Alert>

          <Divider sx={{ my: 3 }} />

          {/* 로그인 버튼 */}
          <Box textAlign="center">
            <Button
              variant="contained"
              size="large"
              onClick={handleSaveSettings}
              sx={{
                px: 6,
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 600,
                borderRadius: 2,
                background: 'linear-gradient(45deg, #667eea, #764ba2)',
                '&:hover': {
                  background: 'linear-gradient(45deg, #5a6fd8, #6a4190)',
                },
              }}
            >
              {t('landing.proceedToLogin')}
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default LandingPage;
