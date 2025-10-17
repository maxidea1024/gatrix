import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  IconButton,
  Skeleton,
  Link as MuiLink,
} from '@mui/material';
import { Close as CloseIcon, Link as LinkIcon } from '@mui/icons-material';

interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

interface LinkPreviewProps {
  url: string;
  onRemove?: () => void;
}

const LinkPreview: React.FC<LinkPreviewProps> = ({ url, onRemove }) => {
  const [loading, setLoading] = useState(true);
  const [previewData, setPreviewData] = useState<LinkPreviewData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Simulate fetching link preview data
    // In a real implementation, you would call an API endpoint that fetches Open Graph data
    const fetchPreview = async () => {
      try {
        setLoading(true);
        setError(false);

        // For now, just extract basic info from URL
        // In production, you'd call your backend API to fetch Open Graph metadata
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.replace('www.', '');

        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 500));

        setPreviewData({
          url,
          title: hostname,
          description: url,
          siteName: hostname,
        });
      } catch (err) {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (url) {
      fetchPreview();
    }
  }, [url]);

  if (loading) {
    return (
      <Card variant="outlined" sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', p: 2 }}>
          <Skeleton variant="rectangular" width={120} height={80} sx={{ borderRadius: 1, mr: 2 }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="80%" height={24} />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="60%" />
          </Box>
        </Box>
      </Card>
    );
  }

  if (error || !previewData) {
    return (
      <Card variant="outlined" sx={{ mb: 2, borderColor: 'divider' }}>
        <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <LinkIcon color="action" />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ color: 'primary.main' }}>
              {url}
            </Typography>
          </Box>
          {onRemove && (
            <IconButton size="small" onClick={onRemove}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 2,
        borderColor: 'divider',
        transition: 'all 0.2s',
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: 1,
        },
      }}
    >
      <Box sx={{ display: 'flex', position: 'relative' }}>
        {previewData.image && (
          <CardMedia
            component="img"
            sx={{ width: 120, height: 80, objectFit: 'cover' }}
            image={previewData.image}
            alt={previewData.title}
          />
        )}
        <CardContent sx={{ flex: 1, py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {previewData.siteName && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  {previewData.siteName}
                </Typography>
              )}
              <MuiLink
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                sx={{ display: 'block', mb: 0.5 }}
              >
                <Typography variant="body2" fontWeight="medium" noWrap>
                  {previewData.title || url}
                </Typography>
              </MuiLink>
              {previewData.description && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {previewData.description}
                </Typography>
              )}
            </Box>
            {onRemove && (
              <IconButton size="small" onClick={onRemove} sx={{ mt: -0.5 }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </CardContent>
      </Box>
    </Card>
  );
};

export default LinkPreview;

