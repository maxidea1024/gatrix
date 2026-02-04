import React from 'react';
import { Box, Paper, Grid, Skeleton, Typography, LinearProgress, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface ChatSkeletonProps {
  stage: 'idle' | 'syncing' | 'connecting' | 'loading_channels' | 'complete';
}

const ChatSkeleton: React.FC<ChatSkeletonProps> = ({ stage }) => {
  const { t } = useTranslation();

  const getStageMessage = () => {
    switch (stage) {
      case 'syncing':
        return t('chat.loading.syncingUser', '사용자 정보를 동기화하는 중...');
      case 'connecting':
        return t('chat.loading.connecting', '채팅 서버에 연결하는 중...');
      case 'loading_channels':
        return t('chat.loading.loadingChannels', '채널 목록을 불러오는 중...');
      default:
        return t('chat.loading.initializing', '채팅을 초기화하는 중...');
    }
  };

  const getProgress = () => {
    switch (stage) {
      case 'syncing':
        return 25;
      case 'connecting':
        return 50;
      case 'loading_channels':
        return 75;
      case 'complete':
        return 100;
      default:
        return 0;
    }
  };

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 상단 헤더 스켈레톤 */}
      <Paper
        elevation={1}
        sx={{
          p: 2,
          borderRadius: 0,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <Skeleton variant="circular" width={40} height={40} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" height={24} />
            <Skeleton variant="text" width="40%" height={16} />
          </Box>
        </Stack>
      </Paper>

      {/* 메인 콘텐츠 영역 */}
      <Box sx={{ flex: 1, display: 'flex' }}>
        {/* 사이드바 스켈레톤 */}
        <Paper
          elevation={0}
          sx={{
            width: 280,
            borderRight: 1,
            borderColor: 'divider',
            borderRadius: 0,
          }}
        >
          <Box sx={{ p: 2 }}>
            {/* 채널 목록 헤더 */}
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Skeleton variant="text" width="70%" height={24} />
              <Skeleton variant="circular" width={24} height={24} />
            </Stack>

            {/* 채널 목록 스켈레톤 */}
            <Stack spacing={1}>
              {[...Array(6)].map((_, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', p: 1 }}>
                  <Skeleton variant="text" width="80%" height={20} />
                  <Box sx={{ ml: 'auto' }}>
                    <Skeleton variant="circular" width={16} height={16} />
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>
        </Paper>

        {/* 채팅 영역 스켈레톤 */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* 채팅 헤더 */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderBottom: 1,
              borderColor: 'divider',
              borderRadius: 0,
            }}
          >
            <Stack direction="row" alignItems="center" spacing={2}>
              <Skeleton variant="text" width="30%" height={28} />
              <Box sx={{ ml: 'auto' }}>
                <Skeleton variant="rectangular" width={80} height={32} />
              </Box>
            </Stack>
          </Paper>

          {/* 메시지 영역 */}
          <Box sx={{ flex: 1, p: 2 }}>
            <Stack spacing={2}>
              {[...Array(8)].map((_, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Skeleton variant="circular" width={32} height={32} />
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                      <Skeleton variant="text" width="20%" height={16} />
                      <Skeleton variant="text" width="15%" height={14} />
                    </Stack>
                    <Skeleton variant="text" width={`${Math.random() * 40 + 40}%`} height={20} />
                    {Math.random() > 0.7 && (
                      <Skeleton variant="text" width={`${Math.random() * 30 + 30}%`} height={20} />
                    )}
                  </Box>
                </Box>
              ))}
            </Stack>
          </Box>

          {/* 입력 영역 */}
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderTop: 1,
              borderColor: 'divider',
              borderRadius: 0,
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Skeleton variant="rectangular" sx={{ flex: 1, height: 40, borderRadius: 1 }} />
              <Skeleton variant="circular" width={40} height={40} />
            </Stack>
          </Paper>
        </Box>
      </Box>

      {/* 로딩 상태 표시 - 상단 고정 메시지 제거, 진행률만 표시 */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1300,
          bgcolor: 'background.paper',
        }}
      >
        <LinearProgress variant="determinate" value={getProgress()} sx={{ height: 2 }} />
      </Box>
    </Box>
  );
};

export default ChatSkeleton;
