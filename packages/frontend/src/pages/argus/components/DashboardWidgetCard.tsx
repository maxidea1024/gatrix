import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  CircularProgress,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreIcon,
  DragIndicator as DragIcon,
  ContentCopy as DuplicateIcon,
} from '@mui/icons-material';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';

// ─── Types ───

export interface WidgetConfig {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'area' | 'number' | 'table' | 'pie';
  query: {
    fields: string[];
    conditions?: string;
    groupBy?: string[];
    orderBy?: string;
    limit?: number;
    period?: string;
  };
  layout: { x: number; y: number; w: number; h: number };
}

export interface DashboardData {
  id?: number;
  title: string;
  description: string;
  widgets_config: WidgetConfig[];
}

export interface PresetSummary {
  id: string;
  title: string;
  description: string;
  widgetCount: number;
}

// ─── WidgetCard ───

interface WidgetCardProps {
  widget: WidgetConfig;
  data: any[];
  loading: boolean;
  isDark: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export const WidgetCard: React.FC<WidgetCardProps> = ({
  widget,
  data,
  loading,
  isDark,
  isEditing,
  onEdit,
  onDelete,
  onDuplicate,
}) => {
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const renderContent = () => {
    if (loading) {
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
          }}
        >
          <CircularProgress size={24} />
        </Box>
      );
    }

    if (!data || data.length === 0) {
      return (
        <EmptyPlaceholder
          message="No data"
          minHeight="100%"
          sx={{ height: '100%', border: 'none', py: 0, px: 0 }}
        />
      );
    }

    switch (widget.type) {
      case 'number': {
        const val = data[0];
        const numVal = Object.values(val)[0];
        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100%',
            }}
          >
            <Typography
              variant="h3"
              fontWeight={800}
              sx={{
                background: 'linear-gradient(135deg, #7c4dff, #448aff)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {typeof numVal === 'number'
                ? numVal.toLocaleString()
                : String(numVal)}
            </Typography>
          </Box>
        );
      }

      case 'bar':
      case 'line':
      case 'area': {
        const keys = Object.keys(data[0]);
        const numKey = keys.find((k) => typeof data[0][k] === 'number');
        const labelKey = keys.find((k) => k !== numKey);
        if (!numKey || !labelKey) return null;

        const maxVal = Math.max(...data.map((r) => Number(r[numKey])));

        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              overflow: 'auto',
              height: '100%',
              py: 0.5,
            }}
          >
            {data.slice(0, 10).map((row, i) => (
              <Box
                key={i}
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    minWidth: 80,
                    maxWidth: 100,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    fontSize: '0.68rem',
                    color: 'text.secondary',
                  }}
                >
                  {String(row[labelKey])}
                </Typography>
                <Box
                  sx={{
                    flex: 1,
                    height: 14,
                    borderRadius: 1,
                    overflow: 'hidden',
                    backgroundColor: isDark
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(0,0,0,0.03)',
                  }}
                >
                  <Box
        sx={{
          minWidth: 0,
          height: '100%',
                      borderRadius: 1,
                      width: `${maxVal > 0 ? (Number(row[numKey]) / maxVal) * 100 : 0}%`,
                      background:
                        widget.type === 'bar'
                          ? 'linear-gradient(90deg, #7c4dff, #448aff)'
                          : widget.type === 'line'
                            ? 'linear-gradient(90deg, #00bcd4, #26c6da)'
                            : 'linear-gradient(90deg, #ff7043, #ffab91)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.68rem',
                    fontWeight: 600,
                    minWidth: 40,
                    textAlign: 'right',
                  }}
                >
                  {Number(row[numKey]).toLocaleString()}
                </Typography>
              </Box>
            ))}
          </Box>
        );
      }

      case 'pie': {
        const keys = Object.keys(data[0]);
        const numKey = keys.find((k) => typeof data[0][k] === 'number');
        const labelKey = keys.find((k) => k !== numKey);
        if (!numKey || !labelKey) return null;

        const total = data.reduce((s, r) => s + Number(r[numKey]), 0);
        const colors = [
          '#7c4dff',
          '#448aff',
          '#00bcd4',
          '#4caf50',
          '#ff9800',
          '#f44336',
          '#e91e63',
          '#9c27b0',
        ];

        return (
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              height: '100%',
              alignItems: 'center',
            }}
          >
            {/* Donut representation */}
            <Box
              sx={{
                position: 'relative',
                width: 80,
                height: 80,
                flexShrink: 0,
              }}
            >
              <svg
                viewBox="0 0 36 36"
                style={{
                  width: '100%',
                  height: '100%',
                  transform: 'rotate(-90deg)',
                }}
              >
                {data
                  .slice(0, 6)
                  .reduce((acc: any[], row, i) => {
                    const pct =
                      total > 0 ? (Number(row[numKey]) / total) * 100 : 0;
                    const offset =
                      acc.length > 0 ? acc[acc.length - 1].endOffset : 0;
                    acc.push({
                      elem: (
                        <circle
                          key={i}
                          cx="18"
                          cy="18"
                          r="15.9"
                          fill="none"
                          stroke={colors[i % colors.length]}
                          strokeWidth="3.5"
                          strokeDasharray={`${pct} ${100 - pct}`}
                          strokeDashoffset={-offset}
                        />
                      ),
                      endOffset: offset + pct,
                    });
                    return acc;
                  }, [])
                  .map((a: any) => a.elem)}
              </svg>
            </Box>
            {/* Legend */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 0.25,
                overflow: 'auto',
              }}
            >
              {data.slice(0, 6).map((row, i) => (
                <Box
                  key={i}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
                >
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: colors[i % colors.length],
                      flexShrink: 0,
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{ fontSize: '0.65rem', color: 'text.secondary' }}
                  >
                    {String(row[labelKey])} (
                    {total > 0
                      ? Math.round((Number(row[numKey]) / total) * 100)
                      : 0}
                    %)
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        );
      }

      case 'table': {
        const headers = Object.keys(data[0]);
        return (
          <Box sx={{ overflow: 'auto', height: '100%', fontSize: '0.72rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {headers.map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '4px 8px',
                        textAlign: 'left',
                        fontWeight: 700,
                        fontSize: '0.68rem',
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                        position: 'sticky',
                        top: 0,
                        backgroundColor: isDark
                          ? 'rgba(30,30,40,0.95)'
                          : 'rgba(255,255,255,0.95)',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 20).map((row, i) => (
                  <tr key={i}>
                    {headers.map((h) => (
                      <td
                        key={h}
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.68rem',
                          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)'}`,
                        }}
                      >
                        {typeof row[h] === 'number'
                          ? row[h].toLocaleString()
                          : String(row[h])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        );
      }

      default:
        return null;
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        borderRadius: 2,
        overflow: 'hidden',
        '&:hover': {
          borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
        },
        transition: 'border-color 0.15s',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1.5,
          py: 0.75,
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
          backgroundColor: isDark
            ? 'rgba(255,255,255,0.015)'
            : 'rgba(0,0,0,0.008)',
        }}
      >
        {isEditing && (
          <DragIcon
            className="drag-handle"
            sx={{
              fontSize: 16,
              color: 'text.disabled',
              cursor: 'grab',
              '&:active': { cursor: 'grabbing' },
            }}
          />
        )}
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ flex: 1, fontSize: '0.75rem' }}
        >
          {widget.title}
        </Typography>
        {isEditing && (
          <>
            <IconButton
              size="small"
              onClick={(e) => setMenuAnchor(e.currentTarget)}
              sx={{ p: 0.25 }}
            >
              <MoreIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
              PaperProps={{ sx: { minWidth: 140 } }}
            >
              <MenuItem
                onClick={() => {
                  onEdit();
                  setMenuAnchor(null);
                }}
                sx={{ fontSize: '0.8rem' }}
              >
                <EditIcon sx={{ fontSize: 16, mr: 1 }} /> Edit
              </MenuItem>
              <MenuItem
                onClick={() => {
                  onDuplicate();
                  setMenuAnchor(null);
                }}
                sx={{ fontSize: '0.8rem' }}
              >
                <DuplicateIcon sx={{ fontSize: 16, mr: 1 }} /> Duplicate
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={() => {
                  onDelete();
                  setMenuAnchor(null);
                }}
                sx={{ fontSize: '0.8rem', color: 'error.main' }}
              >
                <DeleteIcon sx={{ fontSize: 16, mr: 1 }} /> Delete
              </MenuItem>
            </Menu>
          </>
        )}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, p: 1.5, overflow: 'hidden' }}>{renderContent()}</Box>
    </Paper>
  );
};
