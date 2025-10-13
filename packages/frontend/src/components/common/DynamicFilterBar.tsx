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
  Checkbox,
  ListItemText,
  Tooltip,
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
  type: 'text' | 'select' | 'multiselect' | 'number' | 'tags';
  options?: { value: any; label: string; color?: string; description?: string }[];
  placeholder?: string;
  operator?: 'OR' | 'AND'; // For multiselect and tags - default is OR
}


export interface ActiveFilter {
  key: string;
  value: any;
  label: string;
  operator?: 'OR' | 'AND'; // For multiselect and tags
}

interface DynamicFilterBarProps {
  availableFilters: FilterDefinition[];
  activeFilters: ActiveFilter[];
  onFilterAdd: (filter: ActiveFilter) => void;
  onFilterRemove: (filterKey: string) => void;
  onFilterChange: (filterKey: string, value: any) => void;
  onOperatorChange?: (filterKey: string, operator: 'OR' | 'AND') => void;
}

const DynamicFilterBar: React.FC<DynamicFilterBarProps> = ({
  availableFilters,
  activeFilters,
  onFilterAdd,
  onFilterRemove,
  onFilterChange,
  onOperatorChange,
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
    const defaultValue = (filterDef.type === 'multiselect' || filterDef.type === 'tags') ? [] : undefined;
    const defaultOperator = filterDef.operator || 'OR';
    onFilterAdd({
      key: filterDef.key,
      value: defaultValue,
      label: filterDef.label,
      operator: (filterDef.type === 'multiselect' || filterDef.type === 'tags') ? defaultOperator : undefined,
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

  const handleToggleOperator = (filterKey: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent chip click
    const filter = activeFilters.find(f => f.key === filterKey);
    if (!filter) return;

    const newOperator = filter.operator === 'OR' ? 'AND' : 'OR';
    if (onOperatorChange) {
      onOperatorChange(filterKey, newOperator);
    }
  };

  const renderFilterValue = (filter: ActiveFilter) => {
    const filterDef = getFilterDefinition(filter.key);
    if (!filterDef) return null;

    const isEditing = editingFilter === filter.key;

    if (!isEditing) {
      // Display mode - show as chip or tag chips
      // Don't show filter if value is empty/undefined
      if (filter.value === undefined || filter.value === null || filter.value === '') {
        return null;
      }

      // Tags type - show selected tags as chips wrapped in a container chip
      if (filterDef.type === 'tags' && Array.isArray(filter.value) && filterDef.options) {
        if (filter.value.length === 0) return null;

        const selectedOptions = filterDef.options.filter(opt =>
          filter.value.includes(opt.value)
        );

        const operator = filter.operator || filterDef.operator || 'OR';
        const showOperator = selectedOptions.length > 1;

        return (
          <Chip
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', py: 0.25 }}>
                <Box sx={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'primary.main',
                }}>
                  {filter.label}:
                </Box>
                {showOperator && onOperatorChange && (
                  <Chip
                    label={operator}
                    size="small"
                    onClick={(e) => handleToggleOperator(filter.key, e)}
                    sx={{
                      height: '18px',
                      bgcolor: operator === 'OR' ? 'success.main' : 'warning.main',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: '0.65rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      '&:hover': {
                        opacity: 0.8,
                        transform: 'scale(1.05)',
                      },
                      '& .MuiChip-label': {
                        px: 0.5,
                      }
                    }}
                  />
                )}
                {selectedOptions.map((option) => (
                  <Tooltip key={option.value} title={option.description || ''} arrow>
                    <Chip
                      label={option.label}
                      size="small"
                      sx={{
                        height: '20px',
                        bgcolor: option.color || 'primary.main',
                        color: '#fff',
                        fontWeight: 500,
                        fontSize: '0.7rem',
                        '& .MuiChip-label': {
                          px: 0.75,
                        }
                      }}
                    />
                  </Tooltip>
                ))}
              </Box>
            }
            onClick={() => setEditingFilter(filter.key)}
            onDelete={() => handleRemoveFilter(filter.key)}
            sx={{
              height: 'auto',
              minHeight: '32px',
              bgcolor: 'rgba(25, 118, 210, 0.08)',
              border: '1.5px solid',
              borderColor: 'primary.main',
              fontWeight: 500,
              transition: 'all 0.2s',
              cursor: 'pointer',
              '&:hover': {
                borderColor: 'primary.dark',
                boxShadow: '0 2px 8px rgba(25, 118, 210, 0.25)',
                transform: 'translateY(-1px)',
              },
              '& .MuiChip-label': {
                display: 'block',
                whiteSpace: 'normal',
                py: 0.5,
                color: 'primary.main',
              },
              '& .MuiChip-deleteIcon': {
                color: 'primary.main',
                '&:hover': {
                  color: 'error.main',
                  bgcolor: 'rgba(211, 47, 47, 0.1)',
                }
              }
            }}
          />
        );
      }

      // Multiselect type - show selected items as chips
      if (filterDef.type === 'multiselect' && Array.isArray(filter.value) && filterDef.options) {
        if (filter.value.length === 0) return null;

        const selectedOptions = filterDef.options.filter(opt =>
          filter.value.includes(opt.value)
        );

        const operator = filter.operator || filterDef.operator || 'OR';
        const showOperator = selectedOptions.length > 1;

        return (
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            <Box sx={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: 'text.secondary',
              px: 1,
            }}>
              {filter.label}:
            </Box>
            {showOperator && onOperatorChange && (
              <Chip
                label={operator}
                size="small"
                onClick={(e) => handleToggleOperator(filter.key, e)}
                sx={{
                  height: '18px',
                  bgcolor: operator === 'OR' ? 'success.main' : 'warning.main',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.65rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    opacity: 0.8,
                    transform: 'scale(1.05)',
                  },
                  '& .MuiChip-label': {
                    px: 0.5,
                  }
                }}
              />
            )}
            {selectedOptions.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                size="small"
                onClick={() => setEditingFilter(filter.key)}
                sx={{
                  height: '24px',
                  bgcolor: 'rgba(25, 118, 210, 0.08)',
                  color: 'primary.main',
                  border: '1.5px solid',
                  borderColor: 'primary.main',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: 'primary.dark',
                    boxShadow: '0 2px 6px rgba(25, 118, 210, 0.2)',
                    transform: 'translateY(-1px)',
                  }
                }}
              />
            ))}
            <IconButton
              size="small"
              onClick={() => handleRemoveFilter(filter.key)}
              sx={{
                width: 20,
                height: 20,
                color: 'text.secondary',
                '&:hover': {
                  color: 'error.main',
                  bgcolor: 'error.lighter',
                }
              }}
            >
              <CloseIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </Box>
        );
      }

      // Single select or text - show as single chip
      let displayValue = filter.value;
      if (filterDef.type === 'select' && filterDef.options) {
        const option = filterDef.options.find(opt => opt.value == filter.value); // Use == for type coercion
        displayValue = option ? option.label : filter.value;
      }

      return (
        <Chip
          icon={<FilterListIcon />}
          label={`${filter.label}: ${displayValue}`}
          onClick={() => setEditingFilter(filter.key)}
          onDelete={() => handleRemoveFilter(filter.key)}
          sx={{
            height: '32px',
            bgcolor: 'rgba(25, 118, 210, 0.08)',
            color: 'primary.main',
            border: '1.5px solid',
            borderColor: 'primary.main',
            fontWeight: 600,
            transition: 'all 0.2s',
            cursor: 'pointer',
            '&:hover': {
              borderColor: 'primary.dark',
              boxShadow: '0 2px 8px rgba(25, 118, 210, 0.25)',
              transform: 'translateY(-1px)',
            },
            '& .MuiChip-icon': {
              color: 'primary.main',
            },
            '& .MuiChip-deleteIcon': {
              color: 'primary.main',
              '&:hover': {
                color: 'error.main',
                bgcolor: 'rgba(211, 47, 47, 0.1)',
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
              MenuProps={{
                PaperProps: {
                  style: {
                    maxHeight: 300,
                  }
                }
              }}
            >
              {filterDef.options.map((option, idx) => (
                <MenuItem key={`${filter.key}-ms-${idx}-${option.value}`} value={option.value}>
                  <Checkbox
                    checked={Array.isArray(filter.value) && filter.value.indexOf(option.value) > -1}
                    size="small"
                  />
                  <ListItemText primary={option.label} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {filterDef.type === 'tags' && filterDef.options && (
          <FormControl
            size="small"
            sx={{
              minWidth: 200,
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
              renderValue={(selected) => {
                if (!Array.isArray(selected) || selected.length === 0) return '0 selected';
                const selectedOptions = filterDef.options!.filter(opt => selected.includes(opt.value));
                return (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selectedOptions.map((option) => (
                      <Chip
                        key={option.value}
                        label={option.label}
                        size="small"
                        sx={{
                          height: '20px',
                          bgcolor: option.color || 'primary.main',
                          color: '#fff',
                          fontSize: '0.7rem',
                          '& .MuiChip-label': {
                            px: 1,
                          }
                        }}
                      />
                    ))}
                  </Box>
                );
              }}
              sx={{
                minHeight: '28px',
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
              MenuProps={{
                PaperProps: {
                  style: {
                    maxHeight: 300,
                  }
                }
              }}
            >
              {filterDef.options.map((option, idx) => (
                <MenuItem key={`${filter.key}-tag-${idx}-${option.value}`} value={option.value}>
                  <Checkbox
                    checked={Array.isArray(filter.value) && filter.value.indexOf(option.value) > -1}
                    size="small"
                  />
                  <Tooltip title={option.description || ''} arrow placement="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                      <Chip
                        label={option.label}
                        size="small"
                        sx={{
                          height: '22px',
                          bgcolor: option.color || 'primary.main',
                          color: '#fff',
                          fontSize: '0.75rem',
                        }}
                      />
                      {option.description && (
                        <Box component="span" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                          {option.description}
                        </Box>
                      )}
                    </Box>
                  </Tooltip>
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

