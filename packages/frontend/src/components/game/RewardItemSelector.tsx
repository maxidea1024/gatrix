import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  Autocomplete,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import planningDataService, { RewardTypeInfo, RewardItem } from '../../services/planningDataService';
import { useDebounce } from '../../hooks/useDebounce';

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
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // State
  const [rewardTypes, setRewardTypes] = useState<RewardTypeInfo[]>([]);
  const [items, setItems] = useState<RewardItem[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState('');

  const debouncedItemSearch = useDebounce(itemSearchTerm, 300);

  // Load reward types on mount
  useEffect(() => {
    loadRewardTypes();
  }, []);

  // Load items when reward type changes
  useEffect(() => {
    if (value.rewardType) {
      loadItems(parseInt(value.rewardType));
    } else {
      setItems([]);
    }
  }, [value.rewardType]);

  const loadRewardTypes = async () => {
    try {
      setLoadingTypes(true);
      const types = await planningDataService.getRewardTypeList();
      setRewardTypes(types);
    } catch (error: any) {
      enqueueSnackbar(error.message || t('planningData.errors.loadRewardTypesFailed'), { variant: 'error' });
    } finally {
      setLoadingTypes(false);
    }
  };

  const loadItems = async (rewardType: number) => {
    try {
      setLoadingItems(true);
      const typeInfo = rewardTypes.find(t => t.value === rewardType);
      
      if (typeInfo && typeInfo.hasTable) {
        const itemList = await planningDataService.getRewardTypeItems(rewardType);
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
  };

  const handleRewardTypeChange = (newRewardType: string) => {
    onChange({
      rewardType: newRewardType,
      itemId: '',
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

  // Filter items based on search term
  const filteredItems = useMemo(() => {
    if (!debouncedItemSearch) return items;
    const searchLower = debouncedItemSearch.toLowerCase();
    return items.filter(item =>
      item.name.toLowerCase().includes(searchLower) ||
      item.id.toString().includes(searchLower)
    );
  }, [items, debouncedItemSearch]);

  // Get selected item
  const selectedItem = useMemo(() => {
    if (!value.itemId) return null;
    return items.find(item => item.id === parseInt(value.itemId));
  }, [value.itemId, items]);

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
      {/* Reward Type Selector */}
      <FormControl sx={{ flex: 1 }} size="small" disabled={disabled} error={error}>
        <InputLabel>{t('rewards.rewardType')}</InputLabel>
        <Select
          value={value.rewardType}
          onChange={(e) => handleRewardTypeChange(e.target.value)}
          label={t('rewards.rewardType')}
        >
          {loadingTypes ? (
            <MenuItem disabled>
              <CircularProgress size={20} />
            </MenuItem>
          ) : (
            rewardTypes.map((type) => (
              <MenuItem key={type.value} value={type.value.toString()}>
                {t(type.nameKey)} ({type.name})
                {type.hasTable && ` - ${type.itemCount} ${t('rewards.items')}`}
              </MenuItem>
            ))
          )}
        </Select>
      </FormControl>

      {/* Item Selector (only if reward type has table) */}
      {selectedTypeInfo?.hasTable && (
        <FormControl sx={{ flex: 1 }} size="small" disabled={disabled || loadingItems} error={error}>
          <Autocomplete
            value={selectedItem}
            onChange={(event, newValue) => {
              handleItemIdChange(newValue ? newValue.id.toString() : '');
            }}
            inputValue={itemSearchTerm}
            onInputChange={(event, newInputValue) => {
              setItemSearchTerm(newInputValue);
            }}
            options={filteredItems}
            getOptionLabel={(option) => `[${option.id}] ${option.name}`}
            loading={loadingItems}
            disabled={disabled || loadingItems}
            renderInput={(params) => (
              <TextField
                {...params}
                label={t('rewards.item')}
                error={error}
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingItems ? <CircularProgress color="inherit" size={20} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                }}
              />
            )}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Box>
                  <Typography variant="body2">
                    <strong>[{option.id}]</strong> {option.name}
                  </Typography>
                </Box>
              </li>
            )}
            noOptionsText={t('rewards.noItemsFound')}
            size="small"
          />
        </FormControl>
      )}

      {/* Description for types without table */}
      {selectedTypeInfo && !selectedTypeInfo.hasTable && selectedTypeInfo.descriptionKey && (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <Alert severity="info" sx={{ width: '100%', py: 0 }}>
            <Typography variant="caption">
              {t(selectedTypeInfo.descriptionKey)}
            </Typography>
          </Alert>
        </Box>
      )}

      {/* Quantity Input */}
      <TextField
        label={t('rewards.quantity')}
        type="number"
        value={value.quantity}
        onChange={(e) => handleQuantityChange(parseInt(e.target.value) || minQuantity)}
        disabled={disabled}
        error={error}
        size="small"
        sx={{
          width: 120,
          '& input[type=number]': {
            MozAppearance: 'textfield',
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

      {helperText && (
        <Typography variant="caption" color={error ? 'error' : 'text.secondary'} sx={{ mt: 0.5 }}>
          {helperText}
        </Typography>
      )}
    </Box>
  );
};

export default RewardItemSelector;

