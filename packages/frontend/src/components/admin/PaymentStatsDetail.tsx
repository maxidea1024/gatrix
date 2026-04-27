import React, { useState, useMemo } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

// ─── Types ───

interface ProductData {
  name: string;
  count: number;
  amount: number;
}

interface DailyData {
  totalCount: number;
  totalAmount: number;
  products: Record<string, ProductData>;
}

interface PaymentStatsDetailProps {
  stats: {
    totalCount: number;
    totalAmount: number;
    products: Record<string, ProductData>;
    daily: Record<string, DailyData>;
  };
  onBack: () => void;
}

type SortField = 'id' | 'name' | 'unit' | 'count' | 'amount';
type SortDir = 'asc' | 'desc';

// ─── Helpers ───

const CNY_TO_KRW = 216.48;

/** Replace "{0}" placeholder in product names with the number portion */
function formatProductName(name: string): string {
  const match = name.match(/(\d[\d,]*)\s*\+\s*\{0\}/);
  if (match) return name.replace(/\{0\}/, match[1]);
  return name;
}

function sortProducts(
  entries: [string, ProductData][],
  field: SortField,
  dir: SortDir
): [string, ProductData][] {
  return [...entries].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    switch (field) {
      case 'id':
        aVal = a[0];
        bVal = b[0];
        break;
      case 'name':
        aVal = formatProductName(a[1].name);
        bVal = formatProductName(b[1].name);
        break;
      case 'unit':
        aVal = a[1].count > 0 ? a[1].amount / a[1].count : 0;
        bVal = b[1].count > 0 ? b[1].amount / b[1].count : 0;
        break;
      case 'count':
        aVal = a[1].count;
        bVal = b[1].count;
        break;
      case 'amount':
        aVal = a[1].amount;
        bVal = b[1].amount;
        break;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return dir === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    return dir === 'asc'
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });
}

// ─── Shared Styles ───

const cellSx = {
  px: 2,
  py: 1.2,
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  fontFamily: '"Inter", "Roboto Mono", monospace',
  fontVariantNumeric: 'tabular-nums' as const,
  fontSize: '0.85rem',
  textShadow: '0 1px 4px rgba(0,0,0,0.6)',
};

const headerCellSx = {
  ...cellSx,
  color: 'rgba(255,255,255,0.8)',
  fontWeight: 700,
  fontSize: '0.75rem',
  letterSpacing: 0.5,
  textTransform: 'uppercase' as const,
  cursor: 'pointer',
  userSelect: 'none' as const,
  whiteSpace: 'nowrap' as const,
  transition: 'background 0.15s ease',
  '&:hover': { background: 'rgba(255,255,255,0.08)' },
};

// ─── Sort Header Component ───

const SortHeader: React.FC<{
  field: SortField;
  label: string;
  align?: 'left' | 'right';
  currentSort: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
}> = ({ field, label, align = 'left', currentSort, currentDir, onSort }) => {
  const isActive = currentSort === field;
  const arrow = isActive ? (currentDir === 'asc' ? ' ↑' : ' ↓') : ' ⇅';
  return (
    <Box
      component="th"
      onClick={() => onSort(field)}
      sx={{
        ...headerCellSx,
        textAlign: align,
        color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)',
      }}
    >
      {label}
      <Box
        component="span"
        sx={{ ml: 0.5, opacity: isActive ? 1 : 0.3, fontSize: '0.7rem' }}
      >
        {arrow}
      </Box>
    </Box>
  );
};

// ─── Product Table ───

