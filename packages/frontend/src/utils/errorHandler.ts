import {
  ErrorCodes,
  extractErrorCode,
  extractErrorMessage,
} from "@gatrix/shared";
import i18n from "i18next";

/**
 * Get localized error message based on error code
 * Falls back to backend message if no localization exists
 */
export function getLocalizedErrorMessage(
  error: any,
  defaultKey = "common.unknownError",
): string {
  const errorCode = extractErrorCode(error);
  const backendMessage = extractErrorMessage(error);

  // If we have an error code, try to get localized message
  if (errorCode) {
    const i18nKey = `errors.${errorCode}`;
    const localizedMessage = i18n.t(i18nKey);

    // If translation exists (not same as key), use it
    if (localizedMessage !== i18nKey) {
      return localizedMessage;
    }
  }

  // Fallback to backend message if available
  if (backendMessage && backendMessage !== "An error occurred") {
    return backendMessage;
  }

  // Final fallback to default message
  return i18n.t(defaultKey);
}

/**
 * Common error code to i18n key mapping
 * Add new mappings as needed
 */
export const ErrorCodeI18nKeys: Partial<Record<string, string>> = {
  [ErrorCodes.INTERNAL_SERVER_ERROR]: "errors.internalServerError",
  [ErrorCodes.BAD_REQUEST]: "errors.badRequest",
  [ErrorCodes.NOT_FOUND]: "errors.notFound",
  [ErrorCodes.UNAUTHORIZED]: "errors.unauthorized",
  [ErrorCodes.FORBIDDEN]: "errors.forbidden",
  [ErrorCodes.VALIDATION_ERROR]: "errors.validationError",
  [ErrorCodes.RESOURCE_NOT_FOUND]: "errors.resourceNotFound",
  [ErrorCodes.RESOURCE_ALREADY_EXISTS]: "errors.resourceAlreadyExists",
  [ErrorCodes.RESOURCE_CREATE_FAILED]: "errors.resourceCreateFailed",
  [ErrorCodes.RESOURCE_UPDATE_FAILED]: "errors.resourceUpdateFailed",
  [ErrorCodes.RESOURCE_DELETE_FAILED]: "errors.resourceDeleteFailed",
  [ErrorCodes.AUTH_TOKEN_INVALID]: "errors.authTokenInvalid",
  [ErrorCodes.AUTH_TOKEN_EXPIRED]: "errors.authTokenExpired",
  [ErrorCodes.AUTH_PERMISSION_DENIED]: "errors.authPermissionDenied",
  [ErrorCodes.USER_NOT_FOUND]: "errors.userNotFound",
  [ErrorCodes.ENV_NOT_FOUND]: "errors.envNotFound",
  [ErrorCodes.ENV_ACCESS_DENIED]: "errors.envAccessDenied",
  [ErrorCodes.RATE_LIMIT_EXCEEDED]: "errors.rateLimitExceeded",
  [ErrorCodes.TOO_MANY_REQUESTS]: "errors.tooManyRequests",
  [ErrorCodes.CHANNEL_MEMBER_EXISTS]: "chat.alreadyMember",
  [ErrorCodes.ALREADY_MEMBER]: "chat.alreadyMember",
  [ErrorCodes.INVITATION_PENDING]: "chat.alreadyInvited",
  [ErrorCodes.ALREADY_INVITED]: "chat.alreadyInvited",
  [ErrorCodes.SURVEY_ALREADY_EXISTS]: "surveys.platformSurveyIdExists",
};

/**
 * Handle API error with automatic localization and snackbar
 * Use this in catch blocks for consistent error handling
 */
export function handleApiError(
  error: any,
  enqueueSnackbar: (message: string, options?: any) => void,
  options?: {
    defaultMessage?: string;
    variant?: "error" | "warning" | "info";
  },
): void {
  const message = getLocalizedErrorMessage(error, options?.defaultMessage);
  enqueueSnackbar(message, { variant: options?.variant || "error" });
}
