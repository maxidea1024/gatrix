import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import {
  Box,
  Tabs,
  Tab,
  Alert,
  Button,
  Typography,
  Card,
  CardContent,
  Grid,
  ButtonGroup,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  alpha,
  Divider,
  Chip,
  Avatar,
  CircularProgress,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  TableContainer,
  Tooltip,
  IconButton,
  RadioGroup,
  FormControlLabel,
  Radio,
  Slider,
  Checkbox,
} from '@mui/material';
import {
  SLIDESHOW_LANDSCAPES,
  SLIDESHOW_PORTRAITS,
  ALL_SLIDESHOW_IMAGES,
} from '../../components/admin/SlideshowBackground';
import {
  People as PeopleIcon,
  Refresh as RefreshIcon,
  ArrowDropDown as ArrowDropDownIcon,
  Block as KickIcon,
  TrendingUp as TrendingUpIcon,
  Public as WorldIcon,
  SignalCellularAlt as CcuIcon,
  ErrorOutline as ErrorIcon,
  SmartToy as BotIcon,
  SwapVert as SortIcon,
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
  Sync as SyncIcon,
  Fullscreen as FullscreenIcon,
  MoreVert as MoreVertIcon,
  Timer as TimerIcon,
  HourglassEmpty as QueueIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { useSearchParams } from 'react-router-dom';
import { useOrgProject } from '../../contexts/OrgProjectContext';
import playerConnectionService from '../../services/playerConnectionService';
import type {
  CcuData,
  LoginQueueData,
} from '../../services/playerConnectionService';
import PageContentLoader from '../../components/common/PageContentLoader';
import PageHeader from '../../components/common/PageHeader';
import CcuGraphTab from '../../components/admin/CcuGraphTab';
import PlayerListTab from '../../components/admin/PlayerListTab';
import AllPlayersTab from '../../components/admin/AllPlayersTab';
import AllCharactersTab from '../../components/admin/AllCharactersTab';
import {
  formatRelativeTime,
  formatDateTimeDetailed,
} from '../../utils/dateFormat';
import CcuScoreboard from '../../components/admin/CcuScoreboard';
import CountdownScoreboard from '../../components/admin/CountdownScoreboard';
import LocalizedDateTimePicker from '../../components/common/LocalizedDateTimePicker';

const REFRESH_STORAGE_KEY = 'playerConnections.refreshInterval';
const REFRESH_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 10000, label: '10s' },
  { value: 30000, label: '30s' },
  { value: 60000, label: '1m' },
  { value: 300000, label: '5m' },
  { value: 600000, label: '10m' },
];

