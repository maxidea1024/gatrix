import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import {
  FiberManualRecord as DotIcon,
  Build as MaintenanceIcon,
  Event as EventIcon,
  Announcement as NoticeIcon,
  LocalOffer as PromotionIcon,
  Info as OtherIcon,
  CardGiftcard as GiftIcon,
  Notifications as BellIcon,
  RemoveRedEye as UnreadIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import serviceNoticeService, { ServiceNotice } from '../../services/serviceNoticeService';
import { formatRelativeTime, formatDateTimeDetailed } from '../../utils/dateFormat';
import { Tooltip } from '@mui/material';

const PREVIEW_WIDTH = 1536;
const PREVIEW_HEIGHT = 928;
const SIDEBAR_WIDTH = 320;
const READ_NOTICES_KEY = 'serviceNotices_readStatus';

// Game UI color palette (based on 대항해시대 온라인 오리진)
const GAME_COLORS = {
  background: '#E8DDD0', // Light beige background
  sidebarBg: '#2B2420', // Darker brown sidebar (matching game UI)
  listItemEven: '#322822', // Even row - slightly lighter (more noticeable difference)
  listItemOdd: '#2B2420', // Odd row - darker brown
  listItemSelected: '#C8B896', // Selected item - light tan/gold
  listItemHover: '#4A3D32', // Hover state - medium brown
  textPrimary: '#3D3228', // Dark brown text
  textSecondary: '#6B5D52', // Medium brown text
  textLight: '#E8DDD0', // Light beige text for dark backgrounds
  textSelected: '#2A1F18', // Dark text for selected item
  border: '#4A3D32', // Border color - medium brown
  unreadBadge: '#D32F2F', // Red badge for unread
  categoryBg: '#6B5D52', // Category chip background
};

// Get icon for category
const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'maintenance':
      return <MaintenanceIcon fontSize="small" />;
    case 'event':
      return <EventIcon fontSize="small" />;
    case 'notice':
      return <NoticeIcon fontSize="small" />;
    case 'promotion':
      return <PromotionIcon fontSize="small" />;
    default:
      return <BellIcon fontSize="small" />;
  }
};

// Check if localStorage is available
const isLocalStorageAvailable = (): boolean => {
  try {
    const test = '__localStorage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch (e) {
    return false;
  }
};

// Cookie helper functions
const setCookie = (name: string, value: string, days: number) => {
  const expires = days ? `; expires=${new Date(Date.now() + days * 864e5).toUTCString()}` : '';
  document.cookie = `${name}=${encodeURIComponent(value)}${expires}; path=/; SameSite=Lax`;
};

const getCookie = (name: string): string | null => {
  const nameEQ = `${name}=`;
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
  }
  return null;
};

// Get read status from localStorage or cookie
const getReadNotices = (): Set<number> => {
  try {
    let stored: string | null = null;

    // Try localStorage first
    if (isLocalStorageAvailable()) {
      stored = localStorage.getItem(READ_NOTICES_KEY);
      console.log('[ReadStatus] Using localStorage');
    } else {
      // Fallback to cookie
      stored = getCookie(READ_NOTICES_KEY);
      console.log('[ReadStatus] localStorage not available, using cookie');
    }

    if (stored) {
      const parsed = JSON.parse(stored);
      const readIds = new Set<number>(Array.isArray(parsed) ? parsed : []);
      console.log('[ReadStatus] Loaded read notices:', Array.from(readIds));
      return readIds;
    }
  } catch (error) {
    console.error('[ReadStatus] Failed to load read notices:', error);
  }
  return new Set();
};

// Save read status to localStorage or cookie
const saveReadNotices = (readNotices: Set<number>) => {
  try {
    const data = JSON.stringify(Array.from(readNotices));

    // Try localStorage first
    if (isLocalStorageAvailable()) {
      localStorage.setItem(READ_NOTICES_KEY, data);
      console.log('[ReadStatus] Saved to localStorage:', Array.from(readNotices));
    } else {
      // Fallback to cookie (expires in 365 days)
      setCookie(READ_NOTICES_KEY, data, 365);
      console.log('[ReadStatus] Saved to cookie:', Array.from(readNotices));
    }
  } catch (error) {
    console.error('[ReadStatus] Failed to save read notices:', error);
  }
};



const ServiceNoticesPreviewPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [notices, setNotices] = useState<ServiceNotice[]>([]);
  const [selectedNotice, setSelectedNotice] = useState<ServiceNotice | null>(null);
  const [readNotices, setReadNotices] = useState<Set<number>>(getReadNotices());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debug: Log to console for UE4 debugging
  useEffect(() => {
    console.log('[ServiceNoticesPreview] Component mounted');
    console.log('[ServiceNoticesPreview] User Agent:', navigator.userAgent);
    console.log('[ServiceNoticesPreview] Window size:', window.innerWidth, 'x', window.innerHeight);
    return () => {
      console.log('[ServiceNoticesPreview] Component unmounted');
    };
  }, []);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';

    return () => {
      document.body.style.overflow = '';
      document.body.style.margin = '';
      document.body.style.padding = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.margin = '';
      document.documentElement.style.padding = '';
    };
  }, []);

  // Load active notices
  useEffect(() => {
    const loadNotices = async () => {
      try {
        console.log('[ServiceNoticesPreview] Starting to load notices...');
        setLoading(true);
        setError(null);

        // Get all active notices
        console.log('[ServiceNoticesPreview] Calling API...');
        const result = await serviceNoticeService.getServiceNotices(1, 100, { isActive: true });
        console.log('[ServiceNoticesPreview] API response:', result);

        if (result && result.notices) {
          // Filter notices that are currently active (within date range)
          // startDate is optional - if null, treat as immediately available
          // endDate is optional - if null, treat as permanent (no end date)
          const now = new Date();
          const activeNotices = result.notices.filter(notice => {
            const startDate = notice.startDate ? new Date(notice.startDate) : null;
            const endDate = notice.endDate ? new Date(notice.endDate) : null;
            return (!startDate || now >= startDate) && (!endDate || now <= endDate);
          });

          console.log('[ServiceNoticesPreview] Active notices count:', activeNotices.length);
          setNotices(activeNotices);

          // Select first notice by default and mark as read
          if (activeNotices.length > 0 && !selectedNotice) {
            const firstNotice = activeNotices[0];
            console.log('[ServiceNoticesPreview] Selecting first notice:', firstNotice.id);
            setSelectedNotice(firstNotice);

            // Mark first notice as read automatically
            if (!readNotices.has(firstNotice.id)) {
              const newReadNotices = new Set(readNotices);
              newReadNotices.add(firstNotice.id);
              setReadNotices(newReadNotices);
              saveReadNotices(newReadNotices);
            }
          }
        } else {
          console.warn('[ServiceNoticesPreview] No result or notices from API');
        }
      } catch (err: any) {
        console.error('[ServiceNoticesPreview] Failed to load notices:', err);
        console.error('[ServiceNoticesPreview] Error details:', {
          message: err.message,
          stack: err.stack,
          name: err.name
        });
        setError(err.message || t('serviceNotices.loadFailed'));
      } finally {
        console.log('[ServiceNoticesPreview] Loading complete');
        setLoading(false);
      }
    };

    loadNotices();
  }, []);

  // Mark notice as read when selected
  const handleNoticeSelect = (notice: ServiceNotice) => {
    setSelectedNotice(notice);

    // Mark as read
    if (!readNotices.has(notice.id)) {
      const newReadNotices = new Set(readNotices);
      newReadNotices.add(notice.id);
      setReadNotices(newReadNotices);
      saveReadNotices(newReadNotices);
    }
  };

  // Check if notice is read
  const isNoticeRead = (noticeId: number): boolean => {
    return readNotices.has(noticeId);
  };

  // Get display title (use tabTitle if available, otherwise use title)
  const getDisplayTitle = (notice: ServiceNotice): string => {
    return notice.tabTitle || notice.title;
  };

  if (loading) {
    return (
      <Box
        sx={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          position: 'fixed',
          top: 0,
          left: 0,
          margin: 0,
          padding: 0,
          overflow: 'hidden',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          p: 3,
          position: 'fixed',
          top: 0,
          left: 0,
          margin: 0,
          overflow: 'hidden',
        }}
      >
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (notices.length === 0) {
    return (
      <Box
        sx={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          p: 3,
          position: 'fixed',
          top: 0,
          left: 0,
          margin: 0,
          overflow: 'hidden',
        }}
      >
        <Alert severity="info">{t('serviceNotices.previewPage.noActiveNotices')}</Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        bgcolor: GAME_COLORS.background,
        overflow: 'hidden',
        fontFamily: '"Noto Sans KR", "Roboto", sans-serif',
        position: 'fixed',
        top: 0,
        left: 0,
        margin: 0,
        padding: 0,
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
        textRendering: 'optimizeLegibility',
      }}
    >
      {/* Left Sidebar - Notice List */}
      <Box
        sx={{
          width: SIDEBAR_WIDTH,
          height: '100%',
          bgcolor: GAME_COLORS.sidebarBg,
          display: 'flex',
          flexDirection: 'column',
          borderRight: `1px solid ${GAME_COLORS.border}`,
          boxShadow: '4px 0 8px rgba(0, 0, 0, 0.2)',
          // Subtle diagonal stripe pattern for empty space
          backgroundImage: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 3px,
            rgba(74, 63, 53, 0.15) 3px,
            rgba(74, 63, 53, 0.15) 6px
          )`,
        }}
      >
        {/* Notice List */}
        <List
          sx={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            p: 0,
            m: 0,
            WebkitFontSmoothing: 'antialiased',
            MozOsxFontSmoothing: 'grayscale',
          }}
        >
          {notices.map((notice, index) => (
            <ListItem key={notice.id} disablePadding>
              <ListItemButton
                selected={selectedNotice?.id === notice.id}
                onClick={() => handleNoticeSelect(notice)}
                sx={{
                  px: 2.5,
                  py: 1.5,
                  minHeight: '80px', // Match the height of right title section (increased by 4px total)
                  display: 'flex',
                  alignItems: 'center',
                  bgcolor: selectedNotice?.id === notice.id
                    ? GAME_COLORS.listItemSelected
                    : index % 2 === 0
                      ? GAME_COLORS.listItemEven
                      : GAME_COLORS.listItemOdd,
                  borderBottom: `1px solid ${GAME_COLORS.border}`,
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: selectedNotice?.id === notice.id ? GAME_COLORS.listItemSelected : GAME_COLORS.listItemHover,
                  },
                  '&.Mui-selected': {
                    bgcolor: GAME_COLORS.listItemSelected,
                    '&:hover': {
                      bgcolor: GAME_COLORS.listItemSelected,
                    },
                  },
                }}
              >
                <Box sx={{ width: '100%' }}>
                  {/* Title with unread indicator and category icon */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {/* Category Icon */}
                    <Box
                      sx={{
                        color: selectedNotice?.id === notice.id ? GAME_COLORS.textSelected : GAME_COLORS.textLight,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {getCategoryIcon(notice.category)}
                    </Box>

                    {/* Title */}
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: isNoticeRead(notice.id) ? 400 : 700,
                        color: selectedNotice?.id === notice.id ? GAME_COLORS.textSelected : GAME_COLORS.textLight,
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: '0.95rem',
                      }}
                    >
                      {getDisplayTitle(notice)}
                    </Typography>

                    {/* Unread indicator icon (eye icon) on the right */}
                    {!isNoticeRead(notice.id) && (
                      <UnreadIcon
                        sx={{
                          color: GAME_COLORS.unreadBadge,
                          fontSize: '1.2rem',
                          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3))',
                        }}
                      />
                    )}
                  </Box>
                </Box>
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Right Content Area */}
      <Box
        sx={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: GAME_COLORS.background,
        }}
      >
        {selectedNotice ? (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            {/* Title Section - Fixed Header */}
            <Box
              sx={{
                px: 2.5,
                py: 1.5,
                minHeight: '80px', // Match the height of left list items (increased by 4px total)
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                borderBottom: `1px solid rgba(155, 138, 120, 0.3)`,
                bgcolor: 'rgba(255, 255, 255, 0.3)', // Fixed color, not theme-dependent
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                position: 'sticky',
                top: 0,
                zIndex: 10,
              }}
            >
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 700,
                  color: GAME_COLORS.textPrimary, // Fixed color, not theme-dependent
                  mb: 0.5,
                  textShadow: '1px 1px 2px rgba(255, 255, 255, 0.5)',
                }}
              >
                {selectedNotice.title}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Chip
                  label={selectedNotice.category.toUpperCase()}
                  size="small"
                  sx={{
                    bgcolor: GAME_COLORS.categoryBg,
                    color: GAME_COLORS.textLight,
                    fontWeight: 600,
                    border: `1px solid ${GAME_COLORS.border}`,
                  }}
                />
                <Tooltip title={formatDateTimeDetailed(selectedNotice.createdAt)}>
                  <Typography
                    variant="caption"
                    sx={{
                      color: GAME_COLORS.textSecondary, // Fixed color, not theme-dependent
                    }}
                  >
                    {formatRelativeTime(selectedNotice.createdAt, undefined, i18n.language)}
                  </Typography>
                </Tooltip>
              </Box>
            </Box>

            {/* Content Section - Scrollable only when needed */}
            <Box
              sx={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                p: 3,
                minHeight: 0,
                WebkitFontSmoothing: 'antialiased',
                MozOsxFontSmoothing: 'grayscale',
              }}
            >
              <Box
                sx={{
                  color: GAME_COLORS.textPrimary,
                  lineHeight: 1.6,
                  fontSize: '0.95rem',
                  width: '100%',
                  maxWidth: '100%',
                  fontFamily: '"Noto Sans KR", "Roboto", sans-serif',
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  // Image styles - respect inline styles from editor
                  '& img': {
                    display: 'block',
                    margin: 0,
                  },
                  '& a': {
                    color: '#8B4513',
                    textDecoration: 'underline',
                    fontWeight: 600,
                    '&:hover': {
                      color: '#A0522D',
                    },
                  },
                  '& p': {
                    margin: 0,
                    padding: 0,
                    wordWrap: 'break-word',
                    wordBreak: 'break-word',
                    minHeight: '1em', // Ensure empty paragraphs have height
                  },
                  // Preserve empty paragraphs for blank lines
                  '& p:empty': {
                    minHeight: '1em',
                  },
                  '& p > br:only-child': {
                    display: 'none',
                  },
                  // Remove margin from paragraphs containing only images
                  '& p:has(> img:only-child)': {
                    margin: 0,
                    padding: 0,
                  },
                  '& h1, & h2, & h3, & h4, & h5, & h6': {
                    color: GAME_COLORS.textPrimary,
                    fontWeight: 700,
                    marginTop: '1.2em',
                    marginBottom: '0.5em',
                  },
                  '& ul, & ol': {
                    paddingLeft: '2.5em',
                    margin: '0.75em 0',
                    listStylePosition: 'outside',
                  },
                  '& li': {
                    marginBottom: '0.4em',
                    lineHeight: 1.6,
                    display: 'list-item',
                  },
                  '& ul li': {
                    listStyleType: 'disc',
                  },
                  '& ol li': {
                    listStyleType: 'decimal',
                  },
                  '& ul ul, & ol ol, & ul ol, & ol ul': {
                    marginTop: '0.4em',
                    marginBottom: '0.4em',
                    paddingLeft: '2.5em',
                  },
                  '& br': {
                    lineHeight: 1.2,
                  },
                  '& iframe': {
                    maxWidth: '100%',
                    border: 'none',
                  },
                  // Quill editor font families
                  '& .ql-font-serif': {
                    fontFamily: 'Georgia, Times New Roman, serif',
                  },
                  '& .ql-font-monospace': {
                    fontFamily: 'Monaco, Courier New, monospace',
                  },
                  // Quill editor font sizes
                  '& .ql-size-small': {
                    fontSize: '0.75em',
                  },
                  '& .ql-size-large': {
                    fontSize: '1.5em',
                  },
                  '& .ql-size-huge': {
                    fontSize: '2.5em',
                  },
                  // Quill editor text alignment
                  '& .ql-align-center': {
                    textAlign: 'center',
                  },
                  '& .ql-align-right': {
                    textAlign: 'right',
                  },
                  '& .ql-align-justify': {
                    textAlign: 'justify',
                  },
                  // Emoji support
                  '& .emoji': {
                    display: 'inline-block',
                    verticalAlign: 'middle',
                  },
                  // Code block styling
                  '& code': {
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    padding: '0.2em 0.4em',
                    borderRadius: '3px',
                    fontFamily: 'Monaco, Courier New, monospace',
                    fontSize: '0.9em',
                  },
                  '& pre': {
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    padding: '1em',
                    borderRadius: '4px',
                    overflow: 'auto',
                    margin: '0.75em 0',
                  },
                  '& pre code': {
                    backgroundColor: 'transparent',
                    padding: 0,
                  },
                  // Table styling
                  '& table': {
                    borderCollapse: 'collapse',
                    width: '100%',
                    margin: '0.75em 0',
                  },
                  '& th, & td': {
                    border: `1px solid ${GAME_COLORS.border}`,
                    padding: '0.5em',
                    textAlign: 'left',
                  },
                  '& th': {
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    fontWeight: 700,
                  },
                  // Blockquote styling
                  '& blockquote': {
                    borderLeft: `4px solid ${GAME_COLORS.border}`,
                    paddingLeft: '1em',
                    marginLeft: 0,
                    marginRight: 0,
                    color: GAME_COLORS.textSecondary,
                    fontStyle: 'italic',
                  },
                  // Video wrapper styling
                  '& .video-wrapper': {
                    margin: '10px 0',
                    position: 'relative',
                  },
                  '& .video-wrapper iframe': {
                    border: 'none',
                    display: 'block',
                  },
                  // Page background wrapper
                  '& .page-background': {
                    borderRadius: '4px',
                  },
                  // Animation keyframes - defined inline via @keyframes in global styles
                  '@keyframes ql-blink': {
                    '0%, 100%': { opacity: 1 },
                    '50%': { opacity: 0 },
                  },
                  '@keyframes ql-pulse': {
                    '0%, 100%': { transform: 'scale(1)' },
                    '50%': { transform: 'scale(1.05)' },
                  },
                  '@keyframes ql-shake': {
                    '0%, 100%': { transform: 'translateX(0)' },
                    '25%': { transform: 'translateX(-3px)' },
                    '75%': { transform: 'translateX(3px)' },
                  },
                  '@keyframes ql-bounce': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-5px)' },
                  },
                  '@keyframes ql-glow-pulse': {
                    '0%, 100%': { textShadow: '0 0 5px currentColor, 0 0 10px currentColor' },
                    '50%': { textShadow: '0 0 20px currentColor, 0 0 30px currentColor, 0 0 40px currentColor' },
                  },
                  '@keyframes ql-rainbow': {
                    '0%': { backgroundPosition: '0% center' },
                    '100%': { backgroundPosition: '200% center' },
                  },
                  '@keyframes ql-float': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-8px)' },
                  },
                  '@keyframes ql-jelly': {
                    '0%, 100%': { transform: 'scale(1, 1)' },
                    '25%': { transform: 'scale(0.95, 1.05)' },
                    '50%': { transform: 'scale(1.05, 0.95)' },
                    '75%': { transform: 'scale(0.95, 1.05)' },
                  },
                  '@keyframes ql-swing': {
                    '0%, 100%': { transform: 'rotate(0deg)' },
                    '25%': { transform: 'rotate(5deg)' },
                    '75%': { transform: 'rotate(-5deg)' },
                  },
                  '@keyframes ql-heartbeat': {
                    '0%, 100%': { transform: 'scale(1)' },
                    '14%': { transform: 'scale(1.15)' },
                    '28%': { transform: 'scale(1)' },
                    '42%': { transform: 'scale(1.15)' },
                    '70%': { transform: 'scale(1)' },
                  },
                }}
                dangerouslySetInnerHTML={{ __html: selectedNotice.content }}
              />
            </Box>
          </Box>
        ) : (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography
              variant="h6"
              sx={{
                color: GAME_COLORS.textSecondary,
                fontWeight: 500,
              }}
            >
              {t('serviceNotices.previewPage.selectNotice')}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default ServiceNoticesPreviewPage;

