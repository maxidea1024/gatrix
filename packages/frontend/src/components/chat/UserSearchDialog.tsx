import React, { useState, useEffect, useCallback, useRef } from "react";
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
} from "@mui/material";
import {
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
  Close as CloseIcon,
} from "@mui/icons-material";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";
import { debounce } from "lodash";
import { apiService } from "../../services/api";
import { ErrorCodes } from "@gatrix/shared";

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
  channelId?: number; // 채널 ID 추가
}

const UserSearchDialog: React.FC<UserSearchDialogProps> = ({
  open,
  onClose,
  onInviteUser,
  title,
  subtitle,
  excludeUserIds = [],
  channelId,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [invitingUsers, setInvitingUsers] = useState<Set<number>>(new Set());
  const [pendingInvitedUsers, setPendingInvitedUsers] = useState<Set<number>>(
    new Set(),
  );
  const [channelMemberIds, setChannelMemberIds] = useState<Set<number>>(
    new Set(),
  );

  // 검색 입력창 ref
  const searchInputRef = useRef<HTMLInputElement>(null);

  // 채널 멤버 조회
  const fetchChannelMembers = async () => {
    if (!channelId) return;

    try {
      const response = await fetch(`/api/v1/chat/channels/${channelId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Channel data response:", data); // 디버깅용
        if (data.success && data.data) {
          // members 배열에서 userId 추출
          const memberIds = new Set(
            (data.data.members || []).map((member: any) => member.userId),
          );
          console.log("Channel member IDs:", memberIds); // 디버깅용
          setChannelMemberIds(memberIds);
        }
      } else {
        console.error(
          "Failed to fetch channel members:",
          response.status,
          response.statusText,
        );
      }
    } catch (error) {
      console.error("Failed to fetch channel members:", error);
    }
  };

  // 채널의 pending invitation 조회
  const fetchPendingInvitations = async () => {
    if (!channelId) return;

    try {
      const response = await fetch(
        `/api/v1/chat/channels/${channelId}/pending-invitations`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        },
      );

      if (response.ok) {
        const data = await response.json();
        console.log("Pending invitations response:", data); // 디버깅용
        if (data.success && data.data) {
          const invitedUserIds = new Set(
            data.data.map((invitation: any) => invitation.inviteeId),
          );
          console.log("Pending invited user IDs:", invitedUserIds); // 디버깅용
          setPendingInvitedUsers(invitedUserIds);
        }
      } else {
        console.error(
          "Failed to fetch pending invitations:",
          response.status,
          response.statusText,
        );
      }
    } catch (error) {
      console.error("Failed to fetch pending invitations:", error);
    }
  };

  // 검색 API 호출
  const searchUsers = async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await apiService.get<{ success: boolean; data: User[] }>(
        `/users/search?q=${encodeURIComponent(query)}`,
      );

      console.log("User search response:", response); // 디버깅용

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
          console.warn("Unexpected API response structure:", response);
          setSearchResults([]);
          return;
        }

        // 제외할 사용자들 필터링
        const filteredUsers = users.filter(
          (user: User) => !excludeUserIds.includes(user.id),
        );
        setSearchResults(filteredUsers);
      } else {
        console.error("Search API failed:", response);
        enqueueSnackbar(response.error?.message || "Search failed", {
          variant: "error",
        });
        setSearchResults([]);
      }
    } catch (error: any) {
      console.error("Search error:", error);
      enqueueSnackbar(error.message || "Search failed", { variant: "error" });
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 디바운스된 검색 함수 (300ms 지연)
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      if (query.trim().length >= 2) {
        searchUsers(query.trim());
      }
    }, 300),
    [excludeUserIds],
  );

  // 검색어 변경 시 디바운스된 검색 실행
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      // 최소 2글자 이상일 때만 검색
      debouncedSearch(searchQuery.trim());
    } else {
      // 검색어가 짧으면 결과 초기화
      setSearchResults([]);
      debouncedSearch.cancel();
    }

    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, debouncedSearch]);

  // 다이얼로그 열릴 때 채널 멤버 및 pending invitation 조회
  useEffect(() => {
    if (open && channelId) {
      fetchChannelMembers();
      fetchPendingInvitations();
    }
  }, [open, channelId]);

  // 다이얼로그가 열릴 때 검색 입력창에 포커스
  useEffect(() => {
    if (open) {
      // 다이얼로그 애니메이션이 완료된 후 포커스 설정
      const timer = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [open]);

  // 다이얼로그 닫힐 때 상태 초기화
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSearchResults([]);
      setInvitingUsers(new Set());
      setPendingInvitedUsers(new Set());
      setChannelMemberIds(new Set());
    }
  }, [open]);

  // 사용자 초대 처리
  const handleInviteUser = async (userId: number) => {
    setInvitingUsers((prev) => new Set(prev).add(userId));

    try {
      await onInviteUser(userId);

      // 초대 성공 시 pending invitation 목록에 추가
      setPendingInvitedUsers((prev) => new Set(prev).add(userId));

      // 먼저 다이얼로그를 닫고 토스트를 표시 (backdrop에 가려지지 않도록)
      onClose();

      // 다이얼로그가 닫힌 후 토스트 표시
      setTimeout(() => {
        enqueueSnackbar(t("chat.invitationSent"), { variant: "success" });
      }, 100);
    } catch (error: any) {
      console.error("Invite error:", error);

      // Use error code for specific handling
      const errorCode = error?.error?.code || error?.code || "";
      const errorMessage = error?.error?.message || error?.message || "";

      switch (errorCode) {
        case ErrorCodes.CHANNEL_MEMBER_EXISTS:
        case ErrorCodes.ALREADY_MEMBER:
          // 이미 멤버인 경우 - 멤버 목록 새로고침
          await fetchChannelMembers();
          enqueueSnackbar(t("chat.alreadyMember"), { variant: "info" });
          break;
        case ErrorCodes.INVITATION_PENDING:
        case ErrorCodes.ALREADY_INVITED:
          // 이미 초대된 경우 - pending invitation 목록 새로고침
          await fetchPendingInvitations();
          enqueueSnackbar(t("chat.alreadyInvited"), { variant: "warning" });
          break;
        default:
          // 기타 오류
          enqueueSnackbar(errorMessage || t("chat.invitationFailed"), {
            variant: "error",
          });
      }
    } finally {
      setInvitingUsers((prev) => {
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
          borderRadius: 0,
          minHeight: 500, // 최소 높이를 늘려서 안정화
          maxHeight: 600, // 최대 높이 제한
        },
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="h6">
              {title || t("chat.inviteUsers")}
            </Typography>
            {subtitle && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mt: 0.5 }}
              >
                {subtitle}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent
        sx={{
          minHeight: 350, // 최소 높이 설정으로 안정화
          display: "flex",
          flexDirection: "column",
          paddingTop: 3, // 윗부분 패딩 증가로 테두리 잘림 방지
          overflow: "visible", // overflow 설정으로 테두리 표시 보장
        }}
      >
        <TextField
          fullWidth
          inputRef={searchInputRef}
          placeholder={t("chat.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <SearchIcon sx={{ mr: 1, color: "text.secondary" }} />
            ),
            endAdornment: isSearching && <CircularProgress size={20} />,
          }}
          sx={{
            mb: 2,
            "& .MuiOutlinedInput-root": {
              "& fieldset": {
                borderWidth: "1px",
              },
              "&:hover fieldset": {
                borderWidth: "1px",
              },
              "&.Mui-focused fieldset": {
                borderWidth: "2px",
              },
            },
          }}
        />

        {/* 검색 결과 영역 - 고정 높이로 안정화 */}
        <Box
          sx={{
            flex: 1,
            minHeight: 280, // 고정 높이로 들썩임 방지
            display: "flex",
            flexDirection: "column",
          }}
        >
          {searchQuery.length > 0 && searchQuery.length < 2 && (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
              }}
            >
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ textAlign: "center" }}
              >
                {t("chat.searchMinLength")}
              </Typography>
            </Box>
          )}

          {searchQuery.length >= 2 &&
            searchResults.length === 0 &&
            !isSearching && (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: 1,
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ textAlign: "center" }}
                >
                  {t("chat.noUsersFound")}
                </Typography>
              </Box>
            )}

          {searchQuery.length === 0 && (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                textAlign: "center",
              }}
            >
              <SearchIcon
                sx={{ fontSize: 48, color: "text.secondary", mb: 2 }}
              />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {t("chat.searchUsers")}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t("chat.searchUsersDescription")}
              </Typography>
            </Box>
          )}

          {searchResults.length > 0 && (
            <List sx={{ flex: 1, overflow: "auto" }}>
              {searchResults.map((user) => (
                <ListItem key={user.id} divider>
                  <ListItemAvatar>
                    <Avatar src={user.avatarUrl} alt={user.name}>
                      {user.name.charAt(0).toUpperCase()}
                    </Avatar>
                  </ListItemAvatar>

                  <ListItemText primary={user.name} secondary={user.email} />

                  <ListItemSecondaryAction>
                    {(() => {
                      const isInviting = invitingUsers.has(user.id);
                      const isPendingInvited = pendingInvitedUsers.has(user.id);
                      const isMember = channelMemberIds.has(user.id);

                      // 이미 멤버인 경우
                      if (isMember) {
                        return (
                          <Chip
                            label={t("chat.alreadyMember")}
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                        );
                      }

                      // 초대 대기 중인 경우
                      if (isPendingInvited) {
                        return (
                          <Button
                            variant="outlined"
                            size="small"
                            disabled
                            startIcon={<PersonAddIcon />}
                            sx={{
                              color: "warning.main",
                              borderColor: "warning.main",
                              "&.Mui-disabled": {
                                color: "warning.main",
                                borderColor: "warning.main",
                                opacity: 0.7,
                              },
                            }}
                          >
                            {t("chat.invitationPending")}
                          </Button>
                        );
                      }

                      // 초대 가능한 경우
                      return (
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={
                            isInviting ? (
                              <CircularProgress size={16} />
                            ) : (
                              <PersonAddIcon />
                            )
                          }
                          onClick={() => handleInviteUser(user.id)}
                          disabled={isInviting}
                        >
                          {isInviting
                            ? t("chat.inviting")
                            : t("chat.inviteButton")}
                        </Button>
                      );
                    })()}
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
