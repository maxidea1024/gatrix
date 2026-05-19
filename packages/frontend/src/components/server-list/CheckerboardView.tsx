import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  Tooltip,
  Table,
  TableBody,
  TableRow,
  TableCell,
  alpha,
} from '@mui/material';
import {
  Dns as DnsIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as HourglassEmptyIcon,
  PowerSettingsNew as PowerSettingsNewIcon,
  Warning as WarningIcon,
  Search as SearchIcon,
  HelpOutline as HelpOutlineIcon,
} from '@mui/icons-material';
import { ServiceInstance } from '../../services/serviceDiscoveryService';
import { getStatusColor, getStatusTranslationKey } from './constants';
import type { GroupingField } from './types';

type ServiceStatus = ServiceInstance['status'];
// CheckerboardView component props
interface CheckerboardViewProps {
  services: ServiceInstance[];
  updatedServiceIds: Map<string, ServiceStatus>;
  heartbeatIds: Set<string>;
  groupingLevels: GroupingField[];
  getGroupingLabel: (field: GroupingField) => string;
  t: (key: string) => string;
  onContextMenu: (event: React.MouseEvent, service: ServiceInstance) => void;
}

// Helper component for status statistics
const StatusStatsDisplay: React.FC<{
  services: ServiceInstance[];
  t: (key: string) => string;
}> = ({ services, t }) => {
  const statusCounts = useMemo(() => {
    const counts = {
      initializing: 0,
      ready: 0,
      shutting_down: 0,
      terminated: 0,
      error: 0,
    };
    services.forEach((s) => {
      if (s.status === 'initializing') counts.initializing++;
      else if (s.status === 'ready') counts.ready++;
      else if (s.status === 'shutting_down') counts.shutting_down++;
      else if (s.status === 'terminated') counts.terminated++;
      else if (s.status === 'error' || s.status === 'no-response')
        counts.error++;
    });
    return counts;
  }, [services]);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        borderRadius: 1,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        overflow: 'hidden',
        height: 24,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1,
          height: '100%',
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: 'info.main',
          }}
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ whiteSpace: 'nowrap' }}
        >
          {t('serverList.stats.initializing')}{' '}
          <strong style={{ color: 'inherit' }}>
            {statusCounts.initializing}
          </strong>
        </Typography>
      </Box>
      <Box sx={{ width: '1px', height: '100%', bgcolor: 'divider' }} />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1,
          height: '100%',
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: 'success.main',
          }}
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ whiteSpace: 'nowrap' }}
        >
          {t('serverList.stats.ready')}{' '}
          <strong style={{ color: 'inherit' }}>{statusCounts.ready}</strong>
        </Typography>
      </Box>
      <Box sx={{ width: '1px', height: '100%', bgcolor: 'divider' }} />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1,
          height: '100%',
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: 'warning.main',
          }}
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ whiteSpace: 'nowrap' }}
        >
          {t('serverList.stats.shuttingDown')}{' '}
          <strong style={{ color: 'inherit' }}>
            {statusCounts.shutting_down}
          </strong>
        </Typography>
      </Box>
      <Box sx={{ width: '1px', height: '100%', bgcolor: 'divider' }} />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1,
          height: '100%',
        }}
      >
        <Box
          sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'grey.500' }}
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ whiteSpace: 'nowrap' }}
        >
          {t('serverList.stats.terminated')}{' '}
          <strong style={{ color: 'inherit' }}>
            {statusCounts.terminated}
          </strong>
        </Typography>
      </Box>
      <Box sx={{ width: '1px', height: '100%', bgcolor: 'divider' }} />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1,
          height: '100%',
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: 'error.main',
          }}
        />
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ whiteSpace: 'nowrap' }}
        >
          {t('serverList.stats.error')}{' '}
          <strong style={{ color: 'inherit' }}>{statusCounts.error}</strong>
        </Typography>
      </Box>
    </Box>
  );
};

