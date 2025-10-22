import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  IconButton,
  List,
  ListItem,
  Paper,
  TextField,
  Typography,
  Alert,
  Switch,
  FormControlLabel,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  ContentCopy as CopyIcon,
  AddCircleOutline as InsertIcon,
  Straighten as ResizeIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { useTranslation } from 'react-i18next';
import { MuiColorInput } from 'mui-color-input';
import JsonEditor from './JsonEditor';
import { VarValueType } from '@/services/varsService';
import { useTheme } from '@mui/material/styles';
import { useSnackbar } from 'notistack';

interface ArrayEditorProps {
  value: string; // JSON string
  onChange: (value: string) => void;
  elementType: VarValueType;
  label?: string;
  helperText?: string;
  error?: string;
}

interface ArrayItem {
  id: string;
  value: any;
  shouldFocus?: boolean;
}

interface SortableItemProps {
  item: ArrayItem;
  index: number;
  elementType: VarValueType;
  onDelete: (id: string) => void;
  onChange: (id: string, value: any) => void;
  onDuplicate: (id: string) => void;
  onInsertBefore: (id: string) => void;
  onInsertAfter: (id: string) => void;
  onEditObject?: (id: string) => void;
}

// Sortable item component
const SortableItem: React.FC<SortableItemProps> = ({
  item,
  index,
  elementType,
  onDelete,
  onChange,
  onDuplicate,
  onInsertBefore,
  onInsertAfter,
  onEditObject
}) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Auto-focus on newly added items
  useEffect(() => {
    if (item.shouldFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [item.shouldFocus]);

  // Render input based on element type
  const renderInput = () => {
    switch (elementType) {
      case 'number':
        return (
          <TextField
            fullWidth
            type="text"
            inputMode="numeric"
            value={item.value ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              // Allow empty, negative sign, and valid numbers
              if (val === '' || val === '-' || !isNaN(Number(val))) {
                onChange(item.id, val === '' || val === '-' ? '' : parseFloat(val));
              }
            }}
            size="small"
            inputRef={inputRef}
            sx={{
              '& input[type=text]::-webkit-outer-spin-button, & input[type=text]::-webkit-inner-spin-button': {
                display: 'none',
              },
            }}
          />
        );
      case 'boolean':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={item.value === true || item.value === 'true'}
                  onChange={(e) => onChange(item.id, e.target.checked)}
                  size="small"
                />
              }
              label={item.value === true || item.value === 'true' ? 'true' : 'false'}
              sx={{ m: 0 }}
            />
          </Box>
        );
      case 'color':
        return (
          <MuiColorInput
            fullWidth
            value={item.value || '#000000'}
            onChange={(color) => onChange(item.id, color)}
            format="hex"
            size="small"
          />
        );
      case 'object':
        const jsonStr = typeof item.value === 'object' ? JSON.stringify(item.value) : item.value || '{}';
        const displayStr = jsonStr.length > 50 ? jsonStr.substring(0, 50) + '...' : jsonStr;
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
            <TextField
              fullWidth
              value={displayStr}
              placeholder="{}"
              size="small"
              InputProps={{
                readOnly: true,
                sx: {
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                },
              }}
              onClick={() => onEditObject?.(item.id)}
            />
            <Tooltip title={t('common.edit')}>
              <IconButton
                size="small"
                onClick={() => onEditObject?.(item.id)}
                color="primary"
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      default: // string
        return (
          <TextField
            fullWidth
            value={item.value ?? ''}
            onChange={(e) => onChange(item.id, e.target.value)}
            size="small"
            inputRef={inputRef}
          />
        );
    }
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      sx={{
        display: 'flex',
        gap: 1,
        p: 1,
        mb: 1,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        '&:hover': {
          bgcolor: 'action.hover',
        },
      }}
    >
      <Box
        sx={{
          minWidth: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'text.secondary',
          fontWeight: 'bold',
          fontSize: '0.875rem',
        }}
      >
        {index}
      </Box>
      <Box
        {...attributes}
        {...listeners}
        sx={{
          cursor: 'grab',
          display: 'flex',
          alignItems: 'center',
          color: 'text.secondary',
          '&:active': {
            cursor: 'grabbing',
          },
        }}
      >
        <DragIcon />
      </Box>
      <Box sx={{ flex: 1 }}>
        {renderInput()}
      </Box>
      <Box sx={{ display: 'flex', gap: 0.5, alignSelf: 'center' }}>
        <Tooltip title={t('settings.kv.duplicateElement')}>
          <IconButton
            size="small"
            onClick={() => onDuplicate(item.id)}
          >
            <CopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('settings.kv.insertBefore')}>
          <IconButton
            size="small"
            onClick={() => onInsertBefore(item.id)}
          >
            <InsertIcon fontSize="small" sx={{ transform: 'rotate(180deg)' }} />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('settings.kv.insertAfter')}>
          <IconButton
            size="small"
            onClick={() => onInsertAfter(item.id)}
          >
            <InsertIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={t('common.delete')}>
          <IconButton
            size="small"
            color="error"
            onClick={() => onDelete(item.id)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </ListItem>
  );
};

