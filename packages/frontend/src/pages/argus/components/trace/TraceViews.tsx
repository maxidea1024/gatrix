import React from 'react';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import ArgusVolumeChart, { VolumeChartType } from '@/components/argus/ArgusVolumeChart';
import { ChartDataset } from '@/components/argus/InteractiveTimeSeriesChart';
import SegmentedTabs from '@/components/common/SegmentedTabs';
import { SpansTab, TracesTab } from '../TraceExplorerTabs';
import AggregatePanel, { AggChartType } from '@/components/argus/AggregatePanel';
import { FacetGroup } from '@/components/argus/FacetSidebar';

interface TraceViewsProps {
  volumeDatasets: ChartDataset[];
  volumeLabels: string[];
  loading: boolean;
  volume: { bucket: string; op: string; count: number }[];
  handleZoom: (start: string, end: string) => void;
  activeTab: number;
  handleTabChange: (newTab: string) => void;
  // Spans
  spans: any[];
  orderCol: string;
  orderDir: 'asc' | 'desc';
  handleColumnSort: (col: string) => void;
  handleSelectSpan: (span: any, index: number) => void;
  selectedSpanIndex: number | null;
  addSearchTag: (key: string, value: string) => void;
  spansHasMore: boolean;
  loadingMore: boolean;
  handleLoadMoreSpans: () => void;
  // Traces
  traceSamples: any[];
  tracesHasMore: boolean;
  handleLoadMoreTraces: () => void;
  // Aggregates
  aggGroupBys: string[];
  aggDataMap: Record<
    string,
    {
      groupBy: string;
      topValues: { group_value: string; count: number }[];
      timeSeries: { bucket: string; group_value: string; count: number }[];
    }
  >;
  aggLoading: boolean;
  traceGroupByOptions: { value: string; label: string }[];
  spanFacets: FacetGroup[];
  setUrlState: (state: any) => void;
  fetchAggregates: (groupBys?: string[]) => void;
  // Chart type tracking
  volumeChartType?: VolumeChartType;
  onVolumeChartTypeChange?: (type: VolumeChartType) => void;
  aggChartTypes?: AggChartType[];
  onAggChartTypeChange?: (index: number, type: AggChartType) => void;
}