const ProductTable: React.FC<{
  products: Record<string, ProductData>;
  emptyLabel: string;
}> = ({ products, emptyLabel }) => {
  const { t } = useTranslation();
  const [sortField, setSortField] = useState<SortField>('amount');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const entries = useMemo(
    () => sortProducts(Object.entries(products), sortField, sortDir),
    [products, sortField, sortDir]
  );

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'name' || field === 'id' ? 'asc' : 'desc');
    }
  };

  const prefix = 'playerConnections.scoreboard.detail.';

  return (
    <Box
      component="table"
      sx={{
        width: '100%',
        borderCollapse: 'collapse',
        tableLayout: 'auto',
      }}
    >
      <Box component="thead">
        <Box component="tr">
          <SortHeader
            field="id"
            label={t(`${prefix}productId`)}
            currentSort={sortField}
            currentDir={sortDir}
            onSort={handleSort}
          />
          <SortHeader
            field="name"
            label={t(`${prefix}productName`)}
            currentSort={sortField}
            currentDir={sortDir}
            onSort={handleSort}
          />
          <SortHeader
            field="unit"
            label={t(`${prefix}unitPrice`)}
            align="right"
            currentSort={sortField}
            currentDir={sortDir}
            onSort={handleSort}
          />
          <SortHeader
            field="count"
            label={t(`${prefix}quantity`)}
            align="right"
            currentSort={sortField}
            currentDir={sortDir}
            onSort={handleSort}
          />
          <SortHeader
            field="amount"
            label={t(`${prefix}amount`)}
            align="right"
            currentSort={sortField}
            currentDir={sortDir}
            onSort={handleSort}
          />
        </Box>
      </Box>
      <Box component="tbody">
        {entries.length === 0 ? (
          <Box component="tr">
            <Box
              component="td"
              colSpan={5}
              sx={{
                ...cellSx,
                textAlign: 'center',
                color: 'rgba(255,255,255,0.5)',
                fontWeight: 700,
                fontSize: '0.9rem',
                fontFamily: '"Inter", sans-serif',
                py: 3,
              }}
            >
              {emptyLabel}
            </Box>
          </Box>
        ) : (
          entries.map(([shopItemId, product]) => {
            const unitPrice =
              product.count > 0
                ? (product.amount / product.count).toFixed(2)
                : '0.00';
            return (
              <Box
                component="tr"
                key={shopItemId}
                sx={{
                  transition: 'background 0.15s ease',
                  '&:hover': { background: 'rgba(255,255,255,0.03)' },
                }}
              >
                <Box
                  component="td"
                  sx={{ ...cellSx, color: 'rgba(255,255,255,0.4)' }}
                >
                  {shopItemId}
                </Box>
                <Box
                  component="td"
                  sx={{ ...cellSx, color: 'rgba(255,255,255,0.85)' }}
                >
                  {formatProductName(product.name)}
                </Box>
                <Box
                  component="td"
                  sx={{
                    ...cellSx,
                    textAlign: 'right',
                    color: 'rgba(255,255,255,0.6)',
                  }}
                >
                  ¥{unitPrice}
                </Box>
                <Box
                  component="td"
                  sx={{
                    ...cellSx,
                    textAlign: 'right',
                    color: 'rgba(255,255,255,0.7)',
                  }}
                >
                  {product.count.toLocaleString()}
                </Box>
                <Box
                  component="td"
                  sx={{
                    ...cellSx,
                    textAlign: 'right',
                    color: 'rgba(255,255,255,0.9)',
                    fontWeight: 600,
                  }}
                >
                  ¥
                  {product.amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </Box>
              </Box>
            );
          })
        )}
      </Box>
    </Box>
  );
};

// ─── Main Component ───

