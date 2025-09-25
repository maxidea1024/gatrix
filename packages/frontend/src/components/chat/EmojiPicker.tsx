import React, { useState } from 'react';
import {
  Box,
  Popover,
  IconButton,
  Grid,
  Typography,
  Tabs,
  Tab,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  EmojiEmotions as EmojiIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface EmojiPickerProps {
  onEmojiSelect: (emoji: string) => void;
  anchorEl?: HTMLElement | null;
  open?: boolean;
  onClose?: () => void;
}

// Common emoji categories
const emojiCategories = {
  recent: ['😀', '😂', '❤️', '👍', '👎', '😊', '😢', '😮', '😡', '🎉'],
  smileys: [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
    '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
    '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬',
  ],
  people: [
    '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟',
    '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎',
    '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏',
    '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻',
  ],
  nature: [
    '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
    '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
    '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
    '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜',
  ],
  food: [
    '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈',
    '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦',
    '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔',
    '🍠', '🥐', '🥖', '🍞', '🥨', '🥯', '🧀', '🥚', '🍳', '🧈',
  ],
  activities: [
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
    '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
    '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️',
  ],
  travel: [
    '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
    '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛺', '🚨',
    '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞',
  ],
  objects: [
    '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️',
    '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥',
    '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️',
  ],
  symbols: [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
    '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
  ],
  flags: [
    '🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇨', '🇦🇩',
    '🇦🇪', '🇦🇫', '🇦🇬', '🇦🇮', '🇦🇱', '🇦🇲', '🇦🇴', '🇦🇶', '🇦🇷', '🇦🇸',
  ],
};

const EmojiPicker: React.FC<EmojiPickerProps> = ({
  onEmojiSelect,
  anchorEl,
  open = false,
  onClose,
}) => {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState('recent');
  const [searchQuery, setSearchQuery] = useState('');

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    // onClose는 AdvancedMessageInput에서 처리하므로 여기서는 호출하지 않음
  };

  const filteredEmojis = searchQuery
    ? Object.values(emojiCategories)
        .flat()
        .filter((emoji) => emoji.includes(searchQuery))
    : emojiCategories[selectedCategory as keyof typeof emojiCategories] || [];

  const categoryLabels = {
    recent: t('chat.recentEmojis'),
    smileys: t('chat.smileysEmojis'),
    people: t('chat.peopleEmojis'),
    nature: t('chat.natureEmojis'),
    food: t('chat.foodEmojis'),
    activities: t('chat.activitiesEmojis'),
    travel: t('chat.travelEmojis'),
    objects: t('chat.objectsEmojis'),
    symbols: t('chat.symbolsEmojis'),
    flags: t('chat.flagsEmojis'),
  };

  return (
    <>
      {/* 커스텀 스타일 추가 */}
      <style>
        {`
          .emoji-picker-backdrop {
            background-color: transparent !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            filter: none !important;
          }
        `}
      </style>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={onClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        disableBackdropClick={false}
        BackdropProps={{
          className: 'emoji-picker-backdrop',
          style: {
            backgroundColor: 'transparent',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            filter: 'none',
          }
        }}
        PaperProps={{
          sx: {
            width: 420, // 슬랙 스타일로 더 넓게
            height: 400,
            p: 0,
          },
        }}
      >
      <Box sx={{ height: '100%', display: 'flex' }}>
        {/* 슬랙 스타일 세로 카테고리 사이드바 */}
        {!searchQuery && (
          <Box sx={{
            width: 60,
            backgroundColor: '#f5f5f5', // 더 명확한 배경색
            borderRight: '1px solid #e0e0e0', // 명확한 분리선
            display: 'flex',
            flexDirection: 'column',
            py: 1
          }}>
            {Object.keys(categoryLabels).map((category) => {
              const categoryIcons = {
                recent: '🕒',
                smileys: '😀',
                people: '👋',
                nature: '🐶',
                food: '🍎',
                activities: '⚽',
                travel: '🚗',
                objects: '💻',
                symbols: '🔮', // 다른 아이콘으로 변경
                flags: '🏁'
              };

              const isSelected = selectedCategory === category;

              return (
                <IconButton
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  sx={{
                    width: 44,
                    height: 44,
                    mx: 'auto',
                    mb: 0.5,
                    fontSize: '1.2rem',
                    backgroundColor: isSelected ? '#1976d2' : 'transparent',
                    color: isSelected ? 'white' : 'inherit',
                    borderRadius: '8px',
                    '&:hover': {
                      backgroundColor: isSelected ? '#1565c0' : '#e0e0e0',
                    },
                    // 이모지 스타일 초기화
                    '& .MuiTouchRipple-root': {
                      display: 'none'
                    }
                  }}
                  title={categoryLabels[category as keyof typeof categoryLabels]}
                  disableRipple
                >
                  {categoryIcons[category as keyof typeof categoryIcons]}
                </IconButton>
              );
            })}
          </Box>
        )}

        {/* 메인 컨텐츠 영역 */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 1 }}>
          {/* Search */}
          <TextField
            size="small"
            placeholder={t('chat.searchEmojis')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ mb: 1 }}
          />

          {/* 카테고리 제목 */}
          {!searchQuery && (
            <Typography variant="subtitle2" sx={{ mb: 1, px: 1, color: 'text.secondary' }}>
              {categoryLabels[selectedCategory as keyof typeof categoryLabels]}
            </Typography>
          )}

          {/* Emoji Grid */}
          <Box sx={{
            flex: 1,
            overflow: 'auto',
            '&::-webkit-scrollbar': {
              width: '6px',
            },
            '&::-webkit-scrollbar-track': {
              background: 'transparent',
            },
            '&::-webkit-scrollbar-thumb': {
              background: 'rgba(0,0,0,0.2)',
              borderRadius: '3px',
              '&:hover': {
                background: 'rgba(0,0,0,0.3)',
              },
            },
          }}>
            {filteredEmojis.length === 0 ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {searchQuery
                    ? t('chat.noEmojisFound')
                    : t('chat.noEmojis')}
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={0.5}>
                {filteredEmojis.map((emoji, index) => (
                  <Grid key={`${emoji}-${index}`}>
                    <IconButton
                      size="small"
                      onClick={() => handleEmojiClick(emoji)}
                      disableRipple
                      sx={{
                        width: 32,
                        height: 32,
                        fontSize: '1.2rem',
                        opacity: '1 !important',
                        filter: 'none !important',
                        color: 'inherit !important',
                        backgroundColor: 'transparent !important',
                        '&:hover': {
                          backgroundColor: 'action.hover !important',
                          transform: 'scale(1.2)',
                          opacity: '1 !important',
                        },
                        transition: 'transform 0.1s ease-in-out',
                        '& *': {
                          opacity: '1 !important',
                          filter: 'none !important',
                        },
                      }}
                    >
                      <span style={{
                        opacity: 1,
                        filter: 'none',
                        display: 'block',
                        lineHeight: 1
                      }}>
                        {emoji}
                      </span>
                    </IconButton>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>
        </Box>
      </Box>
    </Popover>
  );
};

export default EmojiPicker;