const ArrayEditor: React.FC<ArrayEditorProps> = ({
  value,
  onChange,
  elementType,
  label,
  helperText,
  error,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { enqueueSnackbar } = useSnackbar();
  const [items, setItems] = useState<ArrayItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const itemIdCounter = useRef(0);
  const [resizeDialogOpen, setResizeDialogOpen] = useState(false);
  const [resizeValue, setResizeValue] = useState('');
  const [fillDialogOpen, setFillDialogOpen] = useState(false);
  const [fillValue, setFillValue] = useState('');
  const [objectEditorOpen, setObjectEditorOpen] = useState(false);
  const [editingObjectId, setEditingObjectId] = useState<string | null>(null);
  const [editingObjectValue, setEditingObjectValue] = useState('');

  // Parse JSON value to items (only on initial load or when value changes externally)
  useEffect(() => {
    try {
      const parsed = JSON.parse(value || '[]');
      if (Array.isArray(parsed)) {
        // Only update if the values are actually different
        const currentValues = items.map(item => item.value);
        const valuesChanged = JSON.stringify(currentValues) !== JSON.stringify(parsed);

        if (valuesChanged) {
          const newItems = parsed.map((val, idx) => ({
            id: `item-${itemIdCounter.current++}-${idx}`,
            value: val,
          }));
          setItems(newItems);
        }
        setParseError(null);
      } else {
        setParseError(t('settings.kv.invalidArrayFormat'));
      }
    } catch (e) {
      setParseError(t('settings.kv.invalidJson'));
    }
  }, [value, t]);

  // Update parent when items change
  const updateParent = (newItems: ArrayItem[]) => {
    const values = newItems.map(item => item.value);
    onChange(JSON.stringify(values, null, 2));
  };

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      const newItems = arrayMove(items, oldIndex, newIndex);
      setItems(newItems);
      updateParent(newItems);
    }
  };

  const handleAdd = () => {
    // Copy last element if exists, otherwise use default value
    let valueToAdd;
    if (items.length > 0) {
      valueToAdd = items[items.length - 1].value;
    } else {
      valueToAdd = elementType === 'number' ? 0
        : elementType === 'boolean' ? false
        : elementType === 'color' ? '#000000'
        : elementType === 'object' ? {}
        : '';
    }

    const newItem: ArrayItem = {
      id: `item-${Date.now()}`,
      value: valueToAdd,
      shouldFocus: true,
    };
    const newItems = [...items, newItem];
    setItems(newItems);
    updateParent(newItems);

    // Clear shouldFocus flag after a short delay
    setTimeout(() => {
      setItems(prev => prev.map(item => ({ ...item, shouldFocus: false })));
    }, 100);
  };

  const handleDelete = (id: string) => {
    const newItems = items.filter(item => item.id !== id);
    setItems(newItems);
    updateParent(newItems);
  };

  const handleChange = (id: string, newValue: any) => {
    const newItems = items.map(item =>
      item.id === id ? { ...item, value: newValue } : item
    );
    setItems(newItems);
    updateParent(newItems);
  };

  const handleDuplicate = (id: string) => {
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return;

    const duplicatedItem: ArrayItem = {
      id: `item-${Date.now()}`,
      value: items[index].value,
      shouldFocus: true,
    };
    const newItems = [...items.slice(0, index + 1), duplicatedItem, ...items.slice(index + 1)];
    setItems(newItems);
    updateParent(newItems);

    // Clear shouldFocus flag after a short delay
    setTimeout(() => {
      setItems(prev => prev.map(item => ({ ...item, shouldFocus: false })));
    }, 100);
  };

  const handleInsertBefore = (id: string) => {
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return;

    // Copy the current item's value
    const newItem: ArrayItem = {
      id: `item-${Date.now()}`,
      value: items[index].value,
      shouldFocus: true,
    };
    const newItems = [...items.slice(0, index), newItem, ...items.slice(index)];
    setItems(newItems);
    updateParent(newItems);

    // Clear shouldFocus flag after a short delay
    setTimeout(() => {
      setItems(prev => prev.map(item => ({ ...item, shouldFocus: false })));
    }, 100);
  };

  const handleInsertAfter = (id: string) => {
    const index = items.findIndex(item => item.id === id);
    if (index === -1) return;

    // Copy the current item's value
    const newItem: ArrayItem = {
      id: `item-${Date.now()}`,
      value: items[index].value,
      shouldFocus: true,
    };
    const newItems = [...items.slice(0, index + 1), newItem, ...items.slice(index + 1)];
    setItems(newItems);
    updateParent(newItems);

    // Clear shouldFocus flag after a short delay
    setTimeout(() => {
      setItems(prev => prev.map(item => ({ ...item, shouldFocus: false })));
    }, 100);
  };

  const handleResize = () => {
    const targetSize = parseInt(resizeValue, 10);
    if (isNaN(targetSize) || targetSize < 0) {
      return;
    }

    const currentSize = items.length;

    if (targetSize === currentSize) {
      // No change
      setResizeDialogOpen(false);
      return;
    }

    if (targetSize > currentSize) {
      // Expand: add elements by copying the last element
      const lastValue = items.length > 0
        ? items[items.length - 1].value
        : (elementType === 'number' ? 0
          : elementType === 'boolean' ? false
          : elementType === 'color' ? '#000000'
          : elementType === 'object' ? {}
          : '');

      const newItems = [...items];
      for (let i = currentSize; i < targetSize; i++) {
        newItems.push({
          id: `item-${Date.now()}-${i}`,
          value: lastValue,
        });
      }
      setItems(newItems);
      updateParent(newItems);
    } else {
      // Shrink: remove elements from the end
      const newItems = items.slice(0, targetSize);
      setItems(newItems);
      updateParent(newItems);
    }

    setResizeDialogOpen(false);
    setResizeValue('');
  };

  const handleOpenResize = () => {
    setResizeValue(items.length.toString());
    setResizeDialogOpen(true);
  };

  const handleOpenFill = () => {
    // Set default fill value based on element type
    const defaultValue = elementType === 'number' ? '0'
      : elementType === 'boolean' ? 'false'
      : elementType === 'color' ? '#000000'
      : elementType === 'object' ? '{}'
      : '';
    setFillValue(defaultValue);
    setFillDialogOpen(true);
  };

  const handleFill = () => {
    if (items.length === 0) {
      setFillDialogOpen(false);
      return;
    }

    let parsedValue: any;

    // Parse value based on element type
    try {
      switch (elementType) {
        case 'number':
          parsedValue = fillValue === '' || fillValue === '-' ? '' : parseFloat(fillValue);
          if (isNaN(parsedValue)) {
            enqueueSnackbar(t('settings.kv.invalidNumber'), { variant: 'error' });
            return;
          }
          break;
        case 'boolean':
          parsedValue = fillValue === 'true';
          break;
        case 'color':
          parsedValue = fillValue;
          break;
        case 'object':
          parsedValue = JSON.parse(fillValue);
          break;
        default: // string
          parsedValue = fillValue;
      }
    } catch (e) {
      enqueueSnackbar(t('settings.kv.invalidJson'), { variant: 'error' });
      return;
    }

    // Fill all items with the parsed value
    const newItems = items.map(item => ({
      ...item,
      value: parsedValue,
    }));

    setItems(newItems);
    updateParent(newItems);
    setFillDialogOpen(false);
  };

  const handleOpenObjectEditor = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;

    const jsonStr = typeof item.value === 'object' ? JSON.stringify(item.value, null, 2) : item.value || '{}';
    setEditingObjectId(id);
    setEditingObjectValue(jsonStr);
    setObjectEditorOpen(true);
  };

  const handleSaveObject = () => {
    if (!editingObjectId) return;

    try {
      const parsed = JSON.parse(editingObjectValue);
      const index = items.findIndex(i => i.id === editingObjectId);
      if (index !== -1) {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], value: parsed };
        setItems(newItems);
        updateParent(newItems);
      }
      setObjectEditorOpen(false);
      setEditingObjectId(null);
      setEditingObjectValue('');
    } catch (e) {
      enqueueSnackbar(t('settings.kv.invalidJson'), { variant: 'error' });
    }
  };

  return (
    <Box>
      {label && (
        <Typography variant="subtitle2" gutterBottom>
          {label}
        </Typography>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        {parseError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {parseError}
          </Alert>
        ) : null}

        <Box
          sx={{
            maxHeight: '400px',
            overflowY: 'auto',
            overflowX: 'hidden',
            mb: items.length > 0 ? 1 : 0,
            // Custom scrollbar styling matching chat message list
            '&::-webkit-scrollbar': {
              width: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
              borderRadius: '4px',
              '&:hover': {
                background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)',
              },
            },
            '&::-webkit-scrollbar-thumb:active': {
              background: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)',
            },
            // Firefox scrollbar styling
            scrollbarWidth: 'thin',
            scrollbarColor: theme.palette.mode === 'dark'
              ? 'rgba(255, 255, 255, 0.2) transparent'
              : 'rgba(0, 0, 0, 0.2) transparent',
          }}
        >
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext
              items={items.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <List disablePadding>
                {items.map((item, index) => (
                  <SortableItem
                    key={item.id}
                    item={item}
                    index={index}
                    elementType={elementType}
                    onDelete={handleDelete}
                    onChange={handleChange}
                    onDuplicate={handleDuplicate}
                    onInsertBefore={handleInsertBefore}
                    onInsertAfter={handleInsertAfter}
                    onEditObject={handleOpenObjectEditor}
                  />
                ))}
              </List>
            </SortableContext>
          </DndContext>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
            {t('settings.kv.arrayElementCount', { count: items.length })}
          </Typography>
          <Button
            startIcon={<AddIcon />}
            onClick={handleAdd}
            variant="outlined"
            size="small"
            sx={{ flex: 1 }}
          >
            {t('settings.kv.addArrayElement')}
          </Button>
          <Button
            startIcon={<ResizeIcon />}
            variant="outlined"
            size="small"
            onClick={handleOpenResize}
          >
            {t('settings.kv.resizeArray')}
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={handleOpenFill}
            disabled={items.length === 0}
          >
            {t('settings.kv.fillWith')}
          </Button>
        </Box>
      </Paper>

      {/* Resize Dialog */}
      <Dialog open={resizeDialogOpen} onClose={() => setResizeDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('settings.kv.resizeArray')}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            type="text"
            inputMode="numeric"
            label={t('settings.kv.arraySize')}
            value={resizeValue}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '' || (!isNaN(Number(val)) && Number(val) >= 0)) {
                setResizeValue(val);
              }
            }}
            helperText={t('settings.kv.arraySizeHelp')}
            sx={{
              mt: 2,
              '& input[type=text]::-webkit-outer-spin-button, & input[type=text]::-webkit-inner-spin-button': {
                display: 'none',
              },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResizeDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleResize} variant="contained">{t('common.ok')}</Button>
        </DialogActions>
      </Dialog>

      {/* Fill Dialog */}
      <Dialog open={fillDialogOpen} onClose={() => setFillDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('settings.kv.fillWith')}</DialogTitle>
        <DialogContent>
          {elementType === 'boolean' ? (
            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={fillValue === 'true'}
                    onChange={(e) => setFillValue(e.target.checked ? 'true' : 'false')}
                  />
                }
                label={fillValue === 'true' ? 'true' : 'false'}
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                {t('settings.kv.fillWithHelp')}
              </Typography>
            </Box>
          ) : elementType === 'color' ? (
            <Box sx={{ mt: 2 }}>
              <MuiColorInput
                fullWidth
                value={fillValue}
                onChange={(color) => setFillValue(color)}
                format="hex"
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                {t('settings.kv.fillWithHelp')}
              </Typography>
            </Box>
          ) : elementType === 'object' ? (
            <Box sx={{ mt: 2 }}>
              <JsonEditor
                value={fillValue}
                onChange={setFillValue}
                height={300}
              />
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                {t('settings.kv.fillWithHelp')}
              </Typography>
            </Box>
          ) : (
            <TextField
              autoFocus
              fullWidth
              type="text"
              inputMode={elementType === 'number' ? 'numeric' : 'text'}
              label={t('settings.kv.fillValue')}
              value={fillValue}
              onChange={(e) => setFillValue(e.target.value)}
              helperText={t('settings.kv.fillWithHelp')}
              sx={{
                mt: 2,
                '& input[type=text]::-webkit-outer-spin-button, & input[type=text]::-webkit-inner-spin-button': {
                  display: 'none',
                },
              }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFillDialogOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleFill} variant="contained">{t('common.ok')}</Button>
        </DialogActions>
      </Dialog>

      {/* Object Editor Dialog */}
      <Dialog
        open={objectEditorOpen}
        onClose={() => setObjectEditorOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{t('settings.kv.editObject')}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <JsonEditor
              value={editingObjectValue}
              onChange={setEditingObjectValue}
              height={400}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setObjectEditorOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleSaveObject} variant="contained">{t('common.save')}</Button>
        </DialogActions>
      </Dialog>

      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}

      {helperText && !error && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {helperText}
        </Typography>
      )}
    </Box>
  );
};

export default ArrayEditor;

