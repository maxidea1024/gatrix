import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  InputAdornment,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  MoreVert as MoreVertIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Upload as UploadIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { WhitelistService, Whitelist, CreateWhitelistData, UpdateWhitelistData } from '../../services/whitelistService';

const WhitelistPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  // State
  const [whitelists, setWhitelists] = useState<Whitelist[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [search, setSearch] = useState('');

  // Menu state
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedWhitelist, setSelectedWhitelist] = useState<Whitelist | null>(null);

  // Dialog states
  const [addDialog, setAddDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [bulkDialog, setBulkDialog] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    action: () => {},
  });

  // Form data
  const [formData, setFormData] = useState<CreateWhitelistData>({
    nickname: '',
    ipAddress: '',
    startDate: '',
    endDate: '',
    memo: '',
  });

  const [bulkData, setBulkData] = useState('');

  // Load whitelists
  const loadWhitelists = async () => {
    try {
      setLoading(true);
      const filters = search ? { search } : {};
      const result = await WhitelistService.getWhitelists(page + 1, rowsPerPage, filters);

      console.log('Whitelist load result:', result);

      // 안전한 데이터 접근
      if (result && typeof result === 'object' && Array.isArray(result.whitelists)) {
        setWhitelists(result.whitelists);
        setTotal(result.total || 0);
      } else {
        console.error('Invalid response structure:', result);
        setWhitelists([]);
        setTotal(0);
        // 오류 메시지를 사용자에게 표시하지 않음 (서버 응답 구조 문제일 수 있음)
      }
    } catch (error: any) {
      console.error('Error loading whitelists:', error);
      enqueueSnackbar(error.message || 'Failed to load whitelists', { variant: 'error' });
      setWhitelists([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWhitelists();
  }, [page, rowsPerPage, search]);

  // Handlers
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPage(0);
  };

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, whitelist: Whitelist) => {
    setAnchorEl(event.currentTarget);
    setSelectedWhitelist(whitelist);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedWhitelist(null);
  };

  const handleAdd = () => {
    setFormData({
      nickname: '',
      ipAddress: '',
      startDate: '',
      endDate: '',
      memo: '',
    });
    setAddDialog(true);
  };

  const handleEdit = () => {
    if (selectedWhitelist) {
      setFormData({
        nickname: selectedWhitelist.nickname,
        ipAddress: selectedWhitelist.ipAddress || '',
        startDate: selectedWhitelist.startDate ? selectedWhitelist.startDate.split('T')[0] : '',
        endDate: selectedWhitelist.endDate ? selectedWhitelist.endDate.split('T')[0] : '',
        memo: selectedWhitelist.memo || '',
      });
      setEditDialog(true);
    }
    handleMenuClose();
  };

  const handleDelete = () => {
    if (selectedWhitelist) {
      setConfirmDialog({
        open: true,
        title: 'Delete Whitelist Entry',
        message: `Are you sure you want to delete "${selectedWhitelist.nickname}"?`,
        action: async () => {
          try {
            await WhitelistService.deleteWhitelist(selectedWhitelist.id);
            enqueueSnackbar('Whitelist entry deleted successfully', { variant: 'success' });
            loadWhitelists();
          } catch (error: any) {
            enqueueSnackbar(error.message || 'Failed to delete whitelist entry', { variant: 'error' });
          }
          setConfirmDialog(prev => ({ ...prev, open: false }));
        },
      });
    }
    handleMenuClose();
  };

  const handleSave = async () => {
    try {
      if (editDialog && selectedWhitelist) {
        await WhitelistService.updateWhitelist(selectedWhitelist.id, formData);
        enqueueSnackbar('Whitelist entry updated successfully', { variant: 'success' });
        setEditDialog(false);
      } else {
        await WhitelistService.createWhitelist(formData);
        enqueueSnackbar('Whitelist entry created successfully', { variant: 'success' });
        setAddDialog(false);
      }

      // 안전하게 목록 다시 로드
      setTimeout(() => {
        loadWhitelists();
      }, 100);
    } catch (error: any) {
      console.error('Error saving whitelist:', error);
      enqueueSnackbar(error.message || 'Failed to save whitelist entry', { variant: 'error' });
    }
  };

  const handleBulkCreate = async () => {
    try {
      const lines = bulkData.trim().split('\n').filter(line => line.trim());
      const entries = lines.map(line => {
        const parts = line.split('\t'); // Tab-separated values
        return {
          nickname: parts[0]?.trim() || '',
          ipAddress: parts[1]?.trim() || undefined,
          memo: parts[2]?.trim() || undefined,
        };
      }).filter(entry => entry.nickname);

      if (entries.length === 0) {
        enqueueSnackbar('No valid entries found', { variant: 'warning' });
        return;
      }

      const result = await WhitelistService.bulkCreateWhitelists(entries);
      enqueueSnackbar(`Successfully created ${result.createdCount} entries`, { variant: 'success' });
      setBulkDialog(false);
      setBulkData('');
      loadWhitelists();
    } catch (error: any) {
      enqueueSnackbar(error.message || 'Failed to bulk create entries', { variant: 'error' });
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, mb: 1 }}>
            Whitelist Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage user whitelist entries
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => setBulkDialog(true)}
          >
            Bulk Import
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAdd}
          >
            Add Entry
          </Button>
        </Box>
      </Box>

      {/* Search */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            placeholder={t('whitelist.searchPlaceholder') || 'Search by nickname, IP address, or memo...'}
            value={search}
            onChange={handleSearchChange}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              },
            }}
          />
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent sx={{ p: 0 }}>
          {loading && <LinearProgress />}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Nickname</TableCell>
                  <TableCell>IP Address</TableCell>
                  <TableCell>Allow Period</TableCell>
                  <TableCell>Created By</TableCell>
                  <TableCell>Created At</TableCell>
                  <TableCell>Memo</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {whitelists.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      No whitelist entries found
                    </TableCell>
                  </TableRow>
                ) : (
                  whitelists.map((whitelist) => (
                    <TableRow key={whitelist.id}>
                      <TableCell>{whitelist.id}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {whitelist.nickname}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {whitelist.ipAddress ? (
                          <Chip label={whitelist.ipAddress} size="small" />
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Any IP
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {whitelist.startDate || whitelist.endDate ? (
                          <Box>
                            <Typography variant="body2">
                              {formatDate(whitelist.startDate)} - {formatDate(whitelist.endDate)}
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Permanent
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {whitelist.createdByName || `User ${whitelist.createdBy}`}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(whitelist.createdAt)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {whitelist.memo || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, whitelist)}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={handleChangePage}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </CardContent>
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleEdit}>
          <EditIcon sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <DeleteIcon sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Add/Edit Dialog */}
      <Dialog open={addDialog || editDialog} onClose={() => { setAddDialog(false); setEditDialog(false); }} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editDialog ? 'Edit Whitelist Entry' : 'Add Whitelist Entry'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              fullWidth
              label="Nickname"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="IP Address (Optional)"
              value={formData.ipAddress}
              onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
              placeholder="Leave empty for any IP"
            />
            <TextField
              fullWidth
              label="Start Date (Optional)"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              fullWidth
              label="End Date (Optional)"
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              fullWidth
              label="Memo (Optional)"
              value={formData.memo}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              multiline
              rows={3}
              placeholder="Additional notes..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAddDialog(false); setEditDialog(false); }}>
            Cancel
          </Button>
          <Button onClick={handleSave} variant="contained">
            {editDialog ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={bulkDialog} onClose={() => setBulkDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Bulk Import Whitelist Entries</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Enter one entry per line in the format: Nickname [Tab] IP Address [Tab] Memo
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Example: JohnDoe	192.168.1.100	VIP User
            </Typography>
          </Box>
          <TextField
            fullWidth
            multiline
            rows={10}
            value={bulkData}
            onChange={(e) => setBulkData(e.target.value)}
            placeholder="JohnDoe	192.168.1.100	VIP User&#10;JaneSmith		Regular User&#10;AdminUser	10.0.0.1	Administrator"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleBulkCreate} variant="contained">
            Import
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.message}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))}>
            Cancel
          </Button>
          <Button onClick={confirmDialog.action} color="error" variant="contained">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WhitelistPage;
