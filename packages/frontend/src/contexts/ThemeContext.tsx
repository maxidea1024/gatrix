import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import {
  createTheme,
  Theme,
  ThemeProvider as MuiThemeProvider,
} from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { ThemeMode } from '@/types';

interface ThemeContextType {
  mode: ThemeMode;
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(
  undefined
);

// Theme configurations
const getTheme = (mode: 'light' | 'dark', language: string): Theme => {
  const isChinese = language.startsWith('zh');
  const fontFamily = isChinese
    ? '"Inter", "Rubik", "Microsoft YaHei", "微软雅黑", "Source Han Sans SC", "思源黑体", "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Roboto", "Helvetica", "Arial", sans-serif'
    : '"Pretendard", "Inter", "Noto Sans KR", "Rubik", "Roboto", "Helvetica", "Arial", sans-serif';

  // -- Sentry-inspired color palette --
  const colors = {
    primary: {
      light: {
        main: '#6C5FC7',
        light: '#887BE0',
        dark: '#584ED2',
        contrastText: '#ffffff',
      },
      dark: {
        main: '#818cf8',
        light: '#a5b4fc',
        dark: '#6366f1',
        contrastText: '#ffffff',
      },
    },
    secondary: {
      light: {
        main: '#EAEAEA',
        light: '#F5F5F5',
        dark: '#D4D4D4',
      },
      dark: {
        main: '#fb7185',
        light: '#fda4af',
        dark: '#f43f5e',
      },
    },
    bg: {
      light: {
        default: '#FFFFFF',
        paper: '#FFFFFF',
      },
      dark: {
        default: '#121212',
        paper: '#1e1e1e',
      },
    },
    text: {
      light: {
        primary: '#2B2836',
        secondary: '#6A6582',
      },
      dark: {
        primary: '#e4e4e7',
        secondary: '#a1a1aa',
      },
    },
    success: mode === 'dark' ? '#34d399' : '#57BE8E',
    warning: mode === 'dark' ? '#fbbf24' : '#F4A522',
    error: mode === 'dark' ? '#f87171' : '#E03E2F',
    info: mode === 'dark' ? '#60a5fa' : '#4A8EE6',
    border: mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : '#EAEAEA',
    borderHover: mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : '#D4D4D4',
    borderFocus: mode === 'dark' ? '#818cf8' : '#6C5FC7',
    hoverBg:
      mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.03)',
    activeBg:
      mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
    stripeBg:
      mode === 'dark' ? 'rgba(255, 255, 255, 0.025)' : 'rgba(0, 0, 0, 0.015)',
    drawerBg: mode === 'dark' ? '#171717' : '#FAFAFA',
    inputBg: mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
    theadBg: mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : '#FAFAFA',
  };

  const p = mode === 'dark' ? colors.primary.dark : colors.primary.light;
  const s = mode === 'dark' ? colors.secondary.dark : colors.secondary.light;
  const bg = mode === 'dark' ? colors.bg.dark : colors.bg.light;
  const txt = mode === 'dark' ? colors.text.dark : colors.text.light;