const PaymentStatsDetail: React.FC<PaymentStatsDetailProps> = ({
  stats,
  onBack,
}) => {
  const { t } = useTranslation();
  const dailyDates = useMemo(
    () =>
      Object.keys(stats.daily || {})
        .sort()
        .reverse(),
    [stats.daily]
  );

  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const totalAmountKrw = Math.round(stats.totalAmount * CNY_TO_KRW);
  const prefix = 'playerConnections.scoreboard.detail.';

  return (
    <Box
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'detailFadeIn 0.4s ease-out both',
        '@keyframes detailFadeIn': {
          '0%': { opacity: 0, transform: 'translateY(20px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      }}
    >
      {/* Dark overlay for readability (no own background — parent bg shows through) */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.26) 0%, rgba(0,0,0,0.23) 40%, rgba(0,0,0,0.29) 100%)',
        }}
      />
      {/* Content overlay */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'auto',
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 3,
          },
        }}
      >
        {/* Header with back button */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            px: 4,
            py: 2.5,
            flexShrink: 0,
          }}
        >
          <IconButton
            onClick={onBack}
            sx={{
              color: 'rgba(255,255,255,0.6)',
              '&:hover': {
                color: '#fff',
                background: 'rgba(255,255,255,0.08)',
              },
            }}
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography
            variant="h5"
            sx={{
              color: 'rgba(255,255,255,0.95)',
              fontWeight: 700,
              fontFamily: '"Inter", sans-serif',
              letterSpacing: 0.5,
              textShadow: '0 1px 6px rgba(0,0,0,0.7)',
            }}
          >
            💰 {t(`${prefix}title`)}
          </Typography>
        </Box>

        {/* Summary cards */}
        <Box
          sx={{
            display: 'flex',
            gap: 3,
            px: 4,
            pb: 3,
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          {/* Total transactions */}
          <Box
            sx={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 2,
              px: 3,
              py: 2,
              minWidth: 200,
              backdropFilter: 'blur(8px)',
            }}
          >
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.6)',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: 'uppercase',
                mb: 0.5,
                textShadow: '0 1px 4px rgba(0,0,0,0.6)',
              }}
            >
              {t('playerConnections.scoreboard.totalPurchases')}
            </Typography>
            <Typography
              sx={{
                color: '#fff',
                fontSize: '1.8rem',
                fontWeight: 800,
                fontFamily: '"Inter", "Roboto Mono", monospace',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
                textShadow: '0 1px 8px rgba(0,0,0,0.6)',
              }}
            >
              {stats.totalCount.toLocaleString()}
            </Typography>
          </Box>

          {/* Total revenue */}
          <Box
            sx={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 2,
              px: 3,
              py: 2,
              minWidth: 200,
              backdropFilter: 'blur(8px)',
            }}
          >
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.4)',
                fontSize: '0.75rem',
                fontWeight: 600,
                letterSpacing: 1,
                textTransform: 'uppercase',
                mb: 0.5,
              }}
            >
              {t('playerConnections.scoreboard.totalRevenue')}
            </Typography>
            <Typography
              sx={{
                color: '#fff',
                fontSize: '1.8rem',
                fontWeight: 800,
                fontFamily: '"Inter", "Roboto Mono", monospace',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              ¥
              {stats.totalAmount.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </Typography>
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: '0.8rem',
                mt: 0.5,
                fontFamily: '"Inter", monospace',
                fontVariantNumeric: 'tabular-nums',
                textShadow: '0 1px 4px rgba(0,0,0,0.6)',
              }}
            >
              ≈ ₩{totalAmountKrw.toLocaleString()}
            </Typography>
          </Box>

          {/* Exchange rate notice */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              color: 'rgba(255,255,255,0.45)',
              fontSize: '0.75rem',
              ml: 'auto',
              fontFamily: '"Inter", sans-serif',
              textShadow: '0 1px 4px rgba(0,0,0,0.6)',
            }}
          >
            ⚠️ {t(`${prefix}exchangeRate`)}
          </Box>
        </Box>

        {/* Product sales table */}
        <Box sx={{ px: 4, pb: 3, flexShrink: 0 }}>
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.7)',
              fontSize: '1rem',
              fontWeight: 700,
              mb: 1.5,
              fontFamily: '"Inter", sans-serif',
            }}
          >
            📦 {t(`${prefix}productSales`)}
          </Typography>
          <Box
            sx={{
              background: 'rgba(0,0,0,0.25)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 2,
              overflow: 'hidden',
              backdropFilter: 'blur(8px)',
            }}
          >
            <ProductTable
              products={stats.products}
              emptyLabel={t(`${prefix}noSales`)}
            />
          </Box>
        </Box>

        {/* Daily sales — collapsible sections */}
        <Box sx={{ px: 4, pb: 4 }}>
          <Typography
            sx={{
              color: 'rgba(255,255,255,0.9)',
              fontSize: '1rem',
              fontWeight: 700,
              mb: 1.5,
              fontFamily: '"Inter", sans-serif',
              textShadow: '0 1px 6px rgba(0,0,0,0.7)',
            }}
          >
            📊 {t(`${prefix}dailySales`)}
          </Typography>
          {dailyDates.length === 0 ? (
            <Box
              sx={{
                background: 'rgba(0,0,0,0.25)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 2,
                px: 3,
                py: 4,
                textAlign: 'center',
                backdropFilter: 'blur(8px)',
              }}
            >
              <Typography
                sx={{
                  color: 'rgba(255,255,255,0.5)',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  fontFamily: '"Inter", sans-serif',
                  textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                }}
              >
                {t(`${prefix}noSales`)}
              </Typography>
            </Box>
          ) : (
            dailyDates.map((dateStr) => {
              const daily = stats.daily[dateStr];
              const isExpanded = expandedDates.has(dateStr);
              return (
                <Box
                  key={dateStr}
                  sx={{
                    mb: 1.5,
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 2,
                    overflow: 'hidden',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  {/* Date header — clickable */}
                  <Box
                    onClick={() => toggleDate(dateStr)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      px: 2,
                      py: 1.5,
                      cursor: 'pointer',
                      transition: 'background 0.15s ease',
                      '&:hover': { background: 'rgba(255,255,255,0.03)' },
                    }}
                  >
                    <Box
                      component="span"
                      sx={{
                        fontSize: '0.7rem',
                        color: 'rgba(255,255,255,0.4)',
                        transition: 'transform 0.2s',
                        transform: isExpanded
                          ? 'rotate(90deg)'
                          : 'rotate(0deg)',
                      }}
                    >
                      ▶
                    </Box>
                    <Typography
                      sx={{
                        color: 'rgba(255,255,255,0.85)',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        fontFamily: '"Inter", sans-serif',
                      }}
                    >
                      📅 {dateStr}
                    </Typography>
                    <Typography
                      sx={{
                        color: 'rgba(255,255,255,0.4)',
                        fontSize: '0.8rem',
                        fontFamily: '"Inter", monospace',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {t(`${prefix}quantity`)}:{' '}
                      {daily.totalCount.toLocaleString()} |{' '}
                      {t(`${prefix}amount`)}: ¥
                      {daily.totalAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </Typography>
                  </Box>

                  {/* Expanded table */}
                  {isExpanded && (
                    <Box sx={{ px: 2, pb: 2 }}>
                      <ProductTable
                        products={daily.products}
                        emptyLabel={t(`${prefix}noSales`)}
                      />
                    </Box>
                  )}
                </Box>
              );
            })
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default PaymentStatsDetail;
