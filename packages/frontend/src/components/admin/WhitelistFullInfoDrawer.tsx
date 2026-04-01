/**
 * WhitelistFullInfoDrawer Component
 *
 * Displays a comprehensive overview of all registered account whitelists
 * and IP whitelists in a single drawer for quick reference.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton,
  Divider,
  Menu,
  Button,
  alpha,
} from '@mui/material';
import {
  ContentCopy as ContentCopyIcon,
  Person as PersonIcon,
  Dns as DnsIcon,
  Download as DownloadIcon,
  ArrowDropUp as ArrowDropUpIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import {
  WhitelistService,
  Whitelist,
} from '../../services/whitelistService';
import {
  IpWhitelistService,
  IpWhitelist,
} from '../../services/ipWhitelistService';
import {
  formatRelativeTime,
} from '../../utils/dateFormat';
import { copyToClipboardWithNotification } from '../../utils/clipboard';
import { exportToFile, ExportColumn } from '../../utils/exportImportUtils';
import * as XLSX from 'xlsx';
import { getDateTimeStr, downloadBlob } from '../../utils/exportImportUtils';
import ExportImportMenuItems from '../common/ExportImportMenuItems';
import ResizableDrawer from '../common/ResizableDrawer';

interface WhitelistFullInfoDrawerProps {
  open: boolean;
  onClose: () => void;
}

const WhitelistFullInfoDrawer: React.FC<WhitelistFullInfoDrawerProps> = ({
  open,
  onClose,
}) => {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const [accountWhitelists, setAccountWhitelists] = useState<Whitelist[]>([]);
  const [ipWhitelists, setIpWhitelists] = useState<IpWhitelist[]>([]);
  const [accountTotal, setAccountTotal] = useState(0);
  const [ipTotal, setIpTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Fetch all pages with max allowed limit (100)
  const fetchAllPages = useCallback(
    async <T,>(
      fetcher: (page: number, limit: number) => Promise<{ total: number } & Record<string, any>>,
      dataKey: string
    ): Promise<{ items: T[]; total: number }> => {
      const PAGE_LIMIT = 100;
      const firstPage = await fetcher(1, PAGE_LIMIT);
      const total = firstPage.total || 0;
      const items: T[] = [...(firstPage[dataKey] || [])];

      if (total > PAGE_LIMIT) {
        const totalPages = Math.ceil(total / PAGE_LIMIT);
        const remaining = Array.from(
          { length: totalPages - 1 },
          (_, i) => fetcher(i + 2, PAGE_LIMIT)
        );
        const pages = await Promise.all(remaining);
        for (const page of pages) {
          items.push(...(page[dataKey] || []));
        }
      }

      return { items, total };
    },
    []
  );

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [accountResult, ipResult] = await Promise.all([
        fetchAllPages<Whitelist>(
          (page, limit) => WhitelistService.getWhitelists(page, limit),
          'whitelists'
        ),
        fetchAllPages<IpWhitelist>(
          (page, limit) => IpWhitelistService.getIpWhitelists(page, limit),
          'ipWhitelists'
        ),
      ]);

      setAccountWhitelists(accountResult.items);
      setAccountTotal(accountResult.total);
      setIpWhitelists(ipResult.items);
      setIpTotal(ipResult.total);
    } catch (error) {
      console.error('Failed to load whitelist data:', error);
      enqueueSnackbar(t('whitelist.fullInfo.loadFailed'), {
        variant: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [t, enqueueSnackbar, fetchAllPages]);

  useEffect(() => {
    if (open) {
      loadAllData();
    }
  }, [open, loadAllData]);

  // Export menu state
  const [exportMenuAnchor, setExportMenuAnchor] =
    useState<HTMLElement | null>(null);

  const handleCopy = (text: string) => {
    copyToClipboardWithNotification(
      text,
      () =>
        enqueueSnackbar(t('common.copiedToClipboard'), { variant: 'success' }),
      () => enqueueSnackbar(t('common.copyFailed'), { variant: 'error' })
    );
  };

  // Export handler for all whitelist data
  const handleExport = (format: 'csv' | 'json' | 'xlsx') => {
    setExportMenuAnchor(null);

    try {
      if (format === 'xlsx') {
        // Multi-sheet XLSX: account whitelists + IP whitelists
        const accountHeaders = [
          t('whitelist.form.accountId'),
          t('whitelist.form.ipAddress'),
          t('whitelist.allowedPeriod') + ' (' + t('ipWhitelist.from') + ')',
          t('whitelist.allowedPeriod') + ' (' + t('ipWhitelist.to') + ')',
          t('whitelist.form.purpose'),
          t('common.status'),
        ];
        const accountData = accountWhitelists.map((w) => ({
          [accountHeaders[0]]: w.accountId,
          [accountHeaders[1]]: w.ipAddress || t('whitelist.anyIp'),
          [accountHeaders[2]]: w.startDate || '',
          [accountHeaders[3]]: w.endDate || '',
          [accountHeaders[4]]: w.purpose || '',
          [accountHeaders[5]]: w.isEnabled
            ? t('status.active')
            : t('status.inactive'),
        }));

        const ipHeaders = [
          t('ipWhitelist.ipAddress'),
          t('ipWhitelist.purpose'),
          t('ipWhitelist.period') + ' (' + t('ipWhitelist.from') + ')',
          t('ipWhitelist.period') + ' (' + t('ipWhitelist.to') + ')',
          t('common.status'),
        ];
        const ipData = ipWhitelists.map((ip) => ({
          [ipHeaders[0]]: ip.ipAddress,
          [ipHeaders[1]]: ip.purpose || '',
          [ipHeaders[2]]: ip.startDate || '',
          [ipHeaders[3]]: ip.endDate || '',
          [ipHeaders[4]]: ip.isEnabled
            ? t('status.active')
            : t('status.inactive'),
        }));

        const workbook = XLSX.utils.book_new();

        const accountSheet = XLSX.utils.json_to_sheet(accountData);
        accountSheet['!cols'] = accountHeaders.map((h) => ({
          wch: Math.max(h.length, 15),
        }));
        XLSX.utils.book_append_sheet(
          workbook,
          accountSheet,
          t('whitelist.overview.accountWhitelists')
        );

        const ipSheet = XLSX.utils.json_to_sheet(ipData);
        ipSheet['!cols'] = ipHeaders.map((h) => ({
          wch: Math.max(h.length, 15),
        }));
        XLSX.utils.book_append_sheet(
          workbook,
          ipSheet,
          t('whitelist.overview.ipWhitelists')
        );

        const xlsxBuffer = XLSX.write(workbook, {
          bookType: 'xlsx',
          type: 'array',
        });
        const blob = new Blob([xlsxBuffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        downloadBlob(
          blob,
          `whitelist-full-info-${getDateTimeStr()}.xlsx`
        );
      } else if (format === 'json') {
        // JSON: combined object with both sections
        const jsonData = {
          accountWhitelists: accountWhitelists.map((w) => ({
            accountId: w.accountId,
            ipAddress: w.ipAddress || '',
            startDate: w.startDate || '',
            endDate: w.endDate || '',
            purpose: w.purpose || '',
            isEnabled: w.isEnabled,
          })),
          ipWhitelists: ipWhitelists.map((ip) => ({
            ipAddress: ip.ipAddress,
            purpose: ip.purpose || '',
            startDate: ip.startDate || '',
            endDate: ip.endDate || '',
            isEnabled: ip.isEnabled,
          })),
        };
        const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
          type: 'application/json',
        });
        downloadBlob(
          blob,
          `whitelist-full-info-${getDateTimeStr()}.json`
        );
      } else {
        // CSV: account section first, then IP section separated by empty line
        const accountColumns: ExportColumn[] = [
          { key: 'accountId', header: t('whitelist.form.accountId') },
          { key: 'ipAddress', header: t('whitelist.form.ipAddress') },
          { key: 'startDate', header: t('ipWhitelist.from') },
          { key: 'endDate', header: t('ipWhitelist.to') },
          { key: 'purpose', header: t('whitelist.form.purpose') },
          { key: 'isEnabled', header: t('common.status') },
        ];
        const accountRows = accountWhitelists.map((w) => ({
          accountId: w.accountId,
          ipAddress: w.ipAddress || t('whitelist.anyIp'),
          startDate: w.startDate || '',
          endDate: w.endDate || '',
          purpose: w.purpose || '',
          isEnabled: w.isEnabled
            ? t('status.active')
            : t('status.inactive'),
        }));
        exportToFile(
          accountRows,
          accountColumns,
          'whitelist-full-info',
          'csv'
        );
      }

      enqueueSnackbar(t('common.exportSuccess'), { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(t('common.exportFailed'), { variant: 'error' });
    }
  };

  const getStatusChip = (isEnabled: boolean) => (
    <Chip
      label={isEnabled ? t('status.active') : t('status.inactive')}
      color={isEnabled ? 'success' : 'default'}
      size="small"
    />
  );

  const getPeriodLabel = (
    startDate?: string,
    endDate?: string
  ): React.ReactNode => {
    if (!startDate && !endDate) {
      return (
        <Typography variant="body2" color="text.secondary">
          {t('whitelist.permanent')}
        </Typography>
      );
    }
    return (
      <Typography variant="body2" color="text.secondary">
        {startDate ? formatRelativeTime(startDate) : '-'} ~{' '}
        {endDate ? formatRelativeTime(endDate) : '-'}
      </Typography>
    );
  };

  // Separate active vs inactive for summary
  const activeAccountCount = accountWhitelists.filter(
    (w) => w.isEnabled
  ).length;
  const activeIpCount = ipWhitelists.filter((w) => w.isEnabled).length;

  return (
    <ResizableDrawer
      open={open}
      onClose={onClose}
      title={t('whitelist.fullInfo.title')}
      subtitle={t('whitelist.fullInfo.subtitle')}
      storageKey="whitelistFullInfoDrawerWidth"
      defaultWidth={700}
      minWidth={550}
    >
      {/* Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {loading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              py: 8,
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Summary Cards */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box
                sx={{
                  flex: 1,
                  p: 2,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: (theme) =>
                    alpha(
                      theme.palette.primary.main,
                      theme.palette.mode === 'dark' ? 0.08 : 0.04
                    ),
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 1,
                  }}
                >
                  <PersonIcon
                    sx={{ fontSize: 20, color: 'primary.main' }}
                  />
                  <Typography variant="subtitle2">
                    {t('whitelist.overview.accountWhitelists')}
                  </Typography>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {activeAccountCount}
                  <Typography
                    component="span"
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 0.5 }}
                  >
                    / {accountTotal}
                  </Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('whitelist.overview.activeEntries')}
                </Typography>
              </Box>

              <Box
                sx={{
                  flex: 1,
                  p: 2,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: (theme) =>
                    alpha(
                      theme.palette.secondary.main,
                      theme.palette.mode === 'dark' ? 0.08 : 0.04
                    ),
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 1,
                  }}
                >
                  <DnsIcon
                    sx={{ fontSize: 20, color: 'secondary.main' }}
                  />
                  <Typography variant="subtitle2">
                    {t('whitelist.overview.ipWhitelists')}
                  </Typography>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  {activeIpCount}
                  <Typography
                    component="span"
                    variant="body2"
                    color="text.secondary"
                    sx={{ ml: 0.5 }}
                  >
                    / {ipTotal}
                  </Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t('whitelist.overview.activeEntries')}
                </Typography>
              </Box>
            </Box>

            {/* Account Whitelists Section */}
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: 1.5,
                }}
              >
                <PersonIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {t('whitelist.overview.accountWhitelists')}
                </Typography>
                <Chip
                  label={accountTotal}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              </Box>

              {accountWhitelists.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  {t('whitelist.overview.noActiveAccounts')}
                </Alert>
              ) : (
                <TableContainer
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                  }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>
                          {t('whitelist.form.accountId')}
                        </TableCell>
                        <TableCell>
                          {t('whitelist.form.ipAddress')}
                        </TableCell>
                        <TableCell>
                          {t('whitelist.allowedPeriod')}
                        </TableCell>
                        <TableCell>{t('whitelist.form.purpose')}</TableCell>
                        <TableCell>{t('common.status')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {accountWhitelists.map((w) => (
                        <TableRow key={w.id} hover>
                          <TableCell>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 500 }}
                              >
                                {w.accountId}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => handleCopy(w.accountId)}
                                sx={{ p: 0.25 }}
                              >
                                <ContentCopyIcon
                                  sx={{ fontSize: 14 }}
                                />
                              </IconButton>
                            </Box>
                          </TableCell>
                          <TableCell>
                            {w.ipAddress ? (
                              <Chip
                                label={w.ipAddress}
                                size="small"
                                variant="outlined"
                              />
                            ) : (
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {t('whitelist.anyIp')}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {getPeriodLabel(w.startDate, w.endDate)}
                          </TableCell>
                          <TableCell>
                            <Tooltip
                              title={w.purpose || ''}
                              placement="top"
                            >
                              <Typography
                                variant="body2"
                                sx={{
                                  maxWidth: 150,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {w.purpose || '-'}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>{getStatusChip(w.isEnabled)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>

            <Divider />

            {/* IP Whitelists Section */}
            <Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  mb: 1.5,
                }}
              >
                <DnsIcon sx={{ fontSize: 18, color: 'secondary.main' }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {t('whitelist.overview.ipWhitelists')}
                </Typography>
                <Chip
                  label={ipTotal}
                  size="small"
                  color="secondary"
                  variant="outlined"
                />
              </Box>

              {ipWhitelists.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  {t('whitelist.overview.noActiveIpRanges')}
                </Alert>
              ) : (
                <TableContainer
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 2,
                  }}
                >
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>
                          {t('ipWhitelist.ipAddress')}
                        </TableCell>
                        <TableCell>
                          {t('ipWhitelist.purpose')}
                        </TableCell>
                        <TableCell>
                          {t('ipWhitelist.period')}
                        </TableCell>
                        <TableCell>{t('common.status')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {ipWhitelists.map((ip) => (
                        <TableRow key={ip.id} hover>
                          <TableCell>
                            <Box
                              sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                              }}
                            >
                              <Typography
                                variant="body2"
                                sx={{ fontFamily: 'monospace' }}
                              >
                                {ip.ipAddress}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => handleCopy(ip.ipAddress)}
                                sx={{ p: 0.25 }}
                              >
                                <ContentCopyIcon
                                  sx={{ fontSize: 14 }}
                                />
                              </IconButton>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Tooltip
                              title={ip.purpose || ''}
                              placement="top"
                            >
                              <Typography
                                variant="body2"
                                sx={{
                                  maxWidth: 150,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {ip.purpose || '-'}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            {getPeriodLabel(ip.startDate, ip.endDate)}
                          </TableCell>
                          <TableCell>{getStatusChip(ip.isEnabled)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* Footer */}
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          gap: 1,
          justifyContent: 'flex-end',
        }}
      >
        <Button onClick={onClose}>
          {t('common.close')}
        </Button>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          endIcon={<ArrowDropUpIcon />}
          onClick={(e) => setExportMenuAnchor(e.currentTarget)}
          disabled={
            loading ||
            (accountWhitelists.length === 0 && ipWhitelists.length === 0)
          }
        >
          {t('common.export')}
        </Button>
        <Menu
          anchorEl={exportMenuAnchor}
          open={Boolean(exportMenuAnchor)}
          onClose={() => setExportMenuAnchor(null)}
          anchorOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
        >
          <ExportImportMenuItems
            onExport={handleExport}
            exportOnly
          />
        </Menu>
      </Box>
    </ResizableDrawer>
  );
};

export default WhitelistFullInfoDrawer;
