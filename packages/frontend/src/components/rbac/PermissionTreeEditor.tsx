import React, { useState, useMemo } from 'react';
import { Box, Typography, Checkbox, FormControlLabel, Chip } from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

// Standard CRUD actions (always displayed)
const STANDARD_ACTIONS = ['create', 'read', 'update', 'delete'];

// Parse 'resource:action' -> { resource, action }
const parsePerm = (perm: string): { resource: string; action: string } => {
  // Use ':' as primary separator (PERMISSION_SEPARATOR), fallback to '.'
  let sep = perm.indexOf(':');
  if (sep === -1) sep = perm.lastIndexOf('.');
  if (sep === -1) return { resource: perm, action: '' };
  return { resource: perm.substring(0, sep), action: perm.substring(sep + 1) };
};

// Localize permission label
const permLabel = (t: any, perm: string): string => {
  const key = `rbac.perm.${perm.replace(':', '.')}`;
  return t(key, perm);
};

// Extract resource display name using localization key
// e.g. resource "users" -> t('rbac.resource.users', 'users')
const getResourceLabel = (t: any, resource: string): string => {
  // Try dedicated resource label key first
  const key = `rbac.resource.${resource}`;
  const label = t(key, '');
  if (label) return label;
  // Fallback: capitalize and replace underscores
  return resource.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
};

interface ResourceGroup {
  resource: string;
  permissions: string[];
  actionMap: Record<string, string>; // action -> permissionString
  extraActions: string[]; // non-CRUD actions
}

interface PermissionTreeEditorProps {
  permissions: string[];
  onChange: (permissions: string[]) => void;
  availablePermissions: string[];
  permissionCategories: Record<string, { label: string; permissions: string[] }>;
  maxHeight?: number;
}

