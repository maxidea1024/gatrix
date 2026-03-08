import React, { useEffect, useState } from 'react';
import {
  Box,
  Popover,
  IconButton,
  Typography,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  AccessTime,
  EmojiEmotions,
  BackHand,
  Pets,
  Fastfood,
  SportsSoccer,
  DirectionsCar,
  Devices,
  FavoriteBorder,
  Flag,
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
    '😀',
    '😃',
    '😄',
    '😁',
    '😆',
    '😅',
    '🤣',
    '😂',
    '🙂',
    '🙃',
    '😉',
    '😊',
    '😇',
    '🥰',
    '😍',
    '😘',
    '😗',
    '😙',
    '😚',
    '😋',
    '😛',
    '😝',
    '😜',
    '🤪',
    '🤨',
    '🧐',
    '🤓',
    '😎',
    '🤩',
    '🥳',
    '😏',
    '😒',
    '🙄',
    '😬',
    '🤥',
    '😌',
    '😔',
    '😪',
    '🤤',
    '😴',
    '😷',
    '🤒',
    '🤕',
    '🤢',
    '🤮',
    '🤧',
    '🥵',
    '🥶',
    '🥴',
    '😵',
    '🤯',
    '🤠',
    '😳',
    '😱',
    '😨',
    '😰',
    '😥',
    '😓',
    '🥲',
    '😟',
    '😕',
    '🙁',
    '☹️',
    '😣',
    '😖',
    '😫',
    '😩',
    '🥺',
    '😢',
    '😭',
    '😤',
    '😠',
    '😡',
    '🤬',
    '🤗',
    '🤔',
    '🫣',
    '🫠',
    '🫢',
    '🫡',
    '🫥',
    '🤫',
    '🤭',
    '🫨',
    '🫤',
    '🤐',
    '🤑',
  ],
  people: [
    '👋',
    '🤚',
    '🖐️',
    '✋',
    '🖖',
    '👌',
    '🤏',
    '✌️',
    '🤞',
    '🤟',
    '🤘',
    '🤙',
    '👈',
    '👉',
    '👆',
    '🖕',
    '👇',
    '☝️',
    '👍',
    '👎',
    '👊',
    '✊',
    '🤛',
    '🤜',
    '👏',
    '🙌',
    '👐',
    '🤲',
    '🤝',
    '🙏',
    '✍️',
    '💅',
    '🤳',
    '💪',
    '🦾',
    '🦿',
    '🦵',
    '🦶',
    '👂',
    '🦻',
  ],
  nature: [
    '🐶',
    '🐱',
    '🐭',
    '🐹',
    '🐰',
    '🦊',
    '🐻',
    '🐼',
    '🐨',
    '🐯',
    '🦁',
    '🐮',
    '🐷',
    '🐽',
    '🐸',
    '🐵',
    '🙈',
    '🙉',
    '🙊',
    '🐒',
    '🐔',
    '🐧',
    '🐦',
    '🐤',
    '🐣',
    '🐥',
    '🦆',
    '🦅',
    '🦉',
    '🦇',
    '🐺',
    '🐗',
    '🐴',
    '🦄',
    '🐝',
    '🐛',
    '🦋',
    '🐌',
    '🐞',
    '🐜',
  ],
  food: [
    '🍎',
    '🍐',
    '🍊',
    '🍋',
    '🍌',
    '🍉',
    '🍇',
    '🍓',
    '🫐',
    '🍈',
    '🍒',
    '🍑',
    '🥭',
    '🍍',
    '🥥',
    '🥝',
    '🍅',
    '🍆',
    '🥑',
    '🥦',
    '🥬',
    '🥒',
    '🌶️',
    '🫑',
    '🌽',
    '🥕',
    '🫒',
    '🧄',
    '🧅',
    '🥔',
    '🍠',
    '🥐',
    '🥖',
    '🍞',
    '🥨',
    '🥯',
    '🧀',
    '🥚',
    '🍳',
    '🧈',
  ],
  activities: [
    '⚽',
    '🏀',
    '🏈',
    '⚾',
    '🥎',
    '🎾',
    '🏐',
    '🏉',
    '🥏',
    '🎱',
    '🪀',
    '🏓',
    '🏸',
    '🏒',
    '🏑',
    '🥍',
    '🏏',
    '🪃',
    '🥅',
    '⛳',
    '🪁',
    '🏹',
    '🎣',
    '🤿',
    '🥊',
    '🥋',
    '🎽',
    '🛹',
    '🛷',
    '⛸️',
  ],
  travel: [
    '🚗',
    '🚕',
    '🚙',
    '🚌',
    '🚎',
    '🏎️',
    '🚓',
    '🚑',
    '🚒',
    '🚐',
    '🛻',
    '🚚',
    '🚛',
    '🚜',
    '🏍️',
    '🛵',
    '🚲',
    '🛴',
    '🛺',
    '🚨',
    '🚔',
    '🚍',
    '🚘',
    '🚖',
    '🚡',
    '🚠',
    '🚟',
    '🚃',
    '🚋',
    '🚞',
  ],
  objects: [
    '⌚',
    '📱',
    '📲',
    '💻',
    '⌨️',
    '🖥️',
    '🖨️',
    '🖱️',
    '🖲️',
    '🕹️',
    '🗜️',
    '💽',
    '💾',
    '💿',
    '📀',
    '📼',
    '📷',
    '📸',
    '📹',
    '🎥',
    '📽️',
    '🎞️',
    '📞',
    '☎️',
    '📟',
    '📠',
    '📺',
    '📻',
    '🎙️',
    '🎚️',
  ],
  symbols: [
    '❤️',
    '🧡',
    '💛',
    '💚',
    '💙',
    '💜',
    '🖤',
    '🤍',
    '🤎',
    '💔',
    '❣️',
    '💕',
    '💞',
    '💓',
    '💗',
    '💖',
    '💘',
    '💝',
    '💟',
    '☮️',
    '✝️',
    '☪️',
    '🕉️',
    '☸️',
    '✡️',
    '🔯',
    '🕎',
    '☯️',
    '☦️',
    '🛐',
  ],
  flags: [
    '🏁',
    '🚩',
    '🎌',
    '🏴',
    '🏳️',
    '🏳️‍🌈',
    '🏳️‍⚧️',
    '🏴‍☠️',
    '🇦🇨',
    '🇦🇩',
    '🇦🇪',
    '🇦🇫',
    '🇦🇬',
    '🇦🇮',
    '🇦🇱',
    '🇦🇲',
    '🇦🇴',
    '🇦🇶',
    '🇦🇷',
    '🇦🇸',
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
  // 이 피커가 열려있는 동안에만 Modal backdrop의 blur를 비Active화
  useEffect(() => {
    if (open) {
      document.body.classList.add('no-backdrop-blur');
    } else {
      document.body.classList.remove('no-backdrop-blur');
    }
    return () => {
      document.body.classList.remove('no-backdrop-blur');
    };
  }, [open]);

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
          /* 이 이모지 피커가 열려있는 동안에만 blur 제거 */
          .no-backdrop-blur .MuiBackdrop-root {
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
        BackdropProps={{
          className: 'emoji-picker-backdrop',
          style: {
            backgroundColor: 'transparent',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            filter: 'none',
          },
        }}
        PaperProps={{
          sx: {
            width: 420, // 슬랙 스타일로 더 넓게
            height: 520, // 세로 높이 확장하여 내부 스크롤 방지
            maxHeight: 'min(70vh, 560px)',
            p: 0,
            bgcolor: 'background.paper',
            overflow: 'hidden',
          },
        }}
      >
        <Box sx={{ height: '100%', display: 'flex', minHeight: 0 }}>
          {/* 슬랙 스타일 세로 카테고리 사이드바 */}
          {!searchQuery && (
            <>
              <Box
                sx={{
                  width: 60,
                  height: '100%',
                  backgroundColor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? 'rgba(255, 255, 255, 0.05)'
                      : '#f5f5f5',
                  display: 'flex',
                  flexDirection: 'column',
                  py: 1,
                  flexShrink: 0,
                  overflow: 'auto',
                  borderRight: (theme) => `1px solid ${theme.palette.divider}`,
                }}
              >
                {Object.keys(categoryLabels).map((category) => {
                  const isSelected = selectedCategory === category;

                  const Icon = {
                    recent: AccessTime,
                    smileys: EmojiEmotions,
                    people: BackHand,
                    nature: Pets,
                    food: Fastfood,
                    activities: SportsSoccer,
                    travel: DirectionsCar,
                    objects: Devices,
                    symbols: FavoriteBorder,
                    flags: Flag,
                  }[
                    category as keyof typeof categoryLabels
                  ] as React.ElementType;

                  return (
                    <IconButton
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      sx={{
                        width: 44,
                        height: 44,
                        mx: 'auto',
                        mb: 0.5,
                        color: isSelected
                          ? 'primary.main'
                          : (theme) =>
                              theme.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.7)'
                                : 'rgba(0, 0, 0, 0.6)',
                        backgroundColor: isSelected
                          ? (theme) =>
                              theme.palette.mode === 'dark'
                                ? 'rgba(144, 202, 249, 0.16)'
                                : 'rgba(25, 118, 210, 0.08)'
                          : 'transparent',
                        borderRadius: 0,
                        '&:hover': {
                          backgroundColor: isSelected
                            ? (theme) =>
                                theme.palette.mode === 'dark'
                                  ? 'rgba(144, 202, 249, 0.24)'
                                  : 'rgba(25, 118, 210, 0.12)'
                            : (theme) =>
                                theme.palette.mode === 'dark'
                                  ? 'rgba(255, 255, 255, 0.08)'
                                  : 'rgba(0, 0, 0, 0.04)',
                        },
                        '& .MuiTouchRipple-root': { display: 'none' },
                      }}
                      title={
                        categoryLabels[category as keyof typeof categoryLabels]
                      }
                      disableRipple
                    >
                      <Icon fontSize="small" />
                    </IconButton>
                  );
                })}
              </Box>
            </>
          )}

          {/* 메인 컨텐츠 영역 */}
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              p: 2,
              overflow: 'hidden',
            }}
          >
            {/* Search */}
            <Box sx={{ mb: 2 }}>
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
                fullWidth
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: (theme) =>
                      theme.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(0, 0, 0, 0.02)',
                    '&:hover': {
                      backgroundColor: (theme) =>
                        theme.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.04)',
                    },
                    '&.Mui-focused': {
                      backgroundColor: (theme) =>
                        theme.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.04)',
                    },
                  },
                }}
              />
            </Box>

            {/* 카테고리 제목 */}
            {!searchQuery && (
              <Typography
                variant="subtitle2"
                sx={{
                  mb: 1.5,
                  px: 0.5,
                  color: 'text.secondary',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {
                  categoryLabels[
                    selectedCategory as keyof typeof categoryLabels
                  ]
                }
              </Typography>
            )}

            {/* Emoji Grid */}
            <Box
              sx={{
                flex: 1,
                overflow: 'auto',
              }}
            >
              {filteredEmojis.length === 0 ? (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '200px',
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    {searchQuery ? t('chat.noEmojisFound') : t('chat.noEmojis')}
                  </Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(8, 1fr)',
                    gap: 0.5,
                    pb: 1,
                  }}
                >
                  {filteredEmojis.map((emoji, index) => (
                    <IconButton
                      key={`${emoji}-${index}`}
                      size="small"
                      onClick={() => handleEmojiClick(emoji)}
                      disableRipple
                      sx={{
                        width: 40,
                        height: 40,
                        fontSize: '1.5rem',
                        color: 'inherit',
                        backgroundColor: 'transparent',
                        borderRadius: 0,
                        '&:hover': {
                          backgroundColor: (theme) =>
                            theme.palette.mode === 'dark'
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(0, 0, 0, 0.04)',
                          transform: 'scale(1.2)',
                        },
                        transition: 'all 0.15s ease-in-out',
                      }}
                    >
                      <span style={{ display: 'block', lineHeight: 1 }}>
                        {emoji}
                      </span>
                    </IconButton>
                  ))}
                </Box>
              )}
            </Box>
          </Box>
        </Box>
      </Popover>
    </>
  );
};

export default EmojiPicker;
