/**
 * ExploreActions — "Create Alert" / "Add to Dashboard" dropdown menu
 * Used across Trace Explorer, Metrics Explorer, and Logs pages.
 */
import React, { useState } from 'react';
import {
  Button, Menu, MenuItem, ListItemIcon, ListItemText, Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  NotificationsActive as AlertIcon,
  Dashboard as DashboardIcon,
  Save as SaveIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface ExploreActionsProps {
  /** Dataset for the current page */
  dataset: 'errors' | 'spans' | 'logs' | 'metrics';
  /** Current query context to carry over */
  queryContext?: {
    search?: string;
    period?: string;
    fields?: string[];
    groupBy?: string;
    conditions?: string;
  };
  /** Called when "Save as Query" is clicked (if available) */
  onSaveQuery?: () => void;
  /** Project ID */
  projectId?: string | number;
}

const ExploreActions: React.FC<ExploreActionsProps> = ({
  dataset,
  queryContext,
  onSaveQuery,
  projectId,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const handleCreateAlert = () => {
    setAnchorEl(null);
    // Navigate to alerts page with pre-filled context
    const params = new URLSearchParams();
    params.set('dataset', dataset);
    if (queryContext?.search) params.set('query', queryContext.search);
    if (queryContext?.period) params.set('period', queryContext.period);
    navigate(`/argus/alerts?action=create&${params.toString()}`);
  };

  const handleAddToDashboard = () => {
    setAnchorEl(null);
    // Navigate to dashboards page with pre-filled widget context
    const params = new URLSearchParams();
    params.set('action', 'add-widget');
    params.set('dataset', dataset);
    if (queryContext?.fields) params.set('fields', queryContext.fields.join(','));
    if (queryContext?.search) params.set('conditions', queryContext.search);
    if (queryContext?.groupBy) params.set('groupBy', queryContext.groupBy);
    if (queryContext?.period) params.set('period', queryContext.period);
    navigate(`/argus/dashboards?${params.toString()}`);
  };

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        onClick={(e) => setAnchorEl(e.currentTarget)}
        endIcon={<ExpandMoreIcon sx={{ fontSize: 14 }} />}
        sx={{
          textTransform: 'none',
          fontSize: '0.75rem',
          fontWeight: 600,
          borderRadius: '6px',
          height: 30,
          px: 1.5,
        }}
      >
        {t('argus.explore.actions', 'Actions')}
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { minWidth: 200, borderRadius: '8px', mt: 0.5 },
          },
        }}
      >
        {onSaveQuery && (
          <MenuItem onClick={() => { setAnchorEl(null); onSaveQuery(); }} sx={{ fontSize: '0.8rem' }}>
            <ListItemIcon><SaveIcon sx={{ fontSize: 16 }} /></ListItemIcon>
            <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
              {t('argus.explore.saveAsQuery', 'Save as Query')}
            </ListItemText>
          </MenuItem>
        )}
        {onSaveQuery && <Divider />}
        <MenuItem onClick={handleCreateAlert} sx={{ fontSize: '0.8rem' }}>
          <ListItemIcon><AlertIcon sx={{ fontSize: 16 }} /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
            {t('argus.explore.createAlert', 'Create Alert Rule')}
          </ListItemText>
        </MenuItem>
        <MenuItem onClick={handleAddToDashboard} sx={{ fontSize: '0.8rem' }}>
          <ListItemIcon><DashboardIcon sx={{ fontSize: 16 }} /></ListItemIcon>
          <ListItemText primaryTypographyProps={{ fontSize: '0.8rem' }}>
            {t('argus.explore.addToDashboard', 'Add to Dashboard')}
          </ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
};

export default ExploreActions;
