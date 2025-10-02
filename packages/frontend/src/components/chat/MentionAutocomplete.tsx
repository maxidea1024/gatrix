import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Chip,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { User } from '../../types/chat';

interface MentionAutocompleteProps {
  users: User[];
  query: string;
  position: { top: number; left: number };
  onSelect: (user: User) => void;
  onClose: () => void;
  visible: boolean;
}

const MentionAutocomplete: React.FC<MentionAutocompleteProps> = ({
  users,
  query,
  position,
  onSelect,
  onClose,
  visible,
}) => {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter users based on query
  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(query.toLowerCase()) ||
    user.name?.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 10); // Limit to 10 results

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!visible || filteredUsers.length === 0) return;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setSelectedIndex(prev => 
            prev < filteredUsers.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          event.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : filteredUsers.length - 1
          );
          break;
        case 'Enter':
          event.preventDefault();
          if (filteredUsers[selectedIndex]) {
            onSelect(filteredUsers[selectedIndex]);
          }
          break;
        case 'Escape':
          event.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, filteredUsers, selectedIndex, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }
  }, [selectedIndex]);

  if (!visible || filteredUsers.length === 0) {
    return null;
  }

  return (
    <Paper
      elevation={8}
      sx={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 1300,
        maxWidth: 300,
        maxHeight: 200,
        overflow: 'hidden',
        border: 1,
        borderColor: 'divider',
      }}
    >
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">
          {t('chat.mentionUsers')}
        </Typography>
      </Box>
      
      <List
        ref={listRef}
        dense
        sx={{
          maxHeight: 160,
          overflow: 'auto',
          py: 0,
        }}
      >
        {filteredUsers.map((user, index) => (
          <ListItem key={user.id} disablePadding>
            <ListItemButton
              selected={index === selectedIndex}
              onClick={() => onSelect(user)}
              sx={{
                py: 0.5,
                '&.Mui-selected': {
                  backgroundColor: 'primary.light',
                  '&:hover': {
                    backgroundColor: 'primary.main',
                  },
                },
              }}
            >
              <ListItemAvatar sx={{ minWidth: 36 }}>
                <Avatar
                  src={user.avatarUrl}
                  sx={{ width: 24, height: 24, fontSize: '0.75rem' }}
                >
                  {user.username.charAt(0).toUpperCase()}
                </Avatar>
              </ListItemAvatar>
              
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      @{user.username}
                    </Typography>
                    {user.role === 'admin' && (
                      <Chip
                        label={t('chat.admin')}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ height: 16, fontSize: '0.6rem' }}
                      />
                    )}
                    {user.status === 'online' && (
                      <Box
                        sx={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: 'success.main',
                        }}
                      />
                    )}
                  </Box>
                }
                secondary={user.name}
                primaryTypographyProps={{
                  variant: 'body2',
                  noWrap: true,
                }}
                secondaryTypographyProps={{
                  variant: 'caption',
                  noWrap: true,
                  color: 'text.secondary',
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      
      <Box sx={{ p: 1, borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="caption" color="text.secondary">
          {t('chat.mentionHint')}
        </Typography>
      </Box>
    </Paper>
  );
};

export default MentionAutocomplete;
