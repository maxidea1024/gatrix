import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createTheme, Theme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { ThemeMode } from '@/types';

interface ThemeContextType {
  mode: ThemeMode;
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  isDark: boolean;
}

export const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Theme configurations
const getTheme = (mode: 'light' | 'dark', language: string): Theme => {
  const isChinese = language.startsWith('zh');
  const fontFamily = isChinese
    ? '"Microsoft YaHei", "微软雅黑", "Source Han Sans SC", "思源黑体", "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Roboto", "Helvetica", "Arial", sans-serif'
    : '"Roboto", "Helvetica", "Arial", sans-serif';

  // -- Curated color palette --
  const colors = {
    // Primary: Indigo-violet family
    primary: {
      light: {
        main: '#4f46e5',
        light: '#6366f1',
        dark: '#4338ca',
        contrastText: '#ffffff',
      },
      dark: {
        main: '#818cf8',
        light: '#a5b4fc',
        dark: '#6366f1',
        contrastText: '#0f1225',
      },
    },
    // Secondary: Warm rose for accent
    secondary: {
      light: {
        main: '#e11d48',
        light: '#fb7185',
        dark: '#be123c',
      },
      dark: {
        main: '#fb7185',
        light: '#fda4af',
        dark: '#f43f5e',
      },
    },
    // Backgrounds
    bg: {
      light: {
        default: '#f8f7ff',
        paper: '#ffffff',
      },
      dark: {
        default: '#0f1225',
        paper: '#1a1d36',
      },
    },
    // Text
    text: {
      light: {
        primary: '#1e1b4b',
        secondary: '#64748b',
      },
      dark: {
        primary: '#e8e8f4',
        secondary: '#94a3b8',
      },
    },
    // Accent: Success, Warning, Error (harmonized)
    success: mode === 'dark' ? '#34d399' : '#059669',
    warning: mode === 'dark' ? '#fbbf24' : '#d97706',
    error: mode === 'dark' ? '#f87171' : '#dc2626',
    info: mode === 'dark' ? '#60a5fa' : '#2563eb',
    // Borders
    border: mode === 'dark' ? 'rgba(255, 255, 255, 0.1)' : '#e0e2eb',
    borderHover: mode === 'dark' ? 'rgba(255, 255, 255, 0.18)' : '#c7c9d9',
    borderFocus: mode === 'dark' ? '#818cf8' : '#4f46e5',
    // Surfaces
    hoverBg: mode === 'dark' ? 'rgba(129, 140, 248, 0.08)' : 'rgba(79, 70, 229, 0.04)',
    activeBg: mode === 'dark' ? 'rgba(129, 140, 248, 0.12)' : 'rgba(79, 70, 229, 0.08)',
    stripeBg: mode === 'dark' ? 'rgba(255, 255, 255, 0.025)' : 'rgba(79, 70, 229, 0.02)',
    // Drawer / Sidebar
    drawerBg: mode === 'dark' ? '#161935' : '#ffffff',
    // Input
    inputBg: mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
    // Table head
    theadBg: mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(79, 70, 229, 0.03)',
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
      h1: { fontSize: '2.5rem', fontWeight: 600 },
      h2: { fontSize: '2rem', fontWeight: 600 },
      h3: { fontSize: '1.75rem', fontWeight: 600 },
      h4: { fontSize: '1.5rem', fontWeight: 600 },
      h5: { fontSize: '1.25rem', fontWeight: 600 },
      h6: { fontSize: '1rem', fontWeight: 600 },
    },
    shape: {
      borderRadius: 0,
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow:
              mode === 'dark' ? '0 1px 0 rgba(255,255,255,0.06)' : '0 1px 0 rgba(0,0,0,0.08)',
          },
        },
      },
      MuiAccordion: {
        styleOverrides: {
          root: {
            backgroundColor: mode === 'dark' ? 'transparent' : undefined,
            '&:before': { display: 'none' },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 0,
          },
          outlined: {
            backgroundColor: mode === 'dark' ? 'transparent' : undefined,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: colors.drawerBg,
            borderRight: 'none',
            borderRadius: 0,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 0,
            boxShadow: mode === 'dark' ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.08)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 0,
            fontWeight: 500,
          },
        },
      },
      MuiPagination: {
        styleOverrides: {
          root: {
            '& .MuiPaginationItem-root': {
              borderRadius: 0,
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
              borderRadius: 0,
              backgroundColor: colors.inputBg,
              '& fieldset': {
                borderColor: colors.border,
              },
              '&:hover fieldset': {
                borderColor: colors.borderHover,
              },
              '&.Mui-focused fieldset': {
                borderColor: colors.borderFocus,
              },
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: txt.secondary,
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
                borderBottom: 'none',
              },
            },
            // Zebra stripes
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
            borderBottom: 'none',
          },
          head: {
            backgroundColor: colors.theadBg,
            borderBottom: `1px solid ${colors.border}`,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          root: {
            '& .MuiBackdrop-root': {
              backgroundColor: mode === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(15,18,37,0.4)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
            },
          },
          paper: {
            borderRadius: 0,
          },
        },
      },
      MuiModal: {
        styleOverrides: {
          root: {
            '&:not(.MuiSelect-root) .MuiBackdrop-root': {
              backgroundColor: mode === 'dark' ? 'rgba(0,0,0,0.7)' : 'rgba(15,18,37,0.4)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
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
            PaperProps: {
              style: {
                borderRadius: 0,
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
          PaperProps: {
            style: {
              borderRadius: 0,
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 0,
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
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme);
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
