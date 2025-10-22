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
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  ContentCopy as CopyIcon,
  AddCircleOutline as InsertIcon,
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
}

interface SortableItemProps {
  item: ArrayItem;
  index: number;
  elementType: VarValueType;
  onDelete: (id: string) => void;
  onChange: (id: string, value: any) => void;
}

// Sortable item component
const SortableItem: React.FC<SortableItemProps> = ({ item, index, elementType, onDelete, onChange }) => {
  const { t } = useTranslation();
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

  // Render input based on element type
  const renderInput = () => {
    switch (elementType) {
      case 'number':
        return (
          <TextField
            fullWidth
            type="number"
            value={item.value ?? ''}
            onChange={(e) => onChange(item.id, e.target.value ? parseFloat(e.target.value) : '')}
            size="small"
          />
        );
      case 'boolean':
        return (
          <TextField
            fullWidth
            select
            value={String(item.value ?? 'false')}
            onChange={(e) => onChange(item.id, e.target.value === 'true')}
            size="small"
            SelectProps={{ native: true }}
          >
            <option value="true">true</option>
            <option value="false">false</option>
          </TextField>
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
        return (
          <JsonEditor
            value={typeof item.value === 'object' ? JSON.stringify(item.value, null, 2) : item.value || '{}'}
            onChange={(newValue) => {
              try {
                const parsed = JSON.parse(newValue);
                onChange(item.id, parsed);
              } catch (e) {
                onChange(item.id, newValue);
              }
            }}
            height="100px"
          />
        );
      default: // string
        return (
          <TextField
            fullWidth
            value={item.value ?? ''}
            onChange={(e) => onChange(item.id, e.target.value)}
            size="small"
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
      <IconButton
        size="small"
        color="error"
        onClick={() => onDelete(item.id)}
        sx={{ alignSelf: elementType === 'object' ? 'flex-start' : 'center' }}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
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
  const [items, setItems] = useState<ArrayItem[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const itemIdCounter = useRef(0);

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
    const defaultValue = elementType === 'number' ? 0 
      : elementType === 'boolean' ? false
      : elementType === 'color' ? '#000000'
      : elementType === 'object' ? {}
      : '';
    
    const newItem: ArrayItem = {
      id: `item-${Date.now()}`,
      value: defaultValue,
    };
    const newItems = [...items, newItem];
    setItems(newItems);
    updateParent(newItems);
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
                />
              ))}
            </List>
          </SortableContext>
        </DndContext>

        <Button
          startIcon={<AddIcon />}
          onClick={handleAdd}
          variant="outlined"
          size="small"
          fullWidth
          sx={{ mt: items.length > 0 ? 1 : 0 }}
        >
          {t('settings.kv.addArrayElement')}
        </Button>
      </Paper>

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

