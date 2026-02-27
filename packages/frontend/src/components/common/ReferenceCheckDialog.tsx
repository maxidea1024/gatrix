import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Typography,
    Button,
    Box,
    Alert,
} from '@mui/material';
import {
    Block as BlockIcon,
    InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import ResourceReferenceList, { ResourceReference } from './ResourceReferenceList';

// Re-export for backward compatibility
export type { ResourceReference };

interface ReferenceCheckDialogProps {
    open: boolean;
    onClose: () => void;
    title: string;
    references: ResourceReference | null;
    /** Dialog mode: 'delete' shows error icon + warning, 'view' shows info icon only */
    mode?: 'delete' | 'view';
}

/**
 * Dialog to display resource references.
 * - 'delete' mode: Shows a blocking "Cannot Delete" dialog with warning alert
 * - 'view' mode: Shows a neutral "View References" dialog without the warning
 */
const ReferenceCheckDialog: React.FC<ReferenceCheckDialogProps> = ({
    open,
    onClose,
    title,
    references,
    mode = 'delete',
}) => {
    const { t } = useTranslation();

    if (!references) return null;

    const isDeleteMode = mode === 'delete';

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 2,
                    p: 1,
                },
            }}
        >
            <DialogTitle sx={{ pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {isDeleteMode ? (
                        <BlockIcon color="error" />
                    ) : (
                        <InfoIcon color="primary" />
                    )}
                    <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
                        {title}
                    </Typography>
                </Box>
            </DialogTitle>

            <DialogContent sx={{ pb: 2 }}>
                {isDeleteMode && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        {t('common.resourceInUse')}
                    </Alert>
                )}

                <ResourceReferenceList
                    references={references}
                    onNavigate={onClose}
                />
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={onClose} variant="outlined" sx={{ minWidth: 80 }}>
                    {t('common.close')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ReferenceCheckDialog;
