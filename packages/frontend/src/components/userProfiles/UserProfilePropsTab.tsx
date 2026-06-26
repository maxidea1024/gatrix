import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  CircularProgress,
  TextField,
  InputAdornment,
  IconButton,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Paper,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { getUserProperties } from '@/services/argus/argusAnalytics';
import type { ArgusUserProperty } from '@/services/argus/argusTypes';

const CopyableCell: React.FC<{ value: string; fontSize?: number }> = ({
  value,
  fontSize = 12,
}) => {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 800);
  };
  if (!value) return <Box sx={{ fontSize, color: 'text.disabled' }}>—</Box>;
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        '&:hover .copy-btn': { opacity: 1 },
      }}
    >
      <Box sx={{ fontSize, wordBreak: 'break-all', flex: 1 }}>{value}</Box>
      <IconButton
        className="copy-btn"
        size="small"
        onClick={handleCopy}
        sx={{ opacity: 0, transition: 'opacity 0.15s', p: 0.25, flexShrink: 0 }}
      >
        {copied ? (
          <CheckIcon sx={{ fontSize: 13, color: 'success.main' }} />
        ) : (
          <CopyIcon sx={{ fontSize: 13 }} />
        )}
      </IconButton>
    </Box>
  );
};

interface UserProfilePropsTabProps {
  projectId: string;
  userId: string;
  initialProperties?: ArgusUserProperty[];
  initialLoading?: boolean;
}

export const UserProfilePropsTab: React.FC<UserProfilePropsTabProps> = ({
  projectId,
  userId,
  initialProperties,
  initialLoading,
}) => {
  const { t } = useTranslation();

  const [properties, setProperties] = useState<ArgusUserProperty[]>(initialProperties || []);
  const [loading, setLoading] = useState(initialLoading !== undefined ? initialLoading : true);
  const [propertySearch, setPropertySearch] = useState('');
  const [propertySearchDebounced, setPropertySearchDebounced] = useState('');

  // Debounce property search
  useEffect(() => {
    const timer = setTimeout(() => setPropertySearchDebounced(propertySearch), 250);
    return () => clearTimeout(timer);
  }, [propertySearch]);

  // Load properties
  useEffect(() => {
    if (initialProperties && initialProperties.length > 0) {
      setProperties(initialProperties);
      setLoading(initialLoading !== undefined ? initialLoading : false);
      return;
    }
    if (!userId) return;
    setLoading(true);
    getUserProperties(projectId, userId)
      .then((prop) => setProperties(prop))
      .catch((err) => {
        console.error('Failed to load user properties:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [projectId, userId, initialProperties, initialLoading]);

  const filteredProperties = useMemo(() => {
    if (!propertySearchDebounced.trim()) return properties;
    const query = propertySearchDebounced.toLowerCase().trim();
    return properties.filter((p) => p.key.toLowerCase().includes(query));
  }, [properties, propertySearchDebounced]);

  return (
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search Header */}
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2, flexShrink: 0 }}>
        <TextField
          placeholder={t('argus.userProfiles.searchPropertiesPlaceholder', 'Search properties...')}
          size="small"
          value={propertySearch}
          onChange={(e) => setPropertySearch(e.target.value)}
          sx={{
            flex: 1,
            '& .MuiInputBase-root': {
              height: 36,
              fontSize: 12,
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 16 }} />
              </InputAdornment>
            ),
            endAdornment: propertySearch ? (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={() => setPropertySearch('')}
                  sx={{ p: 0.25 }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </InputAdornment>
            ) : null,
          }}
        />
      </Box>

      {/* Properties Table */}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontSize: 12, fontWeight: 700, p: 1, bgcolor: 'action.hover', width: '30%' }}>
                    {t('argus.userProfiles.propertyKey', 'Property Key')}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, fontWeight: 700, p: 1, bgcolor: 'action.hover', width: '70%' }}>
                    {t('argus.userProfiles.propertyValue', 'Value')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProperties.map((p) => (
                  <TableRow key={p.key} hover>
                    <TableCell sx={{ p: 1, fontSize: 12, wordBreak: 'break-all', fontWeight: 600 }}>
                      {p.key}
                    </TableCell>
                    <TableCell sx={{ p: 1, fontSize: 12, wordBreak: 'break-all' }}>
                      <CopyableCell value={p.value} fontSize={12} />
                    </TableCell>
                  </TableRow>
                ))}
                {filteredProperties.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} align="center" sx={{ py: 4, color: 'text.secondary', fontSize: 13 }}>
                      {t('argus.userProfiles.noPropertiesFound', 'No properties found')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
};

export default UserProfilePropsTab;
