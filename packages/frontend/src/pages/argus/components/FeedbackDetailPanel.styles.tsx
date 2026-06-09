import { styled, alpha } from '@mui/material/styles';
import { Box, Paper, Chip, Typography, Button, Divider } from '@mui/material';

// ─── Layout ───

export const DetailContainer = styled(Box)({
  flex: 1,
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
});

export const DetailHeader = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  paddingLeft: 20,
  paddingRight: 20,
  paddingTop: 12,
  paddingBottom: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
  flexShrink: 0,
}));

export const DetailToolbar = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 6.4,
  paddingBottom: 6.4,
  display: 'flex',
  alignItems: 'center',
  gap: 0,
  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  flexShrink: 0,
  backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.01)',
}));

export const DetailBody = styled(Box)({
  flex: 1,
  overflow: 'auto',
  paddingLeft: 20,
  paddingRight: 20,
  paddingTop: 16,
  paddingBottom: 16,
});

// ─── Toolbar ───

export const ToolbarButtonGroup = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  display: 'flex',
  alignItems: 'center',
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
  borderRadius: '8px',
  overflow: 'hidden',
}));

export const ToolbarButton = styled(Button, {
  shouldForwardProp: (p) => p !== 'isDark' && p !== 'accentColor' && p !== 'isSubdued',
})<{ isDark: boolean; accentColor: string; isSubdued?: boolean }>(
  ({ isDark, accentColor, isSubdued }) => ({
    textTransform: 'none',
    fontSize: '0.72rem',
    fontWeight: isSubdued ? 500 : 600,
    paddingLeft: 9.6,
    paddingRight: 9.6,
    minHeight: 30,
    borderRadius: 0,
    color: accentColor,
    '&:hover': {
      backgroundColor: alpha(accentColor, isDark ? 0.15 : 0.08),
    },
  })
);

export const ToolbarDivider = styled(Divider, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
}));

// ─── Content Blocks ───

export const MessagePaper = styled(Paper, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  padding: 16,
  marginBottom: 16,
  borderRadius: 8,
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
}));

export const LinkedIssuePaper = styled(Paper, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  marginBottom: 16,
  borderRadius: 8,
  overflow: 'hidden',
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
}));

export const LinkedIssueHeaderBar = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  paddingLeft: 12,
  paddingRight: 12,
  paddingTop: 4.8,
  paddingBottom: 4.8,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
}));

export const CardActionButton = styled(Button, {
  shouldForwardProp: (p) => p !== 'isDark' && p !== 'accentColor',
})<{ isDark: boolean; accentColor: string }>(({ isDark, accentColor }) => ({
  textTransform: 'none',
  fontSize: '0.68rem',
  fontWeight: 500,
  borderRadius: '6px',
  paddingLeft: 12,
  paddingRight: 12,
  minHeight: 26,
  backgroundColor: alpha(accentColor, isDark ? 0.12 : 0.08),
  color: isDark ? alpha(accentColor, 0.7) : accentColor,
  border: `1px solid ${alpha(accentColor, isDark ? 0.25 : 0.2)}`,
  '&:hover': {
    backgroundColor: alpha(accentColor, isDark ? 0.2 : 0.14),
  },
}));

// ─── Metadata ───

export const MetadataPaper = styled(Paper, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  marginBottom: 16,
  borderRadius: 8,
  overflow: 'hidden',
  backgroundColor: 'transparent',
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
}));

export const MetadataRow = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  paddingLeft: 12,
  paddingRight: 12,
  paddingTop: 6.4,
  paddingBottom: 6.4,
  borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
  '&:last-child': { borderBottom: 'none' },
}));

export const SectionTitle = styled(Typography)({
  display: 'block',
  marginBottom: 8,
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
});

// ─── Chips ───

export const StatusChip = styled(Chip, {
  shouldForwardProp: (p) => p !== 'statusColor',
})<{ statusColor: string }>(({ statusColor }) => ({
  height: 22,
  fontSize: '0.68rem',
  fontWeight: 700,
  backgroundColor: alpha(statusColor, 0.12),
  color: statusColor,
  border: 'none',
}));

export const IssueStatusChip = styled(Chip, {
  shouldForwardProp: (p) => p !== 'statusColor',
})<{ statusColor: string }>(({ statusColor }) => ({
  height: 18,
  fontSize: '0.6rem',
  fontWeight: 700,
  backgroundColor: alpha(statusColor, 0.12),
  color: statusColor,
  border: 'none',
  flexShrink: 0,
}));

export const TagChip = styled(Chip)(({ theme }) => ({
  height: 22,
  fontSize: '0.65rem',
  backgroundColor: alpha(theme.palette.primary.main, 0.08),
  border: 'none',
}));

// ─── Attachments ───

export const AttachmentThumbnail = styled(Box, {
  shouldForwardProp: (p) => p !== 'isDark',
})<{ isDark: boolean }>(({ isDark }) => ({
  width: 188,
  height: 141,
  borderRadius: 6,
  overflow: 'hidden',
  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
  cursor: 'pointer',
  transition: 'all 0.15s',
  '&:hover': {
    borderColor: '#7c4dff',
    transform: 'scale(1.03)',
  },
}));
