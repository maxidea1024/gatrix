import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Select,
  MenuItem,
  TextField,
  Typography,
  Autocomplete,
  CircularProgress,
  Paper,
  Divider,
} from '@mui/material';
import { CardGiftcard as GiftIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import planningDataService, { RewardTypeInfo, RewardItem } from '../../services/planningDataService';

export interface RewardSelection {
  rewardType: string;
  itemId: string;
  quantity: number;
}

interface RewardItemSelectorProps {
  value: RewardSelection;
  onChange: (value: RewardSelection) => void;
  disabled?: boolean;
  minQuantity?: number;
  error?: boolean;
  helperText?: string;
}

const RewardItemSelector: React.FC<RewardItemSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  minQuantity = 1,
  error = false,
  helperText,
}) => {
  const { t, i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // State
  const [rewardTypes, setRewardTypes] = useState<RewardTypeInfo[]>([]);
  const [items, setItems] = useState<RewardItem[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);


  // Function to load reward types
  const loadRewardTypes = useCallback(async () => {
    try {
      setLoadingTypes(true);
      const types = await planningDataService.getRewardTypeList();
      setRewardTypes(types);
    } catch (error: any) {
      enqueueSnackbar(error.message || t('planningData.errors.loadRewardTypesFailed'), { variant: 'error' });
    } finally {
      setLoadingTypes(false);
    }
  }, [enqueueSnackbar, t]);

  // Function to load items for a specific reward type
  const loadItems = useCallback(async (rewardType: number) => {
    try {
      setLoadingItems(true);
      const typeInfo = rewardTypes.find(t => t.value === rewardType);

      if (typeInfo && typeInfo.hasTable) {
        // Map i18n language to backend language code
        const languageMap: Record<string, 'kr' | 'en' | 'zh'> = {
          'ko': 'kr',
          'en': 'en',
          'zh': 'zh',
        };
        const language = languageMap[i18n.language] || 'kr';

        const itemList = await planningDataService.getRewardTypeItems(rewardType, language);
        console.log('[RewardItemSelector] Loaded items with language:', language, itemList.slice(0, 3)); // Log first 3 items
        setItems(itemList);
      } else {
        setItems([]);
      }
    } catch (error: any) {
      enqueueSnackbar(error.message || t('planningData.errors.loadItemsFailed'), { variant: 'error' });
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  }, [rewardTypes, enqueueSnackbar, t, i18n.language]);

  // Load reward types on mount and when language changes
  useEffect(() => {
    loadRewardTypes();
  }, [loadRewardTypes]);

  // Load items when reward type changes, reward types are loaded, or language changes
  useEffect(() => {
    if (value.rewardType && rewardTypes.length > 0) {
      loadItems(parseInt(value.rewardType));
    } else {
      setItems([]);
    }
  }, [value.rewardType, rewardTypes, loadItems, i18n.language]);

  const handleRewardTypeChange = (newRewardType: string) => {
    // For reward types without table, set itemId to "0"
    const typeInfo = rewardTypes.find(t => t.value === parseInt(newRewardType));
    const itemId = typeInfo?.hasTable ? '' : '0';

    onChange({
      rewardType: newRewardType,
      itemId: itemId,
      quantity: minQuantity,
    });
  };

  const handleItemIdChange = (newItemId: string) => {
    onChange({
      ...value,
      itemId: newItemId,
    });
  };

  const handleQuantityChange = (newQuantity: number) => {
    // Ensure quantity is at least minQuantity
    const validQuantity = Math.max(minQuantity, newQuantity);
    onChange({
      ...value,
      quantity: validQuantity,
    });
  };

  // Get selected reward type info
  const selectedTypeInfo = useMemo(() => {
    if (!value.rewardType) return null;
    return rewardTypes.find(t => t.value === parseInt(value.rewardType));
  }, [value.rewardType, rewardTypes]);



  // Get selected item
  const selectedItem = useMemo(() => {
    if (!value.itemId) return null;
    return items.find(item => item.id === parseInt(value.itemId)) || null;
  }, [value.itemId, items]);

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1,
        backgroundColor: disabled ? 'action.disabledBackground' : 'background.paper',
        borderColor: error ? 'error.main' : 'divider',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        {/* Gift Icon */}
        <GiftIcon sx={{ color: '#ff9800', fontSize: 24, ml: 0.5 }} />

        {/* Reward Type Selector */}
        <Select
          value={
            loadingTypes || rewardTypes.length === 0
              ? ''
              : value.rewardType && rewardTypes.some(t => t.value === parseInt(value.rewardType))
              ? String(value.rewardType)
              : ''
          }
          onChange={(e) => handleRewardTypeChange(e.target.value)}
          disabled={disabled || loadingTypes}
          size="small"
          displayEmpty
          variant="outlined"
          sx={{
            width: 200,
            flexShrink: 0,
            '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
            '& .MuiSelect-select': {
              py: 0.75,
              fontSize: '0.875rem',
            }
          }}
        >
          <MenuItem value="" disabled>
            <em>{t('rewards.rewardType')}</em>
          </MenuItem>
          {loadingTypes ? (
            <MenuItem disabled>
              <CircularProgress size={20} />
            </MenuItem>
          ) : (
            rewardTypes.map((type) => (
              <MenuItem key={type.value} value={type.value.toString()}>
                [{type.value}] {t(type.nameKey)}
              </MenuItem>
            ))
          )}
        </Select>

        <Divider orientation="vertical" flexItem />

        {/* Item Selector (only if reward type has table) */}
        {selectedTypeInfo?.hasTable && (
          <>
            <Autocomplete
              value={selectedItem ?? null}
              onChange={(_event, newValue) => {
                handleItemIdChange(newValue ? newValue.id.toString() : '');
              }}
              options={items}
              getOptionLabel={(option) => `[${option.id}] ${option.name}`}
              loading={loadingItems}
              disabled={disabled || loadingItems}
              disableClearable
              sx={{ flex: '1 1 200px', minWidth: 0 }}
              filterOptions={(options, state) => {
                const inputValue = state.inputValue.toLowerCase();
                if (!inputValue) return options;
                return options.filter(option =>
                  option.name.toLowerCase().includes(inputValue) ||
                  option.id.toString().includes(inputValue)
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={t('rewards.item')}
                  error={error}
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      '& fieldset': { border: 'none' },
                      fontSize: '0.875rem',
                      py: 0,
                    }
                  }}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingItems ? <CircularProgress color="inherit" size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => (
                <li {...props} key={option.id}>
                  <Typography variant="body2">
                    <strong>[{option.id}]</strong> {option.name}
                  </Typography>
                </li>
              )}
              noOptionsText={t('rewards.noItemsFound')}
              size="small"
            />
            <Divider orientation="vertical" flexItem />
          </>
        )}

        {/* Description for types without table */}
        {selectedTypeInfo && !selectedTypeInfo.hasTable && selectedTypeInfo.descriptionKey && (
          <>
            <Typography variant="caption" color="text.secondary" sx={{ flex: '1 1 auto', px: 1 }}>
              {t(selectedTypeInfo.descriptionKey)}
            </Typography>
            <Divider orientation="vertical" flexItem />
          </>
        )}

        {/* Quantity Input - Only show if reward type is selected */}
        {value.rewardType && (
          <TextField
            type="number"
            value={value.quantity}
            onChange={(e) => handleQuantityChange(parseInt(e.target.value) || minQuantity)}
            disabled={disabled}
            error={error}
            placeholder={t('rewards.quantity')}
            size="small"
            sx={{
              width: 90,
              '& .MuiOutlinedInput-root': {
                '& fieldset': { border: 'none' },
                fontSize: '0.875rem',
              },
              '& input[type=number]': {
                MozAppearance: 'textfield',
                textAlign: 'right',
                py: 0.75,
              },
              '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                WebkitAppearance: 'none',
                margin: 0,
              },
            }}
            inputProps={{
              min: minQuantity,
              step: 1,
            }}
          />
        )}
      </Box>

      {helperText && (
        <Typography variant="caption" color={error ? 'error' : 'text.secondary'} sx={{ mt: 0.5, display: 'block', px: 1 }}>
          {helperText}
        </Typography>
      )}
    </Paper>
  );
};

export default RewardItemSelector;

