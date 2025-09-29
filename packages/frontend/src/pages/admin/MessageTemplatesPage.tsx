import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  TextField,
  Switch,
  FormControlLabel,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  LinearProgress,
  Select,
  CircularProgress,
  FormControl,
  InputLabel,
  Tooltip,
  Checkbox,
  Alert,
  Autocomplete,
  Drawer
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  LocalOffer as LocalOfferIcon,
  ContentCopy as ContentCopyIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { formatDateTimeDetailed } from '@/utils/dateFormat';
import { messageTemplateService, MessageTemplate, MessageTemplateLocale, MessageTemplateType } from '@/services/messageTemplateService';
import { tagService, Tag } from '@/services/tagService';
import translationService from '@/services/translationService';
import { getLanguageDisplayName } from '@/contexts/I18nContext';
import SimplePagination from '@/components/common/SimplePagination';
import FormDialogHeader from '@/components/common/FormDialogHeader';
import EmptyTableRow from '@/components/common/EmptyTableRow';
import MultiLanguageMessageInput, { MessageLocale } from '@/components/common/MultiLanguageMessageInput';



const MessageTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [items, setItems] = useState<MessageTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  // Copy helper with type/label for proper i18n interpolation
  // includeValue=false -> use short toast without the copied value
  const copyWithToast = async (value: string, typeLabel?: string, includeValue: boolean = true) => {
    try {
      await navigator.clipboard.writeText(value);
      const message = includeValue && typeLabel
        ? t('common.copied', { type: typeLabel, value })
        : typeLabel
          ? t('common.copySuccess', { type: typeLabel })
          : t('common.copySuccess', { type: t('common.copy') });
      enqueueSnackbar(message, { variant: 'success' });
    } catch (e) {
      enqueueSnackbar(t('common.copyFailed'), { variant: 'error' });
    }
  };

  const [saving, setSaving] = useState(false);

  // 페이지네이션
  const [page, setPage] = useState(0); // SimplePagination은 0-based
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // 필터
  const [filters, setFilters] = useState<{
    type?: MessageTemplateType;
    isEnabled?: boolean;
    q?: string;
    tags?: string[];
  }>({});
  const [tagFilter, setTagFilter] = useState<Tag[]>([]);

  // 선택 관련
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MessageTemplate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<MessageTemplate | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // 태그 관련 상태
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [selectedTemplateForTags, setSelectedTemplateForTags] = useState<MessageTemplate | null>(null);
  const [templateTags, setTemplateTags] = useState<Tag[]>([]);

  const [form, setForm] = useState<MessageTemplate>({ name: '', type: 'maintenance', isEnabled: true, defaultMessage: '', locales: [] });

  // 폼 필드 ref들
  const nameFieldRef = useRef<HTMLInputElement>(null);
  const defaultMessageFieldRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const offset = page * rowsPerPage;
      const params = {
        ...filters,
        limit: rowsPerPage,
        offset
      };

      const result = await messageTemplateService.list(params);

      setItems(result.templates);
      setTotal(result.total);
    } catch (error: any) {
      enqueueSnackbar(error.message || t('admin.messageTemplates.loadFailed'), { variant: 'error' });
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, filters, enqueueSnackbar, t]);

  // 태그 로딩
  const loadTags = useCallback(async () => {
    try {
      const tags = await tagService.list();
      setAllTags(tags);
    } catch (error) {
      // Error handling
    }
  }, []);

  useEffect(() => {
    load();
    loadTags();
  }, [load, loadTags]);

  // 필터 핸들러
  const handleFilterChange = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
    setPage(0);
  }, []);

  // 태그 필터 변경 핸들러
  const handleTagFilterChange = useCallback((tags: Tag[]) => {
    setTagFilter(tags);
    const tagIds = tags.map(tag => tag.id.toString());
    handleFilterChange({
      ...filters,
      tags: tagIds.length > 0 ? tagIds : undefined
    });
  }, [filters, handleFilterChange]);

  // 페이지 변경 핸들러
  const handlePageChange = useCallback((_: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  // 페이지 크기 변경 핸들러
  const handleRowsPerPageChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);
    setPage(0);
  }, []);

  // 선택 관련 핸들러
  const handleSelectAll = useCallback((checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedIds(items.filter(item => item.id).map(item => item.id!));
    } else {
      setSelectedIds([]);
    }
  }, [items]);

  const handleSelectItem = useCallback((id: number, checked: boolean) => {
    setSelectedIds(prev => {
      const newIds = checked
        ? [...prev, id]
        : prev.filter(selectedId => selectedId !== id);

      // 전체 선택 상태 업데이트
      const availableIds = items.filter(item => item.id).map(item => item.id!);
      setSelectAll(newIds.length === availableIds.length && availableIds.length > 0);

      return newIds;
    });
  }, [items]);

  // 일괄 삭제
  const handleBulkDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    setBulkDeleteDialogOpen(true);
  }, [selectedIds]);

  const confirmBulkDelete = useCallback(async () => {
    try {
      await messageTemplateService.bulkDelete(selectedIds);
      enqueueSnackbar(t('admin.messageTemplates.bulkDeleteSuccess', { count: selectedIds.length }), { variant: 'success' });
      setSelectedIds([]);
      setSelectAll(false);
      setBulkDeleteDialogOpen(false);
      load();
    } catch (error: any) {
      console.error('Error bulk deleting templates:', error);
      enqueueSnackbar(error.message || t('admin.messageTemplates.bulkDeleteFailed'), { variant: 'error' });
    }
  }, [selectedIds, t, enqueueSnackbar, load]);

  // 일괄 사용 가능/불가 변경
  const handleBulkToggleAvailability = useCallback(async (isEnabled: boolean) => {
    if (selectedIds.length === 0) return;

    try {
      await Promise.all(selectedIds.map(async (id) => {
        const template = items.find(item => item.id === id);
        if (template) {
          await messageTemplateService.update(id, { ...template, isEnabled });
        }
      }));

      enqueueSnackbar(
        t('admin.messageTemplates.bulkUpdateSuccess', {
          count: selectedIds.length,
          status: isEnabled ? t('common.available') : t('common.unavailable')
        }),
        { variant: 'success' }
      );
      setSelectedIds([]);
      setSelectAll(false);
      load();
    } catch (error: any) {
      console.error('Error bulk updating templates:', error);
      enqueueSnackbar(error.message || t('admin.messageTemplates.bulkUpdateFailed'), { variant: 'error' });
    }
  }, [selectedIds, items, t, enqueueSnackbar, load]);

  // 개별 삭제
  const openDeleteDialog = useCallback((template: MessageTemplate) => {
    setDeletingTemplate(template);
    setDeleteDialogOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deletingTemplate?.id) return;

    try {
      await messageTemplateService.delete(deletingTemplate.id);
      enqueueSnackbar(t('common.deleteSuccess'), { variant: 'success' });
      setDeleteDialogOpen(false);
      setDeletingTemplate(null);
      load();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      enqueueSnackbar(error.message || t('common.deleteFailed'), { variant: 'error' });
    }
  }, [deletingTemplate, t, enqueueSnackbar, load]);

  const handleAdd = () => {
    setEditing(null);
    setForm({ name: '', type: 'maintenance', isEnabled: true, supportsMultiLanguage: false, defaultMessage: '', locales: [], tags: [] });
    setDialogOpen(true);
  };

  const handleEdit = (row: MessageTemplate) => {
    setEditing(row);
    setForm({
      id: row.id,
      name: row.name,
      type: row.type,
      isEnabled: Boolean((row as any).isEnabled),
      supportsMultiLanguage: Boolean((row as any).supportsMultiLanguage),
      defaultMessage: (row as any).defaultMessage || '',
      locales: row.locales || [],
      tags: row.tags || []
    });
    setDialogOpen(true);
  };

  // 태그 관련 핸들러
  const handleOpenTagDialog = useCallback(async (template: MessageTemplate) => {
    try {
      setSelectedTemplateForTags(template);
      const tags = await messageTemplateService.getTags(template.id!);
      setTemplateTags(tags);
      setTagDialogOpen(true);
    } catch (error) {
      console.error('Error loading template tags:', error);
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  }, [t, enqueueSnackbar]);

  const handleSaveTags = useCallback(async (tagIds: number[]) => {
    if (!selectedTemplateForTags?.id) return;

    try {
      await messageTemplateService.setTags(selectedTemplateForTags.id, tagIds);
      setTagDialogOpen(false);
      enqueueSnackbar(t('common.success'), { variant: 'success' });
      // 필요시 목록 새로고침
      load();
    } catch (error) {
      console.error('Error saving template tags:', error);
      enqueueSnackbar(t('common.error'), { variant: 'error' });
    }
  }, [selectedTemplateForTags, t, enqueueSnackbar, load]);



  const handleSave = async () => {
    if (!form.name.trim()) {
      enqueueSnackbar(t('common.nameRequired'), { variant: 'error' });
      nameFieldRef.current?.focus();
      return;
    }

    if (!form.defaultMessage?.trim()) {
      enqueueSnackbar(t('common.defaultMessageRequired'), { variant: 'error' });
      defaultMessageFieldRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      const payload: MessageTemplate = {
        name: form.name.trim(),
        type: form.type,
        isEnabled: !!form.isEnabled,
        supportsMultiLanguage: !!form.supportsMultiLanguage,
        defaultMessage: form.defaultMessage || null,
        locales: form.locales,
      };

      let templateId: number;

      if (editing?.id) {
        await messageTemplateService.update(editing.id, payload);
        templateId = editing.id;
        enqueueSnackbar(t('common.updateSuccess'), { variant: 'success' });
      } else {
        const created = await messageTemplateService.create(payload);
        templateId = created?.id || (created as any)?.data?.id || (created as any)?.insertId;

        if (!templateId) {
          throw new Error(t('common.cannotGetTemplateId'));
        }
        enqueueSnackbar(t('common.createSuccess'), { variant: 'success' });
      }

      // 태그 설정
      if (form.tags && form.tags.length > 0) {
        await messageTemplateService.setTags(templateId, form.tags.map(tag => tag.id));
      } else {
        // 태그가 없으면 기존 태그 모두 제거
        await messageTemplateService.setTags(templateId, []);
      }

      setDialogOpen(false);
      await load();
    } catch (error: any) {
      // Handle duplicate name error - 두 가지 오류 구조 모두 처리
      const status = error?.response?.status || error?.status;
      const errorData = error?.response?.data?.error || error?.error;

      if (status === 409) {
        if (errorData?.code === 'DUPLICATE_NAME') {
          const templateName = errorData?.value || form.name;
          enqueueSnackbar(t('common.duplicateNameErrorWithValue', { name: templateName }), { variant: 'error' });
        } else {
          enqueueSnackbar(t('common.duplicateNameError'), { variant: 'error' });
        }
      } else {
        const message = error?.response?.data?.error?.message || error?.error?.message || error?.message || t('common.saveFailed');
        enqueueSnackbar(message, { variant: 'error' });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            {t('admin.messageTemplates.title')}
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            {t('admin.messageTemplates.addTemplate')}
          </Button>
        </Box>
        <Typography variant="body1" color="text.secondary">
          {t('admin.messageTemplates.subtitle')}
        </Typography>
      </Box>

      {/* 필터 */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel shrink={true}>{t('admin.messageTemplates.type')}</InputLabel>
                <Select
                  value={filters.type || ''}
                  label={t('admin.messageTemplates.type')}
                  onChange={(e) => handleFilterChange({ ...filters, type: e.target.value as MessageTemplateType || undefined })}
                  displayEmpty
                  size="small"
                  MenuProps={{
                    PaperProps: {
                      style: {
                        zIndex: 9999
                      }
                    }
                  }}
                >
                  <MenuItem value="">
                    <em>{t('common.all')}</em>
                  </MenuItem>
                  <MenuItem value="maintenance">{t('admin.messageTemplates.types.maintenance')}</MenuItem>
                  <MenuItem value="general">{t('admin.messageTemplates.types.general')}</MenuItem>
                  <MenuItem value="notification">{t('admin.messageTemplates.types.notification')}</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel shrink={true}>{t('admin.messageTemplates.availability')}</InputLabel>
                <Select
                  value={filters.isEnabled?.toString() || ''}
                  label={t('admin.messageTemplates.availability')}
                  onChange={(e) => {
                    const value = e.target.value;
                    handleFilterChange({
                      ...filters,
                      isEnabled: value === '' ? undefined : value === 'true'
                    });
                  }}
                  displayEmpty
                  size="small"
                  MenuProps={{
                    PaperProps: {
                      style: {
                        zIndex: 9999
                      }
                    }
                  }}
                >
                  <MenuItem value="">
                    <em>{t('common.all')}</em>
                  </MenuItem>
                  <MenuItem value="true">{t('common.available')}</MenuItem>
                  <MenuItem value="false">{t('common.unavailable')}</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label={t('common.search')}
                placeholder={t('admin.messageTemplates.searchPlaceholder')}
                size="small"
                sx={{ minWidth: 200 }}
                value={filters.q || ''}
                onChange={(e) => handleFilterChange({ ...filters, q: e.target.value || undefined })}
              />

              {/* 태그 필터 */}
              <Autocomplete
                multiple
                sx={{ minWidth: 400 }}
                options={allTags}
                getOptionLabel={(option) => option.name}
                filterSelectedOptions
                value={tagFilter}
                onChange={(_, value) => handleTagFilterChange(value)}
                slotProps={{
                  popper: {
                    style: {
                      zIndex: 9999
                    }
                  }
                }}
                renderValue={(value, getTagProps) =>
                  value.map((option, index) => {
                    const { key, ...chipProps } = getTagProps({ index });
                    return (
                      <Tooltip key={option.id} title={option.description || t('tags.noDescription')} arrow>
                        <Chip
                          variant="outlined"
                          label={option.name}
                          size="small"
                          sx={{ bgcolor: option.color, color: '#fff' }}
                          {...chipProps}
                        />
                      </Tooltip>
                    );
                  })
                }
                renderInput={(params) => (
                  <TextField {...params} label={t('common.tags')} size="small" />
                )}
                renderOption={(props, option) => {
                  const { key, ...otherProps } = props;
                  return (
                    <Box component="li" key={key} {...otherProps}>
                      <Chip
                        label={option.name}
                        size="small"
                        sx={{ bgcolor: option.color, color: '#fff', mr: 1 }}
                      />
                      {option.description || t('common.noDescription')}
                    </Box>
                  );
                }}
              />
            </Box>

            <Tooltip title={t('common.refresh')}>
              <span>
                <IconButton onClick={load} disabled={loading}>
                  <RefreshIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </CardContent>
      </Card>

      {/* 일괄 작업 툴바 */}
      {selectedIds.length > 0 && (
        <Card sx={{ mb: 2, bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(110, 168, 255, 0.08)' : 'rgba(25, 118, 210, 0.04)' }}>
          <CardContent sx={{ py: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
              <Typography variant="body2" color="primary" sx={{ fontWeight: 500 }}>
                {t('admin.messageTemplates.selectedCount', { count: selectedIds.length })}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleBulkToggleAvailability(true)}
                  sx={{ minWidth: 'auto' }}
                >
                  {t('admin.messageTemplates.makeAvailable')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleBulkToggleAvailability(false)}
                  sx={{ minWidth: 'auto' }}
                >
                  {t('admin.messageTemplates.makeUnavailable')}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  onClick={handleBulkDelete}
                  sx={{ minWidth: 'auto' }}
                >
                  {t('common.delete')}
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectAll}
                      indeterminate={selectedIds.length > 0 && selectedIds.length < items.filter(item => item.id).length}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </TableCell>
                  <TableCell>{t('common.name')}</TableCell>
                  <TableCell>{t('admin.messageTemplates.defaultMessage')}</TableCell>
                  <TableCell>{t('admin.messageTemplates.availability')}</TableCell>
                  <TableCell>{t('common.updatedAt')}</TableCell>
                  <TableCell>{t('common.languages')}</TableCell>
                  <TableCell>{t('common.creator')}</TableCell>
                  <TableCell>{t('common.tags')}</TableCell>
                  <TableCell align="right">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.length === 0 ? (
                  <EmptyTableRow
                    colSpan={9}
                    loading={loading}
                    message={t('admin.messageTemplates.noTemplatesFound')}
                    loadingMessage={t('common.loadingData')}
                  />
                ) : (
                  items.map(row => {
                  const langs = (row.locales||[]).map(l=>l.lang);
                  const hasLocales = langs.length > 0;
                  const langsLabel = hasLocales ? langs.join(', ') : t('admin.messageTemplates.onlyDefaultMessage');
                  return (
                    <TableRow key={row.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.includes(row.id!)}
                          onChange={(e) => handleSelectItem(row.id!, e.target.checked)}
                          disabled={!row.id}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="subtitle2">{row.name}</Typography>
                          <IconButton size="small" onClick={() => copyWithToast(row.name, t('common.name'))} sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}>
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 280 }}>
                        {(row as any).defaultMessage ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="body2" sx={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {String((row as any).defaultMessage).replace(/\n/g, ' ')}
                            </Typography>
                            <IconButton size="small" onClick={() => copyWithToast(String((row as any).defaultMessage), t('admin.messageTemplates.defaultMessage'), false)} sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}>
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            {t('admin.messageTemplates.onlyDefaultMessage')}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{(row as any).isEnabled ? t('common.available') : t('common.unavailable')}</TableCell>
                      <TableCell>{formatDateTimeDetailed((row as any).updatedAt) || '-'}</TableCell>
                      <TableCell>{hasLocales ? langs.map(c=>getLanguageDisplayName(c as any)).join(', ') : t('admin.messageTemplates.onlyDefaultMessage')}</TableCell>
                      <TableCell>{(row as any).createdByName || '-'}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {row.tags && row.tags.length > 0 ? (
                            row.tags.map((tag) => (
                              <Tooltip key={tag.id} title={(tag as any).description || t('tags.noDescription')} arrow>
                                <Chip
                                  label={tag.name}
                                  size="small"
                                  sx={{
                                    bgcolor: tag.color,
                                    color: '#fff',
                                    fontSize: '0.75rem',
                                    cursor: 'help'
                                  }}
                                />
                              </Tooltip>
                            ))
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              -
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleEdit(row)}><EditIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => openDeleteDialog(row)}><DeleteIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* 페이지네이션 - 데이터가 있을 때만 표시 */}
      {total > 0 && (
        <SimplePagination
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={handlePageChange}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      )}

      <Drawer
        anchor="right"
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        sx={{
          zIndex: 1300,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 600 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
        ModalProps={{
          keepMounted: false
        }}
        SlideProps={{
          onEntered: () => {
            // Drawer가 열린 후 이름 필드에 포커스
            setTimeout(() => {
              nameFieldRef.current?.focus();
            }, 100);
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}>
          <Box>
            <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
              {editing ? '메시지 템플릿 편집' : '메시지 템플릿 추가'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {editing
                ? '기존 메시지 템플릿의 정보를 수정하고 다국어 메시지를 관리할 수 있습니다.'
                : '새로운 메시지 템플릿을 생성하고 다국어 메시지를 설정할 수 있습니다.'
              }
            </Typography>
          </Box>
          <IconButton
            onClick={() => setDialogOpen(false)}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('common.name')}
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
              fullWidth
              required
              inputRef={nameFieldRef}
            />
            <FormControlLabel
              control={<Switch checked={form.isEnabled} onChange={(e) => setForm(prev => ({ ...prev, isEnabled: e.target.checked }))} />}
              label={t('admin.messageTemplates.availability')}
            />
            {/* 다국어 메시지 입력 컴포넌트 */}
            <MultiLanguageMessageInput
              defaultMessage={form.defaultMessage || ''}
              onDefaultMessageChange={(message) => setForm(prev => ({ ...prev, defaultMessage: message }))}
              defaultMessageLabel={t('admin.messageTemplates.defaultMessage')}
              defaultMessageHelperText={t('admin.messageTemplates.defaultMessageHelp')}
              defaultMessageRequired={true}
              defaultMessageError={false}

              supportsMultiLanguage={form.supportsMultiLanguage || false}
              onSupportsMultiLanguageChange={(supports) => setForm(prev => ({ ...prev, supportsMultiLanguage: supports }))}
              supportsMultiLanguageLabel={t('admin.messageTemplates.supportsMultiLanguage')}
              supportsMultiLanguageHelperText={t('admin.messageTemplates.supportsMultiLanguageHelp')}

              locales={(form.locales || []).map(l => ({ lang: l.lang as 'ko' | 'en' | 'zh', message: l.message }))}
              onLocalesChange={(locales) => setForm(prev => ({ ...prev, locales: locales.map(l => ({ lang: l.lang, message: l.message })) }))}
              languageSpecificMessagesLabel={t('admin.messageTemplates.languageSpecificMessages')}

              enableTranslation={true}
              translateButtonLabel={t('admin.messageTemplates.translate')}
              translateTooltip={t('admin.messageTemplates.translateTooltip')}
            />

            {/* 태그 선택 */}
            <TextField
              select
              multiple
              label={t('common.tags')}
              value={form.tags?.map(tag => tag.id) || []}
              onChange={(e) => {
                const selectedIds = Array.isArray(e.target.value) ? e.target.value : [e.target.value];
                const selectedTags = allTags.filter(tag => selectedIds.includes(tag.id));
                setForm(prev => ({ ...prev, tags: selectedTags }));
              }}
              SelectProps={{
                multiple: true,
                MenuProps: {
                  PaperProps: {
                    style: {
                      zIndex: 99999
                    }
                  }
                },
                renderValue: (selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as number[]).map((id) => {
                      const tag = allTags.find(t => t.id === id);
                      return tag ? (
                        <Chip
                          key={id}
                          label={tag.name}
                          size="small"
                          sx={{ bgcolor: tag.color, color: '#fff' }}
                        />
                      ) : null;
                    })}
                  </Box>
                ),
              }}
              helperText="메시지 템플릿에 적용할 태그를 선택하세요"
            >
              {allTags.map((tag) => (
                <MenuItem key={tag.id} value={tag.id}>
                  <Chip
                    label={tag.name}
                    size="small"
                    sx={{ bgcolor: tag.color, color: '#fff', mr: 1 }}
                  />
                  {tag.description || '설명 없음'}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Box>

        {/* Footer */}
        <Box sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={() => setDialogOpen(false)}
            disabled={saving}
            startIcon={<CancelIcon />}
            variant="outlined"
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
          >
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </Box>
      </Drawer>

      {/* 개별 삭제 확인 Drawer */}
      <Drawer
        anchor="right"
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 400 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('common.confirmDelete')}
          </Typography>
          <IconButton
            onClick={() => setDeleteDialogOpen(false)}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, p: 2 }}>
          <Typography>
            {t('admin.messageTemplates.confirmDelete', { name: deletingTemplate?.name })}
          </Typography>
        </Box>

        {/* Footer */}
        <Box sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            variant="outlined"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={confirmDelete}
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
          >
            {t('common.delete')}
          </Button>
        </Box>
      </Drawer>

      {/* 일괄 삭제 확인 Drawer */}
      <Drawer
        anchor="right"
        open={bulkDeleteDialogOpen}
        onClose={() => setBulkDeleteDialogOpen(false)}
        sx={{
          zIndex: 1301,
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 400 },
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        {/* Header */}
        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}>
          <Typography variant="h6" component="h2" sx={{ fontWeight: 600 }}>
            {t('common.confirmDelete')}
          </Typography>
          <IconButton
            onClick={() => setBulkDeleteDialogOpen(false)}
            size="small"
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover'
              }
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, p: 2 }}>
          <Typography>
            {t('admin.messageTemplates.confirmBulkDelete', { count: selectedIds.length })}
          </Typography>
        </Box>

        {/* Footer */}
        <Box sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 2,
          justifyContent: 'flex-end'
        }}>
          <Button
            onClick={() => setBulkDeleteDialogOpen(false)}
            variant="outlined"
          >
            {t('common.cancel')}
          </Button>
          <Button
            onClick={confirmBulkDelete}
            color="error"
            variant="contained"
            startIcon={<DeleteIcon />}
          >
            {t('common.delete')}
          </Button>
        </Box>
      </Drawer>

      {/* 태그 관리 다이얼로그 */}
      <Dialog open={tagDialogOpen} onClose={() => setTagDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {t('common.tags')} - {selectedTemplateForTags?.name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              select
              multiple
              label={t('common.selectTags')}
              value={templateTags.map(tag => tag.id)}
              onChange={(e) => {
                const selectedIds = Array.isArray(e.target.value) ? e.target.value : [e.target.value];
                const selectedTags = allTags.filter(tag => selectedIds.includes(tag.id));
                setTemplateTags(selectedTags);
              }}
              SelectProps={{
                multiple: true,
                MenuProps: {
                  PaperProps: {
                    style: {
                      zIndex: 99999
                    }
                  }
                },
                renderValue: (selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {(selected as number[]).map((id) => {
                      const tag = allTags.find(t => t.id === id);
                      return tag ? (
                        <Chip
                          key={id}
                          label={tag.name}
                          size="small"
                          sx={{ bgcolor: tag.color, color: '#fff' }}
                        />
                      ) : null;
                    })}
                  </Box>
                ),
              }}
              fullWidth
            >
              {allTags.map((tag) => (
                <MenuItem key={tag.id} value={tag.id}>
                  <Chip
                    label={tag.name}
                    size="small"
                    sx={{ bgcolor: tag.color, color: '#fff', mr: 1 }}
                  />
                  {tag.description || t('tags.noDescription')}
                </MenuItem>
              ))}
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTagDialogOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => handleSaveTags(templateTags.map(tag => tag.id))}
            variant="contained"
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MessageTemplatesPage;
