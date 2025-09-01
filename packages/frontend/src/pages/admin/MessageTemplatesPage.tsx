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
  Alert
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Close as CloseIcon,
  Cancel as CancelIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  LocalOffer as LocalOfferIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { formatDateTimeDetailed } from '@/utils/dateFormat';
import { messageTemplateService, MessageTemplate, MessageTemplateLocale, MessageTemplateType } from '@/services/messageTemplateService';
import { tagService, Tag } from '@/services/tagService';
import SimplePagination from '@/components/common/SimplePagination';

const allLangs: Array<{ code: 'ko' | 'en' | 'zh'; label: string }> = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
];

const MessageTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const [items, setItems] = useState<MessageTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 페이지네이션
  const [page, setPage] = useState(0); // SimplePagination은 0-based
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // 필터
  const [filters, setFilters] = useState<{
    type?: MessageTemplateType;
    is_enabled?: boolean;
    q?: string;
  }>({});

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
  const usedLangs = useMemo(() => new Set((form.locales || []).map(l => l.lang)), [form.locales]);
  const availableLangs = allLangs.filter(l => !usedLangs.has(l.code));
  const [newLang, setNewLang] = useState<'ko'|'en'|'zh'>('ko');
  const [newMsg, setNewMsg] = useState('');
  const getLangLabel = (code: 'ko'|'en'|'zh') => allLangs.find(l=>l.code===code)?.label || code;

  // 폼 필드 ref들
  const nameFieldRef = useRef<HTMLInputElement>(null);
  const defaultMessageFieldRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    console.log('🚀 MessageTemplate load() function called');
    setLoading(true);
    try {
      const offset = page * rowsPerPage;
      const params = {
        ...filters,
        limit: rowsPerPage,
        offset
      };

      const result = await messageTemplateService.list(params);

      console.log('🔍 Frontend received data:', result);
      console.log('🔍 Templates array:', result.templates);
      console.log('🔍 Total count:', result.total);

      setItems(result.templates);
      setTotal(result.total);
    } catch (error: any) {
      console.error('Error loading message templates:', error);
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
      console.error('Error loading tags:', error);
    }
  }, []);

  useEffect(() => {
    console.log('🚀 MessageTemplate useEffect triggered');
    load();
    loadTags();
  }, [load, loadTags]);

  // 필터 핸들러
  const handleFilterChange = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
    setPage(0);
  }, []);

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
          await messageTemplateService.update(id, { ...template, is_enabled: isEnabled });
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
    setForm({ name: '', type: 'maintenance', isEnabled: true, defaultMessage: '', locales: [], tags: [] });
    setNewLang('ko'); setNewMsg('');
    setDialogOpen(true);
  };

  const handleEdit = (row: MessageTemplate) => {
    setEditing(row);
    setForm({
      id: row.id,
      name: row.name,
      type: row.type,
      isEnabled: (row as any).isEnabled,
      defaultMessage: (row as any).defaultMessage || '',
      locales: row.locales || [],
      tags: row.tags || []
    });
    setNewLang('ko'); setNewMsg('');
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

  const addLocale = () => {
    const lang = newLang; const message = newMsg.trim();
    if (!message) return;
    setForm(prev => ({ ...prev, locales: [...(prev.locales||[]).filter(l=>l.lang!==lang), { lang, message }] }));
    setNewMsg('');
  };

  const removeLocale = (lang: 'ko'|'en'|'zh') => {
    setForm(prev => ({ ...prev, locales: (prev.locales||[]).filter(l => l.lang !== lang) }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      enqueueSnackbar('이름을 입력해주세요.', { variant: 'error' });
      nameFieldRef.current?.focus();
      return;
    }

    if (!form.defaultMessage?.trim()) {
      enqueueSnackbar('기본 메시지를 입력해주세요.', { variant: 'error' });
      defaultMessageFieldRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      const payload: MessageTemplate = {
        name: form.name.trim(),
        type: form.type,
        isEnabled: !!form.isEnabled,
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
          throw new Error('생성된 템플릿 ID를 가져올 수 없습니다.');
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
          enqueueSnackbar(`이미 존재하는 메시지 템플릿 이름입니다: "${templateName}"`, { variant: 'error' });
        } else {
          enqueueSnackbar('이미 존재하는 메시지 템플릿 이름입니다.', { variant: 'error' });
        }
      } else {
        const message = error?.response?.data?.error?.message || error?.error?.message || error?.message || '저장에 실패했습니다.';
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
            {t('common.add')}
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
                  value={filters.is_enabled?.toString() || ''}
                  label={t('admin.messageTemplates.availability')}
                  onChange={(e) => {
                    const value = e.target.value;
                    handleFilterChange({
                      ...filters,
                      is_enabled: value === '' ? undefined : value === 'true'
                    });
                  }}
                  displayEmpty
                  size="small"
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
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="primary" sx={{ fontWeight: 500 }}>
                {t('admin.messageTemplates.selectedCount', { count: selectedIds.length })}
              </Typography>
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
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading && <LinearProgress />}
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
                  <TableCell>{t('admin.maintenance.defaultMessage')}</TableCell>
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
                  <TableRow>
                    <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        {t('admin.messageTemplates.noTemplates')}
                      </Typography>
                    </TableCell>
                  </TableRow>
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
                        <Typography variant="subtitle2">{row.name}</Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 280 }}>
                        {(row as any).defaultMessage ? (
                          <Typography variant="body2" sx={{ whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                            {String((row as any).defaultMessage).replace(/\n/g, ' ')}
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            {t('admin.messageTemplates.onlyDefaultMessage')}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{(row as any).isEnabled ? t('common.available') : t('common.unavailable')}</TableCell>
                      <TableCell>{formatDateTimeDetailed((row as any).updatedAt) || '-'}</TableCell>
                      <TableCell>{hasLocales ? langs.map(c=>getLangLabel(c as any)).join(', ') : t('admin.messageTemplates.onlyDefaultMessage')}</TableCell>
                      <TableCell>{(row as any).createdByName || '-'}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {row.tags && row.tags.length > 0 ? (
                            row.tags.map((tag) => (
                              <Chip
                                key={tag.id}
                                label={tag.name}
                                size="small"
                                sx={{
                                  bgcolor: tag.color,
                                  color: '#fff',
                                  fontSize: '0.75rem'
                                }}
                              />
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

      {/* 페이지네이션 */}
      <SimplePagination
        count={total}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
      />

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? t('common.edit') : t('common.add')}</DialogTitle>
        <DialogContent>
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
            <TextField
              label={t('admin.maintenance.defaultMessage')}
              value={form.defaultMessage || ''}
              onChange={(e) => setForm(prev => ({ ...prev, defaultMessage: e.target.value }))}
              multiline
              minRows={3}
              required
              helperText={t('admin.messageTemplates.defaultMessageHelp')}
              inputRef={defaultMessageFieldRef}
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
            {(form.locales?.length ?? 0) === 0 && (
              <Typography variant="caption" color="text.secondary">
                {t('admin.maintenance.defaultMessageHint')}
              </Typography>
            )}

            {/* Dynamic language entries */}
            {availableLangs.length > 0 && (
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Select size="small" value={newLang} onChange={(e)=>setNewLang(e.target.value as any)} sx={{ minWidth: 120 }}>
                  {availableLangs.map(l => <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>)}
                </Select>
                <TextField size="small" value={newMsg} onChange={(e)=>setNewMsg(e.target.value)} label={t('admin.maintenance.perLanguageMessage')} sx={{ flex: 1 }} multiline minRows={3} />
                <Button onClick={addLocale} variant="outlined" sx={{ alignSelf: 'flex-start' }}>{t('common.add')}</Button>
              </Stack>
            )}
            <Stack spacing={1}>
              {(form.locales||[]).map(l => (
                <Box key={l.lang} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <Chip label={getLangLabel(l.lang)} size="small" sx={{ width: 96, justifyContent: 'flex-start' }} />
                  <TextField fullWidth size="small" value={l.message} onChange={(e)=>setForm(prev=>({ ...prev, locales: (prev.locales||[]).map(x=> x.lang===l.lang? { ...x, message: e.target.value }: x) }))} multiline minRows={3} />
                  <IconButton size="small" onClick={()=>removeLocale(l.lang)} sx={{ alignSelf: 'flex-start' }}><CloseIcon fontSize="small" /></IconButton>
                </Box>
              ))}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving} startIcon={<CancelIcon />}>{t('common.cancel')}</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
          >
            {saving ? t('common.saving') : t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 개별 삭제 확인 다이얼로그 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('common.confirmDelete')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('admin.messageTemplates.confirmDelete', { name: deletingTemplate?.name })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={confirmDelete} color="error" variant="contained">
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 일괄 삭제 확인 다이얼로그 */}
      <Dialog open={bulkDeleteDialogOpen} onClose={() => setBulkDeleteDialogOpen(false)}>
        <DialogTitle>{t('common.confirmDelete')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('admin.messageTemplates.confirmBulkDelete', { count: selectedIds.length })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={confirmBulkDelete} color="error" variant="contained">
            {t('common.delete')}
          </Button>
        </DialogActions>
      </Dialog>

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
