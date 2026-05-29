import React, { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface PageHeaderContextMenuProps {
  onRefresh?: () => void;
  refreshDisabled?: boolean;
}

const PageHeaderContextMenu: React.FC<PageHeaderContextMenuProps> = ({
  onRefresh,
  refreshDisabled,
}) => {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  if (!onRefresh) return null;

  return (
    <>
      <IconButton onClick={handleOpen} disabled={refreshDisabled}>
        <MoreVertIcon />
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {onRefresh && (
          <MenuItem
            onClick={() => {
              handleClose();
              onRefresh();
            }}
            disabled={refreshDisabled}
          >
            <ListItemIcon>
              <RefreshIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              {t('common.refresh', { defaultValue: 'Refresh' })}
            </ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
};

export default PageHeaderContextMenu;
