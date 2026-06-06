import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  TextField,
  Drawer,
  useTheme,
  alpha,
} from '@mui/material';
import { Close as CloseIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { ArgusSavedQuery } from '@/services/argusService';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

/* ─── Sortable Column Item ─── */
const SortableColumnItem: React.FC<{
  id: string;
  label: string;
  checked: boolean;
  customName: string;
  isDark: boolean;
  onToggle: () => void;
  onChangeName: (val: string) => void;
}> = ({ id, label, checked, customName, isDark, onToggle, onChangeName }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Box
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      sx={{
        display: 'flex',
        alignItems: 'center',
        p: 0.5,
        mb: 0.5,
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)'}`,
        borderRadius: 1,
        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 1 : 'auto',
        position: 'relative',
      }}
    >
      <Box
        {...attributes}
        {...listeners}
        sx={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'grab',
          mr: 0.5,
          color: 'text.disabled',
          '&:active': { cursor: 'grabbing' },
        }}
      >
        <DragIndicatorIcon fontSize="small" />
      </Box>
      <FormControlLabel
        control={
          <Checkbox
            size="small"
            checked={checked}
            onChange={onToggle}
            sx={{
              p: 0.5,
              '&.Mui-checked': { color: theme.palette.primary.main },
            }}
          />
        }
        label={
          <Typography
            sx={{
              fontSize: '0.82rem',
              width: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </Typography>
        }
        sx={{ m: 0, flexShrink: 0 }}
      />
      <TextField
        size="small"
        placeholder={t('argus.logs.columnCustomName', 'Custom name')}
        value={customName}
        onChange={(e) => onChangeName(e.target.value)}
        sx={{
          flex: 1,
          ml: 1,
          '& .MuiInputBase-input': { fontSize: '0.75rem', py: 0.5, px: 1 },
        }}
      />
    </Box>
  );
};

/* ─── Edit Table Dialog ─── */

export interface EditTableDialogProps {
  open: boolean;
  availableColumns: { key: string; label: string }[];
  initialColumns: string[];
  initialNames: Record<string, string>;
  onClose: () => void;
  onSave: (columns: string[], names: Record<string, string>) => void;
}

export const EditTableDialog: React.FC<EditTableDialogProps> = ({
  open,
  availableColumns,
  initialColumns,
  initialNames,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();

  const [columns, setColumns] = useState<string[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [names, setNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      // Initialize columns order: selected ones first, then unselected available ones
      const selected = initialColumns.filter((c) =>
        availableColumns.some((a) => a.key === c)
      );
      const unselected = availableColumns
        .map((c) => c.key)
        .filter((c) => !selected.includes(c));
      setColumns([...selected, ...unselected]);

      const initChecked: Record<string, boolean> = {};
      initialColumns.forEach((c) => {
        initChecked[c] = true;
      });
      setChecked(initChecked);

      setNames({ ...initialNames });
    }
  }, [open, availableColumns, initialColumns, initialNames]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setColumns((items) => {
        const oldIndex = items.indexOf(String(active.id));
        const newIndex = items.indexOf(String(over.id));
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSave = () => {
    const orderedChecked = columns.filter((c) => checked[c]);
    onSave(orderedChecked, names);
  };

  const isDark = useTheme().palette.mode === 'dark';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2.5 } }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          fontSize: '0.95rem',
          pb: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {t('argus.logs.editTable', 'Edit Table')}
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ mb: 1.5, display: 'block' }}
        >
          {t(
            'argus.logs.editTableDesc',
            'Select columns, drag to reorder, and enter custom names to display.'
          )}
        </Typography>
        <Box sx={{ maxHeight: 400, overflow: 'auto', p: 0.5 }}>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columns}
              strategy={verticalListSortingStrategy}
            >
              {columns.map((colId) => {
                const cfg = availableColumns.find((c) => c.key === colId);
                if (!cfg) return null;
                return (
                  <SortableColumnItem
                    key={colId}
                    id={colId}
                    label={cfg.label}
                    checked={!!checked[colId]}
                    customName={names[colId] || ''}
                    isDark={isDark}
                    onToggle={() =>
                      setChecked((p) => ({ ...p, [colId]: !p[colId] }))
                    }
                    onChangeName={(val) =>
                      setNames((p) => ({ ...p, [colId]: val }))
                    }
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          onClick={onClose}
          sx={{ textTransform: 'none', fontSize: '0.78rem' }}
        >
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={columns.filter((c) => checked[c]).length === 0}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {t('common.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/* ─── Save Query Dialog ─── */

export interface SaveQueryDialogProps {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onSave: (name: string) => void;
}

export const SaveQueryDialog: React.FC<SaveQueryDialogProps> = ({
  open,
  initialName = '',
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const [localName, setLocalName] = useState(initialName ?? '');

  useEffect(() => {
    if (open) {
      setLocalName(initialName ?? '');
    }
  }, [open, initialName]);

  const safeName = localName ?? '';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2.5 } }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          fontSize: '0.95rem',
          pb: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {t('argus.logs.saveQuery', 'Save Log Query')}
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          size="small"
          autoFocus
          label={t('argus.discover.queryName', 'Query Name')}
          value={safeName}
          onChange={(e) => setLocalName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && safeName.trim()) onSave(safeName);
          }}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button
          variant="contained"
          onClick={() => onSave(safeName)}
          disabled={!safeName.trim()}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {t('common.save', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/* ─── Saved Queries Drawer ─── */

export interface SavedQueriesDrawerProps {
  open: boolean;
  queries: ArgusSavedQuery[];
  isDark: boolean;
  onClose: () => void;
  onLoad: (query: ArgusSavedQuery) => void;
  onDelete: (id: number) => void;
}

export const SavedQueriesDrawer: React.FC<SavedQueriesDrawerProps> = ({
  open,
  queries,
  isDark,
  onClose,
  onLoad,
  onDelete,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: 340, p: 2 } }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
        }}
      >
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
          {t('argus.logs.savedQueries', 'Saved Log Queries')}
        </Typography>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      {queries.length === 0 ? (
        <Typography
          sx={{
            color: 'text.disabled',
            fontSize: '0.82rem',
            textAlign: 'center',
            py: 4,
          }}
        >
          {t('argus.logs.noSavedQueries', 'No saved log queries yet')}
        </Typography>
      ) : (
        queries.map((sq) => (
          <Paper
            key={sq.id}
            elevation={0}
            sx={{
              p: 1.5,
              mb: 1,
              borderRadius: 2,
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
              cursor: 'pointer',
              '&:hover': {
                borderColor: theme.palette.primary.main,
                bgcolor: alpha(theme.palette.primary.main, 0.02),
              },
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }} onClick={() => onLoad(sq)}>
              <Typography
                sx={{
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {sq.name}
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>
                {sq.created_by} · {new Date(sq.created_at).toLocaleDateString()}
              </Typography>
            </Box>
            <IconButton
              size="small"
              onClick={() => onDelete(sq.id)}
              sx={{
                color: 'text.disabled',
                '&:hover': { color: 'error.main' },
              }}
            >
              <DeleteIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Paper>
        ))
      )}
    </Drawer>
  );
};