  return createTheme({
    palette: {
      mode,
      primary: {
        main: p.main,
        light: p.light,
        dark: p.dark,
        contrastText: p.contrastText,
      },
      secondary: {
        main: s.main,
        light: s.light,
        dark: s.dark,
      },
      success: { main: colors.success },
      warning: { main: colors.warning },
      error: { main: colors.error },
      info: { main: colors.info },
      background: {
        default: bg.default,
        paper: bg.paper,
      },
      text: {
        primary: txt.primary,
        secondary: txt.secondary,
      },
    },
    zIndex: {
      mobileStepper: 1000,
      fab: 1050,
      speedDial: 1050,
      appBar: 1100,
      drawer: 1300,
      modal: 1500,
      snackbar: 1400,
      tooltip: 1600,
    },
    typography: {
      fontFamily,
      fontWeightRegular: 500,
      h1: { fontSize: '2.5rem', fontWeight: 600 },
      h2: { fontSize: '2rem', fontWeight: 600 },
      h3: { fontSize: '1.75rem', fontWeight: 600 },
      h4: { fontSize: '1.5rem', fontWeight: 600 },
      h5: { fontSize: '1.25rem', fontWeight: 600 },
      h6: { fontSize: '1rem', fontWeight: 600 },
      body1: { fontWeight: 500 },
      body2: { fontWeight: 500 },
      subtitle1: { fontWeight: 500 },
      subtitle2: { fontWeight: 500 },
      caption: { fontWeight: 500 },
    },
    shape: {
      borderRadius: 4,
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: bg.paper,
            color: txt.primary,
            boxShadow: 'none',
            borderBottom: `1px solid ${colors.border}`,
          },
        },
      },
      MuiAccordion: {
        styleOverrides: {
          root: {
            backgroundColor: mode === 'dark' ? 'transparent' : undefined,
            '&:before': { display: 'none' },
            borderRadius: '4px !important',
            border: `1px solid ${colors.border}`,
            boxShadow: 'none',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
          elevation1: {
            boxShadow: 'none',
            border: `1px solid ${colors.border}`,
          },
          outlined: {
            backgroundColor: mode === 'dark' ? 'transparent' : undefined,
            borderColor: colors.border,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: colors.drawerBg,
            borderRight: `1px solid ${colors.border}`,
            borderRadius: 0,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: 'none',
            border: `1px solid ${colors.border}`,
            borderRadius: 6,
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 4,
          },
        },
      },
      MuiButtonGroup: {
        styleOverrides: {
          contained: {
            boxShadow:
              mode === 'dark'
                ? '0 3px 0 rgba(0,0,0,0.5)'
                : '0 3px 0 rgba(0,0,0,0.15)',
            '&:active': {
              boxShadow: 'none !important',
              transform: 'translateY(3px)',
            },
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: false,
        },
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 4,
            border: 'none',
            transition: 'all 0.1s ease-in-out',
            // Tactile bottom shadow elevation
            boxShadow:
              mode === 'dark'
                ? '0 3px 0 rgba(0,0,0,0.5)'
                : '0 3px 0 rgba(0,0,0,0.15)',
            '&:active': {
              boxShadow: 'none !important',
              transform: 'translateY(3px)',
            },
          },
          sizeMedium: {
            padding: '6px 14px',
            fontSize: '0.875rem',
            lineHeight: 1.4,
          },
          sizeSmall: {
            padding: '4px 10px',
            fontSize: '0.75rem',
          },
          sizeLarge: {
            padding: '8px 18px',
            fontSize: '1rem',
          },
          containedPrimary: {
            // Stronger bottom shadow for primary button
            boxShadow: mode === 'dark' ? '0 3px 0 #312A66' : '0 3px 0 #4A42B0',
            '&:hover': {
              boxShadow:
                mode === 'dark' ? '0 3px 0 #2A2459' : '0 3px 0 #3D3692',
            },
          },
          containedSecondary: {
            backgroundColor: mode === 'dark' ? '#3F3B55' : '#FFFFFF',
            color: mode === 'dark' ? '#EBEAED' : '#2B2836',
            boxShadow:
              mode === 'dark'
                ? '0 3px 0 rgba(0,0,0,0.3)'
                : '0 3px 0 rgba(0,0,0,0.15)',
            '&:hover': {
              backgroundColor: mode === 'dark' ? '#534E6B' : '#F9F9FB',
              boxShadow:
                mode === 'dark'
                  ? '0 3px 0 rgba(0,0,0,0.4)'
                  : '0 3px 0 rgba(0,0,0,0.2)',
            },
          },
          outlined: {
            backgroundColor:
              mode === 'dark' ? 'rgba(255,255,255,0.02)' : '#FFFFFF',
            color: txt.primary,
            boxShadow:
              mode === 'dark'
                ? '0 3px 0 rgba(0,0,0,0.3)'
                : '0 3px 0 rgba(0,0,0,0.15)',
            '&:hover': {
              backgroundColor:
                mode === 'dark' ? 'rgba(255,255,255,0.05)' : '#F9F9FB',
              boxShadow:
                mode === 'dark'
                  ? '0 3px 0 rgba(0,0,0,0.4)'
                  : '0 3px 0 rgba(0,0,0,0.2)',
            },
          },
          text: {
            boxShadow: 'none',
            '&:hover': {
              backgroundColor:
                mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            },
            '&:active': {
              boxShadow: 'none !important',
              transform: 'none', // Text buttons usually don't press down
            },
          },
        },
      },
      // Dialog action buttons: first button (cancel) should be text, not contained
      MuiDialogActions: {
        styleOverrides: {
          root: {
            '& .MuiButton-root:not([class*="MuiButton-contained"])': {
              boxShadow: 'none',
              backgroundColor: 'transparent',
              '&:active': {
                transform: 'none',
              },
            },
          },
        },
      },
      MuiPagination: {
        styleOverrides: {
          root: {
            '& .MuiPaginationItem-root': {
              fontWeight: 500,
              '&.Mui-selected': {
                backgroundColor: p.main,
                color: p.contrastText,
                '&:hover': {
                  backgroundColor: p.dark,
                },
              },
              '&:hover': {
                backgroundColor: colors.hoverBg,
              },
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              color: txt.primary,
              '& fieldset': {
                borderColor: colors.border,
              },
              '&:hover fieldset': {
                borderColor: colors.borderHover,
              },
              '&.Mui-focused fieldset': {
                borderColor: colors.borderFocus,
                borderWidth: '2px',
              },
            },
            '& .MuiOutlinedInput-input': {
              color: txt.primary,
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            color: `${txt.primary} !important`,
            fontWeight: 500,
          },
          input: {
            color: `${txt.primary} !important`,
            WebkitTextFillColor: `${txt.primary} !important`,
            fontWeight: 500,
            '&::placeholder': {
              color: txt.secondary,
              WebkitTextFillColor: txt.secondary,
              opacity: 1,
              fontWeight: 500,
            },
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            color: `${txt.primary} !important`,
            fontWeight: 500,
          },
          input: {
            color: `${txt.primary} !important`,
            WebkitTextFillColor: `${txt.primary} !important`,
            fontWeight: 500,
            '&::placeholder': {
              fontWeight: 500,
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: txt.secondary,
            fontWeight: 500,
            '&.Mui-focused': {
              color: p.main,
            },
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color 0.15s ease-in-out',
            '&:not(:last-child)': {
              '& td': {
                borderBottom: `1px solid ${colors.border}`,
              },
            },
            '&:nth-of-type(even)': {
              backgroundColor: colors.stripeBg,
            },
            '&:hover': {
              backgroundColor: colors.hoverBg,
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderBottom: `1px solid ${colors.border}`,
          },
          head: {
            backgroundColor: colors.theadBg,
            fontWeight: 600,
            color: txt.secondary,
            borderBottom: `1px solid ${colors.border}`,
          },
        },
      },
      MuiDialog: {
        defaultProps: {
          slotProps: {
            transition: { exit: false },
          },
        },
        styleOverrides: {
          paper: {
            boxShadow:
              mode === 'dark'
                ? '0 8px 24px rgba(0,0,0,0.6)'
                : '0 8px 24px rgba(0,0,0,0.12)',
            border: `1px solid ${colors.border}`,
          },
          root: {
            '& .MuiBackdrop-root': {
              backgroundColor:
                mode === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(28,25,43,0.3)',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
            },
          },
        },
      },
      MuiModal: {
        styleOverrides: {
          root: {
            '&:not(.MuiSelect-root) .MuiBackdrop-root': {
              backgroundColor:
                mode === 'dark' ? 'rgba(0,0,0,0.6)' : 'rgba(28,25,43,0.3)',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
            },
            '&.MuiSelect-root .MuiBackdrop-root': {
              backgroundColor: 'transparent',
            },
          },
        },
      },
      MuiSelect: {
        defaultProps: {
          MenuProps: {
            disableScrollLock: true,
            BackdropProps: {
              style: {
                backgroundColor: 'transparent',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
              },
            },
          },
        },
      },
      MuiMenu: {
        defaultProps: {
          disableScrollLock: true,
          BackdropProps: {
            style: {
              backgroundColor: 'transparent',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
            },
          },
          slotProps: {
            transition: { exit: false },
          },
        },
        styleOverrides: {
          paper: {
            boxShadow:
              mode === 'dark'
                ? '0 4px 16px rgba(0,0,0,0.5)'
                : '0 4px 16px rgba(0,0,0,0.1)',
            border: `1px solid ${colors.border}`,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            fontWeight: 500,
          },
        },
      },
      MuiTableBody: {
        styleOverrides: {
          root: {
            '& .MuiTableRow-root.MuiTableRow-hover:hover': {
              backgroundColor: colors.hoverBg + ' !important',
            },
          },
        },
      },
      MuiPopover: {
        defaultProps: {
          disableScrollLock: true,
          BackdropProps: {
            style: {
              backgroundColor: 'transparent',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
            },
            invisible: true,
          },
          slotProps: {
            transition: { exit: false },
          },
        },
        styleOverrides: {
          paper: {
            boxShadow:
              mode === 'dark'
                ? '0 4px 16px rgba(0,0,0,0.5)'
                : '0 4px 16px rgba(0,0,0,0.1)',
            border: `1px solid ${colors.border}`,
          },
        },
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: {
            '&.Mui-checked': {
              color: p.main,
              '& + .MuiSwitch-track': {
                backgroundColor: p.main,
                opacity: 0.5,
              },
            },
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 500,
            '&.Mui-selected': {
              color: p.main,
            },
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          indicator: {
            backgroundColor: p.main,
          },
        },
      },
    },
  });
};

