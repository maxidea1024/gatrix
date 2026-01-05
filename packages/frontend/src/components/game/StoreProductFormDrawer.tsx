import React, { useState, useEffect } from 'react';
import {
  Button,
  TextField,
  Box,
  Typography,
  Chip,
  Stack,
  Autocomplete,
  Tooltip,
  FormControlLabel,
  Switch,
  MenuItem,
  Select,
  FormControl,
  CircularProgress,
} from '@mui/material';
import ResizableDrawer from '../common/ResizableDrawer';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import storeProductService, { StoreProduct } from '../../services/storeProductService';
import { tagService, Tag } from '../../services/tagService';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import { getContrastColor } from '@/utils/colorUtils';

interface StoreProductFormDrawerProps {
  open: boolean;
  onClose: () => void;
  onSave: () => void;
  product?: StoreProduct | null;
}

// Store options
const STORE_OPTIONS = [
  { value: 'sdo', label: 'SDO' },
  { value: 'google_play', label: 'Google Play' },
  { value: 'app_store', label: 'App Store' },
  { value: 'one_store', label: 'ONE Store' },
  { value: 'galaxy_store', label: 'Galaxy Store' },
  { value: 'amazon', label: 'Amazon Appstore' },
  { value: 'huawei', label: 'Huawei AppGallery' },
];

// Currency options
const CURRENCY_OPTIONS = ['USD', 'KRW', 'JPY', 'EUR', 'CNY', 'TWD'];

