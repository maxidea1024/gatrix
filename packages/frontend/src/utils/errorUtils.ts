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
  if (
    (errorCode === 'ResourceLockedException' || errorCode === 'RESOURCE_LOCKED') &&
    (payload?.changeRequestTitle || payload?.title)
  ) {
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

  // Handle VALIDATION_ERROR format from feature flag validation
  // Format: VALIDATION_ERROR:fieldName:error1|error2|...
  if (
    errorData?.message &&
    typeof errorData.message === 'string' &&
    errorData.message.startsWith('VALIDATION_ERROR:')
  ) {
    const parts = errorData.message.split(':');
    if (parts.length >= 3) {
      const field = parts[1];
      const errors = parts.slice(2).join(':').split('|');

      // Map field names to localized labels
      const fieldLabelKey =
        field === 'enabledValue'
          ? 'featureFlags.enabledValue'
          : field === 'disabledValue'
            ? 'featureFlags.disabledValue'
            : field;

      const fieldLabel = i18n.exists(fieldLabelKey) ? String(i18n.t(fieldLabelKey)) : field;

      // Map each structured error code to localized, user-friendly message
      const localizedErrors = errors.map((err: string) => {
        const trimmed = err.trim();

        // Parse structured error codes
        if (trimmed === 'EMPTY_NOT_ALLOWED') {
          return String(i18n.t('featureFlags.validation.errors.emptyNotAllowed'));
        }
        if (trimmed === 'WHITESPACE_REJECTED') {
          return String(i18n.t('featureFlags.validation.errors.whitespaceRejected'));
        }
        if (trimmed === 'INVALID_NUMBER') {
          return String(i18n.t('featureFlags.validation.errors.invalidNumber'));
        }
        if (trimmed === 'INTEGER_ONLY') {
          return String(i18n.t('featureFlags.validation.errors.integerOnly'));
        }
        if (trimmed === 'INVALID_JSON') {
          return String(i18n.t('featureFlags.validation.errors.invalidJson'));
        }
        if (trimmed === 'INVALID_JSON_SCHEMA') {
          return String(i18n.t('featureFlags.validation.errors.invalidJsonSchema'));
        }

        // Parse parameterized error codes
        if (trimmed.startsWith('PATTERN_MISMATCH:')) {
          const desc = trimmed.substring('PATTERN_MISMATCH:'.length);
          return String(
            i18n.t('featureFlags.validation.errors.patternMismatch', { pattern: desc })
          );
        }
        if (trimmed.startsWith('PATTERN_MISMATCH_RAW:')) {
          const pattern = trimmed.substring('PATTERN_MISMATCH_RAW:'.length);
          return String(i18n.t('featureFlags.validation.errors.patternMismatchRaw', { pattern }));
        }
        if (trimmed.startsWith('INVALID_PATTERN:')) {
          const pattern = trimmed.substring('INVALID_PATTERN:'.length);
          return String(i18n.t('featureFlags.validation.errors.invalidPattern', { pattern }));
        }
        if (trimmed.startsWith('MIN_LENGTH:')) {
          const val = trimmed.substring('MIN_LENGTH:'.length);
          return String(i18n.t('featureFlags.validation.errors.minLength', { min: val }));
        }
        if (trimmed.startsWith('MAX_LENGTH:')) {
          const val = trimmed.substring('MAX_LENGTH:'.length);
          return String(i18n.t('featureFlags.validation.errors.maxLength', { max: val }));
        }
        if (trimmed.startsWith('MIN_VALUE:')) {
          const val = trimmed.substring('MIN_VALUE:'.length);
          return String(i18n.t('featureFlags.validation.errors.minValue', { min: val }));
        }
        if (trimmed.startsWith('MAX_VALUE:')) {
          const val = trimmed.substring('MAX_VALUE:'.length);
          return String(i18n.t('featureFlags.validation.errors.maxValue', { max: val }));
        }
        if (trimmed.startsWith('LEGAL_VALUES:')) {
          const vals = trimmed.substring('LEGAL_VALUES:'.length);
          return String(i18n.t('featureFlags.validation.errors.legalValues', { values: vals }));
        }
        if (trimmed.startsWith('JSON_REQUIRED_FIELD:')) {
          const fieldName = trimmed.substring('JSON_REQUIRED_FIELD:'.length);
          return String(
            i18n.t('featureFlags.validation.errors.jsonRequiredField', { field: fieldName })
          );
        }
        if (trimmed.startsWith('JSON_TYPE_MISMATCH:')) {
          const jsonParts = trimmed.substring('JSON_TYPE_MISMATCH:'.length).split(':');
          return String(
            i18n.t('featureFlags.validation.errors.jsonTypeMismatch', {
              field: jsonParts[0],
              expected: jsonParts[1],
              actual: jsonParts[2],
            })
          );
        }

        // Fallback: return raw error
        return trimmed;
      });

      return String(
        i18n.t('featureFlags.validation.errorMessage', {
          field: fieldLabel,
          errors: localizedErrors.join(', '),
        })
      );
    }
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
