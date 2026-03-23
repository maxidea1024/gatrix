import React, { useState, useEffect, useRef } from 'react';
import {
  Autocomplete,
  TextField,
  Chip,
  Tooltip,
  Box,
  Typography,
  Stack,
  Popover,
  Button,
  IconButton,
  createFilterOptions,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { tagService, Tag } from '@/services/tagService';
import { getContrastColor } from '@/utils/colorUtils';
import { ColorPicker } from '@/components/common/ColorPicker';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { useAuth } from '@/hooks/useAuth';
import { P } from '@/types/permissions';

// Extended option type for "create new" entry
interface TagOption extends Tag {
  isCreateOption?: boolean;
  inputValue?: string;
}

interface TagSelectorProps {
  /** Currently selected tags */
  value: Tag[];
  /** Callback when tags change */
  onChange: (tags: Tag[]) => void;
  /** Input label */
  label?: string;
  /** Input placeholder */
  placeholder?: string;
  /** Disable the selector */
  disabled?: boolean;
  /** Allow inline tag creation (defaults to hasPermission(P.TAGS_UPDATE)) */
  canCreate?: boolean;
}

const filter = createFilterOptions<TagOption>();

const randomHexColor = () =>
  `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0')}`;

const TagSelector: React.FC<TagSelectorProps> = ({
  value,
  onChange,
  label,
  placeholder,
  disabled = false,
  canCreate,
}) => {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();
  const { getProjectApiPath } = useOrgProject();
  const projectApiPath = getProjectApiPath();

  const allowManage = canCreate ?? hasPermission([P.TAGS_UPDATE]);

  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Inline create popover state
  const [createAnchor, setCreateAnchor] = useState<HTMLElement | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagDescription, setNewTagDescription] = useState('');
  const [newTagColor, setNewTagColor] = useState('#607D8B');
  const [creating, setCreating] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);

  // Inline edit popover state
  const [editAnchor, setEditAnchor] = useState<HTMLElement | null>(null);
  const [editingTag, setEditingTag] = useState<Tag | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState('#607D8B');
  const [saving, setSaving] = useState(false);

  // Delete confirmation popover state
  const [deleteAnchor, setDeleteAnchor] = useState<HTMLElement | null>(null);
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load tags once
  useEffect(() => {
    if (loaded) return;
    const loadTags = async () => {
      try {
        setLoading(true);
        const tags = await tagService.list(projectApiPath);
        setAvailableTags(tags);
        setLoaded(true);
      } catch (error) {
        console.error('Failed to load tags:', error);
      } finally {
        setLoading(false);
      }
    };
    loadTags();
  }, [projectApiPath, loaded]);

  // Handle inline tag creation
  const handleCreateTag = async () => {
    const name = newTagName.trim();
    if (!name) return;

    try {
      setCreating(true);
      const tag = await tagService.create(
        {
          name,
          color: newTagColor,
          description: newTagDescription.trim() || null,
        },
        projectApiPath
      );
      setAvailableTags((prev) => [...prev, tag]);
      onChange([...value, tag]);
      setCreateAnchor(null);
      setNewTagName('');
      setNewTagDescription('');
      setNewTagColor(randomHexColor());
    } catch (e: any) {
      console.error('Failed to create tag:', e);
    } finally {
      setCreating(false);
    }
  };

  const openCreatePopover = (
    anchor: HTMLElement | null,
    inputValue: string
  ) => {
    setNewTagName(inputValue);
    setNewTagDescription('');
    setNewTagColor(randomHexColor());
    setCreateAnchor(anchor);
    setTimeout(() => nameInputRef.current?.focus(), 100);
  };

  // Handle tag edit
  const handleOpenEdit = (e: React.MouseEvent, tag: Tag) => {
    e.stopPropagation();
    setEditingTag(tag);
    setEditDescription(tag.description || '');
    setEditColor(tag.color || '#607D8B');
    setEditAnchor(autocompleteRef.current);
  };

  const handleSaveEdit = async () => {
    if (!editingTag) return;
    try {
      setSaving(true);
      const updated = await tagService.update(
        editingTag.id,
        {
          description: editDescription.trim() || null,
          color: editColor,
        },
        projectApiPath
      );
      // Update in available tags
      setAvailableTags((prev) =>
        prev.map((t) => (t.id === editingTag.id ? { ...t, ...updated } : t))
      );
      // Update in currently selected value
      const updatedValue = value.map((t) =>
        t.id === editingTag.id ? { ...t, ...updated } : t
      );
      onChange(updatedValue);
      setEditAnchor(null);
      setEditingTag(null);
    } catch (e: any) {
      console.error('Failed to update tag:', e);
    } finally {
      setSaving(false);
    }
  };

  // Handle tag delete - open confirmation
  const handleDeleteClick = (e: React.MouseEvent, tag: Tag) => {
    e.stopPropagation();
    setDeletingTag(tag);
    setDeleteAnchor(autocompleteRef.current);
  };

  // Confirm tag delete
  const handleConfirmDelete = async () => {
    if (!deletingTag) return;
    try {
      setDeleting(true);
      await tagService.remove(deletingTag.id, projectApiPath);
      setAvailableTags((prev) => prev.filter((t) => t.id !== deletingTag.id));
      onChange(value.filter((t) => t.id !== deletingTag.id));
      setDeleteAnchor(null);
      setDeletingTag(null);
    } catch (e: any) {
      console.error('Failed to delete tag:', e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Autocomplete<TagOption, true>
        ref={autocompleteRef}
        multiple
        options={availableTags as TagOption[]}
        getOptionLabel={(option) => {
          if (option.isCreateOption && option.inputValue) {
            return option.inputValue;
          }
          return option.name;
        }}
        filterSelectedOptions
        isOptionEqualToValue={(option, val) => option.id === val.id}
        value={value as TagOption[]}
        onChange={(event, newValue, reason, details) => {
          // Check if user selected the "create new" option
          const createOption = newValue.find((v) => v.isCreateOption);
          if (createOption) {
            // Open create popover using the autocomplete ref
            openCreatePopover(
              autocompleteRef.current,
              createOption.inputValue || ''
            );
            return;
          }
          onChange(newValue.filter((v) => !v.isCreateOption));
        }}
        loading={loading}
        disabled={disabled}
        noOptionsText={t('tags.noTagsFound')}
        filterOptions={(options, params) => {
          const filtered = filter(options, params);

          // If canCreate and input has text that doesn't match any existing tag
          if (allowManage && params.inputValue.trim()) {
            const exists = availableTags.some(
              (tag) =>
                tag.name.toLowerCase() ===
                params.inputValue.trim().toLowerCase()
            );
            if (!exists) {
              filtered.push({
                isCreateOption: true,
                inputValue: params.inputValue.trim(),
                // Minimal Tag fields for TypeScript
                id: -1 as any,
                name: params.inputValue.trim(),
                color: '#607D8B',
              });
            }
          }
          return filtered;
        }}
        renderOption={(props, option) => {
          if (option.isCreateOption) {
            return (
              <li {...props} key="__create__">
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    color: 'primary.main',
                  }}
                >
                  <AddIcon fontSize="small" />
                  <Typography variant="body2">
                    {t('tags.createInline', { name: option.inputValue })}
                  </Typography>
                </Box>
              </li>
            );
          }
          return (
            <li {...props} key={option.id}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  gap: 1,
                }}
              >
                <Box
                  sx={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    bgcolor: option.color,
                    flexShrink: 0,
                    alignSelf: 'flex-start',
                    mt: 0.5,
                  }}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {option.name}
                  </Typography>
                  {option.description && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        display: 'block',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {option.description}
                    </Typography>
                  )}
                </Box>
                {allowManage && (
                  <Box sx={{ display: 'flex', flexShrink: 0 }}>
                    <IconButton
                      size="small"
                      onClick={(e) => handleOpenEdit(e, option)}
                      sx={{ p: 0.25 }}
                    >
                      <EditIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => handleDeleteClick(e, option)}
                      sx={{ p: 0.25 }}
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Box>
                )}
              </Box>
            </li>
          );
        }}
        renderTags={(tagValues, getTagProps) =>
          tagValues.map((option, index) => {
            const { key, ...chipProps } = getTagProps({ index });
            const chip = (
              <Chip
                variant="outlined"
                label={option.name}
                size="small"
                sx={{
                  bgcolor: option.color,
                  color: getContrastColor(option.color),
                  borderColor: 'transparent',
                }}
                {...chipProps}
              />
            );
            return option.description ? (
              <Tooltip key={option.id} title={option.description} arrow>
                {chip}
              </Tooltip>
            ) : (
              <React.Fragment key={option.id}>{chip}</React.Fragment>
            );
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label={label ?? t('common.tags')}
            placeholder={placeholder ?? t('common.selectTags')}
          />
        )}
      />

      {/* Inline tag create popover */}
      <Popover
        open={!!createAnchor}
        anchorEl={createAnchor}
        onClose={() => setCreateAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: { p: 2, minWidth: 300 },
          },
        }}
      >
        <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
          {t('tags.addTag')}
        </Typography>
        <Stack spacing={1.5}>
          {/* Preview */}
          <Chip
            label={newTagName || 'tag'}
            size="small"
            sx={{
              bgcolor: newTagColor,
              color: getContrastColor(newTagColor),
              alignSelf: 'flex-start',
            }}
          />
          {/* Name */}
          <TextField
            inputRef={nameInputRef}
            size="small"
            label={t('tags.name')}
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTagName.trim()) {
                handleCreateTag();
              }
            }}
            fullWidth
          />
          {/* Description */}
          <TextField
            size="small"
            label={t('tags.description')}
            value={newTagDescription}
            onChange={(e) => setNewTagDescription(e.target.value)}
            fullWidth
            multiline
            minRows={1}
            maxRows={3}
          />
          {/* Color */}
          <Stack direction="row" spacing={1} alignItems="center">
            <ColorPicker
              value={newTagColor}
              onChange={setNewTagColor}
              label={t('common.color')}
              size="small"
            />
            <Typography variant="body2" color="text.secondary">
              {newTagColor}
            </Typography>
          </Stack>
          {/* Actions */}
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button
              size="small"
              onClick={() => setCreateAnchor(null)}
              disabled={creating}
            >
              {t('common.cancel')}
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={handleCreateTag}
              disabled={!newTagName.trim() || creating}
            >
              {t('tags.addTag')}
            </Button>
          </Stack>
        </Stack>
      </Popover>

      {/* Inline tag edit popover */}
      <Popover
        open={!!editAnchor}
        anchorEl={editAnchor}
        onClose={() => {
          setEditAnchor(null);
          setEditingTag(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: { p: 2, minWidth: 300 },
          },
        }}
      >
        {editingTag && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
              {t('tags.editTag')}
            </Typography>
            <Stack spacing={1.5}>
              {/* Preview */}
              <Chip
                label={editingTag.name}
                size="small"
                sx={{
                  bgcolor: editColor,
                  color: getContrastColor(editColor),
                  alignSelf: 'flex-start',
                }}
              />
              {/* Name (read-only) */}
              <TextField
                size="small"
                label={t('tags.name')}
                value={editingTag.name}
                disabled
                fullWidth
              />
              {/* Description */}
              <TextField
                size="small"
                label={t('tags.description')}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                fullWidth
                multiline
                minRows={1}
                maxRows={3}
                autoFocus
              />
              {/* Color */}
              <Stack direction="row" spacing={1} alignItems="center">
                <ColorPicker
                  value={editColor}
                  onChange={setEditColor}
                  label={t('common.color')}
                  size="small"
                />
                <Typography variant="body2" color="text.secondary">
                  {editColor}
                </Typography>
              </Stack>
              {/* Actions */}
              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button
                  size="small"
                  onClick={() => {
                    setEditAnchor(null);
                    setEditingTag(null);
                  }}
                  disabled={saving}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleSaveEdit}
                  disabled={saving}
                >
                  {t('common.update')}
                </Button>
              </Stack>
            </Stack>
          </>
        )}
      </Popover>

      {/* Delete confirmation popover */}
      <Popover
        open={!!deleteAnchor}
        anchorEl={deleteAnchor}
        onClose={() => {
          setDeleteAnchor(null);
          setDeletingTag(null);
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: { p: 2, minWidth: 280 },
          },
        }}
      >
        {deletingTag && (
          <Stack spacing={1.5}>
            <Typography variant="body2">
              {t('tags.confirmDeleteMessage', { name: deletingTag.name })}
            </Typography>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                size="small"
                onClick={() => {
                  setDeleteAnchor(null);
                  setDeletingTag(null);
                }}
                disabled={deleting}
              >
                {t('common.cancel')}
              </Button>
              <Button
                size="small"
                variant="contained"
                color="error"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {t('common.delete')}
              </Button>
            </Stack>
          </Stack>
        )}
      </Popover>
    </>
  );
};

export default TagSelector;
