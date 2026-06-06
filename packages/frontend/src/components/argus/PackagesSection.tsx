/**
 * PackagesSection — G29: Loaded packages/modules at event time.
 *
 * Displays a searchable table of packages, their versions,
 * and whether they are in-app or system packages.
 */
import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  IconButton,
  Collapse,
  TextField,
  InputAdornment,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Inventory as PackageIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface PackageInfo {
  name: string;
  version: string;
  inApp?: boolean;
}

interface PackagesSectionProps {
  packages: PackageInfo[];
}

const PackagesSection: React.FC<PackagesSectionProps> = ({ packages }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState('');

  if (!packages || packages.length === 0) return null;

  const filtered = useMemo(() => {
    if (!search) return packages;
    const q = search.toLowerCase();
    return packages.filter(
      (p) => p.name.toLowerCase().includes(q) || p.version.includes(q)
    );
  }, [packages, search]);

  return (
    <Paper
      elevation={0}
      sx={{
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: 2,
        overflow: 'hidden',
        mb: 1.5,
      }}
    >
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: isDark
              ? 'rgba(255,255,255,0.02)'
              : 'rgba(0,0,0,0.01)',
          },
        }}
      >
        <PackageIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, flex: 1 }}>
          {t('argus.packages.title')}
        </Typography>
        <Chip
          label={packages.length}
          size="small"
          sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }}
        />
        <IconButton size="small" sx={{ width: 20, height: 20 }}>
          {expanded ? (
            <CollapseIcon sx={{ fontSize: 14 }} />
          ) : (
            <ExpandIcon sx={{ fontSize: 14 }} />
          )}
        </IconButton>
      </Box>

      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 1.5 }}>
          {/* Search */}
          <TextField
            size="small"
            fullWidth
            placeholder={t('argus.packages.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 14 }} />
                  </InputAdornment>
                ),
                sx: { fontSize: '0.72rem', borderRadius: '6px', height: 28 },
              },
            }}
            sx={{ mb: 1 }}
          />

          {/* Package list */}
          <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
            {filtered.map((pkg, idx) => (
              <Box
                key={idx}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  py: 0.35,
                  px: 0.5,
                  borderRadius: '4px',
                  '&:hover': {
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.02)'
                      : 'rgba(0,0,0,0.01)',
                  },
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    flex: 1,
                    color: pkg.inApp ? 'text.primary' : 'text.secondary',
                    fontWeight: pkg.inApp ? 600 : 400,
                  }}
                >
                  {pkg.name}
                </Typography>
                <Typography
                  sx={{ fontSize: '0.65rem', color: 'text.disabled' }}
                >
                  {pkg.version}
                </Typography>
                {pkg.inApp && (
                  <Chip
                    label="in-app"
                    size="small"
                    sx={{
                      height: 14,
                      fontSize: '0.5rem',
                      fontWeight: 700,
                      backgroundColor: alpha(theme.palette.primary.main, 0.08),
                      color: theme.palette.primary.main,
                    }}
                  />
                )}
              </Box>
            ))}
          </Box>
        </Box>
      </Collapse>
    </Paper>
  );
};

export default PackagesSection;
