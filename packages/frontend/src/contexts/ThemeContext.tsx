import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createTheme, Theme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { ThemeMode } from '@/types';

interface ThemeContextType {
  mode: ThemeMode;
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Theme configurations
const getTheme = (mode: 'light' | 'dark'): Theme => {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: mode === 'dark' ? '#90caf9' : '#1976d2',
        light: mode === 'dark' ? '#bbdefb' : '#42a5f5',
        dark: mode === 'dark' ? '#64b5f6' : '#1565c0',
      },
      secondary: {
        main: mode === 'dark' ? '#f48fb1' : '#dc004e',
        light: mode === 'dark' ? '#f8bbd9' : '#e91e63',
        dark: mode === 'dark' ? '#f06292' : '#c51162',
      },
      background: {
        default: mode === 'dark' ? '#121212' : '#fafafa',
        paper: mode === 'dark' ? '#1e1e1e' : '#ffffff',
      },
      text: {
        primary: mode === 'dark' ? '#ffffff' : '#000000',
        secondary: mode === 'dark' ? '#b3b3b3' : '#666666',
      },
    },
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
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
            borderRight: mode === 'dark' 
              ? '1px solid rgba(255, 255, 255, 0.12)' 
              : '1px solid rgba(0, 0, 0, 0.12)',
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
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
            },
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            '&:not(:last-child)': {
              '& td': {
                borderBottom: 'none',
              },
            },
            '&:hover': {
              backgroundColor: mode === 'dark'
                ? 'rgba(255, 255, 255, 0.04)'
                : 'rgba(0, 0, 0, 0.04)',
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
              ? 'rgba(255, 255, 255, 0.02)'
              : 'rgba(0, 0, 0, 0.02)',
            borderBottom: mode === 'dark'
              ? '1px solid rgba(255, 255, 255, 0.12)'
              : '1px solid rgba(0, 0, 0, 0.12)',
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
  const theme = getTheme(actualTheme);
  const isDark = actualTheme === 'dark';

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