const PermissionTreeEditor: React.FC<PermissionTreeEditorProps> = ({
  permissions,
  onChange,
  availablePermissions,
  permissionCategories,
  maxHeight = 400,
}) => {
  const { t } = useTranslation();
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  const toggleCatExpanded = (key: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleTogglePerm = (perm: string) => {
    const newPerms = permissions.includes(perm)
      ? permissions.filter((p) => p !== perm)
      : [...permissions, perm];
    onChange(newPerms);
  };

  const handleToggleGroup = (perms: string[]) => {
    const allChecked = perms.every((p) => permissions.includes(p));
    if (allChecked) {
      onChange(permissions.filter((p) => !perms.includes(p)));
    } else {
      const newPerms = [...permissions];
      perms.forEach((p) => {
        if (!newPerms.includes(p)) newPerms.push(p);
      });
      onChange(newPerms);
    }
  };

  const handleSelectAll = () => {
    const allSelected = availablePermissions.every((p) => permissions.includes(p));
    if (allSelected) {
      onChange(permissions.filter((p) => !availablePermissions.includes(p)));
    } else {
      const newPerms = [...permissions];
      availablePermissions.forEach((p) => {
        if (!newPerms.includes(p)) newPerms.push(p);
      });
      onChange(newPerms);
    }
  };

  // Build resource groups within a category
  const buildResourceGroups = useMemo(
    () =>
      (catPerms: string[]): ResourceGroup[] => {
        const map: Record<string, string[]> = {};
        for (const perm of catPerms) {
          const { resource } = parsePerm(perm);
          if (!map[resource]) map[resource] = [];
          map[resource].push(perm);
        }
        return Object.entries(map).map(([resource, perms]) => {
          const actionMap: Record<string, string> = {};
          const extraActions: string[] = [];
          for (const perm of perms) {
            const { action } = parsePerm(perm);
            actionMap[action] = perm;
            if (!STANDARD_ACTIONS.includes(action)) {
              extraActions.push(action);
            }
          }
          return { resource, permissions: perms, actionMap, extraActions };
        });
      },
    []
  );

  const selectedCount = permissions.filter((p) => availablePermissions.includes(p)).length;
  const allSelected = availablePermissions.every((p) => permissions.includes(p));
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          {t('rbac.permissions')} ({selectedCount}/{availablePermissions.length})
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={handleSelectAll}
              size="small"
            />
          }
          label={<Typography variant="body2">{t('rbac.selectAll')}</Typography>}
        />
      </Box>

      {/* Tree */}
      <Box
        sx={{
          maxHeight,
          overflow: 'auto',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        {Object.entries(permissionCategories).map(([key, category]) => {
          const catPerms = category.permissions.filter((p) => availablePermissions.includes(p));
          if (catPerms.length === 0) return null;

          const allCatChecked = catPerms.every((p) => permissions.includes(p));
          const someCatChecked = catPerms.some((p) => permissions.includes(p)) && !allCatChecked;
          const isExpanded = expandedCats.has(key);
          const resourceGroups = buildResourceGroups(catPerms);

          return (
            <Box
              key={key}
              sx={{
                borderBottom: 1,
                borderColor: 'divider',
                '&:last-child': { borderBottom: 0 },
              }}
            >
              {/* Category header */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  px: 1,
                  py: 0.25,
                  cursor: 'pointer',
                  bgcolor: 'action.hover',
                  '&:hover': { bgcolor: 'action.selected' },
                }}
                onClick={() => toggleCatExpanded(key)}
              >
                <Checkbox
                  checked={allCatChecked}
                  indeterminate={someCatChecked}
                  onChange={() => handleToggleGroup(catPerms)}
                  size="small"
                  onClick={(e) => e.stopPropagation()}
                />
                <ExpandMoreIcon
                  sx={{
                    fontSize: 16,
                    transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'transform 0.2s',
                    mr: 0.5,
                  }}
                />
                <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                  {t(category.label, key)}
                </Typography>
                <Chip
                  label={`${catPerms.filter((p) => permissions.includes(p)).length}/${catPerms.length}`}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              </Box>

              {/* Resource rows */}
              {isExpanded && (
                <Box>
                  {/* CRUD column header */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      pl: 4,
                      pr: 1,
                      py: 0,
                    }}
                  >
                    <Box sx={{ minWidth: 130, ml: 4 }} />
                    {STANDARD_ACTIONS.map((action) => (
                      <Typography
                        key={action}
                        variant="caption"
                        sx={{
                          width: 44,
                          textAlign: 'center',
                          fontSize: '0.65rem',
                          color: 'text.disabled',
                          textTransform: 'uppercase',
                          fontWeight: 600,
                          letterSpacing: 0.5,
                        }}
                      >
                        {action.charAt(0).toUpperCase()}
                      </Typography>
                    ))}
                  </Box>

                  {resourceGroups.map(
                    ({ resource, permissions: resPerms, actionMap, extraActions }) => {
                      const allResChecked = resPerms.every((p) => permissions.includes(p));
                      const someResChecked =
                        resPerms.some((p) => permissions.includes(p)) && !allResChecked;
                      const resourceLabel = getResourceLabel(t, resource);

                      return (
                        <Box
                          key={resource}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            pl: 4,
                            pr: 1,
                            py: 0,
                            '&:hover': { bgcolor: 'action.hover' },
                          }}
                        >
                          {/* Resource checkbox + name */}
                          <Checkbox
                            checked={allResChecked}
                            indeterminate={someResChecked}
                            onChange={() => handleToggleGroup(resPerms)}
                            size="small"
                            sx={{ p: 0.25 }}
                          />
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 500,
                              fontSize: '0.78rem',
                              minWidth: 130,
                              ml: 0.5,
                            }}
                          >
                            {resourceLabel}
                          </Typography>

                          {/* Fixed CRUD columns */}
                          {STANDARD_ACTIONS.map((action) => {
                            const perm = actionMap[action];
                            const available = !!perm;
                            return (
                              <Box
                                key={action}
                                sx={{ width: 44, display: 'flex', justifyContent: 'center' }}
                              >
                                <Checkbox
                                  checked={available && permissions.includes(perm)}
                                  onChange={() => available && handleTogglePerm(perm)}
                                  disabled={!available}
                                  size="small"
                                  sx={{
                                    p: 0.25,
                                    opacity: available ? 1 : 0.2,
                                  }}
                                />
                              </Box>
                            );
                          })}

                          {/* Extra non-CRUD actions */}
                          {extraActions.map((action) => {
                            const perm = actionMap[action];
                            return (
                              <FormControlLabel
                                key={perm}
                                control={
                                  <Checkbox
                                    checked={permissions.includes(perm)}
                                    onChange={() => handleTogglePerm(perm)}
                                    size="small"
                                    sx={{ p: 0.25 }}
                                  />
                                }
                                label={
                                  <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                                    {action}
                                  </Typography>
                                }
                                sx={{ m: 0, ml: 0.5 }}
                              />
                            );
                          })}
                        </Box>
                      );
                    }
                  )}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default PermissionTreeEditor;
