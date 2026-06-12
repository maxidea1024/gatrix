/**
 * LogsAggregatePanel — backward-compatible wrapper around the shared AggregatePanel.
 * Supplies the default group-by options for the Logs page.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import AggregatePanel, {
  AggregatePanelProps,
} from '@/components/argus/AggregatePanel';

export type LogsAggregatePanelProps = Omit<
  AggregatePanelProps,
  'groupByOptions' | 'storagePrefix'
>;

const LogsAggregatePanel: React.FC<LogsAggregatePanelProps> = (props) => {
  const { t } = useTranslation();

  const groupByOptions = React.useMemo(
    () => [
      { value: 'level', label: t('argus.logs.agg.level', 'Severity') },
      { value: 'service', label: t('argus.logs.agg.service', 'Service') },
      {
        value: 'environment',
        label: t('argus.logs.agg.environment', 'Environment'),
      },
      {
        value: 'logger_name',
        label: t('argus.logs.agg.logger', 'Logger'),
      },
      { value: 'release', label: t('argus.logs.agg.release', 'Release') },
    ],
    [t]
  );

  return (
    <AggregatePanel
      {...props}
      groupByOptions={groupByOptions}
      storagePrefix="argus_logs_agg"
    />
  );
};

export default LogsAggregatePanel;
