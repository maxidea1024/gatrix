import React, { useState, useRef, useEffect } from 'react';
import { Box, TextField, IconButton, Paper, Chip, Typography, Tooltip } from '@mui/material';
import {
  Send as SendIcon,
  EmojiEmotions as EmojiIcon,
  AttachFile as AttachIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useChat } from '../../contexts/ChatContext';
import { User } from '../../types/chat';
import EmojiPicker from './EmojiPicker';
import FileUpload from './FileUpload';
import MentionAutocomplete from './MentionAutocomplete';

interface AdvancedMessageInputProps {
  channelId: number;
  onSendMessage: (content: string, attachments?: File[]) => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  focusTrigger?: number;
  isThreadOpen?: boolean; // 스레드 열림 상태를 전달받아 포커스 관리에 활용
  threadId?: number; // 스레드 메시지인 경우 threadId
}

const AdvancedMessageInput: React.FC<AdvancedMessageInputProps> = ({
  channelId,
  onSendMessage,
  placeholder,
  disabled = false,
  autoFocus = false,
  focusTrigger,
  isThreadOpen = false,
  threadId,
}) => {
  const { t } = useTranslation();
  const { state, actions } = useChat();
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [emojiAnchorEl, setEmojiAnchorEl] = useState<HTMLElement | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  const [showMentions, setShowMentions] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const textFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const currentChannel = state.channels.find((c) => c.id === channelId);
  const channelUsers = currentChannel?.members || [];

  // ThreadView 등에서 강제로 포커스가 필요할 때
  useEffect(() => {
    if (autoFocus && !disabled && !isThreadOpen) {
      // 스레드가 열려있지 않을 때만 포커스
      const t = setTimeout(() => {
        textFieldRef.current?.focus();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [autoFocus, disabled, isThreadOpen]);

  // 외부에서 focusTrigger가 변경되면 포커스 시도 (스레드가 열려있지 않을 때만)
  useEffect(() => {
    if (focusTrigger !== undefined && !disabled && !isThreadOpen) {
      const t = setTimeout(() => {
        textFieldRef.current?.focus();
      }, 0);
      return () => clearTimeout(t);
    }
  }, [focusTrigger, disabled, isThreadOpen]);

  // WebSocket 연결 및 채널 준비 완료 시 입력창에 포커스(기존 동작 유지)
  useEffect(() => {
    if (
      channelId &&
      textFieldRef.current &&
      !disabled &&
      state.isConnected &&
      currentChannel &&
      autoFocus &&
      !isThreadOpen
    ) {
      // 스레드가 열려있지 않을 때만 자동 포커스
      // WebSocket 연결, 채널 존재, 비활성화 상태가 아닐 때만 포커스
      const timer = setTimeout(() => {
        textFieldRef.current?.focus();
      }, 50); // 딜레이를 더 줄임
      return () => clearTimeout(timer);
    }
  }, [channelId, disabled, state.isConnected, currentChannel, autoFocus, isThreadOpen]);

  // Handle typing indicator
  useEffect(() => {
    const hasContent = message.trim().length > 0;

    if (hasContent && !isTyping) {
      // 타이핑 시작
      setIsTyping(true);
      actions.startTyping(channelId, threadId);
    } else if (!hasContent && isTyping) {
      // 메시지가 비어있으면 즉시 타이핑 중지
      setIsTyping(false);
      actions.stopTyping(channelId, threadId);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      return;
    }

    // 타이핑 중일 때만 타임아웃 설정
    if (hasContent && isTyping) {
      // 기존 타임아웃 클리어
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // 3초 후 타이핑 중지
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        actions.stopTyping(channelId, threadId);
        typingTimeoutRef.current = null;
      }, 3000);
    }

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [message, channelId, actions]); // isTyping 의존성 제거로 무한 루프 방지

  // Stop typing when component unmounts
  useEffect(() => {
    return () => {
      if (isTyping) {
        actions.stopTyping(channelId);
      }
    };
  }, [channelId, isTyping, actions]);

  const handleMessageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setMessage(value);

    // Check for mention trigger
    const cursorPosition = event.target.selectionStart || 0;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1];
      setMentionQuery(query);
      setShowMentions(true);

      // Calculate position for mention dropdown
      const textField = textFieldRef.current;
      if (textField) {
        const rect = textField.getBoundingClientRect();
        setMentionPosition({
          top: rect.top - 200,
          left: rect.left + 10,
        });
      }
    } else {
      setShowMentions(false);
      setMentionQuery('');
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    console.log('⌨️ handleKeyPress called:', {
      key: event.key,
      shiftKey: event.shiftKey,
      ctrlKey: event.ctrlKey,
      altKey: event.altKey,
    });

    if (event.key === 'Enter' && !event.shiftKey) {
      console.log('✅ Enter key pressed, calling handleSendMessage');
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = () => {
    if (!message.trim() && attachments.length === 0) {
      return;
    }

    onSendMessage(message.trim(), attachments);
    setMessage('');
    setAttachments([]);
    setShowMentions(false);

    if (isTyping) {
      setIsTyping(false);
      actions.stopTyping(channelId);
    }

    // 메시지 전송 후 입력창에 포커스 유지 (더 강화된 포커스)
    requestAnimationFrame(() => {
      textFieldRef.current?.focus();
      // 추가 보장을 위한 두 번째 시도
      setTimeout(() => {
        if (document.activeElement !== textFieldRef.current) {
          textFieldRef.current?.focus();
        }
      }, 50);
    });
  };

  const handleEmojiSelect = (emoji: string) => {
    const cursorPosition = textFieldRef.current?.selectionStart || message.length;
    const newMessage =
      message.substring(0, cursorPosition) + emoji + message.substring(cursorPosition);
    setMessage(newMessage);

    // 이모지 선택창 닫기
    setEmojiAnchorEl(null);

    // Focus back to input with proper cursor position (더 강화된 포커스)
    requestAnimationFrame(() => {
      textFieldRef.current?.focus();
      const newCursorPosition = cursorPosition + emoji.length;
      textFieldRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);

      // 추가 보장을 위한 두 번째 시도
      setTimeout(() => {
        if (document.activeElement !== textFieldRef.current) {
          textFieldRef.current?.focus();
          textFieldRef.current?.setSelectionRange(newCursorPosition, newCursorPosition);
        }
      }, 100);
    });
  };

  const handleMentionSelect = (user: User) => {
    const cursorPosition = textFieldRef.current?.selectionStart || 0;
    const textBeforeCursor = message.substring(0, cursorPosition);
    const textAfterCursor = message.substring(cursorPosition);

    // Replace the @query with @username
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      const beforeMention = textBeforeCursor.substring(0, mentionMatch.index);
      const newMessage = beforeMention + `@${user.username} ` + textAfterCursor;
      setMessage(newMessage);

      // Set cursor position after the mention
      setTimeout(() => {
        const newPosition = beforeMention.length + user.username.length + 2;
        textFieldRef.current?.setSelectionRange(newPosition, newPosition);
        textFieldRef.current?.focus();
      }, 0);
    }

    setShowMentions(false);
    setMentionQuery('');
  };

  const handleFileSelect = (files: File[]) => {
    setAttachments((prev) => [...prev, ...files]);
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <Box sx={{ mb: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            {t('chat.attachments')} ({attachments.length})
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {attachments.map((file, index) => (
              <Chip
                key={index}
                label={`${file.name} (${formatFileSize(file.size)})`}
                onDelete={() => handleRemoveAttachment(index)}
                deleteIcon={<CloseIcon />}
                variant="outlined"
                size="small"
              />
            ))}
          </Box>
        </Box>
      )}

      {/* Message Input */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
        <FileUpload
          onFileSelect={handleFileSelect}
          onLocationShare={(location) => {
            // Handle location sharing
            onSendMessage(`📍 ${location.name || 'Location'}: ${location.address}`);
          }}
        />

        <IconButton
          size="small"
          onClick={(e) => setEmojiAnchorEl(e.currentTarget)}
          sx={{ color: 'text.secondary' }}
        >
          <EmojiIcon />
        </IconButton>

        <TextField
          inputRef={textFieldRef}
          fullWidth
          multiline
          maxRows={4}
          value={message}
          onChange={handleMessageChange}
          onKeyPress={handleKeyPress}
          placeholder={placeholder || t('chat.typeMessage')}
          disabled={disabled}
          variant="outlined"
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 0,
              '& fieldset': {
                borderWidth: '1px',
                borderColor: 'rgba(0, 0, 0, 0.12)',
              },
              '&:hover fieldset': {
                borderColor: 'rgba(0, 0, 0, 0.2)',
              },
              '&.Mui-focused fieldset': {
                borderWidth: '1px', // 기본 2px에서 1px로 줄임
                borderColor: 'rgba(25, 118, 210, 0.4)', // 투명도를 높여 더 부드럽게
                boxShadow: '0 0 0 1px rgba(25, 118, 210, 0.1)', // 매우 부드러운 그림자 효과
              },
            },
            '& .MuiInputBase-root': {
              '&.Mui-focused': {
                '& .MuiOutlinedInput-notchedOutline': {
                  borderWidth: '1px !important',
                },
              },
            },
          }}
        />

        <Tooltip title={t('chat.sendMessage')}>
          <span>
            <IconButton
              onClick={handleSendMessage}
              disabled={disabled || (!message.trim() && attachments.length === 0)}
              color="primary"
              sx={{
                '&:not(:disabled)': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                },
              }}
            >
              <SendIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {/* Emoji Picker */}
      <EmojiPicker
        anchorEl={emojiAnchorEl}
        open={Boolean(emojiAnchorEl)}
        onClose={() => setEmojiAnchorEl(null)}
        onEmojiSelect={handleEmojiSelect}
      />

      {/* Mention Autocomplete */}
      <MentionAutocomplete
        users={channelUsers.map((m: any) => m.user || m)}
        query={mentionQuery}
        position={mentionPosition}
        visible={showMentions}
        onSelect={handleMentionSelect}
        onClose={() => setShowMentions(false)}
      />
    </Box>
  );
};

export default AdvancedMessageInput;
