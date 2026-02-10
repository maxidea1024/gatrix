import React, { useState, useCallback, useMemo } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
    IconButton,
    InputAdornment,
} from '@mui/material';
import {
    OpenInFull as ExpandIcon,
    Close as CloseIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import JsonEditor from './JsonEditor';

interface ValueEditorFieldProps {
    value: any;
    onChange: (value: any) => void;
    valueType: 'string' | 'json' | 'number' | 'boolean';
    label?: string;
    disabled?: boolean;
    error?: string | null;
    onValidationError?: (error: string | null) => void;
    size?: 'small' | 'medium';
    placeholder?: string;
    /** If true, renders a multiline inline textarea instead of single-line input */
    multiline?: boolean;
    /** Number of rows for inline multiline mode */
    rows?: number;
}

// Calculate byte length of a value
const getByteLength = (val: any): number => {
    if (val === null || val === undefined) return 0;
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return new TextEncoder().encode(str).length;
};

/**
 * ValueEditorField - A compact input with expand button for string/JSON editing.
 *
 * For string and JSON types, shows a compact single-line input with an expand icon
 * that opens a full dialog for comfortable editing.
 *
 * For boolean and number types, this component should NOT be used - use regular
 * Switch/TextField controls instead.
 */
const ValueEditorField: React.FC<ValueEditorFieldProps> = ({
    value,
    onChange,
    valueType,
    label,
    disabled = false,
    error,
    onValidationError,
    size = 'small',
    placeholder,
    multiline = false,
    rows = 3,
}) => {
    const { t } = useTranslation();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingValue, setEditingValue] = useState('');
    const [dialogError, setDialogError] = useState<string | null>(null);

    // Format value for display
    const getDisplayValue = useCallback((): string => {
        if (value === null || value === undefined) return '';
        if (valueType === 'json') {
            if (typeof value === 'object') return JSON.stringify(value);
            return String(value);
        }
        return String(value);
    }, [value, valueType]);

    // Format value for editor (pretty-printed for JSON)
    const getEditorValue = useCallback((): string => {
        if (value === null || value === undefined) {
            return valueType === 'json' ? '{}' : '';
        }
        if (valueType === 'json') {
            if (typeof value === 'object') return JSON.stringify(value, null, 2);
            try {
                const parsed = JSON.parse(String(value));
                return JSON.stringify(parsed, null, 2);
            } catch {
                return String(value);
            }
        }
        return String(value);
    }, [value, valueType]);

    // Byte length of current value
    const byteLength = useMemo(() => getByteLength(value), [value]);

    // Byte length of editing value in dialog
    const editingByteLength = useMemo(() => {
        return new TextEncoder().encode(editingValue).length;
    }, [editingValue]);

    // Helper text combining error and byte length
    const helperText = error
        ? `${error} · ${t('featureFlags.payloadSize', { size: byteLength })}`
        : byteLength > 0
            ? t('featureFlags.payloadSize', { size: byteLength })
            : undefined;

    const handleOpenDialog = () => {
        setEditingValue(getEditorValue());
        setDialogError(null);
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setDialogError(null);
    };

    const handleApply = () => {
        if (valueType === 'json') {
            try {
                const parsed = JSON.parse(editingValue);
                onChange(parsed);
                onValidationError?.(null);
                setDialogOpen(false);
            } catch (e: any) {
                setDialogError(e.message || 'Invalid JSON');
            }
        } else {
            onChange(editingValue);
            setDialogOpen(false);
        }
    };

    // Handle inline changes for string type
    const handleInlineChange = (newValue: string) => {
        if (valueType === 'json') {
            try {
                const parsed = JSON.parse(newValue);
                onChange(parsed);
                onValidationError?.(null);
            } catch (e: any) {
                onChange(newValue);
                onValidationError?.(e.message || 'Invalid JSON');
            }
        } else {
            onChange(newValue);
        }
    };

    return (
        <>
            {multiline ? (
                <TextField
                    fullWidth
                    size={size}
                    multiline
                    rows={rows}
                    value={getDisplayValue()}
                    onChange={(e) => handleInlineChange(e.target.value)}
                    disabled={disabled}
                    error={!!error}
                    helperText={helperText}
                    placeholder={placeholder}
                    InputProps={{
                        endAdornment: !disabled && (
                            <InputAdornment position="end" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                                <IconButton
                                    size="small"
                                    onClick={handleOpenDialog}
                                    title={t('featureFlags.expandEditor')}
                                >
                                    <ExpandIcon fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />
            ) : (
                <TextField
                    fullWidth
                    size={size}
                    value={getDisplayValue()}
                    onChange={(e) => handleInlineChange(e.target.value)}
                    disabled={disabled}
                    error={!!error}
                    helperText={helperText}
                    placeholder={placeholder}
                    InputProps={{
                        endAdornment: !disabled && (
                            <InputAdornment position="end">
                                <IconButton
                                    size="small"
                                    onClick={handleOpenDialog}
                                    title={t('featureFlags.expandEditor')}
                                >
                                    <ExpandIcon fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        ),
                    }}
                />
            )}

            {/* Expand Dialog */}
            <Dialog
                open={dialogOpen}
                onClose={handleCloseDialog}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: { minHeight: valueType === 'json' ? 500 : 300 },
                }}
            >
                <DialogTitle
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        pb: 1,
                    }}
                >
                    <Typography variant="h6" component="span">
                        {label || t('featureFlags.editValue')}
                    </Typography>
                    <IconButton size="small" onClick={handleCloseDialog}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers sx={{ overflow: 'visible', display: 'flex', flexDirection: 'column' }}>
                    {valueType === 'json' ? (
                        <Box sx={{ flex: 1, minHeight: 350 }}>
                            <JsonEditor
                                value={editingValue}
                                onChange={(val) => {
                                    setEditingValue(val);
                                    try {
                                        JSON.parse(val);
                                        setDialogError(null);
                                    } catch (e: any) {
                                        setDialogError(e.message || 'Invalid JSON');
                                    }
                                }}
                                height={350}
                            />
                            {dialogError && (
                                <Typography
                                    variant="caption"
                                    color="error"
                                    sx={{
                                        mt: 1,
                                        display: 'block',
                                        wordBreak: 'break-word',
                                        whiteSpace: 'normal',
                                    }}
                                >
                                    {dialogError}
                                </Typography>
                            )}
                        </Box>
                    ) : (
                        <TextField
                            fullWidth
                            multiline
                            minRows={14}
                            maxRows={20}
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            placeholder={placeholder}
                            autoFocus
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    '& fieldset': { border: 'none' },
                                    '&:hover fieldset': { border: 'none' },
                                    '&.Mui-focused fieldset': { border: 'none' },
                                },
                            }}
                        />
                    )}
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
                    <Typography variant="caption" color="text.secondary">
                        {t('featureFlags.payloadSize', { size: editingByteLength })}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button onClick={handleCloseDialog} color="inherit">
                            {t('Cancel')}
                        </Button>
                        <Button
                            onClick={handleApply}
                            variant="contained"
                            disabled={valueType === 'json' && !!dialogError}
                        >
                            {t('featureFlags.applyValue')}
                        </Button>
                    </Box>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default ValueEditorField;
