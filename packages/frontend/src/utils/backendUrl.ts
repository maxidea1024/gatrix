/**
 * Get the backend URL from environment config
 * Priority: runtime config > VITE_API_URL > localhost backend > current origin
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
    // In local development, use backend port directly
    if (typeof window !== 'undefined') {
        const origin = window.location.origin;
        // If on frontend dev port (43000), point to backend port (45000)
        if (origin.includes('localhost:43000') || origin.includes('127.0.0.1:43000')) {
            return 'http://localhost:45000';
        }
        // Otherwise use current origin (production setup with nginx proxy)
        return origin;
    }
    return 'https://your-gatrix-server.com';
};
