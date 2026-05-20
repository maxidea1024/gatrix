import React from 'react';
import { Alert, Button, Collapse } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

// ==================== Types ====================

interface VersionUpdateBannerProps {
  visible: boolean;
  savedByName: string;
  onRefresh: () => void;
  onDismiss: () => void;
}

// ==================== Component ====================

const VersionUpdateBanner: React.FC<VersionUpdateBannerProps> = ({
  visible,
  savedByName,
  onRefresh,
  onDismiss,
}) => {
  const { t } = useTranslation();

  return (
    <Collapse in={visible}>
      <Alert
        severity="info"
        variant="filled"
        sx={{
          borderRadius: 0,
          py: 0.5,
          '& .MuiAlert-message': {
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            width: '100%',
          },
        }}
        action={
          <>
            <Button
              color="inherit"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={onRefresh}
              sx={{ fontWeight: 600 }}
            >
              {t('spreadsheets.refreshNow', 'Refresh now')}
            </Button>
            <Button color="inherit" size="small" onClick={onDismiss}>
              {t('common.dismiss', 'Dismiss')}
            </Button>
          </>
        }
      >
        {t('spreadsheets.versionUpdated', '{{name}} saved a new version', {
          name: savedByName,
        })}
      </Alert>
    </Collapse>
  );
};

export default VersionUpdateBanner;
