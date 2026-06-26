import React from 'react';
import {
  Box, Typography, useTheme, alpha, Paper, Chip, LinearProgress,
} from '@mui/material';
import {
  AttachMoney as MoneyIcon,
  TrendingUp as TrendingIcon,
  TrendingDown as TrendingDownIcon,
  Category as ProductIcon,
  AccountBalance as EconomyIcon,
  Diamond as DiamondIcon,
  Timeline as LtvIcon,
  ArrowDropUp, ArrowDropDown,
  OpenInNew as DrillIcon,
  ReceiptLong as LedgerIcon,
  Explore as DiscoverIcon,
  Campaign as CampaignIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { DEFAULT_PRESETS, DateRangePresetOption } from '@/components/common/DateRangeSelector';
import { Line } from 'react-chartjs-2';
import {
  ARGUS_SERIES,
  ARGUS_SEMANTIC,
  METRIC_LABEL_SX,
  argusBorder,
  argusHoverBg,
  changeColor,
} from '../../argusThemeTokens';
import {
  ChangeIndicator,
} from '../argusSharedComponents';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SectionId = 'overview' | 'ledger' | 'discover' | 'products' | 'economy' | 'spenders' | 'ltv' | 'acquisition';

export interface NavItem {
  id: SectionId;
  labelKey: string;
  fallback: string;
  icon: React.ReactNode;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'overview', labelKey: 'argus.monetization.sectionOverview', fallback: 'Overview', icon: <MoneyIcon sx={{ fontSize: 18 }} /> },
  { id: 'ledger', labelKey: 'argus.monetization.sectionLedger', fallback: 'Ledger', icon: <LedgerIcon sx={{ fontSize: 18 }} /> },
  { id: 'discover', labelKey: 'argus.monetization.sectionDiscover', fallback: 'Discover', icon: <DiscoverIcon sx={{ fontSize: 18 }} /> },
  { id: 'products', labelKey: 'argus.monetization.sectionProducts', fallback: 'Products', icon: <ProductIcon sx={{ fontSize: 18 }} /> },
  { id: 'economy', labelKey: 'argus.monetization.sectionEconomy', fallback: 'Economy', icon: <EconomyIcon sx={{ fontSize: 18 }} /> },
  { id: 'spenders', labelKey: 'argus.monetization.sectionSpenders', fallback: 'Top Spenders', icon: <DiamondIcon sx={{ fontSize: 18 }} /> },
  { id: 'ltv', labelKey: 'argus.monetization.sectionLtv', fallback: 'LTV', icon: <LtvIcon sx={{ fontSize: 18 }} /> },
  { id: 'acquisition', labelKey: 'argus.monetization.sectionAcquisition', fallback: 'Acquisition', icon: <CampaignIcon sx={{ fontSize: 18 }} /> },
];

// ── Minimum date range per section (in hours) ────────────────────────────────
export const MIN_HOURS_PER_SECTION: Partial<Record<SectionId, number>> = {
  overview: 24,
  products: 24,
  economy: 24,
  spenders: 168,  // 7 days
  ltv: 168,       // 7 days
};

// Short presets that are < 24h
export const SHORT_PRESETS = new Set(['5min', '10min', '15min', '30min', '1h', '3h', '6h', '12h']);
// Very short presets that are < 7d
export const VERY_SHORT_PRESETS = new Set([...SHORT_PRESETS, '24h', '2d']);

export const DEFAULT_PRESET_FOR_MIN: Record<number, string> = {
  24: '24h',
  168: '7d',
};