const StoreProductFormDrawer: React.FC<StoreProductFormDrawerProps> = ({
  open,
  onClose,
  onSave,
  product,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // Form state
  const [productId, setProductId] = useState('');
  const [productName, setProductName] = useState('');
  // Multi-language name fields
  const [nameKo, setNameKo] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameZh, setNameZh] = useState('');
  const [store, setStore] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [currency, setCurrency] = useState('USD');
  const [isActive, setIsActive] = useState(true);
  const [saleStartAt, setSaleStartAt] = useState<Dayjs | null>(null);
  const [saleEndAt, setSaleEndAt] = useState<Dayjs | null>(null);
  const [description, setDescription] = useState('');
  // Multi-language description fields
  const [descriptionKo, setDescriptionKo] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [descriptionZh, setDescriptionZh] = useState('');
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [saving, setSaving] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);
  const [isCopy, setIsCopy] = useState(false);
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  // Check if this is edit mode (existing product)
  const isEditMode = !!product?.id;

  // Load available tags
  useEffect(() => {
    const loadTags = async () => {
      try {
        setLoadingTags(true);
        const tags = await tagService.list();
        setAvailableTags(tags);
      } catch (error) {
        console.error('Failed to load tags:', error);
      } finally {
        setLoadingTags(false);
      }
    };

    if (open) {
      loadTags();
    }
  }, [open]);

  // Initialize form
  useEffect(() => {
    if (product) {
      const isCopyOperation = !product.id;
      setIsCopy(isCopyOperation);

      setProductId(product.productId);
      setProductName(product.productName);
      // Multi-language name fields
      setNameKo(product.nameKo || '');
      setNameEn(product.nameEn || '');
      setNameZh(product.nameZh || '');
      setStore(product.store);
      setPrice(product.price);
      setCurrency(product.currency || 'USD');
      setIsActive(product.isActive);
      setSaleStartAt(product.saleStartAt ? dayjs(product.saleStartAt) : null);
      setSaleEndAt(product.saleEndAt ? dayjs(product.saleEndAt) : null);
      setDescription(product.description || '');
      // Multi-language description fields
      setDescriptionKo(product.descriptionKo || '');
      setDescriptionEn(product.descriptionEn || '');
      setDescriptionZh(product.descriptionZh || '');

      // Convert tags to Tag objects
      if (product.tags && Array.isArray(product.tags)) {
        const selectedTagObjects = availableTags.filter(tag =>
          product.tags?.some(t => {
            if (typeof t === 'object' && t !== null && 'id' in t) {
              return t.id === tag.id;
            }
            return false;
          })
        );
        setSelectedTags(selectedTagObjects);
      } else {
        setSelectedTags([]);
      }
    } else {
      // Reset form for new product
      setProductId('');
      setProductName('');
      setNameKo('');
      setNameEn('');
      setNameZh('');
      setStore('sdo'); // Default to SDO
      setPrice(0);
      setCurrency('CNY'); // Default to CNY
      setIsActive(true);
      setSaleStartAt(null);
      setSaleEndAt(null);
      setDescription('');
      setDescriptionKo('');
      setDescriptionEn('');
      setDescriptionZh('');
      setSelectedTags([]);
      setIsCopy(false);
    }

    // Focus on description input when drawer opens for editing
    if (open) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [product, open, availableTags]);

  const handleSave = async () => {
    // Validation
    if (!productId.trim()) {
      enqueueSnackbar(t('storeProducts.productIdRequired'), { variant: 'error' });
      return;
    }
    if (!productName.trim()) {
      enqueueSnackbar(t('storeProducts.productNameRequired'), { variant: 'error' });
      return;
    }
    if (!store) {
      enqueueSnackbar(t('storeProducts.storeRequired'), { variant: 'error' });
      return;
    }
    if (price < 0) {
      enqueueSnackbar(t('storeProducts.priceInvalid'), { variant: 'error' });
      return;
    }

    setSaving(true);
    try {
      const tagIds = selectedTags.map(tag => tag.id);
      const payload = {
        productId: productId.trim(),
        productName: productName.trim(),
        // Multi-language name fields
        nameKo: nameKo.trim() || undefined,
        nameEn: nameEn.trim() || undefined,
        nameZh: nameZh.trim() || undefined,
        store,
        price,
        currency,
        isActive,
        saleStartAt: saleStartAt ? saleStartAt.toISOString() : null,
        saleEndAt: saleEndAt ? saleEndAt.toISOString() : null,
        description: description.trim() || undefined,
        // Multi-language description fields
        descriptionKo: descriptionKo.trim() || undefined,
        descriptionEn: descriptionEn.trim() || undefined,
        descriptionZh: descriptionZh.trim() || undefined,
        tagIds,
      };

      if (product && product.id) {
        // Update existing product
        await storeProductService.updateStoreProduct(product.id, payload);
        enqueueSnackbar(t('storeProducts.updateSuccess'), { variant: 'success' });
      } else {
        // Create new product
        await storeProductService.createStoreProduct(payload);
        const message = isCopy ? t('storeProducts.copySuccess') : t('storeProducts.createSuccess');
        enqueueSnackbar(message, { variant: 'success' });
      }
      onSave();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('common.saveFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={
        isCopy
          ? t('storeProducts.copyProduct')
          : product
          ? t('storeProducts.editProduct')
          : t('storeProducts.createProduct')
      }
      subtitle={t('storeProducts.formSubtitle')}
      storageKey="storeProductFormDrawerWidth"
      defaultWidth={600}
      minWidth={500}
    >
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Content */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            <Stack spacing={2}>
              {/* Active Status */}
              <FormControlLabel
                control={
                  <Switch
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    color="primary"
                  />
                }
                label={t('storeProducts.isActive')}
              />

              {/* Product ID - Read-only in edit mode */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t('storeProducts.productId')}
                  {!isEditMode && <span style={{ color: '#d32f2f', marginLeft: '4px' }}>*</span>}
                </Typography>
                <TextField
                  inputRef={nameInputRef}
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder={t('storeProducts.productIdHelp')}
                  disabled={isEditMode}
                  InputProps={{
                    readOnly: isEditMode,
                  }}
                />
              </Box>

              {/* Product Name - Read-only in edit mode */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t('storeProducts.productName')}
                  {!isEditMode && <span style={{ color: '#d32f2f', marginLeft: '4px' }}>*</span>}
                </Typography>
                <TextField
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder={t('storeProducts.productNameHelp')}
                  disabled={isEditMode}
                  InputProps={{
                    readOnly: isEditMode,
                  }}
                />
              </Box>

              {/* Multi-language Product Names */}
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
                  {t('storeProducts.multiLangNames')}
                </Typography>
                <Stack spacing={1.5}>
                  <TextField
                    label={t('storeProducts.nameKo')}
                    value={nameKo}
                    onChange={(e) => setNameKo(e.target.value)}
                    fullWidth
                    size="small"
                    disabled={isEditMode}
                    InputProps={{ readOnly: isEditMode }}
                  />
                  <TextField
                    label={t('storeProducts.nameEn')}
                    value={nameEn}
                    onChange={(e) => setNameEn(e.target.value)}
                    fullWidth
                    size="small"
                    disabled={isEditMode}
                    InputProps={{ readOnly: isEditMode }}
                  />
                  <TextField
                    label={t('storeProducts.nameZh')}
                    value={nameZh}
                    onChange={(e) => setNameZh(e.target.value)}
                    fullWidth
                    size="small"
                    disabled={isEditMode}
                    InputProps={{ readOnly: isEditMode }}
                  />
                </Stack>
              </Box>

              {/* Store - Read-only in edit mode */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t('storeProducts.store')}
                  {!isEditMode && <span style={{ color: '#d32f2f', marginLeft: '4px' }}>*</span>}
                </Typography>
                <FormControl fullWidth size="small">
                  <Select
                    value={store}
                    onChange={(e) => setStore(e.target.value)}
                    displayEmpty
                    disabled={isEditMode}
                    readOnly={isEditMode}
                  >
                    <MenuItem value="" disabled>
                      {t('storeProducts.selectStore')}
                    </MenuItem>
                    {STORE_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {/* Price and Currency - Read-only in edit mode */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ flex: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t('storeProducts.price')}
                    {!isEditMode && <span style={{ color: '#d32f2f', marginLeft: '4px' }}>*</span>}
                  </Typography>
                  <TextField
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                    fullWidth
                    size="small"
                    inputProps={{ min: 0, step: 0.01, readOnly: isEditMode }}
                    disabled={isEditMode}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t('storeProducts.currency')}
                  </Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      disabled={isEditMode}
                      readOnly={isEditMode}
                    >
                      {CURRENCY_OPTIONS.map((curr) => (
                        <MenuItem key={curr} value={curr}>
                          {curr}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
              </Box>

              {/* Sale Period */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t('storeProducts.saleStartAt')}
                  </Typography>
                  <DateTimePicker
                    value={saleStartAt}
                    onChange={(value) => setSaleStartAt(value)}
                    timeSteps={{ minutes: 1 }}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                        slotProps: { input: { readOnly: true } },
                      },
                      actionBar: {
                        actions: ['clear', 'cancel', 'accept'],
                      },
                    }}
                  />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {t('storeProducts.saleEndAt')}
                  </Typography>
                  <DateTimePicker
                    value={saleEndAt}
                    onChange={(value) => setSaleEndAt(value)}
                    minDateTime={saleStartAt || undefined}
                    timeSteps={{ minutes: 1 }}
                    slotProps={{
                      textField: {
                        size: 'small',
                        fullWidth: true,
                        slotProps: { input: { readOnly: true } },
                      },
                      actionBar: {
                        actions: ['clear', 'cancel', 'accept'],
                      },
                    }}
                  />
                </Box>
              </Box>

              {/* Description (default) */}
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {t('storeProducts.description')}
                </Typography>
                <TextField
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  fullWidth
                  multiline
                  rows={2}
                  size="small"
                  placeholder={t('storeProducts.descriptionHelp')}
                  slotProps={{
                    input: {
                      readOnly: isEditMode,
                    },
                  }}
                />
              </Box>

              {/* Multi-language Descriptions */}
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
                  {t('storeProducts.multiLangDescriptions')}
                </Typography>
                <Stack spacing={1.5}>
                  <TextField
                    label={t('storeProducts.descriptionKo')}
                    value={descriptionKo}
                    onChange={(e) => setDescriptionKo(e.target.value)}
                    fullWidth
                    multiline
                    rows={2}
                    size="small"
                    disabled={isEditMode}
                    InputProps={{ readOnly: isEditMode }}
                  />
                  <TextField
                    label={t('storeProducts.descriptionEn')}
                    value={descriptionEn}
                    onChange={(e) => setDescriptionEn(e.target.value)}
                    fullWidth
                    multiline
                    rows={2}
                    size="small"
                    disabled={isEditMode}
                    InputProps={{ readOnly: isEditMode }}
                  />
                  <TextField
                    label={t('storeProducts.descriptionZh')}
                    value={descriptionZh}
                    onChange={(e) => setDescriptionZh(e.target.value)}
                    fullWidth
                    multiline
                    rows={2}
                    size="small"
                    disabled={isEditMode}
                    InputProps={{ readOnly: isEditMode }}
                  />
                </Stack>
              </Box>

              {/* Tags */}
              <Box>
                <Autocomplete
                  multiple
                  options={availableTags.filter(tag => typeof tag !== 'string')}
                  getOptionLabel={(option) => option.name}
                  filterSelectedOptions
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  value={selectedTags}
                  onChange={(_, value) => setSelectedTags(value)}
                  loading={loadingTags}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => {
                      const { key, ...chipProps } = getTagProps({ index });
                      return (
                        <Tooltip key={option.id} title={option.description || t('tags.noDescription')} arrow>
                          <Chip
                            variant="outlined"
                            label={option.name}
                            size="small"
                            sx={{ bgcolor: option.color, color: getContrastColor(option.color) }}
                            {...chipProps}
                          />
                        </Tooltip>
                      );
                    })
                  }
                  renderInput={(params) => (
                    <TextField {...params} label={t('storeProducts.tags')} />
                  )}
                />
              </Box>
            </Stack>
          </Box>

          {/* Footer */}
          <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? t('common.saving') : t('common.save')}
            </Button>
          </Box>
        </Box>
      </LocalizationProvider>
    </ResizableDrawer>
  );
};

export default StoreProductFormDrawer;
