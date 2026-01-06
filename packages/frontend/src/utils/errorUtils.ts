import i18n from 'i18next';

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
    } else if (error?.status && error?.error) {
        // If the error object itself is already parsed (from ApiService)
        errorData = error.error;
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
        // The backend GatrixError wraps the payload inside details.payload 
        // in the errorHandler middleware.
        payload = errorData.payload || errorData.details?.payload || errorData.details;
    }

    // Handle specific CR-related errors by error code
    if ((errorCode === 'ResourceLockedException' || errorCode === 'RESOURCE_LOCKED') && (payload?.changeRequestTitle || payload?.title)) {
        const title = payload?.changeRequestTitle || payload?.title;
        return String(i18n.t('errors.RESOURCE_LOCKED', { changeRequestTitle: title }));
    }

    if (errorCode === 'CR_DATA_CONFLICT') {
        return String(i18n.t('errors.CR_DATA_CONFLICT'));
    }

    // Check for localized error message by error code
    if (errorCode && i18n.exists(`errors.${errorCode}`)) {
        return String(i18n.t(`errors.${errorCode}`, payload || {}));
    }

    // Fallback if we have an error message inside errorData
    if (errorData?.message && typeof errorData.message === 'string') {
        return errorData.message;
    }

    // Fallback to translation key
    return String(i18n.t(fallbackKey));
}

/**
 * Extract conflict info from error
 */
export function extractConflictInfo(error: any): {
    lockedBy?: number | string;
    changeRequestId?: string;
    changeRequestTitle?: string;
    isLocked: boolean;
    isDataConflict: boolean;
    isDuplicate: boolean;
    conflictData?: any;
    message?: string;
} {
    let errorData: any = null;

    if (error?.response?.data?.error) {
        errorData = error.response.data.error;
    } else if (error?.status && error?.error) {
        // If the error object itself is already parsed (from ApiService)
        errorData = error.error;
    } else if (error?.message) {
        try {
            errorData = JSON.parse(error.message);
        } catch {
            errorData = null;
        }
    }

    const errorCode = errorData?.error || errorData?.code || errorData?.errorCode;
    const isLocked = errorCode === 'ResourceLockedException' || errorCode === 'RESOURCE_LOCKED';

    if (isLocked) {
        const payload = errorData?.payload || errorData?.details?.payload || errorData?.details || {};
        return {
            lockedBy: payload.lockedBy,
            changeRequestId: payload.changeRequestId,
            changeRequestTitle: payload.changeRequestTitle || payload.title,
            isLocked: true,
            isDataConflict: false,
            isDuplicate: false,
        };
    }

    const isDataConflict = errorCode === 'CR_DATA_CONFLICT';
    if (isDataConflict) {
        return {
            isLocked: false,
            isDataConflict: true,
            isDuplicate: false,
            conflictData: errorData?.payload || errorData?.details?.payload || errorData?.details || {},
        };
    }

    const isDuplicate = errorCode === 'DUPLICATE_ENTRY';
    if (isDuplicate) {
        return {
            isLocked: false,
            isDataConflict: false,
            isDuplicate: true,
            message: errorData?.message || error.message,
        };
    }

    return { isLocked: false, isDataConflict: false, isDuplicate: false };
}
