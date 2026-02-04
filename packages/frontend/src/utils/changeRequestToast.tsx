import React from 'react';
import { IconButton, Box, Typography } from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { OptionsObject, SnackbarKey, SnackbarMessage, useSnackbar } from 'notistack';
import i18n from 'i18next';

/**
 * Show a consistent Change Request created notification with navigation arrow
 */
export function showChangeRequestCreatedToast(
  enqueueSnackbar: (message: SnackbarMessage, options?: OptionsObject) => SnackbarKey,
  closeSnackbar: (key?: SnackbarKey) => void,
  navigate: (path: string) => void
): void {
  const message = String(i18n.t('changeRequest.messages.created'));

  enqueueSnackbar(message, {
    variant: 'info',
    autoHideDuration: 8000,
    action: (snackbarId) => (
      <IconButton
        size="small"
        color="inherit"
        onClick={() => {
          closeSnackbar(snackbarId);
          navigate('/admin/change-requests?status=draft');
        }}
        sx={{
          '&:hover': {
            backgroundColor: 'rgba(255,255,255,0.15)',
          },
        }}
      >
        <ArrowForwardIcon fontSize="small" />
      </IconButton>
    ),
  });
}

/**
 * Hook to get showChangeRequestCreatedToast with dependencies injected
 */
export function useChangeRequestToast() {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  return {
    showCreated: (navigate: (path: string) => void) => {
      showChangeRequestCreatedToast(enqueueSnackbar, closeSnackbar, navigate);
    },
  };
}

/**
 * Get action button label based on whether environment requires approval
 * @param action - The action type: 'create', 'update', 'delete', 'save'
 * @param requiresApproval - Whether the environment requires CR approval
 * @param t - Translation function
 * @returns Translated button label
 */
export function getActionLabel(
  action: 'create' | 'update' | 'delete' | 'save',
  requiresApproval: boolean,
  t: (key: string) => string
): string {
  if (!requiresApproval) {
    // Direct action labels
    switch (action) {
      case 'create':
        return t('common.create');
      case 'update':
        return t('common.update');
      case 'delete':
        return t('common.delete');
      case 'save':
        return t('common.save');
      default:
        return t('common.save');
    }
  }

  // CR-required labels - use "Submit Request" style
  switch (action) {
    case 'create':
      return t('changeRequest.actions.submitCreate');
    case 'update':
      return t('changeRequest.actions.submitUpdate');
    case 'delete':
      return t('changeRequest.actions.submitDelete');
    case 'save':
      return t('changeRequest.actions.submitSave');
    default:
      return t('changeRequest.actions.submitSave');
  }
}
