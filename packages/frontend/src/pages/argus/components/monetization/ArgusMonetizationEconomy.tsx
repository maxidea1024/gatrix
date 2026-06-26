import React from 'react';
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Paper,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  useTheme,
} from '@mui/material';
import {
  TrendingUp as TrendingIcon,
  TrendingDown as TrendingDownIcon,
  AccountBalance as EconomyIcon,
} from '@mui/icons-material';
import EmptyPagePlaceholder from '@/components/common/EmptyPagePlaceholder';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import { fmtNum, BalanceGauge, KpiCard } from './MonetizationHelpers';
import { ARGUS_SEMANTIC } from '../../argusThemeTokens';

interface ArgusMonetizationEconomyProps {
  economy: any;
  economyCurrency: string;
  setEconomyCurrency: (currency: string) => void;
  loading: boolean;
  isDark: boolean;
  t: any;
  handleChartZoom: (
    rawPeriods: string[]
  ) => (startIdx: number, endIdx: number) => void;
}

export const ArgusMonetizationEconomy: React.FC<
  ArgusMonetizationEconomyProps
> = ({
  economy,
  economyCurrency,
  setEconomyCurrency,
  loading,
  isDark,
  t,
  handleChartZoom,
}) => {
  const theme = useTheme();

  if (
    !economy ||
    (economy.by_currency.length === 0 && economy.flow_over_time.length === 0)
  ) {
    return (
      <EmptyPagePlaceholder
        icon={<EconomyIcon sx={{ fontSize: 48 }} />}
        message={t('argus.monetization.noEconomy', 'No economy data')}
        subtitle={t(
          'argus.monetization.noEconomyDesc',
          'No resource_source / resource_sink events found'
        )}
      />
    );
  }

  const selectedCurrencyData =
    economy.by_currency.find((c: any) => c.currency_type === economyCurrency) ||
    economy.by_currency[0];
  const currentSource = selectedCurrencyData ? selectedCurrencyData.source : 0;
  const currentSink = selectedCurrencyData ? selectedCurrencyData.sink : 0;
  const currentRatio = currentSink > 0 ? currentSource / currentSink : 0;
  const currentNetFlow = currentSource - currentSink;

  // Currency type options for filter
  const currencyOptions = economy.by_currency.map((c: any) => c.currency_type);
  const filteredTopSinks = economy.top_sinks.filter(
    (s: any) => s.currency_type === economyCurrency
  );

  return (
    <>
      {/* Currency Type Filter & Title */}
      {currencyOptions.length > 1 && (
        <Box
          sx={{
            mb: 3,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="h6" fontWeight={700}>
            {t('argus.monetization.economyDashboard', 'Economy Dashboard')}
          </Typography>
          <ToggleButtonGroup
            value={economyCurrency}
            exclusive
            onChange={(_, v) => v && setEconomyCurrency(v)}
            size="small"
          >
            {currencyOptions.map((ct: any) => (
              <ToggleButton
                key={ct}
                value={ct}
                sx={{ px: 2, fontWeight: 700, textTransform: 'uppercase' }}
              >
                {ct}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: '340px 1fr' },
          gap: 3,
        }}
      >
        {/* Left Column: Summary Metrics, Balance Gauge, and Currency Summary Table */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Balance Status Gauge */}
          <BalanceGauge ratio={currentRatio} />

          {/* Summary KPIs */}
          <KpiCard
            icon={<TrendingIcon />}
            label={`${t('argus.monetization.totalSource', 'Total Source')} (${economyCurrency.toUpperCase()})`}
            value={fmtNum(currentSource)}
            color={ARGUS_SEMANTIC.positive}
          />
          <KpiCard
            icon={<TrendingDownIcon />}
            label={`${t('argus.monetization.totalSink', 'Total Sink')} (${economyCurrency.toUpperCase()})`}
            value={fmtNum(currentSink)}
            color={ARGUS_SEMANTIC.negative}
          />
          <KpiCard
            icon={<EconomyIcon />}
            label={`${t('argus.monetization.netFlow', 'Net Flow')} (${economyCurrency.toUpperCase()})`}
            value={(currentNetFlow >= 0 ? '+' : '') + fmtNum(currentNetFlow)}
            color={
              currentNetFlow >= 0
                ? ARGUS_SEMANTIC.warning
                : ARGUS_SEMANTIC.positive
            }
            sub={
              currentNetFlow > 0
                ? t('argus.monetization.inflationRisk', 'Inflation risk')
                : t('argus.monetization.healthy', 'Healthy')
            }
          />

          {/* Currency Summary Table */}
          <Paper
            variant="outlined"
            sx={{
              borderRadius: 3,
              overflow: 'hidden',
              bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
            }}
          >
            <Box
              sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <Typography variant="subtitle2" fontWeight={700}>
                {t('argus.monetization.byCurrency', 'Currency Summary')}
              </Typography>
            </Box>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, fontSize: 11 }}>
                    {t('argus.monetization.currencyType', 'Currency')}
                  </TableCell>
                  <TableCell
                    sx={{ fontWeight: 700, fontSize: 11 }}
                    align="right"
                  >
                    {t('argus.monetization.netFlow', 'Net Flow')}
                  </TableCell>
                  <TableCell
                    sx={{ fontWeight: 700, fontSize: 11 }}
                    align="right"
                  >
                    {t('argus.monetization.sourceSinkRatio', 'Ratio')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {economy.by_currency.map((c: any) => {
                  const r = c.sink > 0 ? c.source / c.sink : 0;
                  const isSelected = c.currency_type === economyCurrency;
                  return (
                    <TableRow
                      key={c.currency_type}
                      hover
                      selected={isSelected}
                      onClick={() => setEconomyCurrency(c.currency_type)}
                      sx={{
                        cursor: 'pointer',
                        '&.Mui-selected': {
                          bgcolor: isDark
                            ? 'rgba(255,255,255,0.05)'
                            : 'rgba(0,0,0,0.04)',
                        },
                      }}
                    >
                      <TableCell sx={{ py: 1.5 }}>
                        <Chip
                          label={c.currency_type.toUpperCase()}
                          size="small"
                          sx={{
                            fontWeight: 800,
                            fontSize: 10,
                            cursor: 'pointer',
                          }}
                          color={isSelected ? 'primary' : 'default'}
                        />
                      </TableCell>
                      <TableCell align="right" sx={{ py: 1.5 }}>
                        <Typography
                          fontSize={12}
                          fontWeight={600}
                          color={
                            c.net_flow >= 0
                              ? ARGUS_SEMANTIC.warning
                              : ARGUS_SEMANTIC.positive
                          }
                        >
                          {c.net_flow >= 0 ? '+' : ''}
                          {fmtNum(c.net_flow)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ py: 1.5 }}>
                        <Typography
                          fontSize={12}
                          fontWeight={600}
                          color={
                            r > 1.2
                              ? ARGUS_SEMANTIC.negative
                              : r < 0.8
                                ? ARGUS_SEMANTIC.warning
                                : ARGUS_SEMANTIC.positive
                          }
                        >
                          {r.toFixed(2)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Paper>
        </Box>

        {/* Right Column: Time-series Charts & Top spending item Table */}
        <Box
          sx={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}
        >
          {/* Flow chart */}
          <ArgusVolumeChart
            title={`${t('argus.monetization.dailyFlow', 'Daily Flow')} - ${economyCurrency.toUpperCase()}`}
            rawPeriods={economy.flow_over_time.map((d: any) => d.period)}
            labels={[]}
            datasets={[
              {
                label: t('argus.monetization.source', 'Source'),
                data: economy.flow_over_time.map((d: any) => d.source),
                color: ARGUS_SEMANTIC.positive,
              },
              {
                label: t('argus.monetization.sink', 'Sink'),
                data: economy.flow_over_time.map((d: any) => d.sink),
                color: ARGUS_SEMANTIC.negative,
              },
            ]}
            loading={loading}
            storagePrefix="argus_economy_flow"
            showCompactToggle={false}
            onZoom={handleChartZoom(
              economy.flow_over_time.map((d: any) => d.period)
            )}
          />

          {/* Source/Sink Ratio Trend — inflation tracking */}
          {economy.ratio_trend && economy.ratio_trend.length > 0 && (
            <ArgusVolumeChart
              title={`${t('argus.monetization.ratioTrend', 'Ratio Trend')} - ${economyCurrency.toUpperCase()}`}
              rawPeriods={economy.ratio_trend.map((d: any) => d.period)}
              labels={[]}
              datasets={[
                {
                  label: t('argus.monetization.sourceSinkRatio', 'Ratio'),
                  data: economy.ratio_trend.map((d: any) => d.ratio),
                  color: ARGUS_SEMANTIC.warning,
                },
              ]}
              loading={loading}
              storagePrefix="argus_economy_ratio"
              showCompactToggle={false}
              onZoom={handleChartZoom(
                economy.ratio_trend.map((d: any) => d.period)
              )}
            />
          )}

          {/* Top sinks table */}
          {filteredTopSinks.length > 0 && (
            <Paper
              variant="outlined"
              sx={{
                borderRadius: 3,
                overflow: 'hidden',
                bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
              }}
            >
              <Box
                sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}
              >
                <Typography variant="subtitle1" fontWeight={700}>
                  {t('argus.monetization.topSinks', 'Top Spending Items')} (
                  {economyCurrency.toUpperCase()})
                </Typography>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {t('argus.monetization.itemName', 'Item')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      {t('argus.monetization.totalSpent', 'Total Spent')}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      {t('argus.monetization.transactions', 'Transactions')}
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredTopSinks.map((s: any, i: number) => (
                    <TableRow key={`${s.item_name}-${s.currency_type}`} hover>
                      <TableCell sx={{ py: 1.5 }}>{i + 1}</TableCell>
                      <TableCell sx={{ py: 1.5 }}>
                        <Typography fontWeight={600} fontSize={13}>
                          {s.item_name}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ py: 1.5 }}>
                        <Typography
                          fontWeight={600}
                          fontSize={13}
                          color="text.primary"
                        >
                          {fmtNum(s.total_spent)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ py: 1.5 }}>
                        {s.transaction_count.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Paper>
          )}
        </Box>
      </Box>
    </>
  );
};
