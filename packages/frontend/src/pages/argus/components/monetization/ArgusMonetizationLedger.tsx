import React from 'react';
import {
  Box, Typography, Button, Paper, Chip, Table, TableHead, TableRow, TableCell, TableBody,
  TableSortLabel, TableContainer, LinearProgress
} from '@mui/material';
import {
  Bookmark as BookmarkIcon,
  Save as SaveIcon,
  FileDownload as ExportIcon,
  ReceiptLong as LedgerIcon,
} from '@mui/icons-material';
import SimplePagination from '@/components/common/SimplePagination';
import EmptyPlaceholder from '@/components/common/EmptyPlaceholder';
import ArgusChartSkeleton from '@/components/argus/ArgusChartSkeleton';
import ArgusVolumeChart from '@/components/argus/ArgusVolumeChart';
import FilterChipSelect from '@/components/common/FilterChipSelect';
import { QueryAQLEditor, DISCOVER_CONFIG, type QueryAQLEditorHandle } from '@/components/argus/query-aql';
import { formatWith } from '@/utils/dateFormat';
import { downloadCsv, type CsvColumn } from '@/utils/csvExport';
import { fmt, fmtNum } from './MonetizationHelpers';
import { ARGUS_SEMANTIC } from '../../argusThemeTokens';
import { getRevenueTransactions, type TransactionResponse, type TransactionGroupedResponse, type LedgerGroupBy } from '@/services/argus/argusAnalytics';

interface ArgusMonetizationLedgerProps {
  txGroupBy: LedgerGroupBy;
  setTxGroupBy: (g: LedgerGroupBy) => void;
  txData: any;
  txLoading: boolean;
  txQuery: string;
  setTxQuery: (q: string) => void;
  txOffset: number;
  setTxOffset: (o: number) => void;
  txLimit: number;
  setTxLimit: (l: number) => void;
  txSort: 'timestamp' | 'amount';
  setTxSort: (s: 'timestamp' | 'amount') => void;
  txOrder: 'asc' | 'desc';
  setTxOrder: (o: 'asc' | 'desc') => void;
  data: any;
  loading: boolean;
  isDark: boolean;
  t: any;
  navigate: any;
  projectId: string;
  apiParams: any;
  setSavedQueriesOpen: (open: boolean) => void;
  setSaveDialogMode: (mode: 'new' | 'saveAs') => void;
  setSaveDialogOpen: (open: boolean) => void;
  fetchFieldValues: (fieldKey: string) => Promise<string[]>;
  handleChartZoom: (rawPeriods: string[]) => (startIdx: number, endIdx: number) => void;
  presetAnchor: any;
  setPresetAnchor: (el: any) => void;
  groupByAnchor: any;
  setGroupByAnchor: (el: any) => void;
  ledgerDslEditorRef: React.RefObject<QueryAQLEditorHandle>;
}

