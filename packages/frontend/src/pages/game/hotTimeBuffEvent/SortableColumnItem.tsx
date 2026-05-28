import React from 'react';
import {
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  DragIndicator as DragIndicatorIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
} from '@mui/icons-material';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { ColumnConfig } from './types';

const SortableColumnItem: React.FC<{
  column: ColumnConfig;
  onToggle: (id: string) => void;
}> = ({ column, onToggle }) => {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      dense
      secondaryAction={
        <IconButton size="small" onClick={() => onToggle(column.id)}>
          {column.visible ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
        </IconButton>
      }
    >
      <ListItemIcon sx={{ minWidth: 28, cursor: 'grab' }} {...attributes} {...listeners}>
        <DragIndicatorIcon fontSize="small" color="action" />
      </ListItemIcon>
      <ListItemText
        primary={t(column.label, column.label)}
        primaryTypographyProps={{
          variant: 'body2',
          color: column.visible ? 'text.primary' : 'text.disabled',
        }}
      />
    </ListItem>
  );
};

export default SortableColumnItem;
