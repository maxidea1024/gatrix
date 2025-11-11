import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  FormControlLabel,
  Checkbox,
  FormHelperText,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Tooltip,
} from '@mui/material';
import { useTranslation } from 'react-i18next';

export interface ChannelSubchannelData {
  channel: string;
  subchannels: string[];
}

export interface TargetSettingsGroupProps {
  // Platform
  targetPlatforms: string[];
  targetPlatformsInverted: boolean;
  platforms: Array<{ label: string; value: string }>;
  onPlatformsChange: (platforms: string[], inverted: boolean) => void;

  // Channel
  targetChannelSubchannels: ChannelSubchannelData[];
  targetChannelSubchannelsInverted: boolean;
  channels: Array<{ label: string; value: string; subChannels: Array<{ label: string; value: string }> }>;
  onChannelsChange: (channels: ChannelSubchannelData[], inverted: boolean) => void;

  // World
  targetWorlds: string[];
  targetWorldsInverted: boolean;
  worlds: Array<{ label: string; value: string }>;
  onWorldsChange: (worlds: string[], inverted: boolean) => void;

  // User IDs (optional)
  targetUserIds?: string;
  targetUserIdsInverted?: boolean;
  onUserIdsChange?: (ids: string) => void;
  onUserIdsInvertedChange?: (inverted: boolean) => void;
  showUserIdFilter?: boolean;
  showWorldFilter?: boolean;
}

