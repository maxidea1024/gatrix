import React, { useState } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    CardHeader,
    Typography,
    Alert,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Divider,
} from '@mui/material';
import { CloudDownload, CloudUpload, Warning } from '@mui/icons-material';
import { apiService } from '../../services/api';
import { useTranslation } from 'react-i18next';

const DataManagementPage: React.FC = () => {
    const { t } = useTranslation();
    const [exporting, setExporting] = useState(false);
    const [importing, setImporting] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [confirmImportOpen, setConfirmImportOpen] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const handleExport = async () => {
        try {
            setExporting(true);
            setMessage(null);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `gatrix-backup-${timestamp}.zip`;

            await apiService.download('/admin/data-management/export', filename);

            setMessage({ type: 'success', text: t('Data exported successfully') });
        } catch (error) {
            console.error('Export failed:', error);
            setMessage({ type: 'error', text: t('Failed to export data') });
        } finally {
            setExporting(false);
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setImportFile(event.target.files[0]);
        }
    };

    const handleImportClick = () => {
        if (!importFile) return;
        setConfirmImportOpen(true);
    };

    const handleImportConfirm = async () => {
        setConfirmImportOpen(false);
        if (!importFile) return;

        try {
            setImporting(true);
            setMessage(null);

            await apiService.upload('/admin/data-management/import', importFile);

            setMessage({ type: 'success', text: t('Data imported successfully. Please refresh the page.') });
            setImportFile(null);
        } catch (error) {
            console.error('Import failed:', error);
            setMessage({ type: 'error', text: t('Failed to import data') });
        } finally {
            setImporting(false);
        }
    };

    return (
        <Box p={3}>
            <Typography variant="h4" gutterBottom>
                {t('Data Management')}
            </Typography>

            {message && (
                <Alert severity={message.type} sx={{ mb: 3 }} onClose={() => setMessage(null)}>
                    {message.text}
                </Alert>
            )}

            <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(300px, 1fr))" gap={3}>
                {/* Export Section */}
                <Card>
                    <CardHeader title={t('Export Data')} subheader={t('Download a full backup of the system data')} />
                    <Divider />
                    <CardContent>
                        <Typography variant="body2" color="textSecondary" paragraph>
                            {t('This will export all database tables, planning data files, and uploads into a single ZIP file.')}
                        </Typography>
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={exporting ? <CircularProgress size={20} color="inherit" /> : <CloudDownload />}
                            onClick={handleExport}
                            disabled={exporting}
                            fullWidth
                        >
                            {exporting ? t('Exporting...') : t('Export All Data')}
                        </Button>
                    </CardContent>
                </Card>

                {/* Import Section */}
                <Card>
                    <CardHeader title={t('Import Data')} subheader={t('Restore system data from a backup file')} />
                    <Divider />
                    <CardContent>
                        <Alert severity="warning" icon={<Warning />} sx={{ mb: 2 }}>
                            {t('Warning: Importing data will OVERWRITE all existing data and cannot be undone.')}
                        </Alert>

                        <Box mb={2}>
                            <input
                                accept=".zip"
                                style={{ display: 'none' }}
                                id="raised-button-file"
                                type="file"
                                onChange={handleFileChange}
                            />
                            <label htmlFor="raised-button-file">
                                <Button variant="outlined" component="span" fullWidth>
                                    {importFile ? importFile.name : t('Select Backup File (.zip)')}
                                </Button>
                            </label>
                        </Box>

                        <Button
                            variant="contained"
                            color="error"
                            startIcon={importing ? <CircularProgress size={20} color="inherit" /> : <CloudUpload />}
                            onClick={handleImportClick}
                            disabled={!importFile || importing}
                            fullWidth
                        >
                            {importing ? t('Importing...') : t('Import Data')}
                        </Button>
                    </CardContent>
                </Card>
            </Box>

            {/* Confirmation Dialog */}
            <Dialog
                open={confirmImportOpen}
                onClose={() => setConfirmImportOpen(false)}
            >
                <DialogTitle>{t('Confirm Data Import')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {t('Are you sure you want to import this data? This action will overwrite all existing database records and files. This cannot be undone.')}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmImportOpen(false)} color="primary">
                        {t('Cancel')}
                    </Button>
                    <Button onClick={handleImportConfirm} color="error" autoFocus>
                        {t('Import & Overwrite')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default DataManagementPage;
