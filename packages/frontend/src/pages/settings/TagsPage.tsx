import React, { useEffect, useMemo, useState } from 'react';
import { Box, Typography, Card, CardContent, Button, TextField, IconButton, Stack, Chip, Tooltip, Divider, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, LinearProgress, TableSortLabel } from '@mui/material';
import { Delete as DeleteIcon, Edit as EditIcon, Save as SaveIcon, Close as CloseIcon, Autorenew as RandomIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { tagService, Tag, TagListParams } from '@/services/tagService';
import { useSnackbar } from 'notistack';
import { formatDateTimeDetailed } from '@/utils/dateFormat';

const randomHexColor = () => `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`;

const TagsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // Data/state
  const [tags, setTags] = useState<Tag[]>([]);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<TagListParams['sort']>('nameAsc');

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
  const loadTags = async (params?: TagListParams) => {
    try {
      setLoading(true);
      const items = await tagService.list(params);
      setTags(items);
    } catch {
      enqueueSnackbar(t('errors.loadError'), { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { loadTags({ sort }); }, [sort]);

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
    try {
      const updated = await tagService.update(id, { name: editName, color: editColor, description: editDescription || null });
      setTags(prev => prev.map(t => (t.id === id ? updated : t)));
      setEditingId(null);
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

  return (
    <Box sx={{ p: 3 }}>
      {/* Header toolbar */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 600, flex: 1 }}>{t('tags.title')}</Typography>
        <TextField size="small" placeholder={t('common.search')} value={query} onChange={(e)=>setQuery(e.target.value)} sx={{ maxWidth: 300 }} />
      </Box>

      {/* Create form (like GitHub new label row) */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <Chip label={newName || 'label'} sx={{ bgcolor: newColor, color: '#fff', height: 28 }} />
            <TextField label={t('tags.name')} value={newName} onChange={(e)=>setNewName(e.target.value)} sx={{ width: 260 }} />
            <TextField label={t('tags.description')} value={newDescription} onChange={(e)=>setNewDescription(e.target.value)} sx={{ flex: 1, minWidth: 220 }} />
            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title={t('common.refresh')}>
                <IconButton onClick={()=> setNewColor(randomHexColor())} color="success"><RandomIcon /></IconButton>
              </Tooltip>
              <TextField type="color" value={newColor} onChange={(e)=>setNewColor(e.target.value)} sx={{ width: 56, p: 0 }} />
              <Typography variant="body2" sx={{ minWidth: 80 }}>{newColor}</Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={()=>{ setNewName(''); setNewDescription(''); }}>{t('common.cancel')}</Button>
              <Button variant="contained" onClick={handleCreate} disabled={!newName.trim()}>{t('common.create')}</Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* List header (align with other list pages: filters on left, sort on right) */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1, gap: 1, flexWrap: 'wrap' }}>
        <TextField select size="small" label={t('common.sort')} value={sort} onChange={(e)=>setSort(e.target.value as any)} sx={{ width: 240, ml: 'auto' }}>
          <MenuItem value="nameAsc">Name A-Z</MenuItem>
          <MenuItem value="nameDesc">Name Z-A</MenuItem>
          <MenuItem value="createdAtDesc">Created (new → old)</MenuItem>
          <MenuItem value="createdAtAsc">Created (old → new)</MenuItem>
          <MenuItem value="updatedAtDesc">Updated (new → old)</MenuItem>
          <MenuItem value="updatedAtAsc">Updated (old → new)</MenuItem>
        </TextField>
      </Box>

      {/* Table list */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading && <LinearProgress />}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>{t('tags.name')}</TableCell>
                  <TableCell>{t('tags.description')}</TableCell>
                  <TableCell>
                    <TableSortLabel active={!!sort?.startsWith('createdAt')} direction={sort?.endsWith('Asc') ? 'asc' : 'desc'} onClick={() => setSort(sort?.startsWith('createdAt') && sort.endsWith('Desc') ? 'createdAtAsc' : 'createdAtDesc')}>
                      {t('common.createdAt')}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel active={!!sort?.startsWith('updatedAt')} direction={sort?.endsWith('Asc') ? 'asc' : 'desc'} onClick={() => setSort(sort?.startsWith('updatedAt') && sort.endsWith('Desc') ? 'updatedAtAsc' : 'updatedAtDesc')}>
                      {t('common.updatedAt')}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>{t('common.createdBy')}</TableCell>
                  <TableCell align="right">{t('common.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        {tags.length === 0 ? t('tags.noTags') : t('tags.noMatchingTags')}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(tag => (
                    <TableRow key={tag.id} hover>
                    <TableCell sx={{ width: 260 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip label={editingId === tag.id ? (editName || 'label') : tag.name} size="small" sx={{ bgcolor: editingId === tag.id ? editColor : tag.color, color: '#fff' }} />
                        {editingId === tag.id && (
                          <TextField size="small" value={editName} onChange={(e)=>setEditName(e.target.value)} sx={{ maxWidth: 160 }} />
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ minWidth: 300 }}>
                      {editingId === tag.id ? (
                        <TextField size="small" value={editDescription} onChange={(e)=>setEditDescription(e.target.value)} fullWidth />
                      ) : (
                        <Typography variant="body2" color="text.secondary">{tag.description || '-'}</Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ width: 180 }}>{formatDateTimeDetailed(tag.createdAt || '')}</TableCell>
                    <TableCell sx={{ width: 180 }}>{formatDateTimeDetailed(tag.updatedAt || '')}</TableCell>
                    <TableCell sx={{ width: 180 }}>{tag.createdByName || '-'}</TableCell>
                    <TableCell align="right" sx={{ width: 140 }}>
                      {editingId === tag.id ? (
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <IconButton size="small" color="primary" onClick={()=>saveEdit(tag.id)}><SaveIcon fontSize="small" /></IconButton>
                          <IconButton size="small" onClick={cancelEdit}><CloseIcon fontSize="small" /></IconButton>
                        </Stack>
                      ) : (
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <IconButton size="small" onClick={()=>startEdit(tag)}><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={()=>openDeleteDialog(tag)}><DeleteIcon fontSize="small" /></IconButton>
                        </Stack>
                      )}
                    </TableCell>
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

