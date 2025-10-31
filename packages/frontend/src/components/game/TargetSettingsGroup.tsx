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
  onUserIdsChange?: (ids: string, inverted: boolean) => void;
  showUserIdFilter?: boolean;
}

const TargetSettingsGroup: React.FC<TargetSettingsGroupProps> = ({
  targetPlatforms,
  targetPlatformsInverted,
  platforms,
  onPlatformsChange,
  targetChannelSubchannels,
  targetChannelSubchannelsInverted,
  channels,
  onChannelsChange,
  targetWorlds,
  targetWorldsInverted,
  worlds,
  onWorldsChange,
  targetUserIds = '',
  targetUserIdsInverted = false,
  onUserIdsChange,
  showUserIdFilter = false,
}) => {
  const { t } = useTranslation();
  const [showPlatformTable, setShowPlatformTable] = useState(false);
  const [showChannelTable, setShowChannelTable] = useState(false);
  const [showWorldTable, setShowWorldTable] = useState(false);

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
          선택된 항목이 없습니다.
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
          선택된 항목이 없습니다.
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
          선택된 항목이 없습니다.
        </Typography>
      );
    }
    return targetWorlds.map((value) => (
      <Chip
        key={value}
        label={value}
        onDelete={(e) => {
          e.stopPropagation();
          handleWorldToggle(value);
        }}
        size="small"
        variant="outlined"
        sx={{ borderRadius: 0.5 }}
      />
    ));
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
        <FormHelperText sx={{ mt: 1 }}>{t('coupons.couponSettings.form.targetPlatformsHelp')}</FormHelperText>
      </Box>

      {/* Channel */}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 500 }}>
          {t('coupons.couponSettings.form.targetChannels')}
        </Typography>
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
          <TableContainer>
            <Table size="small">
              <TableBody>
                {channels.map((channel) => (
                  <React.Fragment key={channel.value}>
                    <TableRow>
                      <TableCell sx={{ width: '30%' }}>
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={targetChannelSubchannels.some((c) => c.channel === channel.value && c.subchannels.includes('*'))}
                              onChange={() => handleChannelToggle(channel.value, '*')}
                              size="small"
                            />
                          }
                          label={channel.label}
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                          {channel.subChannels.map((subChannel) => (
                            <FormControlLabel
                              key={subChannel.value}
                              control={
                                <Checkbox
                                  checked={targetChannelSubchannels.some((c) => c.channel === channel.value && c.subchannels.includes(subChannel.value))}
                                  onChange={() => handleChannelToggle(channel.value, subChannel.value)}
                                  size="small"
                                />
                              }
                              label={subChannel.label}
                            />
                          ))}
                        </Box>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
        <FormHelperText sx={{ mt: 1 }}>{t('coupons.couponSettings.form.targetChannelsHelp')}</FormHelperText>
      </Box>

      {/* World */}
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 500 }}>
          {t('coupons.couponSettings.form.targetWorlds')}
        </Typography>
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
        <FormHelperText sx={{ mt: 1 }}>{t('coupons.couponSettings.form.targetWorldsHelp')}</FormHelperText>
      </Box>
    </Stack>
  );
};

export default TargetSettingsGroup;

