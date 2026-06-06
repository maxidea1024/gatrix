import React from 'react';
import { TextField, Button, InputAdornment } from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { SettingsCard, FieldBlock, RateBar } from './components/SettingsShared';

interface SamplingSettingsProps {
  errorQuota: number;
  setErrorQuota: (v: number) => void;
  retentionDays: number;
  setRetentionDays: (v: number) => void;
  txnRate: number;
  setTxnRate: (v: number) => void;
  sessionRate: number;
  setSessionRate: (v: number) => void;
  saving: boolean;
  isDirty: boolean;
  handleSave: () => Promise<void>;
  isDark: boolean;
  t: any;
}

export const SamplingSettings: React.FC<SamplingSettingsProps> = ({
  errorQuota,
  setErrorQuota,
  retentionDays,
  setRetentionDays,
  txnRate,
  setTxnRate,
  sessionRate,
  setSessionRate,
  saving,
  isDirty,
  handleSave,
  isDark,
  t,
}) => {
  const inpSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
      fontSize: '0.875rem',
    },
  };

  return (
    <SettingsCard
      title={t('argus.settings.samplingQuotas')}
      desc={t('argus.settings.samplingDesc')}
      isDark={isDark}
      headerAction={
        <Button
          variant="contained"
          size="small"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving || !isDirty}
          sx={{
            borderRadius: '8px',
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            boxShadow: 'none',
          }}
        >
          {saving ? t('argus.settings.saving') : t('common.save')}
        </Button>
      }
    >
      <FieldBlock
        label={t('argus.settings.errorQuota')}
        desc={t('argus.settings.errorQuotaDesc')}
      >
        <TextField
          type="number"
          value={errorQuota}
          onChange={(e) => setErrorQuota(Number(e.target.value))}
          size="small"
          sx={{ ...inpSx, width: 200 }}
          InputProps={{
            endAdornment: <InputAdornment position="end">/day</InputAdornment>,
          }}
        />
      </FieldBlock>
      <FieldBlock
        label={t('argus.settings.retentionDays')}
        desc={t('argus.settings.retentionDesc')}
      >
        <TextField
          type="number"
          value={retentionDays}
          onChange={(e) => setRetentionDays(Number(e.target.value))}
          size="small"
          sx={{ ...inpSx, width: 160 }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                {t('argus.settings.days')}
              </InputAdornment>
            ),
          }}
        />
      </FieldBlock>
      <FieldBlock
        label={t('argus.settings.txnSampleRate')}
        desc={t('argus.settings.txnSampleDesc')}
      >
        <RateBar value={txnRate} onChange={setTxnRate} isDark={isDark} />
      </FieldBlock>
      <FieldBlock
        label={t('argus.settings.sessionSampleRate')}
        desc={t('argus.settings.sessionSampleDesc')}
        last
      >
        <RateBar
          value={sessionRate}
          onChange={setSessionRate}
          isDark={isDark}
        />
      </FieldBlock>
    </SettingsCard>
  );
};

export default SamplingSettings;