const PlayerConnectionsPage: React.FC = () => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { getProjectApiPath } = useOrgProject();
  const [searchParams, setSearchParams] = useSearchParams();
  const projectApiPath = getProjectApiPath();

  // State
  const [activeTab, setActiveTab] = useState(() => {
    const p = searchParams.get('tab');
    return p ? parseInt(p, 10) : 0;
  });
  const [loading, setLoading] = useState(true);
  const [ccuData, setCcuData] = useState<CcuData | null>(null);
  const [ccuError, setCcuError] = useState<string | null>(null);
  const prevCcuRef = useRef<CcuData | null>(null);
  const [loginQueueData, setLoginQueueData] = useState<LoginQueueData | null>(
    null
  );
  const [refreshInterval, setRefreshInterval] = useState(() => {
    const saved = localStorage.getItem(REFRESH_STORAGE_KEY);
    return saved !== null ? parseInt(saved, 10) : 30000;
  });
  const [refreshMenuAnchor, setRefreshMenuAnchor] =
    useState<null | HTMLElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Kick dialog
  const [kickOpen, setKickOpen] = useState(false);
  const [kickType, setKickType] = useState<'all' | 'world' | 'user'>('all');
  const [kickWorldId, setKickWorldId] = useState('');
  const [kickUserId, setKickUserId] = useState('');
  const [kickMessage, setKickMessage] = useState('');
  const [kickConfirmText, setKickConfirmText] = useState('');
  const [kicking, setKicking] = useState(false);

  // Sync online status dialog
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncPreviewLoading, setSyncPreviewLoading] = useState(false);
  const [syncPreviewData, setSyncPreviewData] = useState<{
    totalDbOnline: number;
    totalActualOnline: number;
    staleCount: number;
    staleUsers: Array<{
      accountId: string;
      lastUserId: number;
      name: string;
      characterId: string;
      worldId: string;
      lastLoginTimeUtc: string | null;
      loginPlatform: string;
      clientVersion: string;
    }>;
    hasMore: boolean;
  } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const SCOREBOARD_STORAGE_KEY = 'playerConnections.scoreboardOpen';
  const [scoreboardOpen, setScoreboardOpen] = useState(
    () => sessionStorage.getItem(SCOREBOARD_STORAGE_KEY) === 'true'
  );
  const [flashIn, setFlashIn] = useState(false);
  const [transitionOverlay, setTransitionOverlay] = useState(false);

  // Countdown state
  const [countdownOpen, setCountdownOpen] = useState(false);
  const [ddayDialogOpen, setDdayDialogOpen] = useState(false);
  const [ddayDate, setDdayDate] = useState<string>('');
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(
    null
  );

  // Scoreboard background settings
  const BG_TYPE_KEY = 'gx_scoreboard_bg_type';
  const BG_URL_KEY = 'gx_scoreboard_bg_url';
  const BG_SLIDESHOW_KEY = 'gx_scoreboard_bg_slideshow';
  const BG_INTERVAL_KEY = 'gx_scoreboard_bg_interval';
  const [bgSettingsOpen, setBgSettingsOpen] = useState(false);
  const [bgType, setBgType] = useState<'youtube' | 'image' | 'slideshow'>(
    () =>
      (localStorage.getItem(BG_TYPE_KEY) as
        | 'youtube'
        | 'image'
        | 'slideshow') || 'youtube'
  );
  const [bgUrl, setBgUrl] = useState(
    () => localStorage.getItem(BG_URL_KEY) || ''
  );
  const [slideshowImages, setSlideshowImages] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(BG_SLIDESHOW_KEY) || '[]');
    } catch {
      return [];
    }
  });
  const [slideshowInterval, setSlideshowInterval] = useState(
    () => Number(localStorage.getItem(BG_INTERVAL_KEY)) || 20
  );

  // World card sort (persisted)
  const SORT_STORAGE_KEY = 'playerConnections.worldSort';
  const [worldSortBy, setWorldSortBy] = useState<'name' | 'count'>(() => {
    return (
      (localStorage.getItem(SORT_STORAGE_KEY + '.by') as 'name' | 'count') ||
      'name'
    );
  });
  const [worldSortDir, setWorldSortDir] = useState<'asc' | 'desc'>(() => {
    return (
      (localStorage.getItem(SORT_STORAGE_KEY + '.dir') as 'asc' | 'desc') ||
      'asc'
    );
  });
  const [sortMenuAnchor, setSortMenuAnchor] = useState<null | HTMLElement>(
    null
  );

  const handleSetRefreshInterval = (val: number) => {
    setRefreshInterval(val);
    localStorage.setItem(REFRESH_STORAGE_KEY, val.toString());
  };

  // Load login queue
  const loadLoginQueue = useCallback(async () => {
    if (!projectApiPath) return;
    try {
      const data = await playerConnectionService.getLoginQueue(projectApiPath);
      setLoginQueueData(data);
    } catch {
      // Non-critical: silently ignore queue load failures
      setLoginQueueData(null);
    }
  }, [projectApiPath]);

  // Load CCU
  const loadCcu = useCallback(async () => {
    if (!projectApiPath) return;
    try {
      setCcuError(null);
      const [data] = await Promise.all([
        playerConnectionService.getCcu(projectApiPath),
        loadLoginQueue(),
      ]);
      setCcuData((prev) => {
        if (prev) prevCcuRef.current = prev;
        return data;
      });
    } catch (err: any) {
      const status = err?.response?.status || err?.status;
      if (status === 502 || status === 504) {
        setCcuError(t('playerConnections.error.unreachable'));
      } else if (status === 400) {
        setCcuError(
          err?.response?.data?.message || t('playerConnections.error.config')
        );
      } else {
        setCcuError(t('playerConnections.error.unknown'));
      }
      console.error('CCU load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [projectApiPath, t, loadLoginQueue]);

  useEffect(() => {
    loadCcu();
  }, [loadCcu]);

  // Auto-refresh (only for Overview and CCU Graph tabs, not Player List)
  useEffect(() => {
    if (refreshInterval > 0 && activeTab < 2) {
      intervalRef.current = setInterval(loadCcu, refreshInterval);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refreshInterval, loadCcu, activeTab]);

  const handleTabChange = (_: React.SyntheticEvent, val: number) => {
    setActiveTab(val);
    const params = new URLSearchParams(searchParams);
    if (val > 0) params.set('tab', String(val));
    else params.delete('tab');
    // Clean up tab-specific params to prevent cross-contamination between tabs
    params.delete('size');
    setSearchParams(params, { replace: true });
  };

  // Kick
  const handleKick = async () => {
    if (!projectApiPath) return;
    setKicking(true);
    try {
      const result = await playerConnectionService.kickPlayers(projectApiPath, {
        type: kickType,
        worldId: kickType === 'world' ? kickWorldId : undefined,
        userId: kickType === 'user' ? kickUserId : undefined,
        message: kickMessage || undefined,
      });
      const kickedCount =
        typeof result.kicked === 'boolean'
          ? result.kicked
            ? 1
            : 0
          : result.kicked || 0;
      enqueueSnackbar(
        t('playerConnections.kick.success', { count: kickedCount }),
        { variant: 'success' }
      );
      setKickOpen(false);
      setKickMessage('');
      loadCcu();
    } catch (err: any) {
      enqueueSnackbar(
        err?.response?.data?.message || t('playerConnections.kick.failed'),
        { variant: 'error' }
      );
    } finally {
      setKicking(false);
    }
  };

  const openKickForUser = (userId: string) => {
    setKickType('user');
    setKickUserId(userId);
    setKickOpen(true);
  };

  // Sync online status: open dialog and load preview
  const handleOpenSyncDialog = async () => {
    setSyncDialogOpen(true);
    setSyncPreviewData(null);
    setSyncPreviewLoading(true);
    if (!projectApiPath) return;
    try {
      const data =
        await playerConnectionService.previewSyncOnlineStatus(projectApiPath);
      setSyncPreviewData(data);
    } catch (err: any) {
      enqueueSnackbar(
        err?.response?.data?.message ||
          t('playerConnections.sync.previewFailed'),
        { variant: 'error' }
      );
      setSyncDialogOpen(false);
    } finally {
      setSyncPreviewLoading(false);
    }
  };

  // Sync online status: execute
  const handleExecuteSync = async () => {
    if (!projectApiPath) return;
    setSyncing(true);
    try {
      const result =
        await playerConnectionService.syncOnlineStatus(projectApiPath);
      if (result.fixed > 0) {
        enqueueSnackbar(
          t('playerConnections.sync.fixed', {
            fixed: result.fixed,
            dbOnline: result.totalDbOnline,
            actualOnline: result.totalActualOnline,
          }),
          { variant: 'success' }
        );
      } else {
        enqueueSnackbar(t('playerConnections.sync.noIssues'), {
          variant: 'info',
        });
      }
      setSyncDialogOpen(false);
      setDataRefreshKey((k) => k + 1);
      loadCcu();
    } catch (err: any) {
      enqueueSnackbar(
        err?.response?.data?.message || t('playerConnections.sync.failed'),
        { variant: 'error' }
      );
    } finally {
      setSyncing(false);
    }
  };

  const activeRefreshLabel =
    REFRESH_OPTIONS.find((o) => o.value === refreshInterval)?.label || 'Off';

  return (
    <Box sx={{ p: 3 }}>
      {/* Fullscreen CCU Scoreboard */}
      {scoreboardOpen && (
        <CcuScoreboard
          ccuData={ccuData}
          prevCcuData={prevCcuRef.current}
          projectApiPath={projectApiPath}
          flashIn={flashIn}
          onClose={() => {
            setScoreboardOpen(false);
            setFlashIn(false);
            sessionStorage.removeItem(SCOREBOARD_STORAGE_KEY);
          }}
        />
      )}

      {/* Fullscreen Countdown */}
      {countdownOpen && ddayDate && (
        <CountdownScoreboard
          ddayTarget={new Date(ddayDate)}
          onCountdownComplete={() => {
            // Show page-level overlay immediately to cover the gap
            setTransitionOverlay(true);
            setFlashIn(true);
            setScoreboardOpen(true);
            sessionStorage.setItem(SCOREBOARD_STORAGE_KEY, 'true');
            requestAnimationFrame(() => {
              setCountdownOpen(false);
              // Remove overlay after CCU has rendered
              setTimeout(() => setTransitionOverlay(false), 500);
            });
          }}
          onSkipToCcu={() => {
            // Show page-level overlay immediately to cover the gap
            setTransitionOverlay(true);
            setFlashIn(true);
            setScoreboardOpen(true);
            sessionStorage.setItem(SCOREBOARD_STORAGE_KEY, 'true');
            requestAnimationFrame(() => {
              setDdayDate('');
              setCountdownOpen(false);
              setTimeout(() => setTransitionOverlay(false), 500);
            });
          }}
          onClose={() => {
            setCountdownOpen(false);
          }}
        />
      )}

      {/* Page-level transition overlay to cover countdown→CCU gap */}
      {transitionOverlay && (
        <Box
          sx={{
            position: 'fixed',
            inset: 0,
            zIndex: 2147483647,
            bgcolor: '#fff',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* D-Day Setting Dialog */}
      {(() => {
        const PRESETS = [
          { key: '5m', ms: 5 * 60 * 1000 },
          { key: '30m', ms: 30 * 60 * 1000 },
          { key: '1h', ms: 60 * 60 * 1000 },
          { key: '1d', ms: 24 * 60 * 60 * 1000 },
          { key: '1w', ms: 7 * 24 * 60 * 60 * 1000 },
        ] as const;

        const isCustomMode =
          !ddayDate ||
          !PRESETS.some((p) => {
            const expected = Date.now() + p.ms;
            const actual = new Date(ddayDate).getTime();
            return Math.abs(expected - actual) < 120_000; // within 2 min tolerance
          });

        const handlePreset = (ms: number) => {
          const target = new Date(Date.now() + ms);
          setDdayDate(target.toISOString());
        };

        const ddayIsFuture =
          ddayDate && new Date(ddayDate).getTime() > Date.now();

        // Compute remaining time display
        const remainingLabel = ddayDate
          ? (() => {
              const diff = new Date(ddayDate).getTime() - Date.now();
              if (diff <= 0) return null;
              const totalSec = Math.floor(diff / 1000);
              const d = Math.floor(totalSec / 86400);
              const h = Math.floor((totalSec % 86400) / 3600);
              const m = Math.floor((totalSec % 3600) / 60);
              const parts: string[] = [];
              if (d > 0)
                parts.push(
                  t('playerConnections.countdown.remainDays', { count: d })
                );
              if (h > 0)
                parts.push(
                  t('playerConnections.countdown.remainHours', { count: h })
                );
              if (m > 0 || parts.length === 0)
                parts.push(
                  t('playerConnections.countdown.remainMinutes', { count: m })
                );
              return (
                t('playerConnections.countdown.remainPrefix') +
                ' ' +
                parts.join(' ')
              );
            })()
          : null;

        return (
          <Dialog
            open={ddayDialogOpen}
            onClose={() => setDdayDialogOpen(false)}
            maxWidth="xs"
            fullWidth
          >
            <DialogTitle>{t('playerConnections.countdown.title')}</DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              {/* Preset chips */}
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {PRESETS.map((p) => (
                  <Chip
                    key={p.key}
                    label={t(`playerConnections.countdown.preset${p.key}`)}
                    variant={
                      ddayDate &&
                      Math.abs(
                        new Date(ddayDate).getTime() - (Date.now() + p.ms)
                      ) < 120_000
                        ? 'filled'
                        : 'outlined'
                    }
                    color={
                      ddayDate &&
                      Math.abs(
                        new Date(ddayDate).getTime() - (Date.now() + p.ms)
                      ) < 120_000
                        ? 'primary'
                        : 'default'
                    }
                    onClick={() => handlePreset(p.ms)}
                    sx={{ fontWeight: 600, cursor: 'pointer' }}
                  />
                ))}
                <Chip
                  label={t('playerConnections.countdown.presetCustom')}
                  variant={isCustomMode ? 'filled' : 'outlined'}
                  color={isCustomMode ? 'primary' : 'default'}
                  onClick={() => setDdayDate('')}
                  sx={{ fontWeight: 600, cursor: 'pointer' }}
                />
              </Box>

              {/* Custom DateTimePicker — shown when no preset matches or explicitly custom */}
              {(!ddayDate || isCustomMode) && (
                <Box sx={{ mt: 2 }}>
                  <LocalizedDateTimePicker
                    label={t('playerConnections.countdown.ddayLabel')}
                    value={ddayDate || null}
                    onChange={(iso) => setDdayDate(iso)}
                    helperText={t('playerConnections.countdown.ddayHelp')}
                    size="medium"
                  />
                </Box>
              )}

              {/* Status chip */}
              {ddayDate &&
                (() => {
                  if (!ddayIsFuture) {
                    return (
                      <Chip
                        icon={<ErrorIcon />}
                        label={t('playerConnections.countdown.pastDateError')}
                        color="error"
                        variant="outlined"
                        sx={{
                          mt: 2,
                          width: '100%',
                          justifyContent: 'flex-start',
                          py: 0.5,
                        }}
                      />
                    );
                  }
                  if (remainingLabel) {
                    return (
                      <Chip
                        icon={<TimerIcon />}
                        label={remainingLabel}
                        color="primary"
                        variant="outlined"
                        sx={{
                          mt: 2,
                          width: '100%',
                          justifyContent: 'flex-start',
                          py: 0.5,
                        }}
                      />
                    );
                  }
                  return null;
                })()}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setDdayDialogOpen(false)}>
                {t('playerConnections.countdown.cancel')}
              </Button>
              <Button
                variant="contained"
                disabled={!ddayIsFuture}
                onClick={() => {
                  if (ddayDate) {
                    setDdayDialogOpen(false);
                    setCountdownOpen(true);
                    document.documentElement
                      .requestFullscreen?.()
                      .catch(() => {});
                  }
                }}
              >
                {t('playerConnections.countdown.start')}
              </Button>
            </DialogActions>
          </Dialog>
        );
      })()}

      {/* Scoreboard Background Settings Dialog */}
      <Dialog
        open={bgSettingsOpen}
        onClose={() => setBgSettingsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {t('playerConnections.scoreboard.bgSettings.title')}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <FormControl component="fieldset" sx={{ mt: 1 }}>
            <RadioGroup
              row
              value={bgType}
              onChange={(e) =>
                setBgType(e.target.value as 'youtube' | 'image' | 'slideshow')
              }
            >
              <FormControlLabel
                value="youtube"
                control={<Radio />}
                label={t('playerConnections.scoreboard.bgSettings.youtube')}
              />
              <FormControlLabel
                value="image"
                control={<Radio />}
                label={t('playerConnections.scoreboard.bgSettings.image')}
              />
              <FormControlLabel
                value="slideshow"
                control={<Radio />}
                label={t('playerConnections.scoreboard.bgSettings.slideshow')}
              />
            </RadioGroup>
          </FormControl>

          {/* Presets */}
          {(() => {
            const BG_PRESETS: {
              label: string;
              type: 'youtube' | 'image';
              url: string;
              emoji: string;
            }[] = [
              {
                label: t('playerConnections.scoreboard.bgPreset.calmSunset'),
                type: 'youtube',
                url: 'aSk-D86aOtc',
                emoji: '🌅',
              },
              {
                label: t('playerConnections.scoreboard.bgPreset.galaxy'),
                type: 'youtube',
                url: 'TNMOlAGvQZc',
                emoji: '🌌',
              },
              {
                label: t('playerConnections.scoreboard.bgPreset.galleonSunset'),
                type: 'image',
                url: '/images/bg_galleon_sunset.png',
                emoji: '🖼️',
              },
              {
                label: t('playerConnections.scoreboard.bgPreset.navalBattle'),
                type: 'image',
                url: '/images/bg_naval_battle.png',
                emoji: '⚔️',
              },
              {
                label: t('playerConnections.scoreboard.bgPreset.tradingPort'),
                type: 'image',
                url: '/images/bg_trading_port.png',
                emoji: '🏛️',
              },
              {
                label: t('playerConnections.scoreboard.bgPreset.voyageHorizon'),
                type: 'image',
                url: '/images/bg_voyage_horizon.png',
                emoji: '⛵',
              },
              {
                label: t('playerConnections.scoreboard.bgPreset.tradeFleet'),
                type: 'image',
                url: '/images/bg_trade_fleet.png',
                emoji: '🚢',
              },
              {
                label: t('playerConnections.scoreboard.bgPreset.dawnHarbor'),
                type: 'image',
                url: '/images/bg_dawn_harbor.png',
                emoji: '🌄',
              },
              {
                label: t('playerConnections.scoreboard.bgPreset.pirateBattle'),
                type: 'image',
                url: '/images/bg_pirate_battle.png',
                emoji: '🏴‍☠️',
              },
              {
                label: t('playerConnections.scoreboard.bgPreset.seagullVoyage'),
                type: 'image',
                url: '/images/bg_seagull_voyage.png',
                emoji: '🕊️',
              },
              {
                label: t('playerConnections.scoreboard.bgPreset.stormPassage'),
                type: 'image',
                url: '/images/bg_storm_passage.png',
                emoji: '⛈️',
              },
              {
                label: t('playerConnections.scoreboard.bgPreset.goldenTrade'),
                type: 'image',
                url: '/images/bg_golden_trade.png',
                emoji: '💰',
              },
              {
                label: t('playerConnections.scoreboard.bgPreset.spiceRoute'),
                type: 'image',
                url: '/images/bg_spice_route.png',
                emoji: '🏝️',
              },
            ];
            return (
              <Box
                sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}
              >
                {BG_PRESETS.map((p) => {
                  const isActive = bgType === p.type && bgUrl === p.url;
                  return (
                    <Chip
                      key={p.url}
                      label={`${p.emoji} ${p.label}`}
                      variant={isActive ? 'filled' : 'outlined'}
                      color={isActive ? 'primary' : 'default'}
                      onClick={() => {
                        setBgType(p.type);
                        setBgUrl(p.url);
                      }}
                      sx={{ fontWeight: 600, cursor: 'pointer' }}
                    />
                  );
                })}
              </Box>
            );
          })()}

          {bgType === 'slideshow' ? (
            <Box sx={{ mt: 2 }}>
              {/* Interval slider */}
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                {t('playerConnections.scoreboard.bgSettings.slideshowInterval')}
                : {slideshowInterval}s
              </Typography>
              <Slider
                value={slideshowInterval}
                onChange={(_, v) => setSlideshowInterval(v as number)}
                min={5}
                max={120}
                step={5}
                marks={[
                  { value: 5, label: '5s' },
                  { value: 30, label: '30s' },
                  { value: 60, label: '1m' },
                  { value: 120, label: '2m' },
                ]}
                sx={{ mx: 1, mb: 2 }}
              />

              {/* Select all / deselect all */}
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setSlideshowImages([...ALL_SLIDESHOW_IMAGES])}
                >
                  {t(
                    'playerConnections.scoreboard.bgSettings.slideshowSelectAll'
                  )}
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setSlideshowImages([])}
                >
                  {t(
                    'playerConnections.scoreboard.bgSettings.slideshowDeselectAll'
                  )}
                </Button>
                <Typography
                  variant="caption"
                  sx={{
                    ml: 'auto',
                    alignSelf: 'center',
                    color: 'text.secondary',
                  }}
                >
                  {slideshowImages.length} / {ALL_SLIDESHOW_IMAGES.length}
                </Typography>
              </Box>

              {/* Landscape images */}
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: 'text.secondary',
                  display: 'block',
                  mt: 1,
                }}
              >
                🌊{' '}
                {t(
                  'playerConnections.scoreboard.bgSettings.slideshowLandscapes'
                )}{' '}
                ({SLIDESHOW_LANDSCAPES.length})
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0.5,
                  mt: 0.5,
                  maxHeight: 200,
                  overflowY: 'auto',
                }}
              >
                {SLIDESHOW_LANDSCAPES.map((img) => {
                  const checked = slideshowImages.includes(img);
                  return (
                    <Box
                      key={img}
                      onClick={() => {
                        setSlideshowImages((prev) =>
                          checked
                            ? prev.filter((x) => x !== img)
                            : [...prev, img]
                        );
                      }}
                      sx={{
                        width: 80,
                        height: 50,
                        borderRadius: 0.5,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        position: 'relative',
                        border: checked ? '2px solid' : '2px solid transparent',
                        borderColor: checked ? 'primary.main' : 'transparent',
                        opacity: checked ? 1 : 0.5,
                        transition: 'all 0.2s',
                        '&:hover': { opacity: 1 },
                      }}
                    >
                      <Box
                        component="img"
                        src={img}
                        alt=""
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                      {checked && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            bgcolor: 'primary.main',
                            borderRadius: '0 0 0 4px',
                            width: 16,
                            height: 16,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: 10,
                              color: '#fff',
                              fontWeight: 700,
                            }}
                          >
                            ✓
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>

              {/* Portrait images */}
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  color: 'text.secondary',
                  display: 'block',
                  mt: 1.5,
                }}
              >
                👤{' '}
                {t(
                  'playerConnections.scoreboard.bgSettings.slideshowPortraits'
                )}{' '}
                ({SLIDESHOW_PORTRAITS.length})
              </Typography>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 0.5,
                  mt: 0.5,
                  maxHeight: 200,
                  overflowY: 'auto',
                }}
              >
                {SLIDESHOW_PORTRAITS.map((img) => {
                  const checked = slideshowImages.includes(img);
                  return (
                    <Box
                      key={img}
                      onClick={() => {
                        setSlideshowImages((prev) =>
                          checked
                            ? prev.filter((x) => x !== img)
                            : [...prev, img]
                        );
                      }}
                      sx={{
                        width: 50,
                        height: 70,
                        borderRadius: 0.5,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        position: 'relative',
                        border: checked ? '2px solid' : '2px solid transparent',
                        borderColor: checked ? 'primary.main' : 'transparent',
                        opacity: checked ? 1 : 0.5,
                        transition: 'all 0.2s',
                        '&:hover': { opacity: 1 },
                      }}
                    >
                      <Box
                        component="img"
                        src={img}
                        alt=""
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                      {checked && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            bgcolor: 'primary.main',
                            borderRadius: '0 0 0 4px',
                            width: 16,
                            height: 16,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Typography
                            sx={{
                              fontSize: 10,
                              color: '#fff',
                              fontWeight: 700,
                            }}
                          >
                            ✓
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  );
                })}
              </Box>
            </Box>
          ) : (
            <>
              <TextField
                fullWidth
                size="small"
                label={
                  bgType === 'youtube'
                    ? t('playerConnections.scoreboard.bgSettings.youtubeUrl')
                    : t('playerConnections.scoreboard.bgSettings.imageUrl')
                }
                value={bgUrl}
                onChange={(e) => {
                  const val = e.target.value;
                  setBgUrl(val);
                  // Auto-detect type from URL pattern
                  const trimmed = val.trim();
                  if (
                    /(?:youtube\.com\/|youtu\.be\/|^[a-zA-Z0-9_-]{11}$)/.test(
                      trimmed
                    )
                  ) {
                    setBgType('youtube');
                  } else if (
                    /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(trimmed) ||
                    /^\/(images|assets|static)\//.test(trimmed)
                  ) {
                    setBgType('image');
                  }
                }}
                placeholder={
                  bgType === 'youtube'
                    ? 'https://www.youtube.com/watch?v=... or VIDEO_ID'
                    : '/images/my-bg.png or https://...'
                }
                helperText={
                  bgType === 'youtube'
                    ? t('playerConnections.scoreboard.bgSettings.youtubeHelp')
                    : t('playerConnections.scoreboard.bgSettings.imageHelp')
                }
                sx={{ mt: 2 }}
              />

              {/* Preview */}
              {bgUrl.trim() && (
                <Box sx={{ mt: 2 }}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'text.secondary',
                      fontWeight: 600,
                      mb: 1,
                      display: 'block',
                    }}
                  >
                    {t('playerConnections.scoreboard.bgSettings.preview')}
                  </Typography>
                  <Box
                    sx={{
                      position: 'relative',
                      width: '100%',
                      pt: '56.25%', // 16:9 aspect ratio
                      borderRadius: 1,
                      overflow: 'hidden',
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: '#000',
                    }}
                  >
                    {bgType === 'youtube' ? (
                      (() => {
                        let vid = bgUrl.trim();
                        const m = vid.match(
                          /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
                        );
                        if (m) vid = m[1];
                        vid = vid.replace(/[?&].*$/, '').slice(0, 11);
                        return (
                          <Box
                            component="iframe"
                            src={`https://www.youtube.com/embed/${vid}?autoplay=0&mute=1&controls=1&modestbranding=1`}
                            allow="encrypted-media"
                            frameBorder="0"
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              width: '100%',
                              height: '100%',
                              border: 'none',
                            }}
                          />
                        );
                      })()
                    ) : (
                      <Box
                        component="img"
                        src={bgUrl.trim()}
                        alt="preview"
                        onError={(
                          e: React.SyntheticEvent<HTMLImageElement>
                        ) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    )}
                  </Box>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBgSettingsOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="contained"
            disabled={
              bgType === 'slideshow' ? slideshowImages.length === 0 : false
            }
            onClick={() => {
              localStorage.setItem(BG_TYPE_KEY, bgType);
              if (bgType === 'slideshow') {
                localStorage.setItem(
                  BG_SLIDESHOW_KEY,
                  JSON.stringify(slideshowImages)
                );
                localStorage.setItem(
                  BG_INTERVAL_KEY,
                  String(slideshowInterval)
                );
              } else {
                if (bgUrl.trim()) {
                  localStorage.setItem(BG_URL_KEY, bgUrl.trim());
                } else {
                  localStorage.removeItem(BG_URL_KEY);
                }
              }
              setBgSettingsOpen(false);
              enqueueSnackbar(t('common.saved'), { variant: 'success' });
            }}
          >
            {t('common.save')}
          </Button>
        </DialogActions>
      </Dialog>
      <PageHeader
        icon={<PeopleIcon />}
        title={t('playerConnections.title')}
        subtitle={t('playerConnections.subtitle')}
        actions={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {ccuData?.admindUrl && (
              <>
                <Chip
                  label={ccuData.admindUrl}
                  size="small"
                  variant="outlined"
                  sx={{
                    color: 'text.secondary',
                    borderColor: 'divider',
                  }}
                />
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
              </>
            )}
            {activeTab < 2 && (
              <>
                <ButtonGroup
                  variant="contained"
                  size="small"
                  sx={{ borderRadius: 1.5, overflow: 'hidden' }}
                >
                  <Button startIcon={<RefreshIcon />} onClick={loadCcu}>
                    {t('common.refresh')}
                  </Button>
                  <Button
                    size="small"
                    onClick={(e) => setRefreshMenuAnchor(e.currentTarget)}
                    sx={{
                      minWidth: 'auto',
                      px: 1,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}
                  >
                    {activeRefreshLabel}
                    <ArrowDropDownIcon sx={{ ml: 0.25, fontSize: 18 }} />
                  </Button>
                </ButtonGroup>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                <Menu
                  anchorEl={refreshMenuAnchor}
                  open={Boolean(refreshMenuAnchor)}
                  onClose={() => setRefreshMenuAnchor(null)}
                >
                  {REFRESH_OPTIONS.map((opt) => (
                    <MenuItem
                      key={opt.value}
                      selected={refreshInterval === opt.value}
                      onClick={() => {
                        handleSetRefreshInterval(opt.value);
                        setRefreshMenuAnchor(null);
                      }}
                    >
                      {opt.label}
                    </MenuItem>
                  ))}
                </Menu>
              </>
            )}
            <IconButton
              size="small"
              onClick={(e) => setMoreMenuAnchor(e.currentTarget)}
              sx={{
                color: 'text.secondary',
                bgcolor: 'action.hover',
                '&:hover': { bgcolor: 'action.selected' },
              }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
            <Menu
              anchorEl={moreMenuAnchor}
              open={Boolean(moreMenuAnchor)}
              onClose={() => setMoreMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              <MenuItem
                onClick={() => {
                  setMoreMenuAnchor(null);
                  setScoreboardOpen(true);
                  sessionStorage.setItem(SCOREBOARD_STORAGE_KEY, 'true');
                  document.documentElement
                    .requestFullscreen?.()
                    .catch(() => {});
                }}
              >
                <ListItemIcon>
                  <FullscreenIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>
                  {t('playerConnections.scoreboard.dropdown.ccuCounter')}
                </ListItemText>
              </MenuItem>
              <MenuItem
                onClick={() => {
                  setMoreMenuAnchor(null);
                  setBgSettingsOpen(true);
                }}
              >
                <ListItemIcon>
                  <SettingsIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>
                  {t('playerConnections.scoreboard.dropdown.bgSettings')}
                </ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={() => {
                  setMoreMenuAnchor(null);
                  setDdayDate('');
                  setDdayDialogOpen(true);
                }}
              >
                <ListItemIcon>
                  <TimerIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>
                  {t('playerConnections.scoreboard.dropdown.countdown')}
                </ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={() => {
                  setMoreMenuAnchor(null);
                  handleOpenSyncDialog();
                }}
              >
                <ListItemIcon>
                  <SyncIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>
                  {t('playerConnections.sync.button')}
                </ListItemText>
              </MenuItem>
            </Menu>
          </Box>
        }
      />

      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        sx={{
          borderBottom: 1,
          borderColor: 'divider',
          mb: 3,
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 500 },
        }}
      >
        <Tab label={t('playerConnections.tabs.overview')} />
        <Tab label={t('playerConnections.tabs.ccuGraph')} />
        <Tab label={t('playerConnections.tabs.players')} />
        <Tab label={t('playerConnections.tabs.allPlayers')} />
        <Tab label={t('playerConnections.tabs.allCharacters')} />
      </Tabs>

      {/* Tab 0: Overview */}
      {activeTab === 0 && (
        <PageContentLoader loading={loading}>
          {/* Error banner */}
          {ccuError && (
            <Alert
              severity="error"
              icon={<ErrorIcon />}
              sx={{ mb: 3, borderRadius: 2 }}
            >
              {ccuError}
            </Alert>
          )}

          {/* Stat cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card
                sx={(theme) => ({
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                })}
              >
                <Box
                  sx={(theme) => ({
                    position: 'absolute',
                    top: -20,
                    right: -20,
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                  })}
                />
                <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        fontWeight={500}
                        gutterBottom
                      >
                        {t('playerConnections.ccu.total')}
                      </Typography>
                      <Typography
                        variant="h4"
                        fontWeight={700}
                        color="primary.main"
                      >
                        {ccuData?.total?.toLocaleString() ?? '-'}
                      </Typography>
                      {ccuData &&
                        prevCcuRef.current &&
                        (() => {
                          const delta =
                            ccuData.total - prevCcuRef.current.total;
                          if (delta === 0) return null;
                          return (
                            <Typography
                              variant="caption"
                              fontWeight={600}
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                mt: 0.5,
                                color:
                                  delta > 0 ? 'success.main' : 'error.main',
                              }}
                            >
                              {delta > 0 ? (
                                <ArrowUpIcon sx={{ fontSize: 14 }} />
                              ) : (
                                <ArrowDownIcon sx={{ fontSize: 14 }} />
                              )}
                              {Math.abs(delta).toLocaleString()}
                            </Typography>
                          );
                        })()}
                      {ccuData && (
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            mt: 0.5,
                          }}
                        >
                          <Typography variant="caption" color="text.secondary">
                            <PeopleIcon
                              sx={{
                                fontSize: 12,
                                mr: 0.25,
                                verticalAlign: 'middle',
                              }}
                            />
                            {ccuData.total.toLocaleString()}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            <BotIcon
                              sx={{
                                fontSize: 12,
                                mr: 0.25,
                                verticalAlign: 'middle',
                              }}
                            />
                            {(ccuData.botTotal || 0).toLocaleString()}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    <Avatar
                      sx={(theme) => ({
                        bgcolor: alpha(theme.palette.primary.main, 0.15),
                        color: 'primary.main',
                        width: 48,
                        height: 48,
                      })}
                    >
                      <CcuIcon />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card
                sx={(theme) => ({
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                })}
              >
                <Box
                  sx={(theme) => ({
                    position: 'absolute',
                    top: -20,
                    right: -20,
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                  })}
                />
                <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        fontWeight={500}
                        gutterBottom
                      >
                        {t('playerConnections.ccu.worldCount')}
                      </Typography>
                      <Typography
                        variant="h4"
                        fontWeight={700}
                        color="primary.main"
                      >
                        {ccuData?.worlds?.length ?? '-'}
                      </Typography>
                    </Box>
                    <Avatar
                      sx={(theme) => ({
                        bgcolor: alpha(theme.palette.primary.main, 0.15),
                        color: 'primary.main',
                        width: 48,
                        height: 48,
                      })}
                    >
                      <WorldIcon />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card
                sx={(theme) => ({
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                })}
              >
                <Box
                  sx={(theme) => ({
                    position: 'absolute',
                    top: -20,
                    right: -20,
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                  })}
                />
                <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        fontWeight={500}
                        gutterBottom
                      >
                        {t('playerConnections.ccu.peakWorld')}
                      </Typography>
                      <Typography
                        variant="h5"
                        fontWeight={700}
                        color="primary.main"
                        noWrap
                      >
                        {ccuData?.worlds?.length
                          ? (() => {
                              const top = [...ccuData.worlds].sort(
                                (a, b) => b.count - a.count
                              )[0];
                              return `${top.name || top.worldId}`;
                            })()
                          : '-'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {ccuData?.worlds?.length
                          ? `${[...ccuData.worlds].sort((a, b) => b.count - a.count)[0].count.toLocaleString()} players`
                          : ''}
                      </Typography>
                    </Box>
                    <Avatar
                      sx={(theme) => ({
                        bgcolor: alpha(theme.palette.primary.main, 0.15),
                        color: 'primary.main',
                        width: 48,
                        height: 48,
                      })}
                    >
                      <TrendingUpIcon />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card
                sx={(theme) => ({
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: theme.shadows[8],
                  },
                })}
                onClick={() => {
                  setKickType('all');
                  setKickOpen(true);
                }}
              >
                <Box
                  sx={(theme) => ({
                    position: 'absolute',
                    top: -20,
                    right: -20,
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    bgcolor: alpha(theme.palette.error.main, 0.1),
                  })}
                />
                <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Box>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        fontWeight={500}
                        gutterBottom
                      >
                        {t('playerConnections.kick.title')}
                      </Typography>
                      <Typography
                        variant="body1"
                        color="error.main"
                        fontWeight={600}
                        sx={{ mt: 1 }}
                      >
                        {t('playerConnections.kick.openDialog')}
                      </Typography>
                    </Box>
                    <Avatar
                      sx={(theme) => ({
                        bgcolor: alpha(theme.palette.error.main, 0.15),
                        color: 'error.main',
                        width: 48,
                        height: 48,
                      })}
                    >
                      <KickIcon />
                    </Avatar>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Login Queue cards */}
          {loginQueueData && loginQueueData.total > 0 && (
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card
                  sx={(theme) => ({
                    height: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                  })}
                >
                  <Box
                    sx={(theme) => ({
                      position: 'absolute',
                      top: -20,
                      right: -20,
                      width: 100,
                      height: 100,
                      borderRadius: '50%',
                      bgcolor: alpha(theme.palette.warning.main, 0.1),
                    })}
                  />
                  <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Box>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          fontWeight={500}
                          gutterBottom
                        >
                          {t('playerConnections.queue.total')}
                        </Typography>
                        <Typography
                          variant="h4"
                          fontWeight={700}
                          color="warning.main"
                        >
                          {loginQueueData.total.toLocaleString()}
                        </Typography>
                      </Box>
                      <Avatar
                        sx={(theme) => ({
                          bgcolor: alpha(theme.palette.warning.main, 0.15),
                          color: 'warning.main',
                          width: 48,
                          height: 48,
                        })}
                      >
                        <QueueIcon />
                      </Avatar>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Card
                  sx={(theme) => ({
                    height: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                  })}
                >
                  <Box
                    sx={(theme) => ({
                      position: 'absolute',
                      top: -20,
                      right: -20,
                      width: 100,
                      height: 100,
                      borderRadius: '50%',
                      bgcolor: alpha(theme.palette.warning.main, 0.1),
                    })}
                  />
                  <CardContent sx={{ position: 'relative', zIndex: 1 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                      }}
                    >
                      <Box>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          fontWeight={500}
                          gutterBottom
                        >
                          {t('playerConnections.queue.peakWorld')}
                        </Typography>
                        {(() => {
                          const worldEntries = Object.entries(
                            loginQueueData.world
                          );
                          if (worldEntries.length === 0)
                            return (
                              <Typography
                                variant="h5"
                                fontWeight={700}
                                color="warning.main"
                              >
                                -
                              </Typography>
                            );
                          const [topWorldId, topCount] = worldEntries.sort(
                            (a, b) => b[1] - a[1]
                          )[0];
                          return (
                            <>
                              <Typography
                                variant="h5"
                                fontWeight={700}
                                color="warning.main"
                                noWrap
                              >
                                {topWorldId}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {topCount.toLocaleString()}{' '}
                                {t('playerConnections.queue.waiting')}
                              </Typography>
                            </>
                          );
                        })()}
                      </Box>
                      <Avatar
                        sx={(theme) => ({
                          bgcolor: alpha(theme.palette.warning.main, 0.15),
                          color: 'warning.main',
                          width: 48,
                          height: 48,
                        })}
                      >
                        <TrendingUpIcon />
                      </Avatar>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* Per-world cards */}
          {ccuData?.worlds && ccuData.worlds.length > 0 && (
            <Box>
              <Divider sx={{ mb: 3 }} />
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: 1.5,
                }}
              >
                <Typography
                  variant="subtitle2"
                  fontWeight={600}
                  color="text.secondary"
                  sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}
                >
                  {t('playerConnections.ccu.perWorld')}
                </Typography>
                <Button
                  size="small"
                  startIcon={<SortIcon />}
                  onClick={(e) => setSortMenuAnchor(e.currentTarget)}
                  sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                >
                  {worldSortBy === 'name'
                    ? t('playerConnections.sort.byName')
                    : t('playerConnections.sort.byCount')}
                  {worldSortDir === 'asc' ? ' ↑' : ' ↓'}
                </Button>
                <Menu
                  anchorEl={sortMenuAnchor}
                  open={Boolean(sortMenuAnchor)}
                  onClose={() => setSortMenuAnchor(null)}
                >
                  <MenuItem
                    selected={worldSortBy === 'name' && worldSortDir === 'asc'}
                    onClick={() => {
                      setWorldSortBy('name');
                      setWorldSortDir('asc');
                      localStorage.setItem(SORT_STORAGE_KEY + '.by', 'name');
                      localStorage.setItem(SORT_STORAGE_KEY + '.dir', 'asc');
                      setSortMenuAnchor(null);
                    }}
                  >
                    {t('playerConnections.sort.byName')} ↑
                  </MenuItem>
                  <MenuItem
                    selected={worldSortBy === 'name' && worldSortDir === 'desc'}
                    onClick={() => {
                      setWorldSortBy('name');
                      setWorldSortDir('desc');
                      localStorage.setItem(SORT_STORAGE_KEY + '.by', 'name');
                      localStorage.setItem(SORT_STORAGE_KEY + '.dir', 'desc');
                      setSortMenuAnchor(null);
                    }}
                  >
                    {t('playerConnections.sort.byName')} ↓
                  </MenuItem>
                  <Divider />
                  <MenuItem
                    selected={
                      worldSortBy === 'count' && worldSortDir === 'desc'
                    }
                    onClick={() => {
                      setWorldSortBy('count');
                      setWorldSortDir('desc');
                      localStorage.setItem(SORT_STORAGE_KEY + '.by', 'count');
                      localStorage.setItem(SORT_STORAGE_KEY + '.dir', 'desc');
                      setSortMenuAnchor(null);
                    }}
                  >
                    {t('playerConnections.sort.byCount')} ↓
                  </MenuItem>
                  <MenuItem
                    selected={worldSortBy === 'count' && worldSortDir === 'asc'}
                    onClick={() => {
                      setWorldSortBy('count');
                      setWorldSortDir('asc');
                      localStorage.setItem(SORT_STORAGE_KEY + '.by', 'count');
                      localStorage.setItem(SORT_STORAGE_KEY + '.dir', 'asc');
                      setSortMenuAnchor(null);
                    }}
                  >
                    {t('playerConnections.sort.byCount')} ↑
                  </MenuItem>
                </Menu>
              </Box>
              <Grid container spacing={1.5}>
                {[...ccuData.worlds]
                  .sort((a, b) => {
                    let cmp = 0;
                    if (worldSortBy === 'name') {
                      cmp = (a.name || a.worldId).localeCompare(
                        b.name || b.worldId
                      );
                    } else {
                      cmp = a.count - b.count;
                    }
                    return worldSortDir === 'asc' ? cmp : -cmp;
                  })
                  .map((w) => (
                    <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }} key={w.worldId}>
                      <Card
                        sx={{
                          borderRadius: 2,
                          position: 'relative',
                          overflow: 'hidden',
                          transition: 'box-shadow 0.2s',
                          '&:hover': { boxShadow: 2 },
                        }}
                      >
                        <Box
                          sx={(theme) => ({
                            position: 'absolute',
                            top: -15,
                            right: -15,
                            width: 60,
                            height: 60,
                            borderRadius: '50%',
                            bgcolor: alpha(theme.palette.primary.main, 0.1),
                          })}
                        />
                        <CardContent
                          sx={{
                            py: 1.5,
                            px: 2,
                            '&:last-child': { pb: 1.5 },
                            position: 'relative',
                            zIndex: 1,
                          }}
                        >
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            title={w.name || w.worldId}
                            sx={{ display: 'block', mb: 0.5 }}
                          >
                            {w.name || w.worldId}
                          </Typography>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }}
                          >
                            <Typography
                              variant="h6"
                              fontWeight={700}
                              color="primary.main"
                            >
                              {w.count.toLocaleString()}
                            </Typography>
                            {prevCcuRef.current &&
                              (() => {
                                const prev = prevCcuRef.current.worlds?.find(
                                  (pw) => pw.worldId === w.worldId
                                );
                                if (!prev) return null;
                                const delta = w.count - prev.count;
                                if (delta === 0) return null;
                                return (
                                  <Typography
                                    variant="caption"
                                    fontWeight={600}
                                    sx={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      color:
                                        delta > 0
                                          ? 'success.main'
                                          : 'error.main',
                                    }}
                                  >
                                    {delta > 0 ? (
                                      <ArrowUpIcon sx={{ fontSize: 12 }} />
                                    ) : (
                                      <ArrowDownIcon sx={{ fontSize: 12 }} />
                                    )}
                                    {Math.abs(delta)}
                                  </Typography>
                                );
                              })()}
                          </Box>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              mt: 0.25,
                            }}
                          >
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              <PeopleIcon
                                sx={{
                                  fontSize: 11,
                                  mr: 0.25,
                                  verticalAlign: 'middle',
                                }}
                              />
                              {w.count.toLocaleString()}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              <BotIcon
                                sx={{
                                  fontSize: 11,
                                  mr: 0.25,
                                  verticalAlign: 'middle',
                                }}
                              />
                              {(w.botCount || 0).toLocaleString()}
                            </Typography>
                            {loginQueueData &&
                              loginQueueData.world[w.worldId] > 0 && (
                                <Typography
                                  variant="caption"
                                  color="warning.main"
                                  sx={{ fontWeight: 600 }}
                                >
                                  <QueueIcon
                                    sx={{
                                      fontSize: 11,
                                      mr: 0.25,
                                      verticalAlign: 'middle',
                                    }}
                                  />
                                  {loginQueueData.world[
                                    w.worldId
                                  ].toLocaleString()}
                                </Typography>
                              )}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
              </Grid>
            </Box>
          )}
        </PageContentLoader>
      )}

      {/* Tab 1: CCU Graph */}
      {activeTab === 1 && projectApiPath && (
        <CcuGraphTab projectApiPath={projectApiPath} />
      )}

      {/* Tab 2: Player List */}
      {activeTab === 2 && projectApiPath && (
        <PlayerListTab
          key={`playerlist-${dataRefreshKey}`}
          projectApiPath={projectApiPath}
          worlds={ccuData?.worlds || []}
          onKickUser={openKickForUser}
        />
      )}

      {/* Tab 3: All Players (DB) */}
      {activeTab === 3 && projectApiPath && (
        <AllPlayersTab
          key={`allplayers-${dataRefreshKey}`}
          projectApiPath={projectApiPath}
          worlds={ccuData?.worlds || []}
        />
      )}

      {/* Tab 4: All Characters (DB) */}
      {activeTab === 4 && projectApiPath && (
        <AllCharactersTab
          key={`allchars-${dataRefreshKey}`}
          projectApiPath={projectApiPath}
          worlds={ccuData?.worlds || []}
        />
      )}

      {/* Kick Dialog */}
      <Dialog
        open={kickOpen}
        onClose={() => {
          setKickOpen(false);
          setKickConfirmText('');
        }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle
          sx={{
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            pb: 0.5,
          }}
        >
          <KickIcon sx={{ color: 'error.main' }} />
          {t('playerConnections.kick.title')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('playerConnections.kick.subtitle')}
          </Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>{t('playerConnections.kick.type')}</InputLabel>
            <Select
              value={kickType}
              label={t('playerConnections.kick.type')}
              onChange={(e: SelectChangeEvent) => {
                setKickType(e.target.value as any);
                setKickConfirmText('');
              }}
            >
              <MenuItem value="all">{t('playerConnections.kick.all')}</MenuItem>
              <MenuItem value="world">
                {t('playerConnections.kick.world')}
              </MenuItem>
              <MenuItem value="user">
                {t('playerConnections.kick.user')}
              </MenuItem>
            </Select>
          </FormControl>
          {kickType === 'world' && (
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>{t('playerConnections.kick.selectWorld')}</InputLabel>
              <Select
                value={kickWorldId}
                label={t('playerConnections.kick.selectWorld')}
                onChange={(e: SelectChangeEvent) => {
                  setKickWorldId(e.target.value);
                  setKickConfirmText('');
                }}
              >
                {(ccuData?.worlds || []).map((w) => (
                  <MenuItem key={w.worldId} value={w.worldId}>
                    {w.name || w.worldId} ({w.count})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {kickType === 'user' && (
            <TextField
              fullWidth
              label={t('playerConnections.kick.userId')}
              value={kickUserId}
              onChange={(e) => setKickUserId(e.target.value)}
              sx={{ mb: 2 }}
            />
          )}

          {/* Impact Summary — only for all/world */}
          {kickType !== 'user' &&
            (() => {
              const isAll = kickType === 'all';
              const worlds = ccuData?.worlds || [];
              const targetCount = isAll
                ? ccuData?.total || 0
                : worlds.find((w) => w.worldId === kickWorldId)?.count || 0;
              const targetLabel = isAll
                ? t('playerConnections.kick.all')
                : worlds.find((w) => w.worldId === kickWorldId)?.name ||
                  kickWorldId;
              const hasTargets = targetCount > 0;
              const confirmWord = 'KICK';
              const isConfirmed = kickConfirmText === confirmWord;

              return (
                <Box
                  sx={(theme) => ({
                    borderRadius: 2,
                    border: 1,
                    borderColor: hasTargets
                      ? alpha(theme.palette.error.main, 0.3)
                      : alpha(theme.palette.warning.main, 0.3),
                    bgcolor: hasTargets
                      ? alpha(theme.palette.error.main, 0.04)
                      : alpha(theme.palette.warning.main, 0.04),
                    p: 2,
                    mb: 2,
                  })}
                >
                  {/* Impact Header */}
                  <Typography
                    variant="subtitle2"
                    fontWeight={700}
                    color={hasTargets ? 'error.main' : 'warning.main'}
                    sx={{ mb: 1 }}
                  >
                    {t('playerConnections.kick.impactTitle')}
                  </Typography>

                  {hasTargets ? (
                    <>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {isAll
                          ? t('playerConnections.kick.impactAll', {
                              count: targetCount,
                            })
                          : t('playerConnections.kick.impactWorld', {
                              world: targetLabel,
                              count: targetCount,
                            })}
                      </Typography>
                      {isAll && worlds.length > 0 && (
                        <Box
                          sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 0.5,
                            mb: 1.5,
                          }}
                        >
                          {worlds
                            .filter((w) => w.count > 0)
                            .sort((a, b) => b.count - a.count)
                            .map((w) => (
                              <Chip
                                key={w.worldId}
                                label={`${w.name || w.worldId}: ${w.count.toLocaleString()}`}
                                size="small"
                                variant="outlined"
                                color="error"
                                sx={{ fontSize: '0.7rem', borderRadius: 1 }}
                              />
                            ))}
                        </Box>
                      )}
                      {/* Confirmation input */}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mb: 0.75 }}
                      >
                        {t('playerConnections.kick.confirmPrompt', {
                          word: confirmWord,
                        })}
                      </Typography>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder={confirmWord}
                        value={kickConfirmText}
                        onChange={(e) => setKickConfirmText(e.target.value)}
                        error={kickConfirmText.length > 0 && !isConfirmed}
                        sx={{
                          '& .MuiInputBase-input': {
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            letterSpacing: 2,
                          },
                        }}
                      />
                    </>
                  ) : (
                    <>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 1.5 }}
                      >
                        {t('playerConnections.kick.noTargets')}
                      </Typography>
                      <Button
                        variant="contained"
                        color="warning"
                        size="small"
                        startIcon={<KickIcon />}
                        onClick={handleKick}
                        disabled={
                          kicking || (kickType === 'world' && !kickWorldId)
                        }
                        sx={{
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 600,
                        }}
                      >
                        {t('playerConnections.kick.forceExecute')}
                      </Button>
                    </>
                  )}
                </Box>
              );
            })()}

          <TextField
            fullWidth
            multiline
            minRows={2}
            maxRows={8}
            label={t('playerConnections.kick.message')}
            placeholder={t('playerConnections.kick.messagePlaceholder')}
            value={kickMessage}
            onChange={(e) => setKickMessage(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => {
              setKickOpen(false);
              setKickConfirmText('');
            }}
          >
            {t('common.cancel')}
          </Button>
          {/* For user kick or confirmed all/world kick */}
          {(kickType === 'user' ||
            (() => {
              const targetCount =
                kickType === 'all'
                  ? ccuData?.total || 0
                  : ccuData?.worlds?.find((w) => w.worldId === kickWorldId)
                      ?.count || 0;
              return targetCount > 0 && kickConfirmText === 'KICK';
            })()) && (
            <Button
              variant="contained"
              color="error"
              onClick={handleKick}
              disabled={
                kicking ||
                (kickType === 'world' && !kickWorldId) ||
                (kickType === 'user' && !kickUserId)
              }
              sx={{ borderRadius: 2, fontWeight: 600 }}
            >
              {t('playerConnections.kick.execute')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Sync Online Status Confirmation Dialog */}
      <Dialog
        open={syncDialogOpen}
        onClose={() => !syncing && setSyncDialogOpen(false)}
        maxWidth={(syncPreviewData?.staleCount ?? 0) > 0 ? 'md' : 'sm'}
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            fontWeight: 700,
            pb: 1,
          }}
        >
          <SyncIcon color="warning" />
          {t('playerConnections.sync.dialogTitle')}
        </DialogTitle>
        <DialogContent dividers>
          {/* Explanation */}
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }} icon={false}>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
              {t('playerConnections.sync.whyTitle')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              {t('playerConnections.sync.whyDesc1')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              {t('playerConnections.sync.whyDesc2')}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t('playerConnections.sync.whyDesc3')}
            </Typography>
          </Alert>

          {syncPreviewLoading ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                py: 6,
                gap: 2,
              }}
            >
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary">
                {t('playerConnections.sync.analyzing')}
              </Typography>
            </Box>
          ) : syncPreviewData ? (
            <>
              {/* Summary stats */}
              <Box
                sx={{
                  display: 'flex',
                  gap: 3,
                  mb: 2,
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: (theme) => alpha(theme.palette.grey[500], 0.06),
                }}
              >
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('playerConnections.sync.statDbOnline')}
                  </Typography>
                  <Typography variant="h6" fontWeight={700}>
                    {syncPreviewData.totalDbOnline}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('playerConnections.sync.statActualOnline')}
                  </Typography>
                  <Typography
                    variant="h6"
                    fontWeight={700}
                    color="success.main"
                  >
                    {syncPreviewData.totalActualOnline}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    {t('playerConnections.sync.statStale')}
                  </Typography>
                  <Typography
                    variant="h6"
                    fontWeight={700}
                    color={
                      syncPreviewData.staleCount > 0
                        ? 'warning.main'
                        : 'text.primary'
                    }
                  >
                    {syncPreviewData.staleCount}
                  </Typography>
                </Box>
              </Box>

              {syncPreviewData.staleCount === 0 ? (
                <Alert severity="success" sx={{ borderRadius: 2 }}>
                  {t('playerConnections.sync.noStaleFound')}
                </Alert>
              ) : (
                <>
                  <Typography
                    variant="subtitle2"
                    fontWeight={600}
                    sx={{ mb: 1 }}
                  >
                    {t('playerConnections.sync.staleListTitle', {
                      count: syncPreviewData.staleCount,
                    })}
                  </Typography>
                  <TableContainer
                    sx={{
                      maxHeight: 360,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      overflow: 'auto',
                    }}
                  >
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              bgcolor: 'background.paper',
                            }}
                          >
                            #
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              bgcolor: 'background.paper',
                            }}
                          >
                            {t('playerConnections.sync.colAccount')}
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              bgcolor: 'background.paper',
                            }}
                          >
                            {t('playerConnections.sync.colUserId')}
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              bgcolor: 'background.paper',
                            }}
                          >
                            {t('playerConnections.sync.colName')}
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              bgcolor: 'background.paper',
                            }}
                          >
                            {t('playerConnections.sync.colCharId')}
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              bgcolor: 'background.paper',
                            }}
                          >
                            {t('playerConnections.sync.colWorld')}
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              bgcolor: 'background.paper',
                            }}
                          >
                            {t('playerConnections.sync.colPlatform')}
                          </TableCell>
                          <TableCell
                            sx={{
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              bgcolor: 'background.paper',
                            }}
                          >
                            {t('playerConnections.sync.colLastLogin')}
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {syncPreviewData.staleUsers.map((u, idx) => (
                          <TableRow key={u.accountId} hover>
                            <TableCell
                              sx={{
                                fontSize: '0.75rem',
                                color: 'text.secondary',
                              }}
                            >
                              {idx + 1}
                            </TableCell>
                            <TableCell
                              sx={{
                                fontSize: '0.75rem',
                                fontFamily: 'monospace',
                              }}
                            >
                              {u.accountId}
                            </TableCell>
                            <TableCell
                              sx={{
                                fontSize: '0.75rem',
                                fontFamily: 'monospace',
                              }}
                            >
                              {u.lastUserId || '-'}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.75rem' }}>
                              {u.name || '-'}
                            </TableCell>
                            <TableCell
                              sx={{
                                fontSize: '0.75rem',
                                fontFamily: 'monospace',
                              }}
                            >
                              {u.characterId || '-'}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.75rem' }}>
                              {u.worldId ? (
                                <Chip
                                  label={u.worldId}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.7rem', height: 22 }}
                                />
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell sx={{ fontSize: '0.75rem' }}>
                              {u.loginPlatform || '-'}
                            </TableCell>
                            <TableCell
                              sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                            >
                              {u.lastLoginTimeUtc ? (
                                <Tooltip
                                  title={formatDateTimeDetailed(
                                    u.lastLoginTimeUtc
                                  )}
                                >
                                  <Typography
                                    variant="body2"
                                    component="span"
                                    sx={{ fontSize: '0.75rem' }}
                                  >
                                    {formatRelativeTime(u.lastLoginTimeUtc)}
                                  </Typography>
                                </Tooltip>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {syncPreviewData.hasMore && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 1, display: 'block' }}
                    >
                      {t('playerConnections.sync.hasMore', {
                        shown: 500,
                        total: syncPreviewData.staleCount,
                      })}
                    </Typography>
                  )}
                </>
              )}
            </>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSyncDialogOpen(false)} disabled={syncing}>
            {t('common.cancel')}
          </Button>
          {syncPreviewData && syncPreviewData.staleCount > 0 && (
            <Button
              variant="contained"
              color="warning"
              onClick={handleExecuteSync}
              disabled={syncing}
              startIcon={
                syncing ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <SyncIcon />
                )
              }
              sx={{ borderRadius: 2, fontWeight: 600 }}
            >
              {syncing
                ? t('playerConnections.sync.syncing')
                : t('playerConnections.sync.executeButton', {
                    count: syncPreviewData.staleCount,
                  })}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlayerConnectionsPage;
