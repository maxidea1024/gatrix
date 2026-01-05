import i18n from '@/i18n';

/**
 * Parse API error and return a user-friendly message
 * Handles CR-specific errors like ResourceLockedException, CR_DATA_CONFLICT, etc.
 */
export function parseApiErrorMessage(error: any, fallbackKey = 'common.saveFailed'): string {
    // Try to extract error details from various response formats
    let errorData: any = null;
    let errorCode: string | null = null;
    let payload: any = null;

    // Try to parse error from response
    if (error?.response?.data?.error) {
        const errObj = error.response.data.error;
        if (typeof errObj === 'string') {
            try {
                errorData = JSON.parse(errObj);
            } catch {
                errorData = { message: errObj };
            }
        } else {
            errorData = errObj;
        }
    } else if (error?.message) {
        try {
            // Sometimes the error message itself is a JSON string
            errorData = JSON.parse(error.message);
        } catch {
            // Not a JSON string, use as-is
            errorData = null;
        }
    }

    // Extract error code and payload
    if (errorData) {
        errorCode = errorData.error || errorData.code || errorData.errorCode;
        payload = errorData.payload;
    }

    // Handle specific CR-related errors by error code
    if (errorCode === 'ResourceLockedException' && payload?.changeRequestTitle) {
        return i18n.t('errors.ResourceLockedException', { title: payload.changeRequestTitle });
    }

    if (errorCode === 'CR_DATA_CONFLICT') {
        return i18n.t('errors.CR_DATA_CONFLICT');
    }

    // Check for localized error message by error code
    if (errorCode && i18n.exists(`errors.${errorCode}`)) {
        return i18n.t(`errors.${errorCode}`, payload || {});
    }

    // Fallback to translation key
    return i18n.t(fallbackKey);
}
