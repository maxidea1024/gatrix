/**
 * Get the backend URL from environment config
 * Priority: runtime config > VITE_API_URL > current origin
 */
export const getBackendUrl = (): string => {
    if (typeof window !== 'undefined') {
        // Check runtime config first (set dynamically in production)
        const runtimeUrl = (window as any)?.ENV?.VITE_API_URL;
        if (runtimeUrl && runtimeUrl.trim() && !runtimeUrl.startsWith('/')) {
            return runtimeUrl.trim().replace(/\/api\/v1$/, '');
        }
    }
    // Check build-time env
    const envUrl = (import.meta as any).env?.VITE_API_URL;
    if (envUrl && envUrl.trim() && !envUrl.startsWith('/')) {
        return envUrl.trim().replace(/\/api\/v1$/, '');
    }
    // Fallback to current origin (same server)
    return typeof window !== 'undefined' ? window.location.origin : 'https://your-gatrix-server.com';
};
