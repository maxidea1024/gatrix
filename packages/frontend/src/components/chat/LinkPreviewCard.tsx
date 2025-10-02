import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardMedia,
  IconButton,
  useTheme,
  Chip,
  Avatar,
  Divider
} from '@mui/material';
import {
  OpenInNew as OpenInNewIcon,
  Close as CloseIcon,
  Schedule as ScheduleIcon,
  Person as PersonIcon
} from '@mui/icons-material';
import { LinkPreview } from '../../types/chat';
import { isImageUrl, isVideoUrl } from '../../utils/linkPreview';

interface LinkPreviewCardProps {
  linkPreview: LinkPreview;
  onClose?: () => void;
  showCloseButton?: boolean;
}

const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({
  linkPreview,
  onClose,
  showCloseButton = false
}) => {
  const theme = useTheme();
  const [imageError, setImageError] = useState(false);

  const handleOpenLink = () => {
    window.open(linkPreview.url, '_blank', 'noopener,noreferrer');
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'video': return 'error';
      case 'article': return 'primary';
      case 'image': return 'secondary';
      default: return 'default';
    }
  };

  const getTypeLabel = (type?: string) => {
    switch (type) {
      case 'video': return '동영상';
      case 'article': return '아티클';
      case 'image': return '이미지';
      case 'website': return '웹사이트';
      default: return '링크';
    }
  };

  return (
    <Card
      sx={{
        maxWidth: 450,
        margin: '8px 0',
        cursor: 'pointer',
        border: `1px solid ${theme.palette.mode === 'dark' ? '#444' : '#e0e0e0'}`,
        backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#f9f9f9',
        '&:hover': {
          backgroundColor: theme.palette.mode === 'dark' ? '#353535' : '#f0f0f0',
          borderColor: theme.palette.primary.main,
          boxShadow: theme.shadows[3]
        },
        position: 'relative',
        transition: 'all 0.2s ease-in-out'
      }}
      onClick={handleOpenLink}
    >
      {/* 닫기 버튼 */}
      {showCloseButton && onClose && (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            zIndex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            color: 'white',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
            }
          }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      )}

      {/* 이미지/비디오 미리보기 */}
      {linkPreview.image && !imageError && (
        <CardMedia
          component={isVideoUrl(linkPreview.image) ? 'video' : 'img'}
          height="200"
          image={linkPreview.image}
          alt={linkPreview.title || 'Link preview'}
          onError={handleImageError}
          sx={{
            objectFit: 'cover',
            backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#f5f5f5'
          }}
        />
      )}

      <CardContent sx={{ padding: '12px !important' }}>
        {/* 사이트명과 타입 */}
        <Box display="flex" alignItems="center" gap={1} mb={1}>
          {linkPreview.favicon && (
            <Avatar
              src={linkPreview.favicon}
              sx={{ width: 16, height: 16 }}
            />
          )}
          {linkPreview.siteName && (
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.mode === 'dark' ? '#9aa0a6' : '#666',
                fontSize: '12px',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              {linkPreview.siteName}
            </Typography>
          )}
          {linkPreview.type && (
            <Chip
              label={getTypeLabel(linkPreview.type)}
              size="small"
              color={getTypeColor(linkPreview.type)}
              variant="outlined"
              sx={{
                height: 18,
                fontSize: '0.65rem',
                '& .MuiChip-label': { px: 0.5 }
              }}
            />
          )}
        </Box>

        {/* 제목 */}
        {linkPreview.title && (
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              color: theme.palette.mode === 'dark' ? '#e8eaed' : '#1d1c1d',
              fontSize: '14px',
              lineHeight: 1.3,
              marginBottom: 1,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {linkPreview.title}
          </Typography>
        )}

        {/* 설명 */}
        {linkPreview.description && (
          <Typography
            variant="body2"
            sx={{
              color: theme.palette.mode === 'dark' ? '#9aa0a6' : '#666',
              fontSize: '13px',
              lineHeight: 1.4,
              marginBottom: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {linkPreview.description}
          </Typography>
        )}

        {/* 메타데이터 (작성자, 읽기시간) */}
        {(linkPreview.author || linkPreview.readingTime || linkPreview.publishedTime) && (
          <>
            <Divider sx={{ mb: 1 }} />
            <Box display="flex" alignItems="center" gap={2} mb={1}>
              {linkPreview.author && (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <PersonIcon
                    sx={{
                      fontSize: 14,
                      color: theme.palette.mode === 'dark' ? '#9aa0a6' : '#666'
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      color: theme.palette.mode === 'dark' ? '#9aa0a6' : '#666',
                      fontSize: '11px'
                    }}
                  >
                    {linkPreview.author}
                  </Typography>
                </Box>
              )}
              {linkPreview.readingTime && (
                <Box display="flex" alignItems="center" gap={0.5}>
                  <ScheduleIcon
                    sx={{
                      fontSize: 14,
                      color: theme.palette.mode === 'dark' ? '#9aa0a6' : '#666'
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      color: theme.palette.mode === 'dark' ? '#9aa0a6' : '#666',
                      fontSize: '11px'
                    }}
                  >
                    {linkPreview.readingTime}
                  </Typography>
                </Box>
              )}
              {linkPreview.publishedTime && (
                <Typography
                  variant="caption"
                  sx={{
                    color: theme.palette.mode === 'dark' ? '#9aa0a6' : '#666',
                    fontSize: '11px'
                  }}
                >
                  {linkPreview.publishedTime}
                </Typography>
              )}
            </Box>
          </>
        )}

        {/* URL */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.mode === 'dark' ? '#8ab4f8' : '#1976d2',
              fontSize: '11px',
              textDecoration: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1
            }}
          >
            {new URL(linkPreview.url).hostname}
          </Typography>
          <OpenInNewIcon
            sx={{
              fontSize: 12,
              color: theme.palette.mode === 'dark' ? '#8ab4f8' : '#1976d2',
              flexShrink: 0
            }}
          />
        </Box>
      </CardContent>
    </Card>
  );
};

export default LinkPreviewCard;
