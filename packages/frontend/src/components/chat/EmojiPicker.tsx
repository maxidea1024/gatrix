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
    onClose?.();
  };

  const filteredEmojis = searchQuery
    ? Object.values(emojiCategories)
        .flat()
        .filter((emoji) => emoji.includes(searchQuery))
    : emojiCategories[selectedCategory as keyof typeof emojiCategories] || [];

  const categoryLabels = {
    recent: t('chat.recentEmojis', 'Recent'),
    smileys: t('chat.smileysEmojis', 'Smileys'),
    people: t('chat.peopleEmojis', 'People'),
    nature: t('chat.natureEmojis', 'Nature'),
    food: t('chat.foodEmojis', 'Food'),
    activities: t('chat.activitiesEmojis', 'Activities'),
    travel: t('chat.travelEmojis', 'Travel'),
    objects: t('chat.objectsEmojis', 'Objects'),
    symbols: t('chat.symbolsEmojis', 'Symbols'),
    flags: t('chat.flagsEmojis', 'Flags'),
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
          placeholder={t('chat.searchEmojis', 'Search emojis...')}
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
                  ? t('chat.noEmojisFound', 'No emojis found')
                  : t('chat.noEmojis', 'No emojis')}
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={0.5}>
              {filteredEmojis.map((emoji, index) => (
                <Grid item key={`${emoji}-${index}`}>
                  <IconButton
                    size="small"
                    onClick={() => handleEmojiClick(emoji)}
                    sx={{
                      width: 32,
                      height: 32,
                      fontSize: '1.2rem',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                        transform: 'scale(1.2)',
                      },
                      transition: 'transform 0.1s ease-in-out',
                    }}
                  >
                    {emoji}
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
