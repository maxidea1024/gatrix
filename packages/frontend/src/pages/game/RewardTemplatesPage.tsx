import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  Tooltip,
  Checkbox,
  Skeleton,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
  CardGiftcard as GiftIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import rewardTemplateService, { RewardTemplate } from '../../services/rewardTemplateService';
import SimplePagination from '../../components/common/SimplePagination';
import EmptyTableRow from '../../components/common/EmptyTableRow';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDateTimeDetailed } from '../../utils/dateFormat';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';
import RewardTemplateFormDialog from '../../components/game/RewardTemplateFormDialog';

const RewardTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // State
  const [templates, setTemplates] = useState<RewardTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [formDrawerOpen, setFormDrawerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RewardTemplate | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState<RewardTemplate | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 500);

  // Load templates
  const loadTemplates = async () => {
    setLoading(true);
    try {
      const result = await rewardTemplateService.getRewardTemplates({
        page: page + 1,
        limit: rowsPerPage,
        search: debouncedSearchTerm || undefined,
      });

      if (result && typeof result === 'object' && 'templates' in result && Array.isArray(result.templates)) {
        setTemplates(result.templates);
        // Ensure total is a valid number, default to 0 if undefined or NaN
        const totalCount = result.total;
        const validTotal = typeof totalCount === 'number' && !isNaN(totalCount) ? totalCount : 0;
        setTotal(validTotal);
      } else {
        console.error('Invalid response:', result);
        setTemplates([]);
        setTotal(0);
      }
    } catch (error: any) {
      console.error('Failed to load templates:', error);
      enqueueSnackbar(error.message || t('rewardTemplates.loadFailed'), { variant: 'error' });
      setTemplates([]);
      setTotal(0);
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, [page, rowsPerPage, debouncedSearchTerm]);

  // CRUD handlers
  const handleCreate = () => {
    setEditingTemplate(null);
    setFormDrawerOpen(true);
  };

  const handleEdit = (template: RewardTemplate) => {
    setEditingTemplate(template);
    setFormDrawerOpen(true);
  };

  const handleFormClose = () => {
    setFormDrawerOpen(false);
    setEditingTemplate(null);
  };

  const handleFormSave = async () => {
    handleFormClose();
    setPage(0);
    await loadTemplates();
  };

  const handleDeleteClick = async (template: RewardTemplate) => {
    try {
      // Check references before showing delete dialog
      const references = await rewardTemplateService.checkReferences(template.id);
      setDeletingTemplate({ ...template, references } as any);
      setDeleteConfirmOpen(true);
    } catch (error: any) {
      enqueueSnackbar(error.message || t('common.error'), { variant: 'error' });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTemplate) return;

    try {
      await rewardTemplateService.deleteRewardTemplate(deletingTemplate.id);
      enqueueSnackbar(t('rewardTemplates.deleteSuccess'), { variant: 'success' });
      setDeleteConfirmOpen(false);
      setDeletingTemplate(null);
      setPage(0);
      await loadTemplates();
    } catch (error: any) {
      enqueueSnackbar(error.message || t('rewardTemplates.deleteFailed'), { variant: 'error' });
    }
  };

  const handleRefresh = () => {
    setPage(0);
    loadTemplates();
  };

  // Selection handlers
  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedIds(templates.map(t => t.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const isAllSelected = templates.length > 0 && selectedIds.length === templates.length;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < templates.length;

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GiftIcon />
            {t('rewardTemplates.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('rewardTemplates.subtitle')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
          >
            {t('rewardTemplates.createTemplate')}
          </Button>
          <Tooltip title={t('common.refresh')}>
            <IconButton onClick={handleRefresh} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Search */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder={t('rewardTemplates.searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(0);
          }}
          size="small"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Table */}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'action.hover' }}>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={isAllSelected}
                  indeterminate={isIndeterminate}
                  onChange={handleSelectAll}
                />
              </TableCell>
              <TableCell>{t('rewardTemplates.name')}</TableCell>
              <TableCell>{t('rewardTemplates.description')}</TableCell>
              <TableCell>{t('rewardTemplates.tags')}</TableCell>
              <TableCell>{t('rewardTemplates.createdAt')}</TableCell>
              <TableCell align="right">{t('common.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && isInitialLoad ? (
              Array.from({ length: rowsPerPage }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6}>
                    <Skeleton />
                  </TableCell>
                </TableRow>
              ))
            ) : templates.length === 0 ? (
              <EmptyTableRow colSpan={6} message={t('rewardTemplates.noTemplatesFound')} />
            ) : (
              templates.map((template) => (
                <TableRow key={template.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.includes(template.id)}
                      onChange={() => handleSelectOne(template.id)}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>{template.name}</TableCell>
                  <TableCell sx={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {template.description || '-'}
                  </TableCell>
                  <TableCell>
                    {template.tags && template.tags.length > 0 ? (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {template.tags.map((tag) => (
                          <Chip key={tag} label={tag} size="small" variant="outlined" />
                        ))}
                      </Box>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>{formatDateTimeDetailed(template.createdAt)}</TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('common.edit')}>
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(template)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={t('common.delete')}>
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteClick(template)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <SimplePagination
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      </Box>

      {/* Form Dialog */}
      <RewardTemplateFormDialog
        open={formDrawerOpen}
        onClose={handleFormClose}
        onSave={handleFormSave}
        template={editingTemplate}
      />

      {/* Delete Confirm Dialog */}
      <ConfirmDeleteDialog
        open={deleteConfirmOpen}
        title={t('rewardTemplates.deleteConfirmTitle')}
        message={t('rewardTemplates.deleteConfirmMessage', { name: deletingTemplate?.name })}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setDeletingTemplate(null);
        }}
        additionalContent={
          deletingTemplate?.references && (
            <Box sx={{ mt: 2, p: 2, backgroundColor: 'warning.light', borderRadius: 1 }}>
              {(deletingTemplate.references.coupons?.length > 0 || deletingTemplate.references.surveys?.length > 0) && (
                <>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    {t('rewardTemplates.referencedBy')}
                  </Typography>
                  {deletingTemplate.references.coupons?.length > 0 && (
                    <Box sx={{ mb: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 500 }}>
                        {t('rewardTemplates.coupons')} ({deletingTemplate.references.coupons.length})
                      </Typography>
                      <Box sx={{ ml: 1 }}>
                        {deletingTemplate.references.coupons.map((coupon: any) => (
                          <Typography key={coupon.id} variant="caption" display="block">
                            • {coupon.name} ({coupon.code})
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                  )}
                  {deletingTemplate.references.surveys?.length > 0 && (
                    <Box>
                      <Typography variant="caption" sx={{ fontWeight: 500 }}>
                        {t('rewardTemplates.surveys')} ({deletingTemplate.references.surveys.length})
                      </Typography>
                      <Box sx={{ ml: 1 }}>
                        {deletingTemplate.references.surveys.map((survey: any) => (
                          <Typography key={survey.id} variant="caption" display="block">
                            • {survey.title}
                          </Typography>
                        ))}
                      </Box>
                    </Box>
                  )}
                </>
              )}
            </Box>
          )
        }
      />
    </Box>
  );
};

export default RewardTemplatesPage;

