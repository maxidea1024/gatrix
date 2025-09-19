import React from 'react';
import { Box, Typography, Link, Chip, Avatar } from '@mui/material';
import {
  Image as ImageIcon,
  VideoFile as VideoIcon,
  AudioFile as AudioIcon,
  AttachFile as FileIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';
import { Message, MessageType } from '../../types/chat';
import { LinkPreviewList } from '../LinkPreview';
import { linkPreviewService } from '../../services/linkPreviewService';

interface MessageContentProps {
  message: Message;
}

const MessageContent: React.FC<MessageContentProps> = ({ message }) => {
  const renderTextContent = (content: string) => {
    // Extract URLs for link previews
    const urls = linkPreviewService.extractUrls(content);

    // Process mentions, hashtags, and links
    const processedContent = content
      .replace(/@(\w+)/g, '<span class="cs-mention">@$1</span>')
      .replace(/#(\w+)/g, '<span class="cs-hashtag">#$1</span>')
      .replace(
        /(https?:\/\/[^\s]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
      );

    return (
      <Box>
        <Typography
          variant="body2"
          component="div"
          dangerouslySetInnerHTML={{ __html: processedContent }}
          sx={{
            wordBreak: 'break-word',
            '& .cs-mention': {
              backgroundColor: 'primary.light',
              color: 'primary.main',
              padding: '1px 4px',
              borderRadius: '4px',
              fontWeight: 500,
            },
            '& .cs-hashtag': {
              color: 'info.main',
              fontWeight: 500,
              cursor: 'pointer',
              '&:hover': {
                textDecoration: 'underline',
              },
            },
            '& a': {
              color: 'primary.main',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
              },
            },
          }}
        />
        {urls.length > 0 && (
          <Box sx={{ mt: 1 }} data-link-preview="container">
            <LinkPreviewList urls={urls} />
          </Box>
        )}
      </Box>
    );
  };

  const renderImageContent = () => (
    <Box sx={{ maxWidth: 300, borderRadius: 1, overflow: 'hidden' }}>
      <img
        src={message.attachments?.[0]?.url}
        alt="Shared image"
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
        }}
        loading="lazy"
      />
      {message.content && (
        <Box sx={{ p: 1 }}>
          {renderTextContent(message.content)}
        </Box>
      )}
    </Box>
  );

  const renderVideoContent = () => (
    <Box sx={{ maxWidth: 400, borderRadius: 1, overflow: 'hidden' }}>
      <video
        src={message.attachments?.[0]?.url}
        controls
        style={{
          width: '100%',
          height: 'auto',
          display: 'block',
        }}
      />
      {message.content && (
        <Box sx={{ p: 1 }}>
          {renderTextContent(message.content)}
        </Box>
      )}
    </Box>
  );

  const renderAudioContent = () => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}>
      <AudioIcon color="primary" />
      <audio
        src={message.attachments?.[0]?.url}
        controls
        style={{ flex: 1 }}
      />
    </Box>
  );

  const renderFileContent = () => {
    const attachment = message.attachments?.[0];
    if (!attachment) return null;

    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          backgroundColor: 'background.paper',
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
        }}
        onClick={() => window.open(attachment.url, '_blank')}
      >
        <FileIcon color="primary" />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap>
            {attachment.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {attachment.size ? formatFileSize(attachment.size) : 'Unknown size'}
          </Typography>
        </Box>
      </Box>
    );
  };

  const renderLocationContent = () => {
    const location = message.location;
    if (!location) return null;

    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          backgroundColor: 'background.paper',
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
        }}
        onClick={() => {
          const url = `https://maps.google.com/?q=${location.latitude},${location.longitude}`;
          window.open(url, '_blank');
        }}
      >
        <LocationIcon color="primary" />
        <Box>
          <Typography variant="body2">
            {location.name || 'Shared Location'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {location.address || `${location.latitude}, ${location.longitude}`}
          </Typography>
        </Box>
      </Box>
    );
  };

  const renderSystemMessage = () => (
    <Box sx={{ textAlign: 'center', py: 1 }}>
      <Chip
        label={message.content}
        size="small"
        variant="outlined"
        sx={{ fontSize: '0.75rem' }}
      />
    </Box>
  );

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle different message types
  switch (message.type) {
    case 'image':
      return renderImageContent();
    case 'video':
      return renderVideoContent();
    case 'audio':
      return renderAudioContent();
    case 'file':
      return renderFileContent();
    case 'location':
      return renderLocationContent();
    case 'system':
      return renderSystemMessage();
    case 'text':
    default:
      return renderTextContent(message.content);
  }
};

export default MessageContent;
