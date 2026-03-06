import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { EffectivePermissions } from '@/services/rbacService';

// Parse 'resource:action' -> { resource, action }
const parsePerm = (perm: string): { resource: string; action: string } => {
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
const getResourceLabel = (
  t: any,
  resource: string
): string => {
  const key = `rbac.resource.${resource}`;
  const label = t(key, '');
  if (label) return label;
  return resource.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
};

// Get action display label from full permission label
const getActionLabel = (
  t: any,
  perm: string
): string => {
  const label = permLabel(t, perm);
  const lastSpace = label.lastIndexOf(' ');
  if (lastSpace === -1) return label;
  return label.substring(lastSpace + 1);
};

interface PermItem {
  perm: string;
  resource: string;
  action: string;
  source: 'own' | 'inherited';
  fromRoleName?: string;
}

interface EffectivePermissionsViewerProps {
  data: EffectivePermissions | null;
  loading?: boolean;
  maxHeight?: number;
}

const EffectivePermissionsViewer: React.FC<EffectivePermissionsViewerProps> = ({
  data,
  loading = false,
  maxHeight = 300,
}) => {
  const { t } = useTranslation();

  // Build resource-grouped tree
  const resourceTree = useMemo(() => {
    if (!data) return [];

    const allPerms: PermItem[] = [
      ...data.own.map((p) => ({
        perm: p,
        ...parsePerm(p),
        source: 'own' as const,
      })),
      ...data.inherited.map((ip) => ({
        perm: ip.permission,
        ...parsePerm(ip.permission),
        source: 'inherited' as const,
        fromRoleName: ip.fromRoleName,
      })),
    ];

    // Group by resource
    const map: Record<string, PermItem[]> = {};
    for (const item of allPerms) {
      if (!map[item.resource]) map[item.resource] = [];
      map[item.resource].push(item);
    }

    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([resource, items]) => ({
        resource,
        label: getResourceLabel(t, resource),
        items,
      }));
  }, [data, t]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (!data) return null;

  const totalCount = data.own.length + data.inherited.length;
  if (totalCount === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
        {t('rbac.roles.noPermissions', 'No permissions')}
      </Typography>
    );
  }

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
        {t('rbac.roles.ownPermission')}: {data.own.length} &nbsp;|&nbsp;
        {t('rbac.roles.inheritedPermission')}: {data.inherited.length} &nbsp;|&nbsp;
        {t('common.total', 'Total')}: {totalCount}
      </Typography>
      <Box
        sx={{
          maxHeight,
          overflow: 'auto',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
        }}
      >
        {resourceTree.map(({ resource, label, items }) => (
          <Box
            key={resource}
            sx={{
              display: 'flex',
              alignItems: 'center',
              px: 1.5,
              py: 0.5,
              borderBottom: 1,
              borderColor: 'divider',
              '&:last-child': { borderBottom: 0 },
              gap: 1,
            }}
          >
            <Typography
              variant="body2"
              sx={{ fontWeight: 500, fontSize: '0.8rem', minWidth: 100, flexShrink: 0 }}
            >
              {label}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {items.map((item) => (
                <Tooltip
                  key={item.perm}
                  title={
                    item.source === 'inherited'
                      ? `${t('rbac.roles.inheritedPermission')}: ${item.fromRoleName}`
                      : t('rbac.roles.ownPermission')
                  }
                >
                  <Chip
                    label={getActionLabel(t, item.perm)}
                    size="small"
                    variant={item.source === 'inherited' ? 'outlined' : 'filled'}
                    color={item.source === 'inherited' ? 'default' : 'primary'}
                    sx={{
                      fontSize: '0.7rem',
                      height: 20,
                      fontStyle: item.source === 'inherited' ? 'italic' : 'normal',
                    }}
                  />
                </Tooltip>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

export default EffectivePermissionsViewer;