export const TraceViews: React.FC<TraceViewsProps> = ({
  volumeDatasets,
  volumeLabels,
  loading,
  volume,
  handleZoom,
  activeTab,
  handleTabChange,
  spans,
  orderCol,
  orderDir,
  handleColumnSort,
  handleSelectSpan,
  selectedSpanIndex,
  addSearchTag,
  spansHasMore,
  loadingMore,
  handleLoadMoreSpans,
  traceSamples,
  tracesHasMore,
  handleLoadMoreTraces,
  aggGroupBys,
  aggDataMap,
  aggLoading,
  traceGroupByOptions,
  spanFacets,
  setUrlState,
  fetchAggregates,
  volumeChartType,
  onVolumeChartTypeChange,
  aggChartTypes,
  onAggChartTypeChange,
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Volume Chart */}
      <Box sx={{ px: 2, pt: 2 }}>
        <ArgusVolumeChart
          datasets={volumeDatasets}
          labels={volumeLabels}
          loading={loading}
          title="count(spans)"
          onZoom={(startIdx, endIdx) => {
            const buckets = [...new Set(volume.map((v) => v.bucket))].sort();
            const si = Math.min(startIdx, endIdx);
            const ei = Math.max(startIdx, endIdx);
            if (buckets[si] && buckets[ei]) {
              const startDate = new Date(buckets[si]);
              let endDate = new Date(buckets[ei]);
              if (buckets.length > 1) {
                const gap = new Date(buckets[1]).getTime() - new Date(buckets[0]).getTime();
                endDate = new Date(endDate.getTime() + gap);
              } else {
                endDate = new Date(endDate.getTime() + 3600000);
              }
              handleZoom(startDate.toISOString(), endDate.toISOString());
            }
          }}
          storagePrefix="argus_traces_volume"
          showLegend={volumeDatasets.length > 1}
          mb={1}
          chartType={volumeChartType}
          onChartTypeChange={onVolumeChartTypeChange}
        />
      </Box>

      {/* Tabs */}
      <Box sx={{ px: 2, mb: 1 }}>
        <SegmentedTabs
          items={[
            { key: '0', label: t('argus.traces.spansTab', 'Spans') },
            { key: '1', label: t('argus.traces.tracesTab', 'Traces') },
            { key: '2', label: t('argus.traces.aggregatesTab', 'Aggregates') },
          ]}
          value={String(activeTab)}
          onChange={handleTabChange}
        />
      </Box>

      {/* Tab Content */}
      <Box
        sx={{
          px: 2,
          pb: 2,
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ display: activeTab === 0 ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          <SpansTab
            spans={spans}
            loading={loading}
            orderCol={orderCol}
            orderDir={orderDir}
            onColumnSort={handleColumnSort}
            onSelectSpan={handleSelectSpan}
            selectedSpanIndex={selectedSpanIndex}
            onFilterTag={addSearchTag}
            hasMore={spansHasMore}
            loadingMore={loadingMore}
            onLoadMore={handleLoadMoreSpans}
          />
        </Box>

        <Box sx={{ display: activeTab === 1 ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          <TracesTab
            traceSamples={traceSamples}
            loading={loading}
            hasMore={tracesHasMore}
            loadingMore={loadingMore}
            onLoadMore={handleLoadMoreTraces}
          />
        </Box>

        <Box sx={{ display: activeTab === 2 ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {aggGroupBys.map((gKey, gIdx) => (
              <AggregatePanel
                key={gKey}
                aggData={aggDataMap[gKey] || null}
                aggGroupBy={gKey}
                aggLoading={aggLoading}
                isDark={isDark}
                groupByOptions={traceGroupByOptions}
                storagePrefix={`argus_traces_agg_${gIdx}`}
                discoveredFacetKeys={spanFacets.map((f) => f.label)}
                chartType={aggChartTypes?.[gIdx]}
                onChartTypeChange={(type) => onAggChartTypeChange?.(gIdx, type)}
                onGroupByChange={(val) => {
                  const newKeys = [...aggGroupBys];
                  newKeys[gIdx] = val;
                  const deduped = [...new Set(newKeys)];
                  setUrlState({ groupBy: deduped.join(',') });
                  fetchAggregates(deduped);
                }}
                onAddFilter={(key, val) => {
                  addSearchTag(key, val);
                }}
                showRemove={aggGroupBys.length > 1}
                onRemovePanel={() => {
                  const newKeys = aggGroupBys.filter((_, i) => i !== gIdx);
                  setUrlState({ groupBy: newKeys.join(',') });
                  fetchAggregates(newKeys);
                }}
              />
            ))}
          </Box>
          {aggGroupBys.length < 5 ? (
            <Box
              onClick={() => {
                const defaults = ['op', 'status', 'domain', 'action', 'service'];
                const next = defaults.find((d) => !aggGroupBys.includes(d)) || 'op';
                const newKeys = [...aggGroupBys, next];
                setUrlState({ groupBy: newKeys.join(',') });
                fetchAggregates(newKeys);
              }}
              sx={{
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                py: 0.75,
                cursor: 'pointer',
                borderTop: `1px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                color: 'text.disabled',
                fontSize: '0.72rem',
                fontWeight: 600,
                transition: 'color 0.15s',
                '&:hover': { color: 'primary.main' },
              }}
            >
              + {t('argus.traces.addGroup', 'Add group')}
            </Box>
          ) : (
            <Box
              sx={{
                flex: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                py: 0.75,
                borderTop: `1px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                color: 'text.disabled',
                fontSize: '0.68rem',
                opacity: 0.6,
              }}
            >
              {t('argus.traces.maxGroups', '최대 그룹 수에 도달했습니다 (5/5)')}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};
