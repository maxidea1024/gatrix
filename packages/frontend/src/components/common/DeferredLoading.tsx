import React, { useState, useEffect } from 'react';
import { Backdrop, CircularProgress, Box } from '@mui/material';

interface DeferredLoadingProps {
    loading: boolean;
    delay?: number; // ms to wait before showing loader
    children?: React.ReactNode; // Content to show while loading (e.g. spinner)
    fullScreen?: boolean; // If true, use Backdrop
}

/**
 * A component that only renders its content if 'loading' is true 
 * AND the 'delay' threshold has passed. Prevents flickering for fast loads.
 */
export const DeferredLoading: React.FC<DeferredLoadingProps> = ({
    loading,
    delay = 200,
    children,
    fullScreen = false
}) => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        let timeout: NodeJS.Timeout;
        if (loading) {
            timeout = setTimeout(() => {
                setShow(true);
            }, delay);
        } else {
            setShow(false);
        }
        return () => clearTimeout(timeout);
    }, [loading, delay]);

    if (!loading || !show) return null;

    if (fullScreen) {
        return (
            <Backdrop open={true} sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}>
                {children || <CircularProgress color="inherit" />}
            </Backdrop>
        );
    }

    return (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3, width: '100%' }}>
            {children || <CircularProgress />}
        </Box>
    );
};
