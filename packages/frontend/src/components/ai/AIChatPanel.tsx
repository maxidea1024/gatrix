/**
 * AIChatPanel - Floating AI Chat Panel Component
 *
 * A resizable floating drawer for AI chat interactions.
 * Renders Markdown responses and shows streaming progress.
 * Uses react-virtuoso for virtualized message rendering.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import {
  Box,
  Chip,
  Drawer,
  IconButton,
  Typography,
  TextField,
  InputAdornment,
  CircularProgress,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Tooltip,
  Fab,
  Zoom,
  keyframes,
} from '@mui/material';
import {
  Close as CloseIcon,
  Send as SendIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  SmartToy as SmartToyIcon,
  ArrowBack as ArrowBackIcon,
  Stop as StopIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAIChat } from '@/hooks/useAIChat';
import aiChatService, { AIChatListItem } from '@/services/aiChatService';
import { useOrgProject } from '@/contexts/OrgProjectContext';
import { useEnvironment } from '@/contexts/EnvironmentContext';

const STORAGE_KEY_WIDTH = 'aiChatPanelWidth';
const DEFAULT_DRAWER_WIDTH = 420;
const MIN_DRAWER_WIDTH = 320;
const MAX_DRAWER_WIDTH = 800;

// Floating button wiggle animation
const wiggleAnimation = keyframes`
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-5deg); }
  50% { transform: rotate(5deg); }
  75% { transform: rotate(-3deg); }
`;

// Load saved width from localStorage
function getSavedWidth(): number {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_WIDTH);
    if (saved) {
      const parsed = parseInt(saved, 10);
      if (
        !isNaN(parsed) &&
        parsed >= MIN_DRAWER_WIDTH &&
        parsed <= MAX_DRAWER_WIDTH
      ) {
        return parsed;
      }
    }
  } catch {
    // Ignore storage errors
  }
  return DEFAULT_DRAWER_WIDTH;
}

type PanelView = 'chat' | 'history';

interface AIChatPanelProps {
  open: boolean;
  onClose: () => void;
}

// Message bubble styles extracted to reduce repetition
const getMessageBubbleSx = (role: 'user' | 'assistant' | 'system') => ({
  maxWidth: '85%',
  p: 1.5,
  borderRadius: '16px',
  ...(role === 'user'
    ? { borderBottomRightRadius: '4px' }
    : { borderBottomLeftRadius: '4px' }),
  boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
  bgcolor:
    role === 'user'
      ? 'primary.main'
      : (theme: any) =>
          theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'grey.100',
  color: role === 'user' ? 'primary.contrastText' : 'text.primary',
  whiteSpace: role === 'user' ? 'pre-wrap' : 'normal',
  wordBreak: 'break-word',
  fontSize: '0.875rem',
  lineHeight: 1.6,
  '& code': {
    bgcolor: 'action.hover',
    px: 0.5,
    borderRadius: 0.5,
    fontFamily: 'monospace',
    fontSize: '0.8em',
  },
  '& pre': {
    bgcolor: 'action.hover',
    p: 1.5,
    borderRadius: 1,
    overflow: 'auto',
    '& code': {
      bgcolor: 'transparent',
      p: 0,
    },
  },
  '& p': { m: 0, mb: 0.5, '&:last-child': { mb: 0 } },
  '& ul, & ol': { m: 0, pl: 2, mb: 0.5 },
  '& li': { mb: 0.25 },
  '& h1, & h2, & h3, & h4': {
    mt: 1,
    mb: 0.5,
    fontWeight: 600,
  },
  '& h1': { fontSize: '1.1em' },
  '& h2': { fontSize: '1.05em' },
  '& h3': { fontSize: '1em' },
  '& hr': {
    my: 1,
    border: 'none',
    borderTop: '1px solid',
    borderColor: 'divider',
  },
  '& strong': { fontWeight: 600 },
});

const AIChatPanel: React.FC<AIChatPanelProps> = ({ open, onClose }) => {
  const { t } = useTranslation();
  const { currentProjectId, currentProject } = useOrgProject();
  const { currentEnvironmentId, currentEnvironment } = useEnvironment();
  const {
    messages,
    isStreaming,
    currentChatId,
    error,
    sendMessage,
    loadChat,
    clearChat,
    abort,
  } = useAIChat({
    projectId: currentProjectId,
    environmentId: currentEnvironment?.environmentId || null,
    projectName: currentProject?.displayName || null,
    environmentName:
      currentEnvironment?.displayName || currentEnvironmentId || null,
  });

  const [inputValue, setInputValue] = useState('');
  const [panelView, setPanelView] = useState<PanelView>('chat');
  const [chatHistory, setChatHistory] = useState<AIChatListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [drawerWidth, setDrawerWidth] = useState(getSavedWidth);
  const inputRef = useRef<HTMLInputElement>(null);
  const isResizingRef = useRef(false);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const initialLoadDoneRef = useRef(false);

  // Auto-load the most recent chat when panel opens for the first time
  useEffect(() => {
    if (open && !initialLoadDoneRef.current && !currentChatId && messages.length === 0) {
      initialLoadDoneRef.current = true;
      (async () => {
        try {
          const result = await aiChatService.listChats({ limit: 1 });
          if (result.chats.length > 0) {
            const chat = await aiChatService.getChat(result.chats[0].id);
            loadChat(result.chats[0].id, chat.messages);
          }
        } catch (e) {
          console.error('Failed to auto-load last chat:', e);
        }
      })();
    }
  }, [open, currentChatId, messages.length, loadChat]);

  // Auto-focus input when panel opens or view switches to chat
  useEffect(() => {
    if (open && panelView === 'chat') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, panelView]);

  // Auto-scroll to bottom on new messages using Virtuoso
  useEffect(() => {
    if (messages.length > 0) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        virtuosoRef.current?.scrollToIndex({
          index: messages.length - 1,
          align: 'end',
          behavior: isStreaming ? 'smooth' : 'auto',
        });
      });
    }
  }, [messages, isStreaming]);

  // Load chat history
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const result = await aiChatService.listChats({ limit: 50 });
      setChatHistory(result.chats);
      setHistoryTotal(result.total);
    } catch (e) {
      console.error('Failed to load chat history:', e);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Load history when switching to history view
  useEffect(() => {
    if (panelView === 'history') {
      loadHistory();
    }
  }, [panelView, loadHistory]);

  // Handle send
  const handleSend = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isStreaming) return;
    setInputValue('');
    await sendMessage(trimmed);
    // Re-focus input after send
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [inputValue, isStreaming, sendMessage]);

  // Handle key press
  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Load a chat from history
  const handleLoadChat = useCallback(
    async (chatId: string) => {
      try {
        const chat = await aiChatService.getChat(chatId);
        loadChat(chatId, chat.messages);
        setPanelView('chat');
      } catch (e) {
        console.error('Failed to load chat:', e);
      }
    },
    [loadChat]
  );

  // Delete a chat
  const handleDeleteChat = useCallback(
    async (chatId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await aiChatService.deleteChat(chatId);
        setChatHistory((prev) => prev.filter((c) => c.id !== chatId));
      } catch (err) {
        console.error('Failed to delete chat:', err);
      }
    },
    []
  );

  // New chat - focus input after clearing
  const handleNewChat = useCallback(() => {
    clearChat();
    setPanelView('chat');
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [clearChat]);

  // Resize handling - save width to localStorage on mouseup
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isResizingRef.current = true;
    e.preventDefault();

    let latestWidth = 0;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newWidth = window.innerWidth - ev.clientX;
      latestWidth = Math.max(
        MIN_DRAWER_WIDTH,
        Math.min(MAX_DRAWER_WIDTH, newWidth)
      );
      setDrawerWidth(latestWidth);
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Save width to localStorage
      if (latestWidth > 0) {
        try {
          localStorage.setItem(STORAGE_KEY_WIDTH, String(latestWidth));
        } catch {
          // Ignore storage errors
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // Render individual message item for Virtuoso
  const renderMessage = useCallback(
    (index: number) => {
      const msg = messages[index];
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            px: 2,
            py: 0.75,
          }}
        >
          <Box sx={getMessageBubbleSx(msg.role)}>
            {msg.role === 'assistant' ? (
              // Streaming with no content yet - show typing dots
              isStreaming && index === messages.length - 1 && !msg.content ? (
                <Box sx={{ display: 'flex', gap: 0.5, py: 0.5, px: 0.5 }}>
                  {[0, 1, 2].map((i) => (
                    <Box
                      key={i}
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: 'text.secondary',
                        animation: 'dotBounce 1.4s infinite ease-in-out',
                        animationDelay: `${i * 0.2}s`,
                        '@keyframes dotBounce': {
                          '0%, 80%, 100%': {
                            transform: 'scale(0.6)',
                            opacity: 0.4,
                          },
                          '40%': { transform: 'scale(1)', opacity: 1 },
                        },
                      }}
                    />
                  ))}
                </Box>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content}
                </ReactMarkdown>
              )
            ) : (
              msg.content
            )}
            {isStreaming &&
              index === messages.length - 1 &&
              msg.role === 'assistant' &&
              msg.content && (
                <Box
                  component="span"
                  sx={{
                    display: 'inline-block',
                    width: 6,
                    height: 14,
                    bgcolor: 'text.primary',
                    ml: 0.5,
                    animation: 'blink 1s infinite',
                    '@keyframes blink': {
                      '0%, 50%': { opacity: 1 },
                      '51%, 100%': { opacity: 0 },
                    },
                  }}
                />
              )}
          </Box>
        </Box>
      );
    },
    [messages, isStreaming]
  );

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      variant="persistent"
      PaperProps={{
        sx: {
          width: drawerWidth,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: (theme) =>
            theme.palette.mode === 'dark' ? '#1a1d23' : 'background.paper',
        },
      }}
    >
      {/* Resize Handle */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          cursor: 'col-resize',
          zIndex: 10,
          '&:hover': { bgcolor: 'primary.main', opacity: 0.5 },
        }}
      />

      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          minHeight: 56,
        }}
      >
        {panelView === 'history' ? (
          <>
            <IconButton size="small" onClick={() => setPanelView('chat')}>
              <ArrowBackIcon />
            </IconButton>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {t('aiChat.history')}
              </Typography>
              {historyTotal > 0 && (
                <Chip label={historyTotal} size="small" color="primary" variant="outlined" />
              )}
            </Box>
          </>
        ) : (
          <>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SmartToyIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={600}>
                {t('aiChat.title')}
              </Typography>
            </Box>
          </>
        )}

        <Box>
          {panelView === 'chat' && (
            <>
              <Tooltip title={t('aiChat.newChat')}>
                <IconButton size="small" onClick={handleNewChat}>
                  <AddIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title={t('aiChat.history')}>
                <IconButton
                  size="small"
                  onClick={() => setPanelView('history')}
                >
                  <HistoryIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
          <Tooltip title={t('common.close')}>
            <IconButton size="small" onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Chat view */}
      {panelView === 'chat' && (
        <>
          {/* Messages - Virtualized */}
          {messages.length === 0 ? (
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.5,
                gap: 1,
                p: 2,
              }}
            >
              <SmartToyIcon sx={{ fontSize: 48 }} />
              <Typography variant="body2">{t('aiChat.placeholder')}</Typography>
            </Box>
          ) : (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Virtuoso
                ref={virtuosoRef}
                style={{ flex: 1 }}
                totalCount={messages.length}
                itemContent={renderMessage}
                followOutput="auto"
                initialTopMostItemIndex={messages.length - 1}
                overscan={200}
              />
              {error && (
                <Box sx={{ textAlign: 'center', py: 0.5, px: 2 }}>
                  <Typography variant="caption" color="error">
                    {error}
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          <Divider />

          {/* Input */}
          <Box
            sx={{
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <TextField
              inputRef={inputRef}
              id="ai-chat-input"
              fullWidth
              multiline
              maxRows={4}
              size="small"
              placeholder={t('aiChat.inputPlaceholder')}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isStreaming}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '20px',
                  bgcolor: 'background.paper',
                  transition: 'all 0.2s ease-in-out',
                  '& fieldset': {
                    borderColor: 'divider',
                  },
                  '&:hover': {
                    bgcolor: 'action.hover',
                    '& fieldset': {
                      borderColor: 'primary.light',
                    },
                  },
                  '&.Mui-focused': {
                    bgcolor: 'background.paper',
                    boxShadow: '0 0 0 2px rgba(25, 118, 210, 0.1)',
                    '& fieldset': {
                      borderColor: 'primary.main',
                      borderWidth: '1px',
                    },
                  },
                },
                '& .MuiInputBase-input': {
                  fontSize: '0.875rem',
                },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    {isStreaming ? (
                      <IconButton
                        size="small"
                        color="error"
                        onClick={abort}
                        sx={{ p: 0.5 }}
                      >
                        <StopIcon sx={{ fontSize: 20 }} />
                      </IconButton>
                    ) : (
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={handleSend}
                        disabled={!inputValue.trim()}
                        sx={{ p: 0.5 }}
                      >
                        <SendIcon sx={{ fontSize: 20 }} />
                      </IconButton>
                    )}
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </>
      )}

      {/* History view */}
      {panelView === 'history' && (
        <Box sx={{ flex: 1, overflow: 'auto' }}>
          {historyLoading ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                p: 4,
              }}
            >
              <CircularProgress size={24} />
            </Box>
          ) : chatHistory.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 4, opacity: 0.5 }}>
              <Typography variant="body2">{t('aiChat.noHistory')}</Typography>
            </Box>
          ) : (
            <List disablePadding>
              {chatHistory.map((chat) => (
                <ListItemButton
                  key={chat.id}
                  onClick={() => handleLoadChat(chat.id)}
                  sx={{ borderBottom: 1, borderColor: 'divider' }}
                >
                  <ListItemText
                    primary={chat.title || t('aiChat.untitledChat')}
                    secondary={new Date(chat.updatedAt).toLocaleString()}
                    primaryTypographyProps={{
                      noWrap: true,
                      fontSize: '0.875rem',
                    }}
                    secondaryTypographyProps={{ fontSize: '0.75rem' }}
                  />
                  <Tooltip title={t('common.delete')}>
                    <IconButton
                      size="small"
                      onClick={(e) => handleDeleteChat(chat.id, e)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
      )}
    </Drawer>
  );
};

// Floating button to toggle AI Chat
export const AIChatFloatingButton: React.FC<{
  onClick: () => void;
  visible: boolean;
}> = ({ onClick, visible }) => {
  const { t } = useTranslation();

  return (
    <Zoom in={visible}>
      <Tooltip title={t('aiChat.title')} placement="left">
        <Fab
          id="ai-chat-fab"
          color="primary"
          onClick={onClick}
          sx={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 1200,
            '&:hover .MuiSvgIcon-root': {
              animation: `${wiggleAnimation} 0.5s ease-in-out`,
            },
          }}
        >
          <SmartToyIcon />
        </Fab>
      </Tooltip>
    </Zoom>
  );
};

export default AIChatPanel;
