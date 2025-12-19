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

  return createTheme({
    palette: {
      mode,
      primary: {
        main: mode === 'dark' ? '#6EA8FF' : '#1976d2',
        light: mode === 'dark' ? '#8FB9FF' : '#42a5f5',
        dark: mode === 'dark' ? '#3D7DFF' : '#1565c0',
      },
      secondary: {
        main: mode === 'dark' ? '#f48fb1' : '#dc004e',
        light: mode === 'dark' ? '#f8bbd9' : '#e91e63',
        dark: mode === 'dark' ? '#f06292' : '#c51162',
      },
      background: {
        default: mode === 'dark' ? '#0D0F12' : '#fafafa',
        paper: mode === 'dark' ? '#15181D' : '#ffffff',
      },
      text: {
        primary: mode === 'dark' ? '#FFFFFF' : '#000000',
        secondary: mode === 'dark' ? '#9AA4AF' : '#666666',
      },
    },
    zIndex: {
      mobileStepper: 1000,
      fab: 1050,
      speedDial: 1050,
      appBar: 1100,
      drawer: 1300,
      modal: 1500,       // Popover/Menu가 Drawer 위로 오도록
      snackbar: 1400,
      tooltip: 1600,
    },
    typography: {
      fontFamily,
      h1: {
        fontSize: '2.5rem',
        fontWeight: 500,
      },
      h2: {
        fontSize: '2rem',
        fontWeight: 500,
      },
      h3: {
        fontSize: '1.75rem',
        fontWeight: 500,
      },
      h4: {
        fontSize: '1.5rem',
        fontWeight: 500,
      },
      h5: {
        fontSize: '1.25rem',
        fontWeight: 500,
      },
      h6: {
        fontSize: '1rem',
        fontWeight: 500,
      },
    },
    components: {
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: mode === 'dark'
              ? '0px 2px 4px rgba(0, 0, 0, 0.3)'
              : '0px 2px 4px rgba(0, 0, 0, 0.1)',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: mode === 'dark' ? '#1e1e1e' : '#ffffff',
            borderRight: 'none',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: mode === 'dark'
              ? '0px 2px 8px rgba(0, 0, 0, 0.3)'
              : '0px 2px 8px rgba(0, 0, 0, 0.1)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
            fontWeight: 500,
          },
        },
      },
      MuiPagination: {
        styleOverrides: {
          root: {
            '& .MuiPaginationItem-root': {
              borderRadius: 8,
              fontWeight: 500,
              '&.Mui-selected': {
                backgroundColor: mode === 'dark' ? '#6EA8FF' : '#1976d2',
                color: '#fff',
                '&:hover': {
                  backgroundColor: mode === 'dark' ? '#5A96E6' : '#1565c0',
                },
              },
              '&:hover': {
                backgroundColor: mode === 'dark'
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(0, 0, 0, 0.04)',
              },
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
              backgroundColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'inherit',
              '& fieldset': {
                borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
              },
              '&:hover fieldset': {
                borderColor: mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
              },
              '&.Mui-focused fieldset': {
                borderColor: mode === 'dark' ? '#6EA8FF' : '#1976d2',
              },
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: mode === 'dark' ? 'rgba(255, 255, 255, 0.7)' : undefined,
            '&.Mui-focused': {
              color: mode === 'dark' ? '#6EA8FF' : undefined,
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
            // Zebra stripes for better row separation
            '&:nth-of-type(even)': {
              backgroundColor: mode === 'dark'
                ? 'rgba(255, 255, 255, 0.04)'
                : 'rgba(0, 0, 0, 0.025)',
            },
            '&:hover': {
              backgroundColor: mode === 'dark'
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(0, 0, 0, 0.05)',
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
            backgroundColor: mode === 'dark'
              ? 'rgba(255, 255, 255, 0.04)'
              : 'rgba(0, 0, 0, 0.02)',
            borderBottom: mode === 'dark'
              ? '1px solid rgba(255, 255, 255, 0.12)'
              : '1px solid rgba(0, 0, 0, 0.12)',
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          root: {
            '& .MuiBackdrop-root': {
              backgroundColor: mode === 'dark'
                ? 'rgba(0, 0, 0, 0.7)'
                : 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)', // Safari support
            },
          },
        },
      },
      MuiModal: {
        styleOverrides: {
          root: {
            // Dialog와 Drawer에만 블러 효과 적용, Select는 제외
            '&:not(.MuiSelect-root) .MuiBackdrop-root': {
              backgroundColor: mode === 'dark'
                ? 'rgba(0, 0, 0, 0.7)'
                : 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)', // Safari support
            },
            // Select 드롭다운용 투명한 배경
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
            // Portal은 기본값(false)을 사용하고, z-index는 theme.zIndex.modal을 따르게 함
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
  const theme = React.useMemo(() => getTheme(actualTheme, i18n.language), [actualTheme, i18n.language]);
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
      <MuiThemeProvider theme={theme}>
        {children}
      </MuiThemeProvider>
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
