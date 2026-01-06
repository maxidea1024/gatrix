import React, { useState, useCallback } from 'react';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { parseApiErrorMessage, extractConflictInfo } from '../utils/errorUtils';
import ResourceLockedDialog from '../components/common/ResourceLockedDialog';

export function useHandleApiError() {
    const { enqueueSnackbar } = useSnackbar();
    const { t } = useTranslation();
    const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
    const [conflictInfo, setConflictInfo] = useState<{
        lockedBy?: number | string;
        changeRequestId?: string;
        changeRequestTitle?: string;
    }>({});

    const handleApiError = useCallback((error: any, fallbackKey: string = 'common.generic') => {
        const lockInfo = extractConflictInfo(error);

        if (lockInfo.isLocked) {
            setConflictInfo({
                lockedBy: lockInfo.lockedBy,
                changeRequestId: lockInfo.changeRequestId,
                changeRequestTitle: lockInfo.changeRequestTitle,
            });
            setConflictDialogOpen(true);
            return true; // Error was handled by dialog
        }

        enqueueSnackbar(parseApiErrorMessage(error, fallbackKey), { variant: 'error' });
        return false; // Error was handled by toast
    }, [enqueueSnackbar]);

    const ErrorDialog = useCallback(() => (
        <ResourceLockedDialog
            open={conflictDialogOpen}
            onClose={() => setConflictDialogOpen(false)}
            {...conflictInfo}
        />
    ), [conflictDialogOpen, conflictInfo]);

    return {
        handleApiError,
        ErrorDialog,
    };
}
