import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    Paper,
} from '@mui/material';
import { Lock as LockIcon, ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export interface ResourceLockedDialogProps {
    open: boolean;
    onClose: () => void;
    lockedBy?: number | string;
    changeRequestId?: string;
    changeRequestTitle?: string;
}

const ResourceLockedDialog: React.FC<ResourceLockedDialogProps> = ({
    open,
    onClose,
    lockedBy,
    changeRequestId,
    changeRequestTitle,
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const handleViewChangeRequest = () => {
        if (changeRequestId) {
            navigate(`/admin/change-requests/${changeRequestId}`);
            onClose();
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
                <LockIcon />
                {t('errors.saveError')}
            </DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 1 }}>
                    <Typography variant="body1" gutterBottom>
                        {t('errors.RESOURCE_LOCKED', { changeRequestTitle: changeRequestTitle || t('common.unknown') })}
                    </Typography>

                    {changeRequestId && (
                        <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: 'action.hover' }}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                {t('auditLogs.resourceId')}: {changeRequestId}
                            </Typography>
                            {changeRequestTitle && (
                                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                                    {changeRequestTitle}
                                </Typography>
                            )}
                        </Paper>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">
                    {t('common.close')}
                </Button>
                {changeRequestId && (
                    <Button
                        onClick={handleViewChangeRequest}
                        variant="contained"
                        color="primary"
                        endIcon={<ArrowForwardIcon />}
                    >
                        {t('auditLogs.actions.view')}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

export default ResourceLockedDialog;