export const ArgusMonetizationLedger: React.FC<ArgusMonetizationLedgerProps> = ({
  txGroupBy,
  setTxGroupBy,
  txData,
  txLoading,
  txQuery,
  setTxQuery,
  txOffset,
  setTxOffset,
  txLimit,
  setTxLimit,
  txSort,
  setTxSort,
  txOrder,
  setTxOrder,
  data,
  loading,
  isDark,
  t,
  navigate,
  projectId,
  apiParams,
  setSavedQueriesOpen,
  setSaveDialogMode,
  setSaveDialogOpen,
  fetchFieldValues,
  handleChartZoom,
  presetAnchor,
  setPresetAnchor,
  groupByAnchor,
  setGroupByAnchor,
  ledgerDslEditorRef,
}) => {
  const dslEditorRef = ledgerDslEditorRef;
  const isGrouped = txGroupBy !== 'none';
  const isDataMatchingMode = txData && (isGrouped ? txData.mode === 'grouped' : txData.mode === 'flat');
  const hasData = isDataMatchingMode && (isGrouped
    ? Array.isArray((txData as TransactionGroupedResponse).groups) && (txData as TransactionGroupedResponse).groups.length > 0
    : Array.isArray((txData as TransactionResponse).transactions) && (txData as TransactionResponse).transactions.length > 0);

  const eventTypeLabels: Record<string, { label: string; color: string }> = {
    purchase: { label: t('argus.monetization.txPurchase', 'Purchase'), color: ARGUS_SEMANTIC.positive },
    refund: { label: t('argus.monetization.txRefund', 'Refund'), color: ARGUS_SEMANTIC.negative },
    grant: { label: t('argus.monetization.txGrant', 'Free Grant'), color: ARGUS_SEMANTIC.warning },
    ad_impression: { label: t('argus.monetization.txAd', 'Ad'), color: ARGUS_SEMANTIC.info },
  };

  const txCsvColumns: CsvColumn<any>[] = isGrouped
    ? [
        { key: 'group_key', label: 'Group Key' },
        { key: 'count', label: 'Transaction Count' },
        { key: 'total_amount', label: 'Total Amount', formatter: (v) => `$${(Number(v) || 0).toFixed(2)}` },
        { key: 'avg_amount', label: 'Average Amount', formatter: (v) => `$${(Number(v) || 0).toFixed(2)}` },
        { key: 'unique_users', label: 'Unique Users' },
        { key: 'first_at', label: 'First At', formatter: (v) => v ? new Date(v).toLocaleString() : '' },
        { key: 'last_at', label: 'Last At', formatter: (v) => v ? new Date(v).toLocaleString() : '' },
      ]
    : [
        { key: 'event_type', label: 'Type' },
        { key: 'timestamp', label: 'Time', formatter: (v) => v ? new Date(v).toLocaleString() : '' },
        { key: 'user_id', label: 'User ID' },
        { key: 'product_name', label: 'Product' },
        { key: 'amount', label: 'Amount', formatter: (v) => `$${(Number(v) || 0).toFixed(2)}` },
        { key: 'reason', label: 'Reason' },
        { key: 'payment_method', label: 'Payment Method' },
      ];

  // Presets definitions
  const presets = [
    {
      label: t('argus.monetization.presetReset', 'Reset All'),
      action: () => {
        setTxQuery('');
        setTxGroupBy('none');
        setTxOffset(0);
      },
    },
    {
      label: t('argus.monetization.presetVip', 'VIP Purchases (≥$100)'),
      action: () => {
        setTxQuery('event_name:purchase amount>=100');
        setTxGroupBy('none');
        setTxOffset(0);
      },
    },
    {
      label: t('argus.monetization.presetRefunds', 'Refunds (Technical)'),
      action: () => {
        setTxQuery('event_name:refund (reason:technical_issue OR reason:policy_violation)');
        setTxGroupBy('none');
        setTxOffset(0);
      },
    },
    {
      label: t('argus.monetization.presetGrants', 'Recent High Grants'),
      action: () => {
        setTxQuery('event_name:grant amount>=50');
        setTxGroupBy('none');
        setTxOffset(0);
      },
    },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Box sx={{ flexShrink: 0 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <LedgerIcon sx={{ color: 'text.secondary', fontSize: 24 }} />
            <Box>
              <Typography variant="h6" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {t('argus.monetization.transactionLedger', 'Transaction Ledger')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('argus.monetization.ledgerDesc', 'Audit and analyze individual transaction events')}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Button
              size="small" variant="outlined" startIcon={<BookmarkIcon sx={{ fontSize: 16 }} />}
              onClick={() => setSavedQueriesOpen(true)}
              sx={{ textTransform: 'none', fontSize: 12 }}
            >
              {t('argus.discover.savedQueries', 'Saved Queries')}
            </Button>
            <Button
              size="small" variant="outlined" startIcon={<SaveIcon sx={{ fontSize: 16 }} />}
              onClick={() => { setSaveDialogMode('new'); setSaveDialogOpen(true); }}
              sx={{ textTransform: 'none', fontSize: 12 }}
            >
              {t('common.save', 'Save')}
            </Button>
            <Button
              size="small" variant="outlined" startIcon={<ExportIcon sx={{ fontSize: 16 }} />}
              onClick={async () => {
                if (!txData) return;
                try {
                  const fullResult = await getRevenueTransactions(projectId, {
                    ...apiParams,
                    search: txQuery || undefined,
                    sort: txSort, order: txOrder,
                    group_by: txGroupBy,
                    offset: 0, limit: 10000,
                  });
                  const rowsToExport = isGrouped
                    ? (fullResult as TransactionGroupedResponse).groups
                    : (fullResult as TransactionResponse).transactions;
                  downloadCsv(rowsToExport, txCsvColumns, `ledger_${txGroupBy}_${txQuery ? 'query' : 'all'}_${new Date().toISOString().slice(0, 10)}`);
                } catch {
                  const rowsToExport = isGrouped
                    ? ((txData as TransactionGroupedResponse).groups || [])
                    : ((txData as TransactionResponse).transactions || []);
                  downloadCsv(rowsToExport, txCsvColumns, `ledger_${txGroupBy}_${txQuery ? 'query' : 'all'}_${new Date().toISOString().slice(0, 10)}`);
                }
              }}
              disabled={!hasData}
              sx={{ textTransform: 'none', fontSize: 12 }}
            >
              CSV
            </Button>
          </Box>
        </Box>

        {/* AQL Query Editor + Presets + Group By (inline) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <FilterChipSelect
            label={t('argus.monetization.presets', 'Presets')}
            value="__none__"
            options={presets.map((p, idx) => ({ value: String(idx), label: p.label }))}
            anchorEl={presetAnchor}
            onOpen={(e) => setPresetAnchor(e.currentTarget)}
            onClose={() => setPresetAnchor(null)}
            onSelect={(v) => { presets[Number(v)]?.action(); }}
          />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <QueryAQLEditor
              ref={dslEditorRef}
              config={DISCOVER_CONFIG}
              initialQuery={txQuery}
              onSearch={(val) => {
                setTxQuery(val);
                setTxOffset(0);
              }}
              onChange={(val) => {
                setTxQuery(val);
                setTxOffset(0);
              }}
              fetchFieldValues={fetchFieldValues}
              placeholder={t('argus.monetization.txSearchPlaceholder', 'event_name:purchase product_name:"Gem Pack"...')}
            />
          </Box>
          <FilterChipSelect
            label={t('argus.monetization.groupBy', 'Group By')}
            value={txGroupBy}
            options={[
              { value: 'none', label: t('argus.monetization.groupNone', 'None') },
              { value: 'product', label: t('argus.monetization.groupProduct', 'Product') },
              { value: 'user', label: t('argus.monetization.groupUser', 'User') },
              { value: 'day', label: t('argus.monetization.groupDay', 'Day') },
              { value: 'hour', label: t('argus.monetization.groupHour', 'Hour') },
              { value: 'reason', label: t('argus.monetization.groupReason', 'Reason') },
            ]}
            anchorEl={groupByAnchor}
            onOpen={(e) => setGroupByAnchor(e.currentTarget)}
            onClose={() => setGroupByAnchor(null)}
            onSelect={(v) => { setTxGroupBy(v as LedgerGroupBy); setTxOffset(0); }}
          />
        </Box>

        {/* Summary — total count + type breakdown */}
        <Box sx={{ display: 'flex', gap: 3, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          {isDataMatchingMode && txData && (
            <Chip
              variant="outlined" size="small"
              label={
                isGrouped
                  ? `${((txData as TransactionGroupedResponse).total_groups || 0).toLocaleString()} ${t('argus.monetization.groups', 'groups')}`
                  : `${((txData as TransactionResponse).total_count || 0).toLocaleString()} ${t('argus.monetization.txTotal', 'transactions')}`
              }
              sx={{ fontSize: 11, fontWeight: 700 }}
            />
          )}
          <Typography variant="body2" color="text.secondary" fontSize={12}>
            {t('argus.monetization.purchaseShort', 'Purchase')}: {isDataMatchingMode && txData ? `${fmt(txData.summary.purchase_total)} (${txData.summary.purchase_count.toLocaleString()})` : '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary" fontSize={12}>
            {t('argus.monetization.refundShort', 'Refund')}: {isDataMatchingMode && txData && txData.summary.refund_count > 0 ? `-${fmt(txData.summary.refund_total)} (${txData.summary.refund_count.toLocaleString()})` : '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary" fontSize={12}>
            {t('argus.monetization.grantShort', 'Free Grant')}: {isDataMatchingMode && txData && txData.summary.grant_count > 0 ? `${fmt(txData.summary.grant_total)} (${txData.summary.grant_count.toLocaleString()})` : '—'}
          </Typography>
          <Typography variant="body2" color="text.secondary" fontSize={12}>
            {t('argus.monetization.adShort', 'Ad')}: {isDataMatchingMode && txData && txData.summary.ad_count > 0 ? `${fmt(txData.summary.ad_total)} (${txData.summary.ad_count.toLocaleString()})` : '—'}
          </Typography>
        </Box>

        {!data ? (
          <Paper elevation={0} sx={{ mb: 1, p: 2, pt: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <ArgusChartSkeleton height={140} color={ARGUS_SEMANTIC.positive} />
          </Paper>
        ) : (() => {
          // When AQL filter is active, chart data (from overview API) doesn't match
          // the filtered transaction list — show empty chart to avoid misleading bars
          const hasAqlFilter = !!txQuery;
          const rot = hasAqlFilter ? [] : data.revenue_over_time;
          const periods = rot.map((d: any) => d.period);
          const refundMap = hasAqlFilter ? new Map() : new Map(data.refunds_over_time.map((r: any) => [r.period, r.refund_count]));
          const grantMap = hasAqlFilter ? new Map() : new Map((data.grants_over_time || []).map((g: any) => [g.period, g.grant_count]));
          const adMap = hasAqlFilter ? new Map() : new Map(data.ad_revenue_over_time.map((a: any) => [a.period, a.impressions]));
          return (
            <ArgusVolumeChart
              title={t('argus.monetization.txVolume', 'Transaction Volume')}
              rawPeriods={periods}
              labels={[]}
              datasets={[
                { label: t('argus.monetization.purchaseShort', 'Purchase'), data: rot.map((d: any) => d.transactions), color: ARGUS_SEMANTIC.positive },
                { label: t('argus.monetization.refundShort', 'Refund'), data: periods.map((p) => refundMap.get(p) || 0), color: ARGUS_SEMANTIC.negative },
                { label: t('argus.monetization.grantShort', 'Free Grant'), data: periods.map((p) => grantMap.get(p) || 0), color: ARGUS_SEMANTIC.warning },
                { label: t('argus.monetization.adShort', 'Ad'), data: periods.map((p) => adMap.get(p) || 0), color: ARGUS_SEMANTIC.info },
              ]}
              loading={false}
              onZoom={handleChartZoom(periods)}
              storagePrefix="ledger-volume"
              showChartTypeToggle
              showCompactToggle
              showLegend
              mb={1}
            />
          );
        })()}
      </Box>

      {/* Table — flex:1 fills remaining space, overflow:auto for internal scroll */}
      {hasData ? (
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{
            flex: 1,
            overflow: 'auto',
            borderRadius: 2,
            bgcolor: isDark ? 'rgba(255,255,255,0.02)' : '#fff',
            position: 'relative',
            opacity: txLoading ? 0.55 : 1,
            transition: 'opacity 0.15s ease',
            pointerEvents: txLoading ? 'none' : 'auto',
          }}
        >
          {txLoading && (
            <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 3, borderRadius: '8px 8px 0 0' }} />
          )}
          {!isGrouped ? (
            // ─── FLAT MODE TABLE (Standard User Profile style) ───
            <Table stickyHeader sx={{ '& .MuiTableCell-root': { py: 1.2 }, '& .MuiTableHead-root .MuiTableCell-root': { zIndex: 2, bgcolor: isDark ? '#1e1e1e' : '#fff' } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, width: 120 }}>{t('argus.monetization.txType', 'Type')}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>
                    <TableSortLabel
                      active={txSort === 'timestamp'}
                      direction={txSort === 'timestamp' ? txOrder : 'desc'}
                      onClick={() => {
                        const newOrder = txSort === 'timestamp' && txOrder === 'desc' ? 'asc' : 'desc';
                        setTxSort('timestamp');
                        setTxOrder(newOrder);
                      }}
                    >
                      {t('argus.monetization.txTime', 'Time')}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{t('argus.monetization.txUser', 'User')}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{t('argus.monetization.txProduct', 'Product')}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    <TableSortLabel
                      active={txSort === 'amount'}
                      direction={txSort === 'amount' ? txOrder : 'desc'}
                      onClick={() => {
                        const newOrder = txSort === 'amount' && txOrder === 'desc' ? 'asc' : 'desc';
                        setTxSort('amount');
                        setTxOrder(newOrder);
                      }}
                    >
                      {t('argus.monetization.txAmount', 'Amount')}
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{t('argus.monetization.txReason', 'Details')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(txData as TransactionResponse).transactions.map((tx, idx) => {
                  const meta = eventTypeLabels[tx.event_type] || { icon: '❓', label: tx.event_type, color: '#999' };
                  return (
                    <TableRow key={`${tx.event_id}-${idx}`} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: meta.color, flexShrink: 0 }} />
                          <Typography fontSize={12} fontWeight={600}>{meta.label}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                        {formatWith(tx.timestamp, 'M/D HH:mm')}
                      </TableCell>
                      <TableCell>
                        {tx.user_id ? (
                          <Typography
                            component="span"
                            onClick={() => navigate(`/argus/analytics/users/${encodeURIComponent(tx.user_id)}`)}
                            sx={{ fontSize: 12, fontWeight: 600, color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                          >
                            {tx.user_id.slice(0, 16)}{tx.user_id.length > 16 ? '…' : ''}
                          </Typography>
                        ) : <Typography fontSize={12} color="text.secondary">—</Typography>}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>{tx.product_name || (tx.ad_type ? tx.ad_type.replace(/_/g, ' ') : '—')}</TableCell>
                      <TableCell align="right" sx={{
                        fontSize: 12, fontWeight: 700,
                        color: tx.event_type === 'refund' ? ARGUS_SEMANTIC.negative : tx.event_type === 'grant' ? ARGUS_SEMANTIC.warning : 'text.primary',
                      }}>
                        {tx.event_type === 'refund' ? '-' : ''}{fmt(tx.amount)}
                      </TableCell>
                      <TableCell sx={{ fontSize: 11, color: 'text.secondary', textTransform: 'capitalize' }}>
                        {tx.reason ? tx.reason.replace(/_/g, ' ') : (tx.payment_method ? tx.payment_method.replace(/_/g, ' ') : '—')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            // ─── GROUPED MODE TABLE (Standard User Profile style) ───
            <Table stickyHeader sx={{ '& .MuiTableCell-root': { py: 1.2 }, '& .MuiTableHead-root .MuiTableCell-root': { zIndex: 2, bgcolor: isDark ? '#1e1e1e' : '#fff' } }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>{t('argus.monetization.groupKey', 'Group Key')}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{t('argus.monetization.groupCount', 'Count')}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{t('argus.monetization.groupTotal', 'Total Amount')}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{t('argus.monetization.groupAvg', 'Average Amount')}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>{t('argus.monetization.groupUniqueUsers', 'Unique Users')}</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>{t('argus.monetization.groupRange', 'Activity Range')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(txData as TransactionGroupedResponse).groups.map((group, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell sx={{ fontSize: 12, fontWeight: 700 }}>
                      {txGroupBy === 'user' ? (
                        <Typography
                          component="span"
                          onClick={() => navigate(`/argus/analytics/users/${encodeURIComponent(group.group_key)}`)}
                          sx={{ fontSize: 12, fontWeight: 700, color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                        >
                          {group.group_key || '—'}
                        </Typography>
                      ) : (
                        group.group_key || '—'
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600 }}>{group.count.toLocaleString()}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, fontWeight: 800, color: 'primary.main' }}>{fmt(group.total_amount)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600 }}>{fmt(group.avg_amount)}</TableCell>
                    <TableCell align="right" sx={{ fontSize: 12, fontWeight: 600 }}>{group.unique_users.toLocaleString()}</TableCell>
                    <TableCell sx={{ fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}>
                      {group.first_at ? new Date(group.first_at).toLocaleDateString() : ''}
                      {group.last_at && group.last_at !== group.first_at ? ` ~ ${new Date(group.last_at).toLocaleDateString()}` : ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TableContainer>
      ) : (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!txLoading && (
            <EmptyPlaceholder
              message={t('argus.monetization.txEmpty', 'No transactions found for the selected filters.')}
              sx={{ py: 6 }}
            />
          )}
        </Box>
      )}

      {/* Pagination — flexShrink:0 keeps it at bottom */}
      <Box sx={{ mt: 2, flexShrink: 0 }}>
        {isDataMatchingMode && txData && (isGrouped ? (txData as TransactionGroupedResponse).total_groups || 0 : (txData as TransactionResponse).total_count || 0) > 0 && (
          <SimplePagination
            count={isGrouped ? (txData as TransactionGroupedResponse).total_groups || 0 : (txData as TransactionResponse).total_count || 0}
            page={Math.floor(txOffset / txLimit)}
            rowsPerPage={txLimit}
            onPageChange={(_, newPage) => setTxOffset(newPage * txLimit)}
            onRowsPerPageChange={(e) => {
              const newLimit = Number(e.target.value);
              setTxLimit(newLimit);
              setTxOffset(0);
            }}
            rowsPerPageOptions={[10, 15, 20, 25, 50, 100]}
            showRowsPerPage={true}
            size="small"
          />
        )}
      </Box>
    </Box>
  );
};
