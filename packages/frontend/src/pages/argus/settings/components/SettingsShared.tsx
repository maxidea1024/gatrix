import React, { useState } from 'react';
import {
  Box, Typography, Paper, TextField, Button, Chip, IconButton,
  Divider, useTheme, InputAdornment, alpha, Tooltip, Select, MenuItem,
  FormControl, InputLabel, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, Avatar, Menu
} from '@mui/material';
import {
  Add as AddIcon, Delete as DeleteIcon, Save as SaveIcon,
  PlayArrow as TestConnectionIcon, Close as CloseIcon,
  MoreVert as MoreVertIcon, Edit as EditIcon,
  Visibility as VisibilityIcon, VisibilityOff as VisibilityOffIcon,
  CheckCircle as CheckIcon, Cancel as CancelIcon
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/components/common/CopyButton';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('bash', bash);

export interface ProviderFieldDef {
  key: string;
  labelKey: string;
  labelFallback: string;
  placeholder: string;
  type?: string;
  options?: { value: string; label: string }[];
  width?: number;
}

/** 설정 카드 — 패널 단위 래퍼 */
export const SettingsCard: React.FC<{
  title: string; desc: string; isDark: boolean;
  children: React.ReactNode; headerAction?: React.ReactNode; footer?: React.ReactNode;
}> = ({ title, desc, isDark, children, headerAction, footer }) => {
  const theme = useTheme();
  const bdr = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  return (
    <Paper elevation={0} sx={{ border: `1px solid ${bdr}`, borderRadius: '12px', overflow: 'hidden', backgroundColor: theme.palette.background.paper }}>
      {/* Header */}
      <Box sx={{
        px: 3, py: 2.5, borderBottom: `1px solid ${bdr}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem', mt: 0.3 }}>{desc}</Typography>
        </Box>
        {headerAction}
      </Box>
      {/* Body */}
      <Box sx={{ p: 3 }}>{children}</Box>
      {/* Footer */}
      {footer && (
        <Box sx={{ px: 3, py: 2, borderTop: `1px solid ${bdr}`, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', display: 'flex', justifyContent: 'flex-end' }}>
          {footer}
        </Box>
      )}
    </Paper>
  );
};

/** 필드 블록 — Sentry 스타일 (라벨+설명 위, 인풋 아래, 일관된 폭) */
export const FieldBlock: React.FC<{
  label: string; desc: string; children: React.ReactNode; last?: boolean;
}> = ({ label, desc, children, last }) => (
  <Box sx={{
    py: 2.5,
    borderBottom: last ? 'none' : '1px solid',
    borderColor: 'divider',
  }}>
    <Typography sx={{ fontWeight: 600, fontSize: '0.88rem', mb: 0.3 }}>{label}</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.78rem', mb: 1.5, lineHeight: 1.5 }}>{desc}</Typography>
    {children}
  </Box>
);

/** 프로바이더 카드 (마켓플레이스 그리드용) */
export const ProviderCard: React.FC<{
  prov: { id: string; name: string; descKey: string; color: string; icon: React.ReactNode };
  isDark: boolean; t: any; count: number; onAdd: () => void;
}> = ({ prov, isDark, t, count, onAdd }) => {
  const bdr = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  return (
    <Paper elevation={0} onClick={onAdd}
      sx={{
        p: 2.5, border: `1px solid ${bdr}`, borderRadius: '12px',
        display: 'flex', flexDirection: 'column', gap: 1.5, cursor: 'pointer',
        transition: 'all 0.15s',
        '&:hover': { borderColor: alpha(prov.color, 0.5), transform: 'translateY(-1px)', boxShadow: `0 4px 16px ${alpha(prov.color, 0.1)}` },
      }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ width: 36, height: 36, backgroundColor: alpha(prov.color, isDark ? 0.2 : 0.08), color: prov.color, '& .MuiSvgIcon-root': { fontSize: 20 } }}>
          {prov.icon}
        </Avatar>
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{prov.name}</Typography>
          {count > 0 && <Chip label={`${count} ${t('argus.settings.configured')}`} size="small"
            sx={{ height: 18, fontSize: '0.58rem', fontWeight: 600, backgroundColor: alpha('#4caf50', 0.1), color: '#4caf50', border: 'none', mt: 0.3 }} />}
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.73rem', lineHeight: 1.5, flex: 1 }}>
        {t(prov.descKey)}
      </Typography>
      <Button size="small" variant="contained" fullWidth startIcon={<AddIcon />}
        onClick={e => { e.stopPropagation(); onAdd(); }}
        sx={{
          mt: 'auto', borderRadius: '8px', textTransform: 'none', fontWeight: 600, fontSize: '0.78rem',
        }}
      >
        {t('argus.settings.addConnection')}
      </Button>
    </Paper>
  );
};

/** 연결된 아이템 (Integration / Tracker 공통) */
export const ConnectedItem: React.FC<{
  isDark: boolean; color: string; icon: React.ReactNode;
  title: string; subtitle: string; chipLabel?: string;
  active: boolean; t: any;
  onEdit?: () => void;
  onToggle?: () => void; onTest?: () => void; onDelete: () => void;
}> = ({ isDark, color, icon, title, subtitle, chipLabel, active, t, onEdit, onToggle, onTest, onDelete }) => {
  const bdr = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const openMenu = Boolean(anchorEl);

  const handleMenuClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <Paper elevation={0} sx={{
      p: 2.5, display: 'flex', flexDirection: 'column', gap: 1.5,
      border: `1px solid ${bdr}`, borderRadius: '12px',
      transition: 'all 0.15s ease-in-out',
      position: 'relative',
      '&:hover': {
        borderColor: alpha(color, 0.5),
        boxShadow: `0 4px 16px ${alpha(color, 0.1)}`,
        transform: 'translateY(-1px)',
      },
    }}>
      {/* Header: Avatar, Chip, and More Menu */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
          <Avatar sx={{
            width: 36, height: 36,
            backgroundColor: alpha(color, isDark ? 0.2 : 0.08),
            color: color,
            border: `1px solid ${alpha(color, 0.15)}`,
          }}>
            {icon}
          </Avatar>
          {chipLabel && (
            <Chip 
              label={chipLabel} 
              size="small" 
              sx={{ 
                height: 18, 
                fontSize: '0.58rem', 
                fontWeight: 700, 
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                backgroundColor: alpha(color, 0.1), 
                color: color, 
                border: 'none' 
              }} 
            />
          )}
        </Box>

        <IconButton
          size="small"
          onClick={handleMenuClick}
          sx={{
            color: 'text.secondary',
            '&:hover': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              color: 'text.primary',
            }
          }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* Body: Title and Subtitle */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={title}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.73rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={subtitle}>
          {subtitle}
        </Typography>
      </Box>

      {/* Footer: Toggle/Status */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: `1px solid ${bdr}`, pt: 1.5, mt: 'auto' }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.73rem', fontWeight: 600 }}>
          {t('argus.common.status', 'Status')}
        </Typography>
        {onToggle ? (
          <Tooltip title={active ? t('argus.settings.deactivateKey', 'Deactivate') : t('common.active', 'Activate')}>
            <Chip
              label={active ? t('common.active') : t('common.inactive')}
              size="small"
              onClick={onToggle}
              sx={{
                height: 22,
                fontWeight: 600,
                fontSize: '0.7rem',
                cursor: 'pointer',
                transition: 'all 0.15s',
                backgroundColor: alpha(active ? '#4caf50' : '#9e9e9e', 0.12),
                color: active ? '#4caf50' : '#9e9e9e',
                border: 'none',
                '&:hover': {
                  backgroundColor: alpha(active ? '#4caf50' : '#9e9e9e', 0.2),
                }
              }}
            />
          </Tooltip>
        ) : (
          <StatusBadge active={active} t={t} />
        )}
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={openMenu}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: {
            borderRadius: '10px',
            minWidth: 130,
            mt: 0.5,
            boxShadow: isDark
              ? '0 5px 15px rgba(0, 0, 0, 0.5)'
              : '0 5px 15px rgba(0, 0, 0, 0.08)',
            border: `1px solid ${bdr}`,
          }
        }}
      >
        {onEdit && (
          <MenuItem
            onClick={() => { handleMenuClose(); onEdit(); }}
            sx={{ gap: 1, fontSize: '0.8rem', fontWeight: 500, py: 1 }}
          >
            <EditIcon fontSize="small" sx={{ fontSize: 16, color: 'text.secondary' }} />
            {t('common.edit', '편집')}
          </MenuItem>
        )}
        {onTest && (
          <MenuItem
            onClick={() => { handleMenuClose(); onTest(); }}
            sx={{ gap: 1, fontSize: '0.8rem', fontWeight: 500, py: 1 }}
          >
            <TestConnectionIcon fontSize="small" sx={{ fontSize: 16, color: '#4caf50' }} />
            {t('argus.settings.testConnection', '연결 테스트')}
          </MenuItem>
        )}
        <Divider sx={{ my: '4px !important', borderColor: bdr }} />
        <MenuItem
          onClick={() => { handleMenuClose(); onDelete(); }}
          sx={{
            gap: 1, fontSize: '0.8rem', fontWeight: 500, py: 1,
            color: 'error.main',
            '&:hover': {
              backgroundColor: isDark ? 'rgba(244, 67, 54, 0.12)' : 'rgba(211, 47, 47, 0.08)',
            }
          }}
        >
          <DeleteIcon fontSize="small" sx={{ fontSize: 16, color: 'inherit' }} />
          {t('common.delete', '삭제')}
        </MenuItem>
      </Menu>
    </Paper>
  );
};

/** 설정 다이얼로그 (Integration + Tracker 공통) */
export const ConfigDialog: React.FC<{
  open: boolean; onClose: () => void;
  provider: { name: string; color: string; icon: React.ReactNode; descKey: string } | null;
  fields: ProviderFieldDef[];
  formData: Record<string, string>; setFormData: (d: Record<string, string>) => void;
  onSubmit: () => void; submitDisabled: boolean;
  isDark: boolean; t: any; inpSx: any;
}> = ({ open, onClose, provider, fields, formData, setFormData, onSubmit, submitDisabled, isDark, t, inpSx }) => {
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});
  if (!provider) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '14px' } }}>
      <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
        <Avatar sx={{ width: 28, height: 28, backgroundColor: alpha(provider.color, 0.1), color: provider.color }}>{provider.icon}</Avatar>
        {t('argus.settings.configure')} {provider.name}
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, fontSize: '0.8rem' }}>{t(provider.descKey)}</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {fields.map(f => {
            const isSecret = f.type === 'password';
            const showPlain = visibleFields[f.key];
            
            if (f.type === 'select') {
              return (
                <FormControl key={f.key} size="small" fullWidth sx={inpSx}>
                  <InputLabel>{t(f.labelKey)}</InputLabel>
                  <Select
                    value={formData[f.key] || ''}
                    label={t(f.labelKey)}
                    onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                  >
                    {f.options?.map(opt => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              );
            }

            return (
              <TextField key={f.key} size="small" fullWidth label={t(f.labelKey)} placeholder={f.placeholder}
                type={isSecret && !showPlain ? 'password' : 'text'} value={formData[f.key] || ''}
                onChange={e => setFormData({ ...formData, [f.key]: e.target.value })} sx={inpSx}
                InputProps={isSecret ? {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setVisibleFields(v => ({ ...v, [f.key]: !v[f.key] }))} edge="end">
                        {showPlain ? <VisibilityOffIcon sx={{ fontSize: 18 }} /> : <VisibilityIcon sx={{ fontSize: 18 }} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                } : undefined}
              />
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none', color: 'text.secondary' }}>{t('common.cancel')}</Button>
        <Button variant="contained" onClick={onSubmit} disabled={submitDisabled}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px', px: 3 }}>{t('common.add')}</Button>
      </DialogActions>
    </Dialog>
  );
};

/** 샘플링 비율 프로그레스 바 — 마우스 드래그로 설정 */
export const RateBar: React.FC<{ value: number; onChange: (v: number) => void; isDark: boolean }> = ({ value, onChange, isDark }) => {
  const barRef = React.useRef<HTMLDivElement>(null);
  const pct = Math.round(value * 100);
  const color = '#7c4dff';

  const calcValue = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    onChange(Math.round(ratio * 100) / 100);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    calcValue(e.clientX);
    const onMove = (ev: MouseEvent) => calcValue(ev.clientX);
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <Box ref={barRef} onMouseDown={handleMouseDown}
      sx={{
        maxWidth: 400, width: '100%', height: 32, borderRadius: '6px', cursor: 'ew-resize',
        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
        position: 'relative', overflow: 'hidden', userSelect: 'none',
        '&:hover': { boxShadow: `0 0 0 2px ${alpha(color, 0.3)}` },
      }}>
      <Box sx={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${pct}%`, borderRadius: '6px',
        background: `linear-gradient(90deg, ${alpha(color, 0.4)}, ${alpha(color, 0.2)})`,
        transition: 'none',
      }} />
      <Typography sx={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: '0.82rem', color: isDark ? '#fff' : '#333',
        pointerEvents: 'none',
      }}>
        {pct}%
      </Typography>
    </Box>
  );
};

