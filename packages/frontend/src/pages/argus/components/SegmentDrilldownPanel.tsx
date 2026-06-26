import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  LinearProgress,
  IconButton,
  Chip,
  alpha,
  useTheme,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import type { SegmentVerdict } from '../monetizationInsights';

interface SegmentDrilldownPanelProps {
  segment: SegmentVerdict;
  segmentType: 'country' | 'platform';
  revenueOverTime: { period: string; revenue: number; arpdau?: number }[];
  products: { product_name: string; revenue: number; transactions: number }[];
  totalRevenue: number;
  onClose: () => void;
  onNavigateTab?: (tab: string) => void;
}

const fmt = (n: number) =>
  n >= 1000000
    ? `$${(n / 1000000).toFixed(1)}M`
    : n >= 1000
      ? `$${(n / 1000).toFixed(1)}K`
      : `$${n.toFixed(2)}`;

const SegmentDrilldownPanel: React.FC<SegmentDrilldownPanelProps> = ({
  segment,
  segmentType,
  revenueOverTime,
  products,
  totalRevenue,
  onClose,
}) => {
  const theme = useTheme();
  const share = totalRevenue > 0 ? (segment.revenue / totalRevenue) * 100 : 0;

  const verdictColor: Record<string, string> = {
    invest: theme.palette.success.main,
    maintain: theme.palette.info.main,
    opportunity: theme.palette.warning.main,
    review: theme.palette.error.main,
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        borderRadius: 2,
        minWidth: 340,
        maxWidth: 480,
        bgcolor: theme.palette.background.paper,
        boxShadow: 8,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 2,
        }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            {segment.name}
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ textTransform: 'capitalize' }}
          >
            {segmentType} segment
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* KPIs */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 1.5,
          mb: 2,
        }}
      >
        {[
          { label: 'Revenue', value: fmt(segment.revenue) },
          {
            label: 'vs Prev',
            value: `${segment.changePct >= 0 ? '+' : ''}${segment.changePct.toFixed(1)}%`,
            color:
              segment.changePct >= 0
                ? theme.palette.success.main
                : theme.palette.error.main,
          },
          { label: 'Rev. Share', value: `${share.toFixed(1)}%` },
          {
            label: 'Change',
            value: `${segment.change >= 0 ? '+' : ''}${fmt(segment.change)}`,
            color:
              segment.change >= 0
                ? theme.palette.success.main
                : theme.palette.error.main,
          },
        ].map(({ label, value, color }) => (
          <Box
            key={label}
            sx={{
              p: 1.5,
              borderRadius: 1.5,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
            >
              {label}
            </Typography>
            <Typography
              variant="body2"
              fontWeight={700}
              sx={{ color: color || 'text.primary' }}
            >
              {value}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Verdict */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Verdict:
        </Typography>
        <Chip
          label={segment.verdictLabel}
          size="small"
          sx={{
            height: 22,
            fontSize: 11,
            fontWeight: 700,
            bgcolor: alpha(
              verdictColor[segment.verdict] || theme.palette.grey[500],
              0.15
            ),
            color:
              verdictColor[segment.verdict] || theme.palette.text.secondary,
            border: `1px solid ${alpha(verdictColor[segment.verdict] || theme.palette.grey[500], 0.3)}`,
          }}
        />
      </Box>

      {/* Revenue share bar */}
      <Box sx={{ mb: 2 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          mb={0.5}
        >
          Share of Total Revenue
        </Typography>
        <LinearProgress
          variant="determinate"
          value={Math.min(share, 100)}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            '& .MuiLinearProgress-bar': {
              bgcolor:
                verdictColor[segment.verdict] || theme.palette.primary.main,
              borderRadius: 3,
            },
          }}
        />
        <Typography variant="caption" color="text.secondary">
          {share.toFixed(1)}%
        </Typography>
      </Box>

      {/* Top products for this segment */}
      {products.length > 0 && (
        <Box>
          <Typography
            variant="caption"
            fontWeight={600}
            color="text.secondary"
            display="block"
            mb={1}
          >
            Top Products
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: 11, fontWeight: 700, py: 0.5 }}>
                  Product
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ fontSize: 11, fontWeight: 700, py: 0.5 }}
                >
                  Revenue
                </TableCell>
                <TableCell
                  align="right"
                  sx={{ fontSize: 11, fontWeight: 700, py: 0.5 }}
                >
                  Txns
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.slice(0, 5).map((p) => (
                <TableRow key={p.product_name} hover>
                  <TableCell sx={{ fontSize: 11, py: 0.5 }}>
                    {p.product_name}
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: 11, py: 0.5 }}>
                    {fmt(p.revenue)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontSize: 11, py: 0.5 }}>
                    {p.transactions.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Paper>
  );
};

export default SegmentDrilldownPanel;
