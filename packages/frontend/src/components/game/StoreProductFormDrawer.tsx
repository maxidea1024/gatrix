import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Button,
  TextField,
  Box,
  Typography,
  Stack,
  FormControlLabel,
  Switch,
  MenuItem,
  Select,
  FormControl,
  Alert,
  AlertTitle,
  IconButton,
  Tooltip,
  Chip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  RestartAlt as ResetIcon,
  Undo as UndoIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  Translate as TranslateIcon,
} from '@mui/icons-material';
import ResizableDrawer from '../common/ResizableDrawer';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { showChangeRequestCreatedToast } from '../../utils/changeRequestToast';
import storeProductService, {
  StoreProduct,
} from '../../services/storeProductService';
import translationService from '../../services/translationService';
import { Tag } from '../../services/tagService';
import LocalizedDateTimePicker from '../common/LocalizedDateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import { useEnvironment } from '../../contexts/EnvironmentContext';
import { getActionLabel } from '../../utils/changeRequestToast';
import { useHandleApiError } from '../../hooks/useHandleApiError';
import { useEntityLock } from '../../hooks/useEntityLock';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import TagSelector from '../common/TagSelector';

interface StoreProductFormDrawerProps {
  open: boolean;
  onClose: () => void;
  onSave: (isNew: boolean) => void;
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

/**
 * OverrideFieldWrapper: Shows override indicator + per-field reset button
 */
const OverrideFieldWrapper: React.FC<{
  fieldName: string;
  overriddenFields: string[];
  hasCmsProduct: boolean;
  onReset: (field: string) => void;
  label: string;
  children: React.ReactNode;
}> = ({
  fieldName,
  overriddenFields,
  hasCmsProduct,
  onReset,
  label,
  children,
}) => {
  const { t } = useTranslation();
  const isOverridden = overriddenFields.includes(fieldName);
  const isPendingReset = (onReset as any).__pendingResets?.includes(fieldName);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 0.5 }}>
        <Typography variant="subtitle2">{label}</Typography>
        {isOverridden && !isPendingReset && (
          <>
            <Chip
              icon={<EditIcon sx={{ fontSize: 14 }} />}
              label={t('storeProducts.overridden')}
              size="small"
              color="warning"
              variant="outlined"
              sx={{
                height: 20,
                '& .MuiChip-label': { px: 0.5, fontSize: '0.7rem' },
              }}
            />
            {hasCmsProduct && (
              <Tooltip title={t('storeProducts.resetFieldOverride')}>
                <IconButton
                  size="small"
                  onClick={() => onReset(fieldName)}
                  sx={{ p: 0.25 }}
                >
                  <UndoIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </>
        )}
        {isPendingReset && (
          <Chip
            icon={<UndoIcon sx={{ fontSize: 14 }} />}
            label={t('storeProducts.pendingReset')}
            size="small"
            color="info"
            variant="outlined"
            sx={{
              height: 20,
              '& .MuiChip-label': { px: 0.5, fontSize: '0.7rem' },
            }}
          />
        )}
      </Box>
      {children}
    </Box>
  );
};

