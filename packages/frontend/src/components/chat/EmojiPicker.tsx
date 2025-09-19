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
        invisible: true, // 백드롭을 투명하게 만들어서 보이지 않게 함
      }}
      PaperProps={{
        sx: {
          width: 320,
          height: 400,
          p: 1,
        },
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
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

        {/* Category Tabs */}
        {!searchQuery && (
          <Tabs
            value={selectedCategory}
            onChange={(_, value) => setSelectedCategory(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ mb: 1, minHeight: 32 }}
          >
            {Object.keys(categoryLabels).map((category) => (
              <Tab
                key={category}
                value={category}
                label={categoryLabels[category as keyof typeof categoryLabels]}
                sx={{ minHeight: 32, fontSize: '0.75rem', py: 0.5 }}
              />
            ))}
          </Tabs>
        )}

        {/* Emoji Grid */}
        <Box sx={{ flex: 1, overflow: 'auto' }}>
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
                      opacity: '1 !important', // 강제로 불투명도 설정
                      filter: 'none !important', // 강제로 필터 제거
                      color: 'inherit !important', // 색상 상속
                      backgroundColor: 'transparent !important',
                      '&:hover': {
                        backgroundColor: 'action.hover !important',
                        transform: 'scale(1.2)',
                        opacity: '1 !important',
                      },
                      '&:active': {
                        opacity: '1 !important',
                      },
                      '&:focus': {
                        opacity: '1 !important',
                      },
                      '&.Mui-disabled': {
                        opacity: '1 !important',
                      },
                      transition: 'transform 0.1s ease-in-out',
                      // 모든 상태에서 이모지가 선명하게 보이도록
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
    </Popover>
  );
};

export default EmojiPicker;
