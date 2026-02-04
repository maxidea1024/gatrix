import React from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';
import HelpTip from './HelpTip';

interface NamingGuideProps {
  type: 'flag' | 'segment' | 'contextField';
}

/**
 * NamingGuide component - standardized naming guide for flags, segments, and context fields
 */
const NamingGuide: React.FC<NamingGuideProps> = ({ type }) => {
  const { t } = useTranslation();

  const getTitle = () => {
    switch (type) {
      case 'flag':
        return t('common.namingGuide.flagTitle');
      case 'segment':
        return t('common.namingGuide.segmentTitle');
      case 'contextField':
        return t('common.namingGuide.fieldTitle');
      default:
        return t('common.namingGuide.title');
    }
  };

  const getGoodExamples = () => {
    switch (type) {
      case 'flag':
        return ['enable-new-dashboard', 'feature-payment-v2', 'exp-checkout-flow'];
      case 'segment':
        return ['beta-testers', 'premium-users', 'internal-staff'];
      case 'contextField':
        return ['userId', 'platform', 'appVersion', 'region'];
      default:
        return [];
    }
  };

  const getBadExamples = () => {
    switch (type) {
      case 'flag':
        return ['test', 'new-feature', 'flag1', 'temp'];
      case 'segment':
        return ['test', 'group1', 'users', 'temp'];
      case 'contextField':
        return ['field1', 'test', 'data', 'value'];
      default:
        return [];
    }
  };

  return (
    <HelpTip title={getTitle()}>
      <Alert severity="warning" sx={{ mb: 1.5 }}>
        <Typography variant="body2" fontWeight={500}>
          {t('common.namingGuide.globalUnique')}
        </Typography>
      </Alert>

      <Typography variant="body2" fontWeight={500} sx={{ mb: 0.5 }}>
        {t('common.namingGuide.rulesTitle')}
      </Typography>
      <Box component="ul" sx={{ m: 0, pl: 2, mb: 1.5 }}>
        <li>{t('common.namingGuide.rule1')}</li>
        <li>{t('common.namingGuide.rule2')}</li>
        <li>{t('common.namingGuide.rule3')}</li>
        <li>{t('common.namingGuide.rule4')}</li>
      </Box>

      <Typography variant="body2" fontWeight={500} className="good" sx={{ mb: 0.5 }}>
        ✓ {t('common.namingGuide.goodExamples')}
      </Typography>
      <Box sx={{ mb: 1.5 }}>
        {getGoodExamples().map((ex, i) => (
          <code key={i} style={{ marginRight: 8 }}>
            {ex}
          </code>
        ))}
      </Box>

      <Typography variant="body2" fontWeight={500} className="bad" sx={{ mb: 0.5 }}>
        ✗ {t('common.namingGuide.badExamples')}
      </Typography>
      <Box sx={{ mb: 1.5 }}>
        {getBadExamples().map((ex, i) => (
          <code key={i} style={{ marginRight: 8 }}>
            {ex}
          </code>
        ))}
      </Box>

      <Typography variant="caption" color="text.secondary">
        {t('common.namingGuide.tip')}
      </Typography>
    </HelpTip>
  );
};

export default NamingGuide;