// CheckerboardView component - extracted to prevent re-renders
const CheckerboardView: React.FC<CheckerboardViewProps> = React.memo(
  ({
    services,
    updatedServiceIds,
    heartbeatIds,
    groupingLevels,
    getGroupingLabel,
    t,
    onContextMenu,
  }) => {
    const cellSize = 75; // Cell size in pixels
    const gap = 4; // Gap between cells

    // Render a grid section of items
    const renderItemsGrid = (items: ServiceInstance[], groupKey?: string) => {
      const colCount = 25;
      const itemCount = items.length;
      const emptyCount =
        itemCount > 0 ? (colCount - (itemCount % colCount)) % colCount : 0;

      return (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fill, ${cellSize}px)`,
            gridAutoRows: `${cellSize}px`,
            gap: `${gap}px`,
            alignContent: 'start',
            justifyContent: 'start',
          }}
        >
          {items.map((service) => {
            const serviceKey = `${service.labels.service}-${service.instanceId}`;
            const updatedStatus = updatedServiceIds.get(serviceKey);
            const highlightStatus = updatedStatus || service.status;
            const isUpdated = updatedStatus !== undefined;
            const hasHeartbeat = heartbeatIds.has(serviceKey);

            return (
              <Tooltip
                key={serviceKey}
                arrow
                placement="top"
                slotProps={{
                  tooltip: {
                    sx: {
                      bgcolor: 'background.paper',
                      color: 'text.primary',
                      boxShadow: (theme) => theme.shadows[10],
                      border: 1,
                      borderColor: 'divider',
                      p: 0,
                      maxWidth: 'none',
                    },
                  },
                }}
                title={
                  <Box sx={{ p: 1.5, minWidth: 320 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 1.5,
                        gap: 2,
                      }}
                    >
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 800,
                          color: 'primary.main',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                        }}
                      >
                        <DnsIcon sx={{ fontSize: 20 }} />
                        {service.labels.service}
                      </Typography>
                      <Chip
                        label={t(
                          `serverList.status.${getStatusTranslationKey(service.status)}`
                        )}
                        size="small"
                        color={
                          service.status === 'ready'
                            ? 'success'
                            : service.status === 'error'
                              ? 'error'
                              : 'warning'
                        }
                        variant="outlined"
                        sx={{ fontWeight: 'bold' }}
                      />
                    </Box>

                    <Table
                      size="small"
                      sx={{ '& td': { border: 0, py: 0.5, px: 0 } }}
                    >
                      <TableBody>
                        <TableRow hover>
                          <TableCell
                            sx={{
                              width: 100,
                              color: 'text.secondary',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            {t('serverList.table.instanceId')}
                          </TableCell>
                          <TableCell
                            sx={{
                              fontFamily: '"D2Coding", monospace',
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              color: 'text.primary',
                            }}
                          >
                            {service.instanceId}
                          </TableCell>
                        </TableRow>
                        <TableRow hover>
                          <TableCell
                            sx={{
                              color: 'text.secondary',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            {t('serverList.table.hostname')}
                          </TableCell>
                          <TableCell
                            sx={{ fontWeight: 500, fontSize: '0.75rem' }}
                          >
                            {service.hostname}
                          </TableCell>
                        </TableRow>
                        <TableRow hover>
                          <TableCell
                            sx={{
                              color: 'text.secondary',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            {t('serverList.tooltip.addressExt')}
                          </TableCell>
                          <TableCell
                            sx={{
                              fontFamily: '"D2Coding", monospace',
                              fontSize: '0.75rem',
                            }}
                          >
                            {service.externalAddress}
                          </TableCell>
                        </TableRow>
                        <TableRow hover>
                          <TableCell
                            sx={{
                              color: 'text.secondary',
                              fontSize: '0.75rem',
                              fontWeight: 600,
                            }}
                          >
                            {t('serverList.tooltip.addressInt')}
                          </TableCell>
                          <TableCell
                            sx={{
                              fontFamily: '"D2Coding", monospace',
                              fontSize: '0.75rem',
                            }}
                          >
                            {service.internalAddress}
                          </TableCell>
                        </TableRow>
                        {(service.labels.environmentId ||
                          service.labels.environment) && (
                          <TableRow hover>
                            <TableCell
                              sx={{
                                color: 'text.secondary',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                              }}
                            >
                              {t('serverList.table.environment')}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.75rem' }}>
                              <Chip
                                label={
                                  service.labels.environmentId ||
                                  service.labels.environment
                                }
                                size="small"
                                variant="outlined"
                                color="secondary"
                                sx={{
                                  height: 20,
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                  borderRadius: 0.5,
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                        {service.labels.region && (
                          <TableRow hover>
                            <TableCell
                              sx={{
                                color: 'text.secondary',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                              }}
                            >
                              {t('serverList.table.region')}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.75rem' }}>
                              <Chip
                                label={service.labels.region}
                                size="small"
                                variant="outlined"
                                color="info"
                                sx={{
                                  height: 20,
                                  fontSize: '0.65rem',
                                  fontWeight: 600,
                                  borderRadius: 0.5,
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                        {service.labels.version && (
                          <TableRow hover>
                            <TableCell
                              sx={{
                                color: 'text.secondary',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                              }}
                            >
                              {t('serverList.filters.version')}
                            </TableCell>
                            <TableCell
                              sx={{
                                fontFamily: '"D2Coding", monospace',
                                fontSize: '0.75rem',
                              }}
                            >
                              {service.labels.version}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </Box>
                }
              >
                <Box
                  onContextMenu={(e) => onContextMenu(e, service)}
                  sx={{
                    width: cellSize,
                    height: cellSize,
                    background: `linear-gradient(135deg, ${getStatusColor(service.status)} 0%, ${getStatusColor(service.status)}dd 100%)`,
                    border: 0,
                    boxShadow: (theme) =>
                      `inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 4px ${alpha(theme.palette.common.black, 0.15)}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    pb: 0,
                    // Heartbeat glow animation
                    ...(hasHeartbeat && {
                      animation: 'heartbeatGlowPulse 1s ease-out',
                      '@keyframes heartbeatGlowPulse': {
                        '0%': {
                          boxShadow:
                            '0 0 0 0 rgba(76, 175, 80, 0.7), 0 0 20px rgba(76, 175, 80, 0.8), inset 0 0 15px rgba(255, 255, 255, 0.3)',
                          transform: 'scale(1.08)',
                          filter: 'brightness(1.3)',
                        },
                        '30%': {
                          boxShadow:
                            '0 0 0 8px rgba(76, 175, 80, 0.4), 0 0 30px rgba(76, 175, 80, 0.6), inset 0 0 10px rgba(255, 255, 255, 0.2)',
                          transform: 'scale(1.04)',
                          filter: 'brightness(1.15)',
                        },
                        '60%': {
                          boxShadow:
                            '0 0 0 12px rgba(76, 175, 80, 0.1), 0 0 15px rgba(76, 175, 80, 0.3), inset 0 0 5px rgba(255, 255, 255, 0.1)',
                          transform: 'scale(1.02)',
                          filter: 'brightness(1.05)',
                        },
                        '100%': {
                          boxShadow:
                            'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.15)',
                          transform: 'scale(1)',
                          filter: 'brightness(1)',
                        },
                      },
                    }),
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background:
                        'linear-gradient(180deg, rgba(255,255,255,0.15) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)',
                      pointerEvents: 'none',
                    },
                    '&:hover': {
                      transform: 'scale(1.15) translateY(-2px)',
                      boxShadow: (theme) =>
                        `0 8px 16px ${alpha(theme.palette.common.black, 0.25)}`,
                      zIndex: 2,
                    },
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 4,
                      left: 2,
                      right: 2,
                      display: 'flex',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                      zIndex: 2,
                    }}
                  >
                    <Chip
                      label={service.labels.service}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.6rem',
                        fontWeight: 600,
                        bgcolor: 'rgba(0,0,0,0.4)',
                        color: 'white',
                        backdropFilter: 'blur(2px)',
                        maxWidth: '100%',
                        '& .MuiChip-label': {
                          px: 0.5,
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        },
                      }}
                    />
                  </Box>
                  {/* Status indicator - simple elegant symbol */}
                  <Box
                    sx={{
                      width: 27,
                      height: 27,
                      mt: 0,
                      borderRadius: '50%',
                      bgcolor: 'rgba(255,255,255,0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.2)',
                      zIndex: 1,
                    }}
                  >
                    {service.status === 'ready' ? (
                      <CheckCircleIcon sx={{ fontSize: 21, color: 'white' }} />
                    ) : service.status === 'initializing' ? (
                      <SearchIcon
                        sx={{
                          fontSize: 20,
                          color: 'white',
                          animation: 'searchingAnim 2s ease-in-out infinite',
                          '@keyframes searchingAnim': {
                            '0%': { transform: 'translate(0, 0) rotate(0deg)' },
                            '25%': {
                              transform: 'translate(2px, -2px) rotate(15deg)',
                            },
                            '50%': {
                              transform: 'translate(-2px, 2px) rotate(-15deg)',
                            },
                            '75%': {
                              transform: 'translate(2px, 2px) rotate(15deg)',
                            },
                            '100%': {
                              transform: 'translate(0, 0) rotate(0deg)',
                            },
                          },
                        }}
                      />
                    ) : service.status === 'shutting_down' ? (
                      <PowerSettingsNewIcon
                        sx={{ fontSize: 18, color: 'white' }}
                      />
                    ) : service.status === 'terminated' ? (
                      <PowerSettingsNewIcon
                        sx={{ fontSize: 18, color: 'white', opacity: 0.7 }}
                      />
                    ) : service.status === 'error' ? (
                      <ErrorIcon sx={{ fontSize: 18, color: 'white' }} />
                    ) : service.status === 'no-response' ? (
                      <WarningIcon sx={{ fontSize: 18, color: 'white' }} />
                    ) : service.status === 'busy' ? (
                      <SearchIcon
                        sx={{
                          fontSize: 20,
                          color: 'white',
                          animation: 'searchingAnim 2s ease-in-out infinite',
                          '@keyframes searchingAnim': {
                            '0%': { transform: 'translate(0, 0) rotate(0deg)' },
                            '25%': {
                              transform: 'translate(2px, -2px) rotate(15deg)',
                            },
                            '50%': {
                              transform: 'translate(-2px, 2px) rotate(-15deg)',
                            },
                            '75%': {
                              transform: 'translate(2px, 2px) rotate(15deg)',
                            },
                            '100%': {
                              transform: 'translate(0, 0) rotate(0deg)',
                            },
                          },
                        }}
                      />
                    ) : (
                      <HelpOutlineIcon sx={{ fontSize: 18, color: 'white' }} />
                    )}
                  </Box>
                  <Typography
                    variant="caption"
                    sx={{
                      position: 'absolute',
                      bottom: 4,
                      left: 0,
                      right: 0,
                      textAlign: 'center',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      color: 'white',
                      lineHeight: 1,
                      textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {service.status === 'ready'
                      ? 'READY'
                      : service.status === 'initializing'
                        ? 'INITIALIZING'
                        : service.status === 'shutting_down'
                          ? 'SHUTTING DOWN'
                          : service.status === 'terminated'
                            ? 'TERMINATED'
                            : service.status === 'error'
                              ? 'ERROR'
                              : service.status === 'no-response'
                                ? 'NO RESPONSE'
                                : service.status === 'busy'
                                  ? 'BUSY'
                                  : '?'}
                  </Typography>
                </Box>
              </Tooltip>
            );
          })}
          {/* Empty placeholders with dashed border - fill remaining spots in row */}
          {emptyCount > 0 &&
            Array.from({ length: emptyCount }).map((_, idx) => (
              <Box
                key={`empty-check-${groupKey ?? 'all'}-${idx}`}
                sx={{
                  width: cellSize,
                  height: cellSize,
                  border: '2px dashed',
                  borderColor: 'divider',
                  bgcolor: 'transparent',
                  opacity: 0.3,
                }}
              />
            ))}
        </Box>
      );
    };

    // Multi-level hierarchical group structure (inline definition to avoid import)
    interface LocalServerGroup {
      id: string;
      name: string;
      level: number;
      fieldName: GroupingField;
      instances: ServiceInstance[];
      children?: LocalServerGroup[];
    }

    // Build hierarchical groups recursively
    const buildGroups = (
      items: ServiceInstance[],
      levels: GroupingField[],
      currentLevel: number = 0
    ): LocalServerGroup[] => {
      if (levels.length === 0 || currentLevel >= levels.length) {
        return [];
      }

      const currentField = levels[currentLevel];
      const nextLevel = currentLevel + 1;
      const hasMoreLevels = nextLevel < levels.length;

      const groupMap = new Map<string, ServiceInstance[]>();

      items.forEach((service) => {
        const value = service.labels[currentField] || 'Unknown';
        if (!groupMap.has(value)) {
          groupMap.set(value, []);
        }
        groupMap.get(value)?.push(service);
      });

      return Array.from(groupMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, instances]) => ({
          id: levels.slice(0, currentLevel + 1).join('-') + '-' + name,
          name:
            name === 'Unknown'
              ? `(${getGroupingLabel(currentField)} N/A)`
              : name,
          level: currentLevel,
          fieldName: currentField,
          instances: hasMoreLevels
            ? []
            : instances.sort((a, b) =>
                a.instanceId.localeCompare(b.instanceId)
              ),
          children: hasMoreLevels
            ? buildGroups(instances, levels, nextLevel)
            : undefined,
        }));
    };

    // Collect all instances from a group (including nested)
    const collectAllInstances = (
      group: LocalServerGroup
    ): ServiceInstance[] => {
      if (group.children && group.children.length > 0) {
        return group.children.flatMap(collectAllInstances);
      }
      return group.instances;
    };

    // Render a group recursively with its children
    const renderGroup = (
      group: LocalServerGroup,
      depth: number
    ): React.ReactNode => {
      const allInstances = collectAllInstances(group);
      const hasChildren = group.children && group.children.length > 0;

      return (
        <Box key={group.id} sx={{ mb: depth === 0 ? 4 : 3, ml: depth * 2 }}>
          {/* Modern Unified Group Header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              mb: 1.5,
              gap: 1.5,
              pb: 1,
              borderBottom: '1px solid',
              borderColor: 'divider',
              position: 'relative',
            }}
          >
            {/* visual level bar */}
            {depth > 0 && (
              <Box
                sx={{
                  width: 3,
                  height: 24,
                  bgcolor: 'primary.main',
                  mr: 0.5,
                  opacity: 0.5,
                  borderRadius: 1,
                }}
              />
            )}

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                px: 1.5,
                py: 0.5,
                bgcolor: depth === 0 ? 'primary.main' : 'action.selected',
                color: depth === 0 ? 'primary.contrastText' : 'text.primary',
                boxShadow: depth === 0 ? '0 3px 8px rgba(0,0,0,0.12)' : 'none',
                border: depth === 0 ? 'none' : '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  mr: 1,
                  opacity: 0.7,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {getGroupingLabel(group.fieldName)}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {group.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{ ml: 1, fontWeight: 800, opacity: 0.6 }}
              >
                ({allInstances.length})
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }} />
            <StatusStatsDisplay services={allInstances} t={t} />
          </Box>

          <Box sx={{ mt: 1 }}>
            {hasChildren ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {group.children!.map((child) => renderGroup(child, depth + 1))}
              </Box>
            ) : (
              renderItemsGrid(group.instances, group.id)
            )}
          </Box>
        </Box>
      );
    };

    // Group services if grouping is enabled (multi-level)
    if (groupingLevels.length > 0) {
      const groups = buildGroups(services, groupingLevels);

      return (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
            px: 0,
            py: 2,
          }}
        >
          {groups.map((group) => renderGroup(group, 0))}
        </Box>
      );
    }

    // No grouping - render all items in single grid
    return (
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          p: 1.5,
          alignContent: 'start',
          justifyContent: 'start',
          bgcolor: (theme) => alpha(theme.palette.background.paper, 0.3),
          borderRadius: 1,
          border: 1,
          borderColor: 'divider',
        }}
      >
        {renderItemsGrid(services)}
      </Box>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison for React.memo to prevent unnecessary re-renders
    // Only re-render if:
    // 1. Services selection/order changed
    // 2. Heartbeat IDs changed
    // 3. Updated service IDs changed
    // 4. Grouping levels changed

    if (prevProps.groupingLevels.length !== nextProps.groupingLevels.length)
      return false;
    if (
      prevProps.groupingLevels.some(
        (level, i) => level !== nextProps.groupingLevels[i]
      )
    )
      return false;

    // Shallow compare services array (length check first)
    if (prevProps.services !== nextProps.services) {
      if (prevProps.services.length !== nextProps.services.length) return false;
      // Check if first service changed (sorting change)
      if (prevProps.services[0] !== nextProps.services[0]) return false;
    }

    // Check heartbeat changes - only if heartbeat set size changes or specific critical heartbeats
    // For performance, we can just check reference equality of the set or size
    if (
      prevProps.heartbeatIds !== nextProps.heartbeatIds &&
      prevProps.heartbeatIds.size !== nextProps.heartbeatIds.size
    )
      return false;

    // Check updated services map
    if (
      prevProps.updatedServiceIds !== nextProps.updatedServiceIds &&
      prevProps.updatedServiceIds.size !== nextProps.updatedServiceIds.size
    )
      return false;

    return true;
  }
);

export { StatusStatsDisplay };
export default CheckerboardView;

