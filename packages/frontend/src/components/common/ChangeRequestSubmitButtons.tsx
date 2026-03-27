import React, { useState, useRef } from 'react';
import {
  Button,
  ButtonGroup,
  CircularProgress,
  Popper,
  Grow,
  Paper,
  ClickAwayListener,
  MenuList,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import {
  ArrowDropDown as ArrowDropDownIcon,
  FlashOn as FlashOnIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { P } from '@/types/permissions';
import { getActionLabel } from '@/utils/changeRequestToast';

export interface ChangeRequestSubmitButtonsProps {
  action: 'create' | 'update' | 'delete' | 'save';
  requiresApproval: boolean;
  saving: boolean;
  onSave: (skipCr: boolean) => void;
  title?: string;
  disabled?: boolean;
  startIcon?: React.ReactNode;
}

export const ChangeRequestSubmitButtons: React.FC<
  ChangeRequestSubmitButtonsProps
> = ({
  action,
  requiresApproval,
  saving,
  onSave,
  title,
  disabled,
  startIcon,
}) => {
  const { t } = useTranslation();
  const { hasPermission } = useAuth();

  const canSkipCr = hasPermission(P.CHANGE_REQUESTS_SKIP);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen);
  };

  const handleClose = (event: Event | React.SyntheticEvent) => {
    if (
      anchorRef.current &&
      anchorRef.current.contains(event.target as HTMLElement)
    ) {
      return;
    }
    setOpen(false);
  };

  const isDelete = action === 'delete';
  const buttonColor = isDelete ? 'error' : 'primary';
  const defaultStartIcon = saving ? (
    <CircularProgress size={18} color="inherit" />
  ) : (
    startIcon
  );

  // Standard single button (CR not required or user lacks skip permission)
  if (!requiresApproval || !canSkipCr) {
    return (
      <Button
        variant="contained"
        color={buttonColor}
        onClick={() => onSave(false)}
        disabled={saving || disabled}
        startIcon={defaultStartIcon}
        title={title}
        sx={{ minWidth: 80 }}
      >
        {saving
          ? t('common.saving')
          : title || getActionLabel(action, requiresApproval, t)}
      </Button>
    );
  }

  // Split button (CR required environment & user has skip permission)
  const defaultLabel = title || getActionLabel(action, true, t);
  const skipLabel = t('changeRequest.actions.immediateUpdate');

  return (
    <React.Fragment>
      <ButtonGroup
        variant="contained"
        color={buttonColor}
        ref={anchorRef}
        aria-label="split button"
        disabled={saving || disabled}
        disableElevation
        sx={{
          '& .MuiButtonGroup-grouped:not(:last-of-type)': {
            borderRightColor: isDelete
              ? 'rgba(255,255,255,0.3)'
              : 'rgba(255,255,255,0.3)',
          },
        }}
      >
        <Button
          onClick={() => onSave(false)}
          startIcon={defaultStartIcon}
          sx={{ minWidth: 80 }}
        >
          {saving ? t('common.saving') : defaultLabel}
        </Button>
        <Button
          size="small"
          aria-controls={open ? 'cr-split-button-menu' : undefined}
          aria-expanded={open ? 'true' : undefined}
          aria-haspopup="menu"
          onClick={handleToggle}
          sx={{ px: 0.5, minWidth: 'unset' }}
        >
          <ArrowDropDownIcon fontSize="small" />
        </Button>
      </ButtonGroup>
      <Popper
        sx={{ zIndex: 1400 }}
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        disablePortal={false}
        placement="bottom-end"
      >
        {({ TransitionProps }) => (
          <Grow
            {...TransitionProps}
            style={{ transformOrigin: 'right top' }}
          >
            <Paper
              elevation={3}
              sx={{
                borderRadius: 1,
                overflow: 'hidden',
                mt: 0.5,
                border: 1,
                borderColor: 'divider',
              }}
            >
              <ClickAwayListener onClickAway={handleClose}>
                <MenuList
                  id="cr-split-button-menu"
                  autoFocusItem
                  dense
                  sx={{ py: 0.5 }}
                >
                  <MenuItem
                    disabled={saving || disabled}
                    onClick={(event) => {
                      onSave(true);
                      handleClose(event);
                    }}
                    sx={{ px: 2, py: 0.75 }}
                  >
                    <ListItemIcon sx={{ minWidth: 28 }}>
                      <FlashOnIcon
                        fontSize="small"
                        sx={{ color: 'warning.main', fontSize: 16 }}
                      />
                    </ListItemIcon>
                    <ListItemText
                      primary={skipLabel}
                      primaryTypographyProps={{
                        fontSize: '0.8125rem',
                      }}
                    />
                  </MenuItem>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </React.Fragment>
  );
};
