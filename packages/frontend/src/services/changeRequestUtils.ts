/**
 * Common types for mutation operations that may create change requests
 */

// Extended response type to indicate if change request was created
export interface MutationResult<T> {
  data?: T;
  isChangeRequest: boolean;
  changeRequestId?: string;
}

/**
 * Helper function to check if API response is a change request
 * api methods return response.data, so we check for changeRequestId in the response
 */
export function parseChangeRequestResponse<T>(
  response: any,
  dataExtractor: (responseData: any) => T | undefined,
): MutationResult<T> {
  const responseData = response.data || response;

  // Check if this is a change request response
  if (responseData?.changeRequestId) {
    return {
      data: undefined,
      isChangeRequest: true,
      changeRequestId: responseData.changeRequestId,
    };
  }

  return {
    data: dataExtractor(responseData),
    isChangeRequest: false,
  };
}
