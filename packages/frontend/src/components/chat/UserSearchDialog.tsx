import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  Button,
  IconButton,
  Typography,
  CircularProgress,
  Box,
  Chip,
} from '@mui/material';
import {
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { debounce } from 'lodash';

interface User {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string;
}

interface UserSearchDialogProps {
  open: boolean;
  onClose: () => void;
  onInviteUser: (userId: number) => Promise<void>;
  title?: string;
  excludeUserIds?: number[];
}

const UserSearchDialog: React.FC<UserSearchDialogProps> = ({
  open,
  onClose,
  onInviteUser,
  title = 'Search Users',
  excludeUserIds = [],
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [invitingUsers, setInvitingUsers] = useState<Set<number>>(new Set());

  // 검색 API 호출
  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/v1/users/search?q=${encodeURIComponent(query)}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // 제외할 사용자들 필터링
          const filteredUsers = data.data.filter((user: User) => 
            !excludeUserIds.includes(user.id)
          );
          setSearchResults(filteredUsers);
        } else {
          enqueueSnackbar(data.error || 'Search failed', { variant: 'error' });
        }
      } else {
        enqueueSnackbar('Search failed', { variant: 'error' });
      }
    } catch (error) {
      console.error('Search error:', error);
      enqueueSnackbar('Search failed', { variant: 'error' });
    } finally {
      setIsSearching(false);
    }
  };

  // 디바운스된 검색 함수
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      searchUsers(query);
    }, 300),
    [excludeUserIds]
  );

  // 검색어 변경 시 디바운스된 검색 실행
  useEffect(() => {
    debouncedSearch(searchQuery);
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, debouncedSearch]);

  // 다이얼로그 닫힐 때 상태 초기화
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSearchResults([]);
      setInvitingUsers(new Set());
    }
  }, [open]);

  // 사용자 초대 처리
  const handleInviteUser = async (userId: number) => {
    setInvitingUsers(prev => new Set(prev).add(userId));
    
    try {
      await onInviteUser(userId);
      enqueueSnackbar('Invitation sent successfully', { variant: 'success' });
      
      // 초대 성공 시 검색 결과에서 제거
      setSearchResults(prev => prev.filter(user => user.id !== userId));
    } catch (error: any) {
      console.error('Invite error:', error);
      enqueueSnackbar(error.message || 'Failed to send invitation', { variant: 'error' });
    } finally {
      setInvitingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">{title}</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <TextField
          fullWidth
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            endAdornment: isSearching && <CircularProgress size={20} />,
          }}
          sx={{ mb: 2 }}
        />

        {searchQuery.length > 0 && searchQuery.length < 2 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            Type at least 2 characters to search
          </Typography>
        )}

        {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            No users found
          </Typography>
        )}

        <List>
          {searchResults.map((user) => (
            <ListItem key={user.id} divider>
              <ListItemAvatar>
                <Avatar src={user.avatarUrl} alt={user.name}>
                  {user.name.charAt(0).toUpperCase()}
                </Avatar>
              </ListItemAvatar>
              
              <ListItemText
                primary={user.name}
                secondary={user.email}
              />
              
              <ListItemSecondaryAction>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={
                    invitingUsers.has(user.id) ? (
                      <CircularProgress size={16} />
                    ) : (
                      <PersonAddIcon />
                    )
                  }
                  onClick={() => handleInviteUser(user.id)}
                  disabled={invitingUsers.has(user.id)}
                >
                  {invitingUsers.has(user.id) ? 'Inviting...' : 'Invite'}
                </Button>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
        </List>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default UserSearchDialog;
