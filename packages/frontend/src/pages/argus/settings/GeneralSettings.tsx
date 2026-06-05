import React from 'react';
import { TextField, Button, Select, MenuItem, Box } from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import { SettingsCard, FieldBlock } from './components/SettingsShared';
import { CopyButton } from '@/components/common/CopyButton';

interface GeneralSettingsProps {
  projectId: string;
  name: string;
  setName: (v: string) => void;
  platform: string;
  setPlatform: (v: string) => void;
  saving: boolean;
  isDirty: boolean;
  handleSave: () => Promise<void>;
  isDark: boolean;
  t: any;
  PLATFORM_CATEGORIES: string[];
  PLATFORM_OPTIONS: readonly any[];
}

export const GeneralSettings: React.FC<GeneralSettingsProps> = ({
  projectId, name, setName, platform, setPlatform, saving, isDirty, handleSave, isDark, t, PLATFORM_CATEGORIES, PLATFORM_OPTIONS
}) => {
  const inpSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
      fontSize: '0.875rem',
    },
  };

  return (
    <SettingsCard title={t('argus.settings.general')} desc={t('argus.settings.generalDesc')} isDark={isDark}
      headerAction={<Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving || !isDirty}
        sx={{ borderRadius: '8px', textTransform: 'none', fontWeight: 600, px: 3, boxShadow: 'none' }}>
        {saving ? t('argus.settings.saving') : t('common.save')}
      </Button>}
    >
      <FieldBlock label={t('argus.settings.projectName')} desc={t('argus.settings.projectNameDesc')}>
        <TextField value={name} onChange={e => setName(e.target.value)} size="small" sx={{ ...inpSx, maxWidth: 400, width: '100%' }} />
      </FieldBlock>
      <FieldBlock label={t('argus.settings.platform')} desc={t('argus.settings.platformDesc')}>
        <Select value={platform} onChange={e => setPlatform(e.target.value)} size="small" displayEmpty
          sx={{ ...inpSx, maxWidth: 300, width: '100%' }}>
          {PLATFORM_CATEGORIES.map(cat => [
            <MenuItem key={`cat-${cat}`} disabled sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: '0.05em', py: 0.5, opacity: '1 !important' }}>
              {cat}
            </MenuItem>,
            ...PLATFORM_OPTIONS.filter(p => p.category === cat).map(p => (
              <MenuItem key={p.id} value={p.id} sx={{ fontSize: '0.85rem', pl: 3 }}>{p.label}</MenuItem>
            )),
          ])}
        </Select>
      </FieldBlock>
      <FieldBlock label={t('argus.settings.projectId')} desc={t('argus.settings.projectIdDesc')} last>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField value={projectId} size="small" disabled sx={{ ...inpSx, maxWidth: 380, width: '100%' }} />
          <CopyButton text={projectId} />
        </Box>
      </FieldBlock>
    </SettingsCard>
  );
};

export default GeneralSettings;