/** Filter presets based on section's minimum hours */
export function getPresetsForSection(sectionId: SectionId): DateRangePresetOption[] | undefined {
  const minHours = MIN_HOURS_PER_SECTION[sectionId];
  if (!minHours) return undefined; // no restriction → use all defaults
  const exclude = minHours >= 168 ? VERY_SHORT_PRESETS : SHORT_PRESETS;
  return DEFAULT_PRESETS.filter((p) => !exclude.has(p.value));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function pctChange(current: number, previous: number): number | undefined {
  if (!previous || previous === 0) return undefined;
  return ((current - previous) / previous) * 100;
}

export const fmt = (n: number) =>
  n >= 1000000 ? `$${(n / 1000000).toFixed(1)}M`
    : n >= 1000 ? `$${(n / 1000).toFixed(1)}K`
    : `$${n.toFixed(2)}`;

export const fmtNum = (n: number) =>
  n >= 1000000 ? `${(n / 1000000).toFixed(1)}M`
    : n >= 1000 ? `${(n / 1000).toFixed(1)}K`
    : n.toLocaleString();

export const CHART_COLORS = ARGUS_SERIES as unknown as string[];

// ─── Balance Gauge Component ─────────────────────────────────────────────────

interface BalanceGaugeProps {
  ratio: number;
}

export const BalanceGauge: React.FC<BalanceGaugeProps> = ({ ratio }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const { t } = useTranslation();

  // Normalize percentage for the progress bar. We assume center 1.0 (50%) of a 0.0 to 2.0 scale.
  const percentage = Math.min(Math.max((ratio / 2) * 100, 0), 100);
  
  let statusText = t('argus.monetization.healthy', 'Healthy Balance');
  let color: string = ARGUS_SEMANTIC.positive;
  let desc = t('argus.monetization.healthyDesc', 'Currency faucet and sink are well balanced.');

  if (ratio > 1.2) {
    statusText = t('argus.monetization.inflationRisk', '⚠ Inflation Risk');
    color = ARGUS_SEMANTIC.negative;
    desc = t('argus.monetization.inflationRiskDesc', 'Sources are significantly higher than sinks.');
  } else if (ratio < 0.8) {
    statusText = t('argus.monetization.sinkDeficit', '⚠ Sink Deficit');
    color = ARGUS_SEMANTIC.warning;
    desc = t('argus.monetization.sinkDeficitDesc', 'Sinks exceed sources; currency is being drained.');
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5,
        borderRadius: 3,
        bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
        borderColor: alpha(color, 0.2),
        mb: 2,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={700}>
          {t('argus.monetization.economyBalance', 'ECONOMY BALANCE STATUS')}
        </Typography>
        <Chip
          label={statusText}
          size="small"
          sx={{
            bgcolor: alpha(color, 0.1),
            color: color,
            fontWeight: 700,
            fontSize: 11,
          }}
        />
      </Box>

      <Box sx={{ position: 'relative', height: 8, bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', borderRadius: 4, my: 3 }}>
        {/* Midpoint line at 1.0 (50%) */}
        <Box
          sx={{
            position: 'absolute',
            left: '50%',
            top: -4,
            bottom: -4,
            width: 2,
            bgcolor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
          }}
        />
        {/* Marker */}
        <Box
          sx={{
            position: 'absolute',
            left: `${percentage}%`,
            top: -4,
            transform: 'translateX(-50%)',
            width: 16,
            height: 16,
            borderRadius: '50%',
            bgcolor: color,
            border: '2px solid #fff',
            boxShadow: 2,
            transition: 'left 0.3s ease',
          }}
        />
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'text.secondary', fontWeight: 600, mb: 1.5 }}>
        <span>0.0 ({t('argus.monetization.sinkOnly', 'Sink Heavy')})</span>
        <span style={{ color: ratio >= 0.8 && ratio <= 1.2 ? color : undefined }}>1.0 ({t('argus.monetization.balanced', 'Balanced')})</span>
        <span>2.0+ ({t('argus.monetization.sourceHeavy', 'Source Heavy')})</span>
      </Box>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: 11, mt: 1, fontStyle: 'italic' }}>
        {desc}
      </Typography>
    </Paper>
  );
};

// ─── KPI Card Component ──────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  sub?: string;
  change?: number;
  onClick?: () => void;
  sparkData?: number[];
}

export const KpiCard: React.FC<KpiCardProps> = ({ icon, label, value, color, sub, change, onClick, sparkData }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Box
      onClick={onClick}
      sx={{
        py: 1.5,
        px: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        borderBottom: `1px solid ${argusBorder(isDark)}`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background 0.15s',
        '&:hover': onClick
          ? { backgroundColor: argusHoverBg(isDark) }
          : {},
      }}
    >
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1.5,
          bgcolor: alpha(color, isDark ? 0.12 : 0.08),
          color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={METRIC_LABEL_SX}>
          {label}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
          <Typography
            sx={{
              fontSize: '1.125rem',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {value}
          </Typography>
          <ChangeIndicator value={change} variant="chip" />
        </Box>
        {sub && (
          <Typography sx={{ fontSize: '0.6875rem', mt: 0.2, color: 'text.secondary' }}>
            {sub}
          </Typography>
        )}
      </Box>
      {/* Sparkline */}
      {sparkData && sparkData.length > 1 && (
        <Box sx={{ width: 64, height: 28, flexShrink: 0, opacity: 0.7 }}>
          <Line
            data={{
              labels: sparkData.map((_, i) => i),
              datasets: [{
                data: sparkData,
                borderColor: color,
                borderWidth: 1.5,
                pointRadius: 0,
                fill: true,
                backgroundColor: alpha(color, 0.08),
                tension: 0.4,
              }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: { x: { display: false }, y: { display: false } },
              plugins: { legend: { display: false }, tooltip: { enabled: false, external: null as any } },
              animation: false,
            }}
          />
        </Box>
      )}
      {onClick && <DrillIcon sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />}
    </Box>
  );
};

// ─── Sidebar Item Component ──────────────────────────────────────────────────

interface SidebarItemProps {
  item: NavItem;
  active: boolean;
  isDark: boolean;
  onClick: () => void;
  t: (key: string) => string;
}

export const SidebarItem: React.FC<SidebarItemProps> = React.memo(
  function SidebarItem({ item, active, isDark, onClick, t }) {
    const theme = useTheme();
    return (
      <Box
        onClick={onClick}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.2,
          px: 1.5, py: 1, mb: 0.3,
          borderRadius: '8px 0 0 8px',
          cursor: 'pointer', position: 'relative',
          backgroundColor: active
            ? alpha(theme.palette.primary.main, isDark ? 0.12 : 0.08)
            : 'transparent',
          color: active ? theme.palette.primary.main : 'text.primary',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            backgroundColor: active
              ? alpha(theme.palette.primary.main, isDark ? 0.15 : 0.1)
              : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          },
        }}
      >
        {active && (
          <Box sx={{
            position: 'absolute', left: 0, top: '15%', bottom: '15%',
            width: 3, borderRadius: '0 4px 4px 0',
            background: `linear-gradient(180deg, ${theme.palette.primary.main}, ${alpha(theme.palette.primary.main, 0.5)})`,
          }} />
        )}
        <Box sx={{ display: 'flex', opacity: active ? 1 : 0.6, color: 'inherit' }}>
          {item.icon}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '0.85rem', fontWeight: active ? 600 : 400 }}>
            {t(item.labelKey)}
          </Typography>
        </Box>
      </Box>
    );
  }
);
