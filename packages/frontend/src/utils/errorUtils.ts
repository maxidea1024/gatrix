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
} {
    let errorData: any = null;

    if (error?.response?.data?.error) {
        errorData = error.response.data.error;
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
        const payload = errorData?.payload || errorData?.details || {};
        return {
            lockedBy: payload.lockedBy,
            changeRequestId: payload.changeRequestId,
            changeRequestTitle: payload.changeRequestTitle || payload.title,
            isLocked: true,
        };
    }

    return { isLocked: false };
}