export const StatusBadge: React.FC<{ active: boolean; t: any }> = ({ active, t }) => (
  <Chip
    icon={active ? <CheckIcon sx={{ fontSize: '14px !important' }} /> : <CancelIcon sx={{ fontSize: '14px !important' }} />}
    label={active ? t('common.active') : t('common.inactive')} size="small"
    sx={{ height: 22, fontWeight: 600, fontSize: '0.7rem', backgroundColor: alpha(active ? '#4caf50' : '#9e9e9e', 0.12), color: active ? '#4caf50' : '#9e9e9e', border: 'none', '& .MuiChip-icon': { color: active ? '#4caf50' : '#9e9e9e' } }}
  />
);

export const EmptyState: React.FC<{ icon: React.ReactNode; text: string; hint?: string }> = ({ icon, text, hint }) => (
  <Box sx={{ py: 5, textAlign: 'center' }}>
    <Box sx={{ mb: 1.5, '& .MuiSvgIcon-root': { fontSize: 44, color: 'text.disabled' } }}>{icon}</Box>
    <Typography color="text.secondary" sx={{ fontSize: '0.85rem' }}>{text}</Typography>
    {hint && <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>{hint}</Typography>}
  </Box>
);

export const Spinner: React.FC = () => <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>;

export const CodeBlock: React.FC<{ title: string; language: string; code: string; isDark: boolean }> = ({ title, language, code, isDark }) => {
  return (
  <Paper elevation={0} sx={{ border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, borderRadius: '10px', overflow: 'hidden' }}>
    <Box sx={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 0.8,
      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
      borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
    }}>
      <Typography sx={{ fontWeight: 600, fontSize: '0.75rem' }}>{title}</Typography>
      <CopyButton text={code} size={14} />
    </Box>
    {/* @ts-expect-error react-syntax-highlighter type incompatibility with React 18 */}
    <SyntaxHighlighter language={language} style={isDark ? vscDarkPlus : oneLight}
      customStyle={{ margin: 0, padding: '16px', fontSize: '0.78rem', lineHeight: 1.6, borderRadius: 0, background: isDark ? '#1a1a2e' : '#fafafa' }}
      showLineNumbers={false}>{code}</SyntaxHighlighter>
  </Paper>
  );
};
