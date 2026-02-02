import React from "react";
import {
  Popover,
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemButton,
  Checkbox,
  ClickAwayListener,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

// Column configuration interface
export interface ColumnConfig {
  id: string;
  labelKey: string;
  visible: boolean;
  width?: string;
}

// Sortable column item component
interface SortableColumnItemProps {
  column: ColumnConfig;
  onToggleVisibility: (columnId: string) => void;
}

const SortableColumnItem: React.FC<SortableColumnItemProps> = ({
  column,
  onToggleVisibility,
}) => {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      disablePadding
      secondaryAction={
        <Box
          {...attributes}
          {...listeners}
          sx={{
            cursor: "grab",
            display: "flex",
            alignItems: "center",
            "&:active": { cursor: "grabbing" },
          }}
        >
          <DragIndicatorIcon sx={{ color: "text.disabled", fontSize: 20 }} />
        </Box>
      }
    >
      <ListItemButton
        dense
        onClick={() => onToggleVisibility(column.id)}
        sx={{ pr: 6 }}
      >
        <Checkbox
          edge="start"
          checked={column.visible}
          tabIndex={-1}
          disableRipple
          size="small"
          icon={<VisibilityOffIcon fontSize="small" />}
          checkedIcon={<VisibilityIcon fontSize="small" />}
        />
        <Typography variant="body2" sx={{ ml: 1 }}>
          {t(column.labelKey)}
        </Typography>
      </ListItemButton>
    </ListItem>
  );
};

// Main component props
interface ColumnSettingsDialogProps {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  columns: ColumnConfig[];
  onColumnsChange: (columns: ColumnConfig[]) => void;
  onReset: () => void;
}

/**
 * Reusable column settings dialog component
 * Provides drag-and-drop reordering and visibility toggle for table columns
 */
const ColumnSettingsDialog: React.FC<ColumnSettingsDialogProps> = ({
  anchorEl,
  onClose,
  columns,
  onColumnsChange,
  onReset,
}) => {
  const { t } = useTranslation();

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = columns.findIndex((col) => col.id === active.id);
      const newIndex = columns.findIndex((col) => col.id === over.id);
      const newColumns = arrayMove(columns, oldIndex, newIndex);
      onColumnsChange(newColumns);
    }
  };

  const handleToggleVisibility = (columnId: string) => {
    const newColumns = columns.map((col) =>
      col.id === columnId ? { ...col, visible: !col.visible } : col,
    );
    onColumnsChange(newColumns);
  };

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "right",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
      slotProps={{
        paper: {
          sx: {
            mt: 1,
            boxShadow: 3,
          },
        },
      }}
      hideBackdrop
      disableScrollLock
    >
      <ClickAwayListener onClickAway={onClose}>
        <Box sx={{ p: 2, minWidth: 250 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 1,
            }}
          >
            <Typography variant="subtitle2">
              {t("common.columnSettings")}
            </Typography>
            <Button size="small" onClick={onReset}>
              {t("common.reset")}
            </Button>
          </Box>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
          >
            <SortableContext
              items={columns.map((c) => c.id)}
              strategy={verticalListSortingStrategy}
            >
              <List dense>
                {columns.map((column) => (
                  <SortableColumnItem
                    key={column.id}
                    column={column}
                    onToggleVisibility={handleToggleVisibility}
                  />
                ))}
              </List>
            </SortableContext>
          </DndContext>
        </Box>
      </ClickAwayListener>
    </Popover>
  );
};

export default ColumnSettingsDialog;