const StoreProductFormDrawer: React.FC<StoreProductFormDrawerProps> = ({
  open,
  onClose,
  onSave,
  product,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { currentEnvironment } = useEnvironment();
  const requiresApproval = currentEnvironment?.requiresApproval ?? false;
  const navigate = useNavigate();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();

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
  const [saleStartAt, setSaleStartAt] = useState<string | null>(null);
  const [saleEndAt, setSaleEndAt] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  // Multi-language description fields
  const [descriptionKo, setDescriptionKo] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [descriptionZh, setDescriptionZh] = useState('');
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [saving, setSaving] = useState(false);
  const [isCopy, setIsCopy] = useState(false);
  const [pendingOverrideResets, setPendingOverrideResets] = useState<string[]>(
    []
  );
  const [namesSectionOpen, setNamesSectionOpen] = useState(false);
  const [descSectionOpen, setDescSectionOpen] = useState(false);
  const [confirmResetAllOpen, setConfirmResetAllOpen] = useState(false);
  const [translatingName, setTranslatingName] = useState(false);
  const [translatingDesc, setTranslatingDesc] = useState(false);
  const [planningValues, setPlanningValues] = useState<Record<
    string,
    any
  > | null>(null);

  const { handleApiError, ErrorDialog } = useHandleApiError();
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  // Entity Lock for edit mode
  const { hasLock, lockedBy, pendingCR, forceTakeover } = useEntityLock({
    table: 'g_store_products',
    entityId: product?.id || null,
    isEditing: open && !!product?.id,
    // onLockLost is called when lock is taken - toast is now handled by useEntityLock via SSE
  });

  // Check if this is edit mode (existing product)
  const isEditMode = !!product?.id;

  // Override tracking
  const overriddenFields: string[] = useMemo(() => {
    if (!product?.overriddenFields) return [];
    return Array.isArray(product.overriddenFields)
      ? product.overriddenFields
      : [];
  }, [product?.overriddenFields]);

  const hasCmsProduct = !!product?.cmsProductId;
  const hasOverrides = overriddenFields.length > 0;

  // Initialize form
  useEffect(() => {
    // Always reset pending override resets on form init
    setPendingOverrideResets([]);

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
      setSaleStartAt(product.saleStartAt || null);
      setSaleEndAt(product.saleEndAt || null);
      setDescription(product.description || '');
      // Multi-language description fields
      setDescriptionKo(product.descriptionKo || '');
      setDescriptionEn(product.descriptionEn || '');
      setDescriptionZh(product.descriptionZh || '');

      // Set tags from product
      if (product.tags && Array.isArray(product.tags)) {
        setSelectedTags(
          product.tags.filter(
            (t): t is Tag => typeof t === 'object' && t !== null && 'id' in t
          )
        );
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
  }, [product, open]);

  // Fetch planning data values for override reset preview
  useEffect(() => {
    if (product?.id && product?.cmsProductId && hasOverrides) {
      storeProductService
        .getPlanningValues(projectApiPath, product.id)
        .then((values) => setPlanningValues(values))
        .catch(() => setPlanningValues(null));
    } else {
      setPlanningValues(null);
    }
  }, [product?.id, product?.cmsProductId, hasOverrides, projectApiPath]);

  // Check if form is dirty (data changed)
  const isDirty = useMemo(() => {
    if (!product) return true;
    if (!product.id) return true; // New or Copy

    const currentData = {
      productId,
      productName,
      nameKo,
      nameEn,
      nameZh,
      store,
      price,
      currency,
      isActive,
      saleStartAt,
      saleEndAt,
      description,
      descriptionKo,
      descriptionEn,
      descriptionZh,
      tagIds: selectedTags.map((tag) => tag.id).sort((a, b) => a - b),
    };

    const originalData = {
      productId: product.productId,
      productName: product.productName,
      nameKo: product.nameKo || '',
      nameEn: product.nameEn || '',
      nameZh: product.nameZh || '',
      store: product.store,
      price: product.price,
      currency: product.currency || 'USD',
      isActive: product.isActive,
      saleStartAt: product.saleStartAt || null,
      saleEndAt: product.saleEndAt || null,
      description: product.description || '',
      descriptionKo: product.descriptionKo || '',
      descriptionEn: product.descriptionEn || '',
      descriptionZh: product.descriptionZh || '',
      tagIds: (product.tags || [])
        .map((tag: any) => tag.id)
        .sort((a: number, b: number) => a - b),
    };

    return (
      JSON.stringify(currentData) !== JSON.stringify(originalData) ||
      pendingOverrideResets.length > 0
    );
  }, [
    product,
    productId,
    productName,
    nameKo,
    nameEn,
    nameZh,
    store,
    price,
    currency,
    isActive,
    saleStartAt,
    saleEndAt,
    description,
    descriptionKo,
    descriptionEn,
    descriptionZh,
    selectedTags,
    pendingOverrideResets,
  ]);

  // Reset a single field override (local state only, applied on save)
  const handleResetField = useCallback(
    (field: string) => {
      setPendingOverrideResets((prev) => {
        if (prev.includes(field)) return prev;
        return [...prev, field];
      });
      // Apply planning data value to form field for instant preview
      if (planningValues && field in planningValues) {
        const val = planningValues[field];
        const setters: Record<string, (v: any) => void> = {
          productId: setProductId,
          productName: setProductName,
          nameKo: (v) => setNameKo(v || ''),
          nameEn: (v) => setNameEn(v || ''),
          nameZh: (v) => setNameZh(v || ''),
          store: setStore,
          price: setPrice,
          currency: setCurrency,
          saleStartAt: (v) => setSaleStartAt(v || null),
          saleEndAt: (v) => setSaleEndAt(v || null),
          description: (v) => setDescription(v || ''),
          descriptionKo: (v) => setDescriptionKo(v || ''),
          descriptionEn: (v) => setDescriptionEn(v || ''),
          descriptionZh: (v) => setDescriptionZh(v || ''),
        };
        if (setters[field]) setters[field](val);
      }
    },
    [planningValues]
  );

  // Attach pendingResets info so OverrideFieldWrapper can read it
  (handleResetField as any).__pendingResets = pendingOverrideResets;

  // Reset all overrides (local state only, applied on save)
  const handleResetAllOverrides = useCallback(() => {
    setConfirmResetAllOpen(true);
  }, []);

  const confirmResetAll = useCallback(() => {
    setPendingOverrideResets([...overriddenFields]);
    // Apply all planning data values to form fields
    if (planningValues) {
      if ('productId' in planningValues) setProductId(planningValues.productId);
      if ('productName' in planningValues)
        setProductName(planningValues.productName);
      if ('nameKo' in planningValues) setNameKo(planningValues.nameKo || '');
      if ('nameEn' in planningValues) setNameEn(planningValues.nameEn || '');
      if ('nameZh' in planningValues) setNameZh(planningValues.nameZh || '');
      if ('store' in planningValues) setStore(planningValues.store);
      if ('price' in planningValues) setPrice(planningValues.price);
      if ('currency' in planningValues) setCurrency(planningValues.currency);
      if ('description' in planningValues)
        setDescription(planningValues.description || '');
      if ('descriptionKo' in planningValues)
        setDescriptionKo(planningValues.descriptionKo || '');
      if ('descriptionEn' in planningValues)
        setDescriptionEn(planningValues.descriptionEn || '');
      if ('descriptionZh' in planningValues)
        setDescriptionZh(planningValues.descriptionZh || '');
    }
    setConfirmResetAllOpen(false);
  }, [overriddenFields, planningValues]);
  const handleSave = async () => {
    // Validation
    if (!productId.trim()) {
      enqueueSnackbar(t('storeProducts.productIdRequired'), {
        variant: 'error',
      });
      return;
    }
    if (!productName.trim()) {
      enqueueSnackbar(t('storeProducts.productNameRequired'), {
        variant: 'error',
      });
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
      const tagIds = selectedTags.map((tag) => tag.id);

      // For fields included in overrideResets, we must send explicit null/value
      // instead of undefined, so the backend properly receives the reset value.
      const isResettingField = (field: string) =>
        pendingOverrideResets.includes(field);

      const payload: any = {
        productId: productId.trim(),
        productName: productName.trim(),
        // Multi-language name fields: send null (not undefined) if resetting
        nameKo:
          nameKo.trim() || (isResettingField('nameKo') ? null : undefined),
        nameEn:
          nameEn.trim() || (isResettingField('nameEn') ? null : undefined),
        nameZh:
          nameZh.trim() || (isResettingField('nameZh') ? null : undefined),
        store,
        price,
        currency,
        isActive,
        saleStartAt,
        saleEndAt,
        description:
          description.trim() ||
          (isResettingField('description') ? null : undefined),
        // Multi-language description fields: send null (not undefined) if resetting
        descriptionKo:
          descriptionKo.trim() ||
          (isResettingField('descriptionKo') ? null : undefined),
        descriptionEn:
          descriptionEn.trim() ||
          (isResettingField('descriptionEn') ? null : undefined),
        descriptionZh:
          descriptionZh.trim() ||
          (isResettingField('descriptionZh') ? null : undefined),
        tagIds,
      };

      // Include pending override resets if any
      if (pendingOverrideResets.length > 0) {
        payload.overrideResets = pendingOverrideResets;
      }

      if (product && product.id) {
        // Update existing product
        const result = await storeProductService.updateStoreProduct(
          projectApiPath,
          product.id,
          payload
        );
        if (result.isChangeRequest) {
          showChangeRequestCreatedToast(
            enqueueSnackbar,
            closeSnackbar,
            navigate
          );
        } else {
          enqueueSnackbar(t('storeProducts.updateSuccess'), {
            variant: 'success',
          });
        }
      } else {
        // Create new product
        const result = await storeProductService.createStoreProduct(
          projectApiPath,
          payload
        );
        if (result.isChangeRequest) {
          showChangeRequestCreatedToast(
            enqueueSnackbar,
            closeSnackbar,
            navigate
          );
        } else {
          const message = isCopy
            ? t('storeProducts.copySuccess')
            : t('storeProducts.createSuccess');
          enqueueSnackbar(message, { variant: 'success' });
        }
      }
      onSave(!isEditMode);
    } catch (error: any) {
      console.error('Failed to save store product:', error);
      const fallbackKey = requiresApproval
        ? 'storeProducts.requestSaveFailed'
        : 'common.saveFailed';
      handleApiError(error, fallbackKey);
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
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            <Stack spacing={2}>
              {/* Lock Warning */}
              {product?.id && lockedBy && !hasLock && (
                <Alert
                  severity="warning"
                  action={
                    <Button
                      color="inherit"
                      size="small"
                      onClick={forceTakeover}
                    >
                      {t('entityLock.takeOver')}
                    </Button>
                  }
                >
                  <AlertTitle>
                    {t('entityLock.warning', {
                      userName: lockedBy.userName,
                      userEmail: lockedBy.userEmail,
                    })}
                  </AlertTitle>
                </Alert>
              )}

              {/* Pending CR Warning */}
              {product?.id && pendingCR && (
                <Alert severity="info">
                  <AlertTitle>{t('entityLock.pendingCR')}</AlertTitle>
                  {t('entityLock.pendingCRDetail', {
                    crTitle: pendingCR.crTitle,
                    crId: pendingCR.crId,
                  })}
                </Alert>
              )}

              {/* Override Summary Banner - hide when all fields are pending reset */}
              {isEditMode &&
                hasOverrides &&
                !overriddenFields.every((f) =>
                  pendingOverrideResets.includes(f)
                ) && (
                  <Box
                    sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
                  >
                    <Alert severity="warning" icon={<EditIcon />}>
                      <AlertTitle>
                        {t('storeProducts.overrideNotice')}
                      </AlertTitle>
                      {t('storeProducts.overrideDescription', {
                        count: overriddenFields.filter(
                          (f) => !pendingOverrideResets.includes(f)
                        ).length,
                        fields: overriddenFields
                          .filter((f) => !pendingOverrideResets.includes(f))
                          .join(', '),
                      })}
                    </Alert>
                    {hasCmsProduct && (
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                          color="warning"
                          size="small"
                          variant="outlined"
                          startIcon={<ResetIcon />}
                          onClick={handleResetAllOverrides}
                          disabled={saving}
                        >
                          {t('storeProducts.resetAllOverrides')}
                        </Button>
                      </Box>
                    )}
                  </Box>
                )}

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

              {/* CMS ID + Product ID (same row) */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                {isEditMode && product?.cmsProductId && (
                  <Box sx={{ flex: 1 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        mb: 1,
                        gap: 0.5,
                      }}
                    >
                      <Typography variant="subtitle2">
                        {t('storeProducts.cmsProductId')}
                      </Typography>
                    </Box>
                    <TextField
                      value={product.cmsProductId}
                      fullWidth
                      size="small"
                      InputProps={{ readOnly: true }}
                      sx={{
                        '& .MuiInputBase-input': { color: 'text.secondary' },
                      }}
                    />
                  </Box>
                )}

                <Box sx={{ flex: 1 }}>
                  <OverrideFieldWrapper
                    fieldName="productId"
                    overriddenFields={overriddenFields}
                    hasCmsProduct={hasCmsProduct}
                    onReset={handleResetField}
                    label={t('storeProducts.productId')}
                  >
                    <TextField
                      inputRef={nameInputRef}
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                      fullWidth
                      size="small"
                      placeholder={t('storeProducts.productIdHelp')}
                    />
                  </OverrideFieldWrapper>
                </Box>
              </Box>

              {/* Product Name + AI Translate */}
              <OverrideFieldWrapper
                fieldName="productName"
                overriddenFields={overriddenFields}
                hasCmsProduct={hasCmsProduct}
                onReset={handleResetField}
                label={t('storeProducts.productName')}
              >
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <TextField
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    fullWidth
                    size="small"
                    placeholder={t('storeProducts.productNameHelp')}
                  />
                  <Tooltip title={t('common.aiTranslate', 'AI 번역')}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={async () => {
                          if (!productName.trim()) return;
                          setTranslatingName(true);
                          try {
                            const result =
                              await translationService.translateToMultipleLanguages(
                                {
                                  text: productName.trim(),
                                  targetLanguages: ['ko', 'en', 'zh'],
                                  sourceLanguage: 'auto',
                                }
                              );
                            if (result.ko) setNameKo(result.ko.translatedText);
                            if (result.en) setNameEn(result.en.translatedText);
                            if (result.zh) setNameZh(result.zh.translatedText);
                            setNamesSectionOpen(true);
                            enqueueSnackbar(
                              t('common.translateSuccess', '번역 완료'),
                              { variant: 'success' }
                            );
                          } catch (err) {
                            enqueueSnackbar(
                              t('common.translateFailed', '번역 실패'),
                              { variant: 'error' }
                            );
                          } finally {
                            setTranslatingName(false);
                          }
                        }}
                        disabled={translatingName || !productName.trim()}
                        color="primary"
                        sx={{ flexShrink: 0 }}
                      >
                        {translatingName ? (
                          <CircularProgress size={18} />
                        ) : (
                          <TranslateIcon fontSize="small" />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </OverrideFieldWrapper>

              {/* Multi-language Product Names - Collapsible */}
              <Accordion
                expanded={namesSectionOpen}
                onChange={(_, expanded) => setNamesSectionOpen(expanded)}
                variant="outlined"
                disableGutters
                sx={{
                  borderColor: overriddenFields.some((f) =>
                    ['nameKo', 'nameEn', 'nameZh'].includes(f)
                  )
                    ? 'warning.main'
                    : 'divider',
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: 'text.secondary' }}
                  >
                    {t('storeProducts.multiLangNames')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1.5}>
                    <OverrideFieldWrapper
                      fieldName="nameKo"
                      overriddenFields={overriddenFields}
                      hasCmsProduct={hasCmsProduct}
                      onReset={handleResetField}
                      label={t('storeProducts.nameKo')}
                    >
                      <TextField
                        value={nameKo}
                        onChange={(e) => setNameKo(e.target.value)}
                        fullWidth
                        size="small"
                      />
                    </OverrideFieldWrapper>
                    <OverrideFieldWrapper
                      fieldName="nameEn"
                      overriddenFields={overriddenFields}
                      hasCmsProduct={hasCmsProduct}
                      onReset={handleResetField}
                      label={t('storeProducts.nameEn')}
                    >
                      <TextField
                        value={nameEn}
                        onChange={(e) => setNameEn(e.target.value)}
                        fullWidth
                        size="small"
                      />
                    </OverrideFieldWrapper>
                    <OverrideFieldWrapper
                      fieldName="nameZh"
                      overriddenFields={overriddenFields}
                      hasCmsProduct={hasCmsProduct}
                      onReset={handleResetField}
                      label={t('storeProducts.nameZh')}
                    >
                      <TextField
                        value={nameZh}
                        onChange={(e) => setNameZh(e.target.value)}
                        fullWidth
                        size="small"
                      />
                    </OverrideFieldWrapper>
                  </Stack>
                </AccordionDetails>
              </Accordion>

              {/* Store */}
              <OverrideFieldWrapper
                fieldName="store"
                overriddenFields={overriddenFields}
                hasCmsProduct={hasCmsProduct}
                onReset={handleResetField}
                label={t('storeProducts.store')}
              >
                <FormControl fullWidth size="small">
                  <Select
                    value={store}
                    onChange={(e) => setStore(e.target.value)}
                    displayEmpty
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
              </OverrideFieldWrapper>

              {/* Price and Currency */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ flex: 2 }}>
                  <OverrideFieldWrapper
                    fieldName="price"
                    overriddenFields={overriddenFields}
                    hasCmsProduct={hasCmsProduct}
                    onReset={handleResetField}
                    label={t('storeProducts.price')}
                  >
                    <TextField
                      type="number"
                      value={price}
                      onChange={(e) =>
                        setPrice(parseFloat(e.target.value) || 0)
                      }
                      fullWidth
                      size="small"
                      inputProps={{ min: 0, step: 0.01 }}
                    />
                  </OverrideFieldWrapper>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <OverrideFieldWrapper
                    fieldName="currency"
                    overriddenFields={overriddenFields}
                    hasCmsProduct={hasCmsProduct}
                    onReset={handleResetField}
                    label={t('storeProducts.currency')}
                  >
                    <FormControl fullWidth size="small">
                      <Select
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                      >
                        {CURRENCY_OPTIONS.map((curr) => (
                          <MenuItem key={curr} value={curr}>
                            {curr}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </OverrideFieldWrapper>
                </Box>
              </Box>

              {/* Sale Period */}
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <OverrideFieldWrapper
                    fieldName="saleStartAt"
                    overriddenFields={overriddenFields}
                    hasCmsProduct={hasCmsProduct}
                    onReset={handleResetField}
                    label=""
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        {t('storeProducts.saleStartAt')}
                      </Typography>
                      <LocalizedDateTimePicker
                        value={saleStartAt}
                        onChange={(value) => setSaleStartAt(value)}
                      />
                    </Box>
                  </OverrideFieldWrapper>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <OverrideFieldWrapper
                    fieldName="saleEndAt"
                    overriddenFields={overriddenFields}
                    hasCmsProduct={hasCmsProduct}
                    onReset={handleResetField}
                    label=""
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        {t('storeProducts.saleEndAt')}
                      </Typography>
                      <LocalizedDateTimePicker
                        value={saleEndAt}
                        onChange={(value) => setSaleEndAt(value)}
                        minDateTime={
                          saleStartAt ? dayjs(saleStartAt) : undefined
                        }
                      />
                    </Box>
                  </OverrideFieldWrapper>
                </Box>
              </Box>

              {/* Description (default) + AI Translate */}
              <OverrideFieldWrapper
                fieldName="description"
                overriddenFields={overriddenFields}
                hasCmsProduct={hasCmsProduct}
                onReset={handleResetField}
                label={t('storeProducts.description')}
              >
                <Box
                  sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-start' }}
                >
                  <TextField
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    fullWidth
                    multiline
                    rows={2}
                    size="small"
                    placeholder={t('storeProducts.descriptionHelp')}
                  />
                  <Tooltip title={t('common.aiTranslate', 'AI 번역')}>
                    <span>
                      <IconButton
                        size="small"
                        onClick={async () => {
                          if (!description.trim()) return;
                          setTranslatingDesc(true);
                          try {
                            const result =
                              await translationService.translateToMultipleLanguages(
                                {
                                  text: description.trim(),
                                  targetLanguages: ['ko', 'en', 'zh'],
                                  sourceLanguage: 'auto',
                                }
                              );
                            if (result.ko)
                              setDescriptionKo(result.ko.translatedText);
                            if (result.en)
                              setDescriptionEn(result.en.translatedText);
                            if (result.zh)
                              setDescriptionZh(result.zh.translatedText);
                            setDescSectionOpen(true);
                            enqueueSnackbar(
                              t('common.translateSuccess', '번역 완료'),
                              { variant: 'success' }
                            );
                          } catch (err) {
                            enqueueSnackbar(
                              t('common.translateFailed', '번역 실패'),
                              { variant: 'error' }
                            );
                          } finally {
                            setTranslatingDesc(false);
                          }
                        }}
                        disabled={translatingDesc || !description.trim()}
                        color="primary"
                        sx={{ flexShrink: 0, mt: 0.5 }}
                      >
                        {translatingDesc ? (
                          <CircularProgress size={18} />
                        ) : (
                          <TranslateIcon fontSize="small" />
                        )}
                      </IconButton>
                    </span>
                  </Tooltip>
                </Box>
              </OverrideFieldWrapper>

              {/* Multi-language Descriptions - Collapsible */}
              <Accordion
                expanded={descSectionOpen}
                onChange={(_, expanded) => setDescSectionOpen(expanded)}
                variant="outlined"
                disableGutters
                sx={{
                  borderColor: overriddenFields.some((f) =>
                    [
                      'descriptionKo',
                      'descriptionEn',
                      'descriptionZh',
                    ].includes(f)
                  )
                    ? 'warning.main'
                    : 'divider',
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography
                    variant="subtitle2"
                    sx={{ color: 'text.secondary' }}
                  >
                    {t('storeProducts.multiLangDescriptions')}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={1.5}>
                    <OverrideFieldWrapper
                      fieldName="descriptionKo"
                      overriddenFields={overriddenFields}
                      hasCmsProduct={hasCmsProduct}
                      onReset={handleResetField}
                      label={t('storeProducts.descriptionKo')}
                    >
                      <TextField
                        value={descriptionKo}
                        onChange={(e) => setDescriptionKo(e.target.value)}
                        fullWidth
                        multiline
                        rows={2}
                        size="small"
                      />
                    </OverrideFieldWrapper>
                    <OverrideFieldWrapper
                      fieldName="descriptionEn"
                      overriddenFields={overriddenFields}
                      hasCmsProduct={hasCmsProduct}
                      onReset={handleResetField}
                      label={t('storeProducts.descriptionEn')}
                    >
                      <TextField
                        value={descriptionEn}
                        onChange={(e) => setDescriptionEn(e.target.value)}
                        fullWidth
                        multiline
                        rows={2}
                        size="small"
                      />
                    </OverrideFieldWrapper>
                    <OverrideFieldWrapper
                      fieldName="descriptionZh"
                      overriddenFields={overriddenFields}
                      hasCmsProduct={hasCmsProduct}
                      onReset={handleResetField}
                      label={t('storeProducts.descriptionZh')}
                    >
                      <TextField
                        value={descriptionZh}
                        onChange={(e) => setDescriptionZh(e.target.value)}
                        fullWidth
                        multiline
                        rows={2}
                        size="small"
                      />
                    </OverrideFieldWrapper>
                  </Stack>
                </AccordionDetails>
              </Accordion>

              {/* Tags */}
              <TagSelector value={selectedTags} onChange={setSelectedTags} />
            </Stack>
          </Box>

          {/* Footer */}
          <Box
            sx={{
              p: 2,
              borderTop: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              gap: 1,
              justifyContent: 'flex-end',
              bgcolor: 'background.paper',
            }}
          >
            <Button onClick={onClose} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={
                saving || !productId.trim() || (!!product?.id && !isDirty)
              }
            >
              {saving
                ? t('common.saving')
                : getActionLabel(
                    isEditMode ? 'update' : 'create',
                    requiresApproval,
                    t
                  )}
            </Button>
          </Box>
        </Box>
      </LocalizationProvider>
      <ErrorDialog />

      {/* Reset All Overrides Confirmation Dialog */}
      <Dialog
        open={confirmResetAllOpen}
        onClose={() => setConfirmResetAllOpen(false)}
      >
        <DialogTitle>{t('storeProducts.resetAllOverrides')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('storeProducts.overrideDescription', {
              count: overriddenFields.length,
              fields: overriddenFields.join(', '),
            })}
          </DialogContentText>
          <DialogContentText sx={{ mt: 1 }}>
            {t('storeProducts.fieldOverrideWillReset')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmResetAllOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button onClick={confirmResetAll} color="warning" variant="contained">
            {t('storeProducts.resetAllOverrides')}
          </Button>
        </DialogActions>
      </Dialog>
    </ResizableDrawer>
  );
};

export default StoreProductFormDrawer;