const TargetSettingsGroup: React.FC<TargetSettingsGroupProps> = ({
  targetPlatforms,
  targetPlatformsInverted = false,
  platforms,
  onPlatformsChange,
  targetChannelSubchannels,
  targetChannelSubchannelsInverted = false,
  channels,
  onChannelsChange,
  targetWorlds,
  targetWorldsInverted = false,
  worlds,
  onWorldsChange,
  targetUserIds = '',
  targetUserIdsInverted = false,
  onUserIdsChange,
  onUserIdsInvertedChange,
  showUserIdFilter = false,
  showWorldFilter = true,
}) => {
  const { t } = useTranslation();
  const [showPlatformTable, setShowPlatformTable] = useState(false);
  const [showChannelTable, setShowChannelTable] = useState(false);
  const [showWorldTable, setShowWorldTable] = useState(false);

  const platformRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);

  // Debug log
  useEffect(() => {
    console.log('[TargetSettingsGroup] received props', {
      targetPlatforms,
      targetChannelSubchannels,
      targetWorlds,
    });
  }, [targetPlatforms, targetChannelSubchannels, targetWorlds]);

  // Handle outside click to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Close platform dropdown if clicking outside
      if (showPlatformTable && platformRef.current && !platformRef.current.contains(target)) {
        setShowPlatformTable(false);
      }

      // Close channel dropdown if clicking outside
      if (showChannelTable && channelRef.current && !channelRef.current.contains(target)) {
        setShowChannelTable(false);
      }

      // Close world dropdown if clicking outside
      if (showWorldTable && worldRef.current && !worldRef.current.contains(target)) {
        setShowWorldTable(false);
      }
    };

    // Only add listener if any dropdown is open
    if (showPlatformTable || showChannelTable || showWorldTable) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showPlatformTable, showChannelTable, showWorldTable]);

  const handlePlatformToggle = (value: string) => {
    const newPlatforms = targetPlatforms.includes(value)
      ? targetPlatforms.filter((p) => p !== value)
      : [...targetPlatforms, value];
    onPlatformsChange(newPlatforms, targetPlatformsInverted);
  };

  const handleChannelToggle = (channel: string, subchannel: string) => {
    const existing = targetChannelSubchannels.find((c) => c.channel === channel);
    let newChannels = [...targetChannelSubchannels];

    if (existing) {
      if (existing.subchannels.includes(subchannel)) {
        const updated = {
          ...existing,
          subchannels: existing.subchannels.filter((s) => s !== subchannel),
        };
        if (updated.subchannels.length > 0) {
          newChannels = newChannels.map((c) => (c.channel === channel ? updated : c));
        } else {
          newChannels = newChannels.filter((c) => c.channel !== channel);
        }
      } else {
        newChannels = newChannels.map((c) =>
          c.channel === channel ? { ...c, subchannels: [...c.subchannels, subchannel] } : c
        );
      }
    } else {
      newChannels.push({ channel, subchannels: [subchannel] });
    }

    onChannelsChange(newChannels, targetChannelSubchannelsInverted);
  };

  const handleWorldToggle = (value: string) => {
    const newWorlds = targetWorlds.includes(value)
      ? targetWorlds.filter((w) => w !== value)
      : [...targetWorlds, value];
    onWorldsChange(newWorlds, targetWorldsInverted);
  };

  const renderPlatformChips = () => {
    if (targetPlatforms.length === 0) {
      return !targetPlatformsInverted && (
        <Typography variant="body2" color="text.secondary">
          {t('common.noItemsSelected')}
        </Typography>
      );
    }
    return targetPlatforms.map((value) => {
      const platform = platforms.find((p) => p.value === value);
      return (
        <Chip
          key={value}
          label={platform?.label || value}
          onDelete={(e) => {
            e.stopPropagation();
            handlePlatformToggle(value);
          }}
          size="small"
          variant="outlined"
          sx={{ borderRadius: 0.5 }}
        />
      );
    });
  };

  const renderChannelChips = () => {
    if (targetChannelSubchannels.length === 0) {
      return !targetChannelSubchannelsInverted && (
        <Typography variant="body2" color="text.secondary">
          {t('common.noItemsSelected')}
        </Typography>
      );
    }
    return targetChannelSubchannels.flatMap((c) =>
      c.subchannels.map((sc) => {
        const channelObj = channels.find((ch) => ch.value === c.channel);
        const label = sc === '*'
          ? `${channelObj?.label}`
          : `${channelObj?.label}:${channelObj?.subChannels.find((s) => s.value === sc)?.label}`;
        return (
          <Chip
            key={`${c.channel}:${sc}`}
            label={label}
            onDelete={(e) => {
              e.stopPropagation();
              handleChannelToggle(c.channel, sc);
            }}
            size="small"
            variant="outlined"
            sx={{ borderRadius: 0.5 }}
          />
        );
      })
    );
  };

  const renderWorldChips = () => {
    if (targetWorlds.length === 0) {
      return !targetWorldsInverted && (
        <Typography variant="body2" color="text.secondary">
          {t('common.noItemsSelected')}
        </Typography>
      );
    }
    return targetWorlds.map((value) => {
      const world = worlds.find((w) => w.value === value);
      return (
        <Tooltip key={value} title={world?.label || value}>
          <Chip
            label={value}
            onDelete={(e) => {
              e.stopPropagation();
              handleWorldToggle(value);
            }}
            size="small"
            variant="outlined"
            sx={{ borderRadius: 0.5 }}
          />
        </Tooltip>
      );
    });
  };

  const renderNotButton = (isInverted: boolean, onClick: () => void, hasSelection: boolean) => {
    if (!hasSelection) return null;
    return (
      <Button
        variant="contained"
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        sx={{
          minWidth: 'auto',
          px: 1,
          py: 0.5,
          fontWeight: 600,
          textTransform: 'none',
          fontSize: '0.85rem',
          ...(isInverted ? {
            bgcolor: 'error.main',
            color: 'white',
            '&:hover': {
              bgcolor: 'error.dark',
            }
          } : {
            bgcolor: 'action.disabled',
            color: 'text.secondary',
            '&:hover': {
              bgcolor: 'action.disabled',
              opacity: 0.8,
            }
          })
        }}
      >
        NOT
      </Button>
    );
  };

  return (
    <Stack spacing={2}>
      {/* Platform */}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 500 }}>
          {t('coupons.couponSettings.form.targetPlatforms')}
        </Typography>
        <Box ref={platformRef}>
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'action.disabled',
              borderRadius: 1,
              p: 1.5,
              minHeight: 56,
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1,
              bgcolor: 'background.paper',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: 'action.active',
                bgcolor: 'action.hover',
              }
            }}
            onClick={() => setShowPlatformTable(!showPlatformTable)}
          >
            {renderNotButton(targetPlatformsInverted, () => onPlatformsChange(targetPlatforms, !targetPlatformsInverted), targetPlatforms.length > 0)}
            {renderPlatformChips()}
          </Box>
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'action.disabled',
              borderRadius: 1,
              overflow: showPlatformTable ? 'auto' : 'hidden',
              mt: 0,
              bgcolor: 'background.paper',
              position: 'relative',
              top: -1,
              maxHeight: showPlatformTable ? 300 : 0,
              opacity: showPlatformTable ? 1 : 0,
              transition: 'all 0.3s ease-in-out',
              visibility: showPlatformTable ? 'visible' : 'hidden',
            }}
          >
            <Box sx={{ p: 1 }}>
              {platforms.map((platform) => (
                <FormControlLabel
                  key={platform.value}
                  control={
                    <Checkbox
                      checked={targetPlatforms.includes(platform.value)}
                      onChange={() => handlePlatformToggle(platform.value)}
                      size="small"
                    />
                  }
                  label={platform.label}
                  sx={{ display: 'block', mb: 1 }}
                />
              ))}
            </Box>
          </Box>
        </Box>
        <FormHelperText sx={{ mt: 1 }}>{t('coupons.couponSettings.form.targetPlatformsHelp')}</FormHelperText>
      </Box>

      {/* Channel */}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 500 }}>
          {t('coupons.couponSettings.form.targetChannels')}
        </Typography>
        <Box ref={channelRef}>
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'action.disabled',
              borderRadius: 1,
              p: 1.5,
              minHeight: 56,
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1,
              bgcolor: 'background.paper',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: 'action.active',
                bgcolor: 'action.hover',
              }
            }}
            onClick={() => setShowChannelTable(!showChannelTable)}
          >
            {renderNotButton(targetChannelSubchannelsInverted, () => onChannelsChange(targetChannelSubchannels, !targetChannelSubchannelsInverted), targetChannelSubchannels.length > 0)}
            {renderChannelChips()}
          </Box>
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'action.disabled',
              borderRadius: 1,
              overflow: showChannelTable ? 'auto' : 'hidden',
              mt: 0,
              bgcolor: 'background.paper',
              position: 'relative',
              top: -1,
              maxHeight: showChannelTable ? 300 : 0,
              opacity: showChannelTable ? 1 : 0,
              transition: 'all 0.3s ease-in-out',
              visibility: showChannelTable ? 'visible' : 'hidden',
            }}
          >
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableBody>
                  {channels.map((channel) => {
                    // Check if any subchannel is selected for this channel
                    const anySubchannelSelected = targetChannelSubchannels.some((c) =>
                      c.channel === channel.value && c.subchannels.some((sc) => sc !== '*')
                    );
                    // Check if channel-wide selection exists
                    const isChannelWideSelected = targetChannelSubchannels.some((c) =>
                      c.channel === channel.value && c.subchannels.includes('*')
                    );

                    return (
                      <TableRow key={channel.value} sx={{ '&:hover': { bgcolor: 'action.hover' } }}>
                        <TableCell sx={{ p: 1 }}>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, mb: 0.5 }}>
                              {channel.label}
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                              {/* All checkbox */}
                              <FormControlLabel
                                control={
                                  <Checkbox
                                    checked={isChannelWideSelected || false}
                                    indeterminate={!isChannelWideSelected && anySubchannelSelected}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        // Select all subchannels for this channel
                                        const existing = targetChannelSubchannels.find((c) => c.channel === channel.value);
                                        if (existing) {
                                          const newChannels = targetChannelSubchannels.map((c) =>
                                            c.channel === channel.value
                                              ? { ...c, subchannels: ['*'] }
                                              : c
                                          );
                                          onChannelsChange(newChannels, targetChannelSubchannelsInverted);
                                        } else {
                                          const newChannels = [
                                            ...targetChannelSubchannels,
                                            { channel: channel.value, subchannels: ['*'] }
                                          ];
                                          onChannelsChange(newChannels, targetChannelSubchannelsInverted);
                                        }
                                      } else {
                                        // Deselect all subchannels for this channel
                                        const newChannels = targetChannelSubchannels.filter((c) => c.channel !== channel.value);
                                        onChannelsChange(newChannels, targetChannelSubchannelsInverted);
                                      }
                                    }}
                                    size="small"
                                  />
                                }
                                label={t('coupons.couponSettings.form.targetChannelsAll')}
                                sx={{ m: 0, mr: 1 }}
                              />
                              {/* Divider */}
                              <Box sx={{ width: '1px', height: '24px', bgcolor: 'divider', mx: 0.5 }} />
                              {/* Individual subchannels */}
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {channel.subChannels.map((subchannel) => {
                                  const isSelected = targetChannelSubchannels.some((c) =>
                                    c.channel === channel.value && c.subchannels.includes(subchannel.value)
                                  );
                                  return (
                                    <FormControlLabel
                                      key={subchannel.value}
                                      control={
                                        <Checkbox
                                          checked={isSelected || false}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              const existing = targetChannelSubchannels.find((c) => c.channel === channel.value);
                                              if (existing) {
                                                // Remove '*' if it exists and add the specific subchannel
                                                const filteredSubchannels = existing.subchannels.filter((sc) => sc !== '*');
                                                const newChannels = targetChannelSubchannels.map((c) =>
                                                  c.channel === channel.value
                                                    ? { ...c, subchannels: [...filteredSubchannels, subchannel.value] }
                                                    : c
                                                );
                                                onChannelsChange(newChannels, targetChannelSubchannelsInverted);
                                              } else {
                                                const newChannels = [
                                                  ...targetChannelSubchannels,
                                                  { channel: channel.value, subchannels: [subchannel.value] }
                                                ];
                                                onChannelsChange(newChannels, targetChannelSubchannelsInverted);
                                              }
                                            } else {
                                              const newChannels = targetChannelSubchannels
                                                .map((c) =>
                                                  c.channel === channel.value
                                                    ? { ...c, subchannels: c.subchannels.filter((sc) => sc !== subchannel.value) }
                                                    : c
                                                )
                                                .filter((c) => c.subchannels.length > 0);
                                              onChannelsChange(newChannels, targetChannelSubchannelsInverted);
                                            }
                                          }}
                                          size="small"
                                        />
                                      }
                                      label={subchannel.label}
                                      sx={{ m: 0 }}
                                    />
                                  );
                                })}
                              </Box>
                            </Box>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Box>
        <FormHelperText sx={{ mt: 1 }}>{t('coupons.couponSettings.form.targetChannelsHelp')}</FormHelperText>
      </Box>

      {/* World */}
      {showWorldFilter && (
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 500 }}>
          {t('coupons.couponSettings.form.targetWorlds')}
        </Typography>
        <Box ref={worldRef}>
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'action.disabled',
              borderRadius: 1,
              p: 1.5,
              minHeight: 56,
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1,
              bgcolor: 'background.paper',
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: 'action.active',
                bgcolor: 'action.hover',
              }
            }}
            onClick={() => setShowWorldTable(!showWorldTable)}
          >
            {renderNotButton(targetWorldsInverted, () => onWorldsChange(targetWorlds, !targetWorldsInverted), targetWorlds.length > 0)}
            {renderWorldChips()}
          </Box>
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'action.disabled',
              borderRadius: 1,
              overflow: showWorldTable ? 'auto' : 'hidden',
              mt: 0,
              bgcolor: 'background.paper',
              position: 'relative',
              top: -1,
              maxHeight: showWorldTable ? 300 : 0,
              opacity: showWorldTable ? 1 : 0,
              transition: 'all 0.3s ease-in-out',
              visibility: showWorldTable ? 'visible' : 'hidden',
            }}
          >
            <Box sx={{ p: 1 }}>
              {worlds.map((world) => (
                <FormControlLabel
                  key={world.value}
                  control={
                    <Checkbox
                      checked={targetWorlds.includes(world.value)}
                      onChange={() => handleWorldToggle(world.value)}
                      size="small"
                    />
                  }
                  label={`${world.value} - ${world.label}`}
                  sx={{ display: 'block', mb: 1 }}
                />
              ))}
            </Box>
          </Box>
        </Box>
        <FormHelperText sx={{ mt: 1 }}>{t('coupons.couponSettings.form.targetWorldsHelp')}</FormHelperText>
      </Box>
      )}

      {/* User IDs */}
      {showUserIdFilter && (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 500 }}>
            {t('coupons.couponSettings.form.targetUserIds')}
          </Typography>
          <Box
            sx={{
              border: '1px solid',
              borderColor: 'action.disabled',
              borderRadius: 1,
              p: 1.5,
              minHeight: 56,
              display: 'flex',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: 1,
              bgcolor: 'background.paper',
              transition: 'all 0.2s',
              '&:hover': {
                borderColor: 'action.active',
                bgcolor: 'action.hover',
              },
              '&:focus-within': {
                borderColor: 'primary.main',
                boxShadow: '0 0 0 2px rgba(25, 103, 210, 0.1)',
              }
            }}
          >
            {targetUserIds && targetUserIds.trim() && (
              <Button
                variant="contained"
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  onUserIdsInvertedChange?.(!targetUserIdsInverted);
                }}
                sx={{
                  minWidth: 'auto',
                  px: 1,
                  py: 0.5,
                  fontWeight: 600,
                  textTransform: 'none',
                  fontSize: '0.85rem',
                  ...(targetUserIdsInverted ? {
                    bgcolor: 'error.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'error.dark',
                    }
                  } : {
                    bgcolor: 'action.disabled',
                    color: 'text.secondary',
                    '&:hover': {
                      bgcolor: 'action.disabled',
                      opacity: 0.8,
                    }
                  })
                }}
              >
                NOT
              </Button>
            )}

            {targetUserIds && targetUserIds.trim() && (
              targetUserIds.split(',').map((userId: string, index: number) => {
                const trimmedId = userId.trim();
                if (!trimmedId) return null;
                return (
                  <Chip
                    key={index}
                    label={trimmedId}
                    onDelete={() => {
                      const ids = targetUserIds.split(',').map((id: string) => id.trim()).filter((id: string) => id);
                      const filtered = ids.filter((_: string, i: number) => i !== index);
                      onUserIdsChange?.(filtered.length > 0 ? filtered.join(', ') : '');
                    }}
                    size="small"
                  />
                );
              })
            )}

            <input
              type="text"
              placeholder={targetUserIds && targetUserIds.trim() ? '' : 'user1, user2, user3...'}
              onKeyDown={(e) => {
                const input = (e.currentTarget as HTMLInputElement).value.trim();
                if ((e.key === 'Enter' || e.key === ',') && input) {
                  e.preventDefault();
                  const newIds = input.split(',').map((id: string) => id.trim()).filter((id: string) => id);
                  const existingIds = targetUserIds ? targetUserIds.split(',').map((id: string) => id.trim()).filter((id: string) => id) : [];
                  const uniqueIds = Array.from(new Set([...existingIds, ...newIds]));
                  onUserIdsChange?.(uniqueIds.join(', '));
                  (e.currentTarget as HTMLInputElement).value = '';
                }
              }}
              style={{
                flex: 1,
                minWidth: 150,
                border: 'none',
                outline: 'none',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                backgroundColor: 'transparent',
                color: 'inherit',
                caretColor: 'inherit',
              }}
            />
          </Box>

          <FormHelperText sx={{ mt: 1 }}>{t('coupons.couponSettings.form.targetUserIdsHelp')}</FormHelperText>
        </Box>
      )}
    </Stack>
  );
};

export default TargetSettingsGroup;

