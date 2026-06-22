import React, { useEffect, useState } from 'react';
import { Box, Typography, Skeleton, alpha } from '@mui/material';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip as ChartTooltip,
} from 'chart.js';
import { useTranslation } from 'react-i18next';
import argusService, { ArgusDsnKeyStatsPoint } from '@/services/argusService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  ChartTooltip
);

interface DsnKeySparklineProps {
  projectId: number | string;
  keyId: number;
  isActive: boolean;
  isDark: boolean;
}

export const DsnKeySparkline: React.FC<DsnKeySparklineProps> = ({
  projectId,
  keyId,
  isActive,
  isDark,
}) => {
  const { t } = useTranslation();
  const [data, setData] = useState<ArgusDsnKeyStatsPoint[] | null>(null);
  const [totals, setTotals] = useState<{
    errors: number;
    transactions: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isActive) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    argusService
      .getDsnKeyStats(projectId, keyId, '7d')
      .then((res) => {
        if (!cancelled) {
          setData(res.data);
          setTotals(res.totals);
        }
      })
      .catch(() => {
        if (!cancelled) setData([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, keyId, isActive]);

  if (!isActive) {
    return (
      <Box
        sx={{
          minWidth: 0,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ fontSize: '0.7rem' }}
        >
          {t('argus.settings.dsnKeyInactiveNoStats')}
        </Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
    );
  }

  if (!data || data.length === 0) {
    return (
      <Box
        sx={{
          minWidth: 0,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{ fontSize: '0.7rem' }}
        >
          {t('argus.settings.dsnKeyNoData')}
        </Typography>
      </Box>
    );
  }

  const errColor = '#667eea';
  const txnColor = '#43e97b';

  const chartData = {
    labels: data.map((d) => {
      const date = new Date(d.timestamp);
      return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:00`;
    }),
    datasets: [
      {
        label: 'Errors',
        data: data.map((d) => d.errors),
        borderColor: errColor,
        backgroundColor: alpha(errColor, 0.15),
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 3,
        borderWidth: 1.5,
      },
      {
        label: 'Transactions',
        data: data.map((d) => d.transactions),
        borderColor: txnColor,
        backgroundColor: alpha(txnColor, 0.1),
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 3,
        borderWidth: 1.5,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      },
    },
    scales: {
      x: {
        display: false,
      },
      y: {
        display: false,
        beginAtZero: true,
      },
    },
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
  };

  return (
    <Box>
      <Box sx={{ height: 48 }}>
        <Line data={chartData} options={options} />
      </Box>
      {totals && (
        <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
          <Typography
            variant="caption"
            sx={{ fontSize: '0.65rem', color: errColor, fontWeight: 600 }}
          >
            Errors: {totals.errors.toLocaleString()}
          </Typography>
          <Typography
            variant="caption"
            sx={{ fontSize: '0.65rem', color: txnColor, fontWeight: 600 }}
          >
            Txns: {totals.transactions.toLocaleString()}
          </Typography>
          <Typography
            variant="caption"
            color="text.disabled"
            sx={{ fontSize: '0.65rem' }}
          >
            {t('argus.settings.dsnKeyStatsPeriod')}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
