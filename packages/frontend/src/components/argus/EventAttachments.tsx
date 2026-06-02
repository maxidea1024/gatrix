/**
 * EventAttachments — G25+G26: File attachments and screenshots.
 *
 * Displays attachments associated with an event (minidumps, screenshots, logs).
 * Provides download and inline preview for images.
 */
import React, { useState } from 'react';
import {
  Box, Typography, Paper, IconButton, Chip, Collapse,
  Tooltip, alpha, useTheme, Dialog, DialogContent,
} from '@mui/material';
import {
  AttachFile as AttachIcon,
  Download as DownloadIcon,
  Image as ImageIcon,
  Description as FileIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  ZoomIn as ZoomIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  thumbnailUrl?: string;
}

interface EventAttachmentsProps {
  attachments: Attachment[];
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageType(type: string): boolean {
  return type.startsWith('image/') || ['screenshot', 'png', 'jpg', 'jpeg', 'gif', 'webp'].some(ext => type.includes(ext));
}

const EventAttachments: React.FC<EventAttachmentsProps> = ({ attachments }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';
  const [expanded, setExpanded] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  if (!attachments || attachments.length === 0) return null;

  const images = attachments.filter(a => isImageType(a.type));
  const files = attachments.filter(a => !isImageType(a.type));

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          borderRadius: 2, overflow: 'hidden', mb: 1.5,
        }}
      >
        <Box
          onClick={() => setExpanded(!expanded)}
          sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            px: 2, py: 1, cursor: 'pointer',
            '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)' },
          }}
        >
          <AttachIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
          <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, flex: 1 }}>
            {t('argus.attachments.title')}
          </Typography>
          <Chip label={attachments.length} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }} />
          <IconButton size="small" sx={{ width: 20, height: 20 }}>
            {expanded ? <CollapseIcon sx={{ fontSize: 14 }} /> : <ExpandIcon sx={{ fontSize: 14 }} />}
          </IconButton>
        </Box>

        <Collapse in={expanded}>
          <Box sx={{ px: 2, pb: 1.5 }}>
            {/* Screenshots / Images */}
            {images.length > 0 && (
              <Box sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase', mb: 0.5 }}>
                  {t('argus.attachments.screenshots')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {images.map((img) => (
                    <Box
                      key={img.id}
                      sx={{
                        width: 120, height: 80,
                        borderRadius: '8px', overflow: 'hidden',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                        cursor: 'pointer', position: 'relative',
                        '&:hover .zoom-overlay': { opacity: 1 },
                      }}
                      onClick={() => setPreviewImage(img.url)}
                    >
                      <Box
                        component="img"
                        src={img.thumbnailUrl || img.url}
                        alt={img.name}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <Box
                        className="zoom-overlay"
                        sx={{
                          position: 'absolute', inset: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: 'rgba(0,0,0,0.4)', opacity: 0,
                          transition: 'opacity 0.15s',
                        }}
                      >
                        <ZoomIcon sx={{ color: '#fff', fontSize: 24 }} />
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            {/* Other Files */}
            {files.map((file) => (
              <Box
                key={file.id}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1,
                  py: 0.75, px: 1, borderRadius: '6px',
                  '&:hover': { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' },
                }}
              >
                <FileIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, flex: 1 }}>
                  {file.name}
                </Typography>
                <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>
                  {formatFileSize(file.size)}
                </Typography>
                <Chip label={file.type.split('/').pop()} size="small" sx={{ height: 16, fontSize: '0.55rem' }} />
                <Tooltip title={t('argus.attachments.download')}>
                  <IconButton
                    size="small"
                    component="a"
                    href={file.url}
                    download={file.name}
                    sx={{ width: 24, height: 24 }}
                  >
                    <DownloadIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Box>
        </Collapse>
      </Paper>

      {/* Image Preview Dialog */}
      <Dialog
        open={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
        maxWidth="lg"
        PaperProps={{ sx: { borderRadius: '12px', overflow: 'hidden', backgroundColor: 'transparent', boxShadow: 'none' } }}
      >
        <DialogContent sx={{ p: 0, position: 'relative' }}>
          <IconButton
            onClick={() => setPreviewImage(null)}
            sx={{
              position: 'absolute', top: 8, right: 8, zIndex: 1,
              backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff',
              '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' },
            }}
          >
            <CloseIcon />
          </IconButton>
          {previewImage && (
            <Box component="img" src={previewImage} sx={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain' }} />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EventAttachments;
