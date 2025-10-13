import React, { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Menu,
  MenuItem,
  TextField,
  Select,
  FormControl,
  InputLabel,
  Stack,
  IconButton,
  Paper,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  FilterList as FilterListIcon,
  Tune as TuneIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

export interface FilterDefinition {
  key: string;
  label: string;
  type: 'text' | 'select' | 'multiselect' | 'number';
  options?: { value: any; label: string }[];
  placeholder?: string;
}


export interface ActiveFilter {
  key: string;
  value: any;
  label: string;
}

interface DynamicFilterBarProps {
  availableFilters: FilterDefinition[];
  activeFilters: ActiveFilter[];
  onFilterAdd: (filter: ActiveFilter) => void;
  onFilterRemove: (filterKey: string) => void;
  onFilterChange: (filterKey: string, value: any) => void;
}

const DynamicFilterBar: React.FC<DynamicFilterBarProps> = ({
  availableFilters,
  activeFilters,
  onFilterAdd,
  onFilterRemove,
  onFilterChange,
}) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [editingFilter, setEditingFilter] = useState<string | null>(null);
  const [selectOpen, setSelectOpen] = useState<boolean>(false);

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
  };

  const handleAddFilter = (filterDef: FilterDefinition) => {
    const defaultValue = filterDef.type === 'multiselect' ? [] : undefined;
    onFilterAdd({
      key: filterDef.key,
      value: defaultValue,
      label: filterDef.label,
    });
    setEditingFilter(filterDef.key);
    setSelectOpen(true);
    handleCloseMenu();
  };

  const handleRemoveFilter = (filterKey: string) => {
    onFilterRemove(filterKey);
    if (editingFilter === filterKey) {
      setEditingFilter(null);
    }
  };

  const handleCloseEdit = (filterKey: string) => {
    const filter = activeFilters.find(f => f.key === filterKey);
    if (!filter || filter.value === undefined || filter.value === '' ||
        (Array.isArray(filter.value) && filter.value.length === 0)) {
      handleRemoveFilter(filterKey);
    } else {
      setEditingFilter(null);
    }
  };

  const getFilterDefinition = (key: string): FilterDefinition | undefined => {
    return availableFilters.find(f => f.key === key);
  };

  const renderFilterValue = (filter: ActiveFilter) => {
    const filterDef = getFilterDefinition(filter.key);
    if (!filterDef) return null;

    const isEditing = editingFilter === filter.key;

    if (!isEditing) {
      // Display mode - show as chip
      let displayValue = filter.value;

      // Don't show filter if value is empty/undefined
      if (filter.value === undefined || filter.value === null || filter.value === '') {
        return null;
      }

      if (filterDef.type === 'select' && filterDef.options) {
        const option = filterDef.options.find(opt => opt.value == filter.value); // Use == for type coercion
        displayValue = option ? option.label : filter.value;
      } else if (filterDef.type === 'multiselect' && Array.isArray(filter.value)) {
        if (filter.value.length === 0) return null;
        displayValue = `${filter.value.length} selected`;
      }

      return (
        <Chip
          icon={<FilterListIcon />}
          label={`${filter.label}: ${displayValue}`}
          onClick={() => setEditingFilter(filter.key)}
          onDelete={() => handleRemoveFilter(filter.key)}
          sx={{
            height: '32px',
            bgcolor: 'primary.lighter',
            color: 'primary.main',
            border: '1px solid',
            borderColor: 'primary.light',
            fontWeight: 500,
            transition: 'all 0.2s',
            '&:hover': {
              bgcolor: 'primary.light',
              boxShadow: 1,
            },
            '& .MuiChip-icon': {
              color: 'primary.main',
            },
            '& .MuiChip-deleteIcon': {
              color: 'primary.main',
              '&:hover': {
                color: 'primary.dark',
              }
            }
          }}
        />
      );
    }

    // Edit mode - show input control with refined styling
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          px: 1.5,
          py: 0.75,
          gap: 1,
          minHeight: '32px',
          border: '1.5px solid',
          borderColor: 'primary.main',
          borderRadius: '16px',
          bgcolor: 'rgba(25, 118, 210, 0.08)',
          transition: 'all 0.15s ease-in-out',
        }}
      >
        <Box sx={{
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: 'primary.main',
          whiteSpace: 'nowrap',
          lineHeight: 1
        }}>
          {filter.label}
        </Box>

        {filterDef.type === 'text' && (
          <TextField
            size="small"
            value={filter.value || ''}
            onChange={(e) => onFilterChange(filter.key, e.target.value)}
            onBlur={() => {
              setTimeout(() => handleCloseEdit(filter.key), 150);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCloseEdit(filter.key);
              } else if (e.key === 'Escape') {
                handleRemoveFilter(filter.key);
              }
            }}
            placeholder={filterDef.placeholder}
            autoFocus
            sx={{
              minWidth: 180,
              '& .MuiInputBase-root': {
                height: '28px',
                fontSize: '0.8125rem',
                bgcolor: 'background.paper',
                borderRadius: '8px',
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(0, 0, 0, 0.12)',
              },
              '& .MuiInputBase-input': {
                py: 0.5,
              }
            }}
          />
        )}

        {filterDef.type === 'number' && (
          <TextField
            size="small"
            type="number"
            value={filter.value || ''}
            onChange={(e) => onFilterChange(filter.key, e.target.value)}
            onBlur={() => {
              setTimeout(() => handleCloseEdit(filter.key), 150);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCloseEdit(filter.key);
              } else if (e.key === 'Escape') {
                handleRemoveFilter(filter.key);
              }
            }}
            placeholder={filterDef.placeholder}
            autoFocus
            sx={{
              minWidth: 120,
              '& .MuiInputBase-root': {
                height: '28px',
                fontSize: '0.8125rem',
                bgcolor: 'background.paper',
                borderRadius: '8px',
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: 'rgba(0, 0, 0, 0.12)',
              },
              '& .MuiInputBase-input': {
                py: 0.5,
              }
            }}
          />
        )}

        {filterDef.type === 'select' && filterDef.options && (
          <FormControl
            size="small"
            sx={{
              minWidth: 160,
            }}
          >
            <Select
              value={filter.value ?? ''}
              open={selectOpen && editingFilter === filter.key}
              onOpen={() => setSelectOpen(true)}
              onClose={() => {
                setSelectOpen(false);
              }}
              onChange={(e) => {
                const newValue = e.target.value === '' ? undefined : e.target.value;
                onFilterChange(filter.key, newValue);
                // Close immediately after selection
                if (newValue !== undefined && newValue !== '') {
                  setSelectOpen(false);
                  // Wait for state update before closing edit mode
                  setTimeout(() => {
                    setEditingFilter(null);
                  }, 50);
                } else {
                  // If cleared, remove filter
                  setSelectOpen(false);
                  setTimeout(() => {
                    handleRemoveFilter(filter.key);
                  }, 50);
                }
              }}
              autoFocus
              sx={{
                height: '28px',
                fontSize: '0.8125rem',
                bgcolor: 'background.paper',
                borderRadius: '8px',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0, 0, 0, 0.12)',
                },
                '& .MuiSelect-select': {
                  py: 0.5,
                }
              }}
            >
              {filterDef.options.map((option, idx) => (
                <MenuItem key={`${filter.key}-${idx}-${option.value}`} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {filterDef.type === 'multiselect' && filterDef.options && (
          <FormControl
            size="small"
            sx={{
              minWidth: 160,
            }}
          >
            <Select
              multiple
              value={filter.value || []}
              open={selectOpen && editingFilter === filter.key}
              onOpen={() => setSelectOpen(true)}
              onClose={() => {
                setSelectOpen(false);
                // Check if any values were selected before closing
                setTimeout(() => {
                  const currentFilter = activeFilters.find(f => f.key === filter.key);
                  if (!currentFilter || !Array.isArray(currentFilter.value) || currentFilter.value.length === 0) {
                    handleRemoveFilter(filter.key);
                  } else {
                    setEditingFilter(null);
                  }
                }, 100);
              }}
              onChange={(e) => {
                onFilterChange(filter.key, e.target.value);
              }}
              autoFocus
              renderValue={(selected) =>
                Array.isArray(selected) ? `${selected.length} selected` : '0 selected'
              }
              sx={{
                height: '28px',
                fontSize: '0.8125rem',
                bgcolor: 'background.paper',
                borderRadius: '8px',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(0, 0, 0, 0.12)',
                },
                '& .MuiSelect-select': {
                  py: 0.5,
                }
              }}
            >
              {filterDef.options.map((option, idx) => (
                <MenuItem key={`${filter.key}-ms-${idx}-${option.value}`} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <IconButton
          size="small"
          onClick={() => handleRemoveFilter(filter.key)}
          sx={{
            width: 20,
            height: 20,
            p: 0,
            color: 'primary.main',
            '&:hover': {
              color: 'error.main',
              bgcolor: 'transparent',
            }
          }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>
    );
  };

  // Get filters that are not yet active
  const availableToAdd = availableFilters.filter(
    f => !activeFilters.some(af => af.key === f.key)
  );

  return (
    <>
      {activeFilters.map(filter => (
        <React.Fragment key={`filter-wrapper-${filter.key}`}>
          {renderFilterValue(filter)}
        </React.Fragment>
      ))}

      {availableToAdd.length > 0 && (
        <>
          <Button
            startIcon={<TuneIcon sx={{ fontSize: 18 }} />}
            onClick={handleOpenMenu}
            variant="text"
            size="small"
            sx={{
              height: '32px',
              minWidth: 'auto',
              px: 1.5,
              py: 0.5,
              textTransform: 'none',
              color: 'text.secondary',
              fontSize: '0.875rem',
              fontWeight: 500,
              border: 'none',
              '&:hover': {
                bgcolor: 'action.hover',
                color: 'primary.main',
              }
            }}
          >
            {t('common.filters')}
          </Button>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleCloseMenu}
            PaperProps={{
              sx: {
                mt: 0.5,
                minWidth: 180,
                boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
              }
            }}
          >
            {availableToAdd.map(filterDef => (
              <MenuItem
                key={`add-filter-${filterDef.key}`}
                onClick={() => handleAddFilter(filterDef)}
                sx={{
                  fontSize: '0.875rem',
                  py: 1,
                  '&:hover': {
                    bgcolor: 'action.hover',
                  }
                }}
              >
                {filterDef.label}
              </MenuItem>
            ))}
          </Menu>
        </>
      )}
    </>
  );
};

export default DynamicFilterBar;

