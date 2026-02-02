import React, { useState, useCallback } from "react";
import { useSnackbar } from "notistack";
import { parseApiErrorMessage, extractConflictInfo } from "../utils/errorUtils";
import ApiErrorDialog from "../components/common/ApiErrorDialog";

interface UseHandleApiErrorOptions {
  onDelete?: () => void; // Optional delete callback for conflict/duplicate errors
}

export function useHandleApiError(options: UseHandleApiErrorOptions = {}) {
  const { enqueueSnackbar } = useSnackbar();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [errorType, setErrorType] = useState<
    "LOCKED" | "CONFLICT" | "DUPLICATE" | "GENERIC"
  >("GENERIC");
  const [errorInfo, setErrorInfo] = useState<any>({});

  const handleApiError = useCallback(
    (error: any, fallbackKey: string = "common.generic") => {
      const conflictInfo = extractConflictInfo(error);

      if (conflictInfo.isLocked) {
        setErrorType("LOCKED");
        setErrorInfo({
          lockedInfo: {
            lockedBy: conflictInfo.lockedBy,
            changeRequestId: conflictInfo.changeRequestId,
            changeRequestTitle: conflictInfo.changeRequestTitle,
          },
        });
        setDialogOpen(true);
        return true;
      }

      if (conflictInfo.isDataConflict) {
        setErrorType("CONFLICT");
        setErrorInfo({
          conflictData: conflictInfo.conflictData,
        });
        setDialogOpen(true);
        return true;
      }

      if (conflictInfo.isDuplicate) {
        setErrorType("DUPLICATE");
        setErrorInfo({
          message: conflictInfo.message,
        });
        setDialogOpen(true);
        return true;
      }

      // Generic error handling
      enqueueSnackbar(parseApiErrorMessage(error, fallbackKey), {
        variant: "error",
      });
      return false;
    },
    [enqueueSnackbar],
  );

  const ErrorDialog = useCallback(
    () => (
      <ApiErrorDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        type={errorType}
        onDelete={options.onDelete}
        {...errorInfo}
      />
    ),
    [dialogOpen, errorType, errorInfo, options.onDelete],
  );

  return {
    handleApiError,
    ErrorDialog,
  };
}
