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
import { apiService } from '../../services/api';

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
  subtitle?: string;
  excludeUserIds?: number[];
}

const UserSearchDialog: React.FC<UserSearchDialogProps> = ({
  open,
  onClose,
  onInviteUser,
  title,
  subtitle,
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
      const response = await apiService.get<{ success: boolean; data: User[] }>(
        `/users/search?q=${encodeURIComponent(query)}`
      );

      console.log('User search response:', response); // 디버깅용

      if (response.success && response.data) {
        // API 응답 구조에 따라 적절히 처리
        let users: User[] = [];

        if (Array.isArray(response.data)) {
          // response.data가 직접 배열인 경우
          users = response.data;
        } else if (response.data.data && Array.isArray(response.data.data)) {
          // response.data.data가 배열인 경우
          users = response.data.data;
        } else {
          console.warn('Unexpected API response structure:', response);
          setSearchResults([]);
          return;
        }

        // 제외할 사용자들 필터링
        const filteredUsers = users.filter((user: User) =>
          !excludeUserIds.includes(user.id)
        );
        setSearchResults(filteredUsers);
      } else {
        console.error('Search API failed:', response);
        enqueueSnackbar(response.error?.message || 'Search failed', { variant: 'error' });
        setSearchResults([]);
      }
    } catch (error: any) {
      console.error('Search error:', error);
      enqueueSnackbar(error.message || 'Search failed', { variant: 'error' });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 디바운스된 검색 함수 (0.5초 지연)
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      searchUsers(query);
    }, 500),
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
      enqueueSnackbar(t('chat.invitationSent'), { variant: 'success' });

      // 초대 성공 시 검색 결과에서 제거
      setSearchResults(prev => prev.filter(user => user.id !== userId));

      // 초대 성공 시 창 닫기
      setTimeout(() => {
        onClose();
      }, 1000); // 1초 후 닫기 (성공 메시지를 볼 시간 제공)
    } catch (error: any) {
      console.error('Invite error:', error);
      enqueueSnackbar(error.message || t('chat.invitationFailed'), { variant: 'error' });
    } finally {
      setInvitingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          minHeight: 500, // 최소 높이를 늘려서 안정화
          maxHeight: 600, // 최대 높이 제한
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h6">{title || t('chat.inviteUsers')}</Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{
        minHeight: 350, // 최소 높이 설정으로 안정화
        display: 'flex',
        flexDirection: 'column'
      }}>
        <TextField
          fullWidth
          placeholder={t('chat.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
            endAdornment: isSearching && <CircularProgress size={20} />,
          }}
          sx={{ mb: 2 }}
        />

        {/* 검색 결과 영역 - 고정 높이로 안정화 */}
        <Box sx={{
          flex: 1,
          minHeight: 280, // 고정 높이로 들썩임 방지
          display: 'flex',
          flexDirection: 'column'
        }}>
          {searchQuery.length > 0 && searchQuery.length < 2 && (
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1
            }}>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                {t('chat.searchMinLength')}
              </Typography>
            </Box>
          )}

          {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
            <Box sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1
            }}>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                {t('chat.noUsersFound')}
              </Typography>
            </Box>
          )}

          {searchQuery.length === 0 && (
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 1,
              textAlign: 'center'
            }}>
              <SearchIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {t('chat.searchUsers')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('chat.searchUsersDescription')}
              </Typography>
            </Box>
          )}

          {searchResults.length > 0 && (
            <List sx={{ flex: 1, overflow: 'auto' }}>
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
                      {invitingUsers.has(user.id) ? t('chat.inviting') : t('chat.inviteButton')}
                    </Button>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default UserSearchDialog;
