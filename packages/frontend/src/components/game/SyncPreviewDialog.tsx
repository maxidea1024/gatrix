import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  CircularProgress,
  Alert,
  Checkbox,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { SyncPreviewResult, SyncAddItem, SyncUpdateItem, SyncDeleteItem } from '../../services/storeProductService';

export interface SelectedSyncItems {
  toAdd: number[];      // cmsProductId array
  toUpdate: number[];   // cmsProductId array
  toDelete: string[];   // id array
}

interface SyncPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  onApply: (selected: SelectedSyncItems) => void;
  preview: SyncPreviewResult | null;
  loading: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  productName: 'syncFieldProductName',
  price: 'syncFieldPrice',
  description: 'syncFieldDescription',
};

const SyncPreviewDialog: React.FC<SyncPreviewDialogProps> = ({
  open,
  onClose,
  onApply,
  preview,
  loading,
}) => {
  const { t } = useTranslation();

  // Selection state for each section
  const [selectedAdd, setSelectedAdd] = useState<Set<number>>(new Set());
  const [selectedUpdate, setSelectedUpdate] = useState<Set<number>>(new Set());
  const [selectedDelete, setSelectedDelete] = useState<Set<string>>(new Set());

  // Initialize selections when preview changes
  useEffect(() => {
    if (preview) {
      setSelectedAdd(new Set(preview.toAdd.map(item => item.cmsProductId)));
      setSelectedUpdate(new Set(preview.toUpdate.map(item => item.cmsProductId)));
      setSelectedDelete(new Set(preview.toDelete.map(item => item.id)));
    }
  }, [preview]);

  const hasChanges = preview && preview.summary.totalChanges > 0;
  const hasSelectedItems = selectedAdd.size > 0 || selectedUpdate.size > 0 || selectedDelete.size > 0;

  // Toggle handlers
  const handleToggleAdd = (cmsProductId: number) => {
    setSelectedAdd(prev => {
      const next = new Set(prev);
      if (next.has(cmsProductId)) {
        next.delete(cmsProductId);
      } else {
        next.add(cmsProductId);
      }
      return next;
    });
  };

  const handleToggleUpdate = (cmsProductId: number) => {
    setSelectedUpdate(prev => {
      const next = new Set(prev);
      if (next.has(cmsProductId)) {
        next.delete(cmsProductId);
      } else {
        next.add(cmsProductId);
      }
      return next;
    });
  };

  const handleToggleDelete = (id: string) => {
    setSelectedDelete(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all handlers
  const handleSelectAllAdd = (checked: boolean) => {
    if (checked && preview) {
      setSelectedAdd(new Set(preview.toAdd.map(item => item.cmsProductId)));
    } else {
      setSelectedAdd(new Set());
    }
  };

  const handleSelectAllUpdate = (checked: boolean) => {
    if (checked && preview) {
      setSelectedUpdate(new Set(preview.toUpdate.map(item => item.cmsProductId)));
    } else {
      setSelectedUpdate(new Set());
    }
  };

  const handleSelectAllDelete = (checked: boolean) => {
    if (checked && preview) {
      setSelectedDelete(new Set(preview.toDelete.map(item => item.id)));
    } else {
      setSelectedDelete(new Set());
    }
  };

  const handleApply = () => {
    onApply({
      toAdd: Array.from(selectedAdd),
      toUpdate: Array.from(selectedUpdate),
      toDelete: Array.from(selectedDelete),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{t('storeProducts.syncPreviewTitle')}</DialogTitle>
      <DialogContent dividers>
        {loading && !preview ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : preview ? (
          <Box>
            {/* Subtitle */}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t('storeProducts.syncPreviewSubtitle')}
            </Typography>

            {/* Summary */}
            <Box sx={{ mb: 3, p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('storeProducts.syncSummary')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Chip
                  icon={<AddIcon />}
                  label={`${t('storeProducts.syncToAdd')}: ${preview.summary.addCount}`}
                  color={preview.summary.addCount > 0 ? 'success' : 'default'}
                  variant="outlined"
                />
                <Chip
                  icon={<EditIcon />}
                  label={`${t('storeProducts.syncToUpdate')}: ${preview.summary.updateCount}`}
                  color={preview.summary.updateCount > 0 ? 'warning' : 'default'}
                  variant="outlined"
                />
                <Chip
                  icon={<DeleteIcon />}
                  label={`${t('storeProducts.syncToDelete')}: ${preview.summary.deleteCount}`}
                  color={preview.summary.deleteCount > 0 ? 'error' : 'default'}
                  variant="outlined"
                />
              </Box>
            </Box>

            {!hasChanges && (
              <Alert severity="info">{t('storeProducts.syncNoChanges')}</Alert>
            )}

            {/* To Add */}
            {preview.toAdd.length > 0 && (
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AddIcon color="success" />
                    {t('storeProducts.syncAddItems')} ({selectedAdd.size}/{preview.toAdd.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TableContainer sx={{ maxHeight: 440 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedAdd.size === preview.toAdd.length}
                              indeterminate={selectedAdd.size > 0 && selectedAdd.size < preview.toAdd.length}
                              onChange={(e) => handleSelectAllAdd(e.target.checked)}
                            />
                          </TableCell>
                          <TableCell>{t('storeProducts.cmsProductId')}</TableCell>
                          <TableCell>{t('storeProducts.productId')}</TableCell>
                          <TableCell>{t('storeProducts.productName')}</TableCell>
                          <TableCell align="right">{t('storeProducts.price')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {preview.toAdd.map((item) => (
                          <TableRow key={item.cmsProductId}>
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={selectedAdd.has(item.cmsProductId)}
                                onChange={() => handleToggleAdd(item.cmsProductId)}
                              />
                            </TableCell>
                            <TableCell>{item.cmsProductId}</TableCell>
                            <TableCell>{item.productCode}</TableCell>
                            <TableCell>{item.name}</TableCell>
                            <TableCell align="right">{item.price.toLocaleString()}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            )}

            {/* To Update */}
            {preview.toUpdate.length > 0 && (
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EditIcon color="warning" />
                    {t('storeProducts.syncUpdateItems')} ({selectedUpdate.size}/{preview.toUpdate.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TableContainer sx={{ maxHeight: 440 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedUpdate.size === preview.toUpdate.length}
                              indeterminate={selectedUpdate.size > 0 && selectedUpdate.size < preview.toUpdate.length}
                              onChange={(e) => handleSelectAllUpdate(e.target.checked)}
                            />
                          </TableCell>
                          <TableCell>{t('storeProducts.cmsProductId')}</TableCell>
                          <TableCell>{t('storeProducts.productId')}</TableCell>
                          <TableCell>{t('storeProducts.productName')}</TableCell>
                          <TableCell>{t('storeProducts.syncOldValue')}</TableCell>
                          <TableCell>{t('storeProducts.syncNewValue')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {preview.toUpdate.map((item) => (
                          item.changes.map((change, idx) => (
                            <TableRow key={`${item.cmsProductId}-${idx}`}>
                              {idx === 0 ? (
                                <>
                                  <TableCell rowSpan={item.changes.length} padding="checkbox">
                                    <Checkbox
                                      checked={selectedUpdate.has(item.cmsProductId)}
                                      onChange={() => handleToggleUpdate(item.cmsProductId)}
                                    />
                                  </TableCell>
                                  <TableCell rowSpan={item.changes.length}>{item.cmsProductId}</TableCell>
                                  <TableCell rowSpan={item.changes.length}>{item.productCode}</TableCell>
                                  <TableCell rowSpan={item.changes.length}>{item.name}</TableCell>
                                </>
                              ) : null}
                              <TableCell>
                                <Typography variant="caption" color="text.secondary">
                                  {t(`storeProducts.${FIELD_LABELS[change.field] || change.field}`)}:
                                </Typography>{' '}
                                {String(change.oldValue || '-')}
                              </TableCell>
                              <TableCell>
                                <Typography variant="caption" color="text.secondary">
                                  {t(`storeProducts.${FIELD_LABELS[change.field] || change.field}`)}:
                                </Typography>{' '}
                                {String(change.newValue || '-')}
                              </TableCell>
                            </TableRow>
                          ))
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            )}

            {/* To Delete */}
            {preview.toDelete.length > 0 && (
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <DeleteIcon color="error" />
                    {t('storeProducts.syncDeleteItems')} ({selectedDelete.size}/{preview.toDelete.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <TableContainer sx={{ maxHeight: 440 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedDelete.size === preview.toDelete.length}
                              indeterminate={selectedDelete.size > 0 && selectedDelete.size < preview.toDelete.length}
                              onChange={(e) => handleSelectAllDelete(e.target.checked)}
                            />
                          </TableCell>
                          <TableCell>{t('storeProducts.cmsProductId')}</TableCell>
                          <TableCell>{t('storeProducts.productId')}</TableCell>
                          <TableCell>{t('storeProducts.productName')}</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {preview.toDelete.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell padding="checkbox">
                              <Checkbox
                                checked={selectedDelete.has(item.id)}
                                onChange={() => handleToggleDelete(item.id)}
                              />
                            </TableCell>
                            <TableCell>{item.cmsProductId ?? '-'}</TableCell>
                            <TableCell>{item.productCode}</TableCell>
                            <TableCell>{item.name}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </AccordionDetails>
              </Accordion>
            )}
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          {t('storeProducts.syncCancel')}
        </Button>
        <Button
          onClick={handleApply}
          variant="contained"
          disabled={loading || !hasSelectedItems}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {t('storeProducts.syncApply')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SyncPreviewDialog;