// Detect system theme preference
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return 'light';
};

// Get stored theme preference
const getStoredTheme = (): ThemeMode => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('theme') as ThemeMode;
    if (stored && ['light', 'dark', 'auto'].includes(stored)) {
      return stored;
    }
  }
  return 'auto';
};

// Store theme preference
const storeTheme = (mode: ThemeMode): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('theme', mode);
  }
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(getStoredTheme);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(
    getSystemTheme
  );
  const { i18n } = useTranslation();

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

      const handleChange = (e: MediaQueryListEvent) => {
        setSystemTheme(e.matches ? 'dark' : 'light');
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  // Determine actual theme based on mode
  const actualTheme = mode === 'auto' ? systemTheme : mode;
  const theme = React.useMemo(
    () => getTheme(actualTheme, i18n.language),
    [actualTheme, i18n.language]
  );
  const isDark = actualTheme === 'dark';

  // Set data-theme attribute on document root for CSS selectors
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', actualTheme);
    }
  }, [actualTheme]);

  const toggleTheme = () => {
    // Simple toggle between light and dark (skip auto mode for better UX)
    const newMode: ThemeMode = actualTheme === 'dark' ? 'light' : 'dark';
    setMode(newMode);
    storeTheme(newMode);
  };

  const setTheme = (newMode: ThemeMode) => {
    setMode(newMode);
    storeTheme(newMode);
  };

  const value: ThemeContextType = {
    mode,
    theme,
    toggleTheme,
    setTheme,
    isDark,
  };

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
