import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/types/permissions';
import { Box, Typography, Card, CardContent, Button, TextField, IconButton, Stack, Chip, Tooltip, Divider, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, LinearProgress } from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, Save as SaveIcon, Close as CloseIcon, Autorenew as RandomIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { tagService, Tag } from '@/services/tagService';
import { useSnackbar } from 'notistack';
import EmptyTableRow from '@/components/common/EmptyTableRow';
import { TableLoadingRow } from '@/components/common/TableLoadingRow';
import { formatDateTimeDetailed } from '@/utils/dateFormat';
import { ColorPicker } from '@/components/common/ColorPicker';
import { getContrastColor } from '@/utils/colorUtils';

const randomHexColor = () => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;

const TagsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { hasPermission } = useAuth();
  const canManage = hasPermission([PERMISSIONS.TAGS_MANAGE]);

  // Data/state
  const [tags, setTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState('');
  const nameInputRef = React.useRef<HTMLInputElement>(null);

  // Delete confirm dialog
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  const [confirmName, setConfirmName] = useState('');

  const [loading, setLoading] = useState(false);

  // Create form
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#23dd67');
  const [newDescription, setNewDescription] = useState('');

  // Inline edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#607D8B');
  const [editDescription, setEditDescription] = useState('');

  // Load
  const loadTags = async () => {
    try {
      setLoading(true);
      const items = await tagService.list();
      setTags(items);
    } catch {
      enqueueSnackbar(t('errors.loadError'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadTags(); }, []);

  // Derived
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tags.filter(x => !q || x.name.toLowerCase().includes(q) || (x.description || '').toLowerCase().includes(q));
  }, [tags, query]);

  // Create actions
  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const tag = await tagService.create({ name, color: newColor, description: newDescription || null });
      setTags(prev => [...prev, tag]);
      setNewName('');
      setNewDescription('');
      enqueueSnackbar(t('common.success'), { variant: 'success' });
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message;
      if (msg && /exists/i.test(msg)) {
        enqueueSnackbar(t('tags.duplicateName'), { variant: 'error' });
      } else {
        enqueueSnackbar(msg || t('errors.saveError'), { variant: 'error' });
      }
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await tagService.remove(id);
      setTags(prev => prev.filter(t => t.id !== id));
      enqueueSnackbar(t('common.success'), { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.error?.message || t('errors.deleteError'), { variant: 'error' });
    }
  };

  const openDeleteDialog = (tag: Tag) => { setDeleteTarget(tag); setConfirmName(''); };
  const closeDeleteDialog = () => { setDeleteTarget(null); setConfirmName(''); };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await handleDelete(deleteTarget.id);
    closeDeleteDialog();
  };

  const startEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
    setEditDescription(tag.description || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: number) => {
    const name = editName.trim();
    if (!name) {
      enqueueSnackbar(t('tags.nameRequired'), { variant: 'error' });
      return;
    }

    try {
      const updated = await tagService.update(id, { name, color: editColor, description: editDescription || null });
      setTags(prev => prev.map(t => (t.id === id ? updated : t)));
      setEditingId(null);
      enqueueSnackbar(t('common.success'), { variant: 'success' });
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message;
      if (msg && /exists/i.test(msg)) {
        enqueueSnackbar(t('tags.duplicateName'), { variant: 'error' });
      } else if (msg && /required/i.test(msg)) {
        enqueueSnackbar(t('tags.nameRequired'), { variant: 'error' });
      } else {
        enqueueSnackbar(msg || t('errors.saveError'), { variant: 'error' });
      }
    }
  };

  const handleSaveEdit = () => {
    if (editingId !== null) {
      saveEdit(editingId);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, flex: 1 }}>{t('tags.title')}</Typography>
        <TextField size="small" placeholder={t('common.search')} value={query} onChange={(e) => setQuery(e.target.value)} sx={{ maxWidth: 300 }} />
      </Box>

      {/* Create form (like GitHub new label row) */}
      {canManage && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
              <Tooltip title={newDescription || t('tags.noDescription')} arrow>
                <Chip label={newName || 'label'} sx={{ bgcolor: newColor, color: getContrastColor(newColor), height: 28, cursor: 'help' }} />
              </Tooltip>
              <TextField
                inputRef={nameInputRef}
                label={t('tags.name')}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newName.trim()) {
                    handleCreate();
                  }
                }}
                sx={{ width: 260 }}
              />
              <TextField
                label={t('tags.description')}
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newName.trim()) {
                    handleCreate();
                  }
                }}
                sx={{ flex: 1, minWidth: 220 }}
              />
              <Stack direction="row" spacing={1} alignItems="center">
                <ColorPicker
                  value={newColor}
                  onChange={setNewColor}
                  label={t('common.color')}
                />
                <Typography variant="body2" sx={{ minWidth: 80 }}>{newColor}</Typography>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={() => { setNewName(''); setNewDescription(''); }}>{t('common.cancel')}</Button>
                <Button variant="contained" onClick={handleCreate} disabled={!newName.trim()}>{t('tags.addTag')}</Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* Table list */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('tags.name')}</TableCell>
                  <TableCell>{t('tags.description')}</TableCell>
                  <TableCell sx={{ width: 100 }}>{t('common.color')}</TableCell>
                  <TableCell>{t('common.createdAt')}</TableCell>
                  <TableCell>{t('common.updatedAt')}</TableCell>
                  <TableCell>{t('common.createdBy')}</TableCell>
                  {canManage && <TableCell align="right">{t('common.actions')}</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && filtered.length === 0 ? (
                  <TableLoadingRow colSpan={7} loading={loading} />
                ) : filtered.length === 0 ? (
                  <EmptyTableRow
                    colSpan={7}
                    loading={loading}
                    message={tags.length === 0 ? t('tags.noTagsFound') : t('tags.noMatchingTags')}
                    loadingMessage={t('common.loadingData')}
                    subtitle={canManage && tags.length === 0 ? t('common.addFirstItem') : undefined}
                    onAddClick={canManage && tags.length === 0 ? () => nameInputRef.current?.focus() : undefined}
                    addButtonLabel={t('tags.addTag')}
                  />
                ) : (
                  filtered.map(tag => (
                    <TableRow key={tag.id} hover>
                      <TableCell sx={{ width: 260 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {editingId === tag.id ? (
                            <Chip label={editName || 'label'} size="small" sx={{ bgcolor: editColor, color: getContrastColor(editColor) }} />
                          ) : (
                            <Tooltip title={tag.description || t('tags.noDescription')} arrow>
                              <Chip label={tag.name} size="small" sx={{ bgcolor: tag.color, color: getContrastColor(tag.color), cursor: 'help' }} />
                            </Tooltip>
                          )}
                          {editingId === tag.id && (
                            <TextField
                              size="small"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveEdit();
                                } else if (e.key === 'Escape') {
                                  cancelEdit();
                                }
                              }}
                              sx={{ maxWidth: 160 }}
                            />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ minWidth: 300 }}>
                        {editingId === tag.id ? (
                          <TextField
                            size="small"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveEdit();
                              } else if (e.key === 'Escape') {
                                cancelEdit();
                              }
                            }}
                            fullWidth
                          />
                        ) : (
                          <Typography variant="body2" color="text.secondary">{tag.description || '-'}</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ width: 100 }}>
                        {editingId === tag.id ? (
                          <ColorPicker
                            value={editColor}
                            onChange={setEditColor}
                            label={t('common.color')}
                            size="small"
                          />
                        ) : (
                          <Box
                            sx={{
                              width: 32,
                              height: 32,
                              bgcolor: tag.color,
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: 'divider',
                            }}
                          />
                        )}
                      </TableCell>
                      <TableCell sx={{ width: 180 }}>{formatDateTimeDetailed(tag.createdAt || '')}</TableCell>
                      <TableCell sx={{ width: 180 }}>{formatDateTimeDetailed(tag.updatedAt || '')}</TableCell>
                      <TableCell sx={{ width: 180 }}>
                        {tag.createdByName ? (
                          <Box>
                            <Typography variant="body2">{tag.createdByName}</Typography>
                            {tag.createdByEmail && (
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                                {tag.createdByEmail}
                              </Typography>
                            )}
                          </Box>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      {canManage && (
                        <TableCell align="right" sx={{ width: 140 }}>
                          {editingId === tag.id ? (
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <IconButton size="small" color="primary" onClick={() => saveEdit(tag.id)} disabled={!editName.trim()}><SaveIcon fontSize="small" /></IconButton>
                              <IconButton size="small" onClick={cancelEdit}><CloseIcon fontSize="small" /></IconButton>
                            </Stack>
                          ) : (
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <IconButton size="small" onClick={() => startEdit(tag)}><EditIcon fontSize="small" /></IconButton>
                              <IconButton size="small" color="error" onClick={() => openDeleteDialog(tag)}><DeleteIcon fontSize="small" /></IconButton>
                            </Stack>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onClose={closeDeleteDialog}>
        <DialogTitle>{t('common.confirmDelete')}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>
            {t('tags.confirmDeleteMessage', { name: deleteTarget?.name })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog}>{t('common.cancel')}</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>{t('common.delete')}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TagsPage;

