import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { Close as CloseIcon, Add as AddIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import PropertyPicker from './PropertyPicker';

interface BreakdownSectionProps {
  projectId: string | number;
  /** The event name used for property discovery in the picker */
  eventName?: string;
  /** Currently selected breakdown properties */
  value: string[];
  /** Callback when the selected properties change */
  onChange: (value: string[]) => void;
  /** Maximum number of breakdown properties allowed (default: 3) */
  maxItems?: number;
}

/**
 * Shared Breakdown Section component used across analytics pages
 * (Insights, Funnels, Flows, Retention).
 *
 * When no breakdown is selected, shows an "add" button.
 * When breakdowns are selected, shows a header with clear button and
 * the PropertyPicker with selected chips.
 */
const BreakdownSection: React.FC<BreakdownSectionProps> = ({
  projectId,
  eventName,
  value,
  onChange,
  maxItems = 3,
}) => {
  const { t } = useTranslation();

  const isEmpty = value.length === 0;

  if (isEmpty) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <PropertyPicker
          projectId={projectId}
          eventName={eventName}
          value={value}
          onChange={onChange}
          emptyLabel={t('argus.analytics.addBreakdown', 'Breakdown')}
          variant="text"
          maxItems={maxItems}
        />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Box>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Typography
            variant="overline"
            sx={{ fontWeight: 700, color: 'text.secondary', ml: 0.5 }}
          >
            {t('argus.analytics.breakdownBy', 'Breakdown By')}
          </Typography>
          <IconButton
            size="small"
            onClick={() => onChange([])}
            sx={{ p: 0.25, opacity: 0.6, '&:hover': { opacity: 1 } }}
          >
            <CloseIcon sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
        <Box sx={{ mt: 0.5 }}>
          <PropertyPicker
            projectId={projectId}
            eventName={eventName}
            value={value}
            onChange={onChange}
            emptyLabel={t('argus.analytics.noBreakdown', 'None')}
            maxItems={maxItems}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default BreakdownSection;
