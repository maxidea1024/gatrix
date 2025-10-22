# API Response Handling Guidelines

## Overview
This document provides guidelines for handling API responses consistently across the frontend application to avoid common mistakes related to response structure and error handling.

## Response Structure Awareness

### Understanding the API Service Layer
- **The `api.ts` service already unwraps `response.data` in the `request()` method**
  ```typescript
  // packages/frontend/src/services/api.ts (line 152)
  private async request<T = any>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.api.request<ApiResponse<T>>(config);
      return response.data;  // ⚠️ Already unwrapped here!
    }
    // ...
  }
  ```

- This means `api.get()`, `api.post()`, `api.put()`, `api.patch()`, `api.delete()` all return `response.data`, **NOT** the full axios response

### Backend Response Pattern
Backend responses follow this consistent pattern:
```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "limit": 10
  },
  "message": "Items retrieved successfully"
}
```

### Response Flow
1. **Backend sends:** `{ success: true, data: { items: [...], total: 10 }, message: "..." }`
2. **Axios receives:** Full response with `response.data`, `response.status`, etc.
3. **`api.request()` returns:** `response.data` → `{ success: true, data: { items: [...], total: 10 }, message: "..." }`
4. **Service method should return:** `response.data` → `{ items: [...], total: 10 }`
5. **Page/Component receives:** `{ items: [...], total: 10 }`

## Common Mistake Patterns

### ❌ WRONG: Double Unwrapping
```typescript
// In service file (e.g., surveyService.ts)
async getSurveys(params?: GetSurveysParams): Promise<GetSurveysResponse> {
  const response = await api.get('/admin/surveys', { params });
  return response.data.data;  // ❌ WRONG - Double unwrapping!
  // api.get already returns response.data, so this tries to access data.data.data
}
```

### ✅ CORRECT: Single Unwrapping
```typescript
// In service file (e.g., surveyService.ts)
async getSurveys(params?: GetSurveysParams): Promise<GetSurveysResponse> {
  const response = await api.get('/admin/surveys', { params });
  return response.data;  // ✅ CORRECT - api.get returns { success, data, message }
  // response.data contains { items: [...], total: 10 }
}
```

### ❌ WRONG: Weak Response Validation
```typescript
const result = await service.getData();
if (result && result.items) {  // ❌ Weak validation - doesn't check types
  setItems(result.items);
}
```

### ✅ CORRECT: Explicit Response Validation
```typescript
try {
  const result = await service.getData();
  
  // Validate response structure explicitly with type checking
  if (result && typeof result === 'object' && 'items' in result && Array.isArray(result.items)) {
    setItems(result.items);
    setTotal(result.total || 0);
  } else {
    console.error('Invalid response structure:', result);
    setItems([]);
    setTotal(0);
  }
} catch (error: any) {
  console.error('Failed to load data:', error);
  // Handle nested error messages from api.ts error handling
  const errorMessage = error.message || error.error?.message || t('common.loadFailed');
  enqueueSnackbar(errorMessage, { variant: 'error' });
  setItems([]);
  setTotal(0);
}
```

## Error Handling Best Practices

### API Service Error Transformation
The `api.ts` service transforms errors as follows:
```typescript
// packages/frontend/src/services/api.ts (lines 153-180)
catch (error: any) {
  if (error.response?.data) {
    const errorData = {
      ...error.response.data,
      status: error.response.status,
    };
    throw errorData;  // Throws { success: false, error: { message: "..." }, status: 400 }
  }
  
  throw {
    success: false,
    error: { message: error.message || 'Network error occurred' },
    status: error.response?.status || 500,
    code: isNetworkError ? 'NETWORK_ERROR' : error.code,
    isNetworkError,
  };
}
```

### Handling Errors in Pages/Components
Always handle multiple levels of error messages:
```typescript
catch (error: any) {
  console.error('Failed to load data:', error);
  
  // Check multiple possible error message locations
  const errorMessage = 
    error.message ||           // Direct error message
    error.error?.message ||    // Nested error message from api.ts
    t('common.loadFailed');    // Fallback localized message
  
  enqueueSnackbar(errorMessage, { variant: 'error' });
  
  // Always reset state to safe defaults
  setItems([]);
  setTotal(0);
}
```

## Implementation Checklist

Before implementing any API call, follow this checklist:

1. ✅ **Check `api.ts`** to understand response transformation
   - Remember: `api.get()` already returns `response.data`

2. ✅ **Verify backend response structure**
   - Check the controller and service to see what's in `data`
   - Example: `{ success: true, data: { surveys: [...], total: 10 } }`

3. ✅ **Ensure service method returns correct level**
   - Return `response.data` (not `response.data.data`)
   - This gives you the actual payload: `{ surveys: [...], total: 10 }`

4. ✅ **Add explicit type checking in page/component**
   - Use `typeof`, `in`, `Array.isArray()` for validation
   - Don't rely on truthy checks alone

5. ✅ **Handle both success and error cases**
   - Success: Validate structure before setting state
   - Error: Check multiple error message locations

6. ✅ **Provide fallback values for all state updates**
   - Always set safe defaults (empty arrays, 0, etc.)
   - Prevent undefined/null state issues

## Quick Reference Table

| Layer | What It Returns | Example |
|-------|----------------|---------|
| Backend | `{ success: true, data: { items: [...], total: 10 }, message: "..." }` | Full API response |
| `axios.get()` | Full axios response with `response.data`, `response.status`, etc. | Axios response object |
| `api.get()` | `response.data` (already unwrapped once) | `{ success: true, data: { items: [...] }, message: "..." }` |
| Service method | `response.data` | `{ items: [...], total: 10 }` |
| Page/Component | `{ items: [...], total: 10 }` | Actual data payload |

## Real-World Example

### Backend Controller
```typescript
// packages/backend/src/controllers/SurveyController.ts
static getSurveys = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await SurveyService.getSurveys({ page, limit, isActive, search });
  
  res.json({
    success: true,
    data: result,  // { surveys: [...], total: 10, page: 1, limit: 10 }
    message: 'Surveys retrieved successfully',
  });
});
```

### Service Layer
```typescript
// packages/frontend/src/services/surveyService.ts
async getSurveys(params?: GetSurveysParams): Promise<GetSurveysResponse> {
  const response = await api.get('/admin/surveys', { params });
  // response = { success: true, data: { surveys: [...], total: 10 }, message: "..." }
  return response.data;  // Returns { surveys: [...], total: 10, page: 1, limit: 10 }
}
```

### Page/Component
```typescript
// packages/frontend/src/pages/game/SurveysPage.tsx
const loadSurveys = async () => {
  setLoading(true);
  try {
    const result = await surveyService.getSurveys({ page: page + 1, limit: rowsPerPage });
    // result = { surveys: [...], total: 10, page: 1, limit: 10 }
    
    if (result && typeof result === 'object' && 'surveys' in result && Array.isArray(result.surveys)) {
      setSurveys(result.surveys);
      setTotal(result.total || 0);
    } else {
      console.error('Invalid survey response:', result);
      setSurveys([]);
      setTotal(0);
    }
  } catch (error: any) {
    console.error('Failed to load surveys:', error);
    const errorMessage = error.message || error.error?.message || t('surveys.loadFailed');
    enqueueSnackbar(errorMessage, { variant: 'error' });
    setSurveys([]);
    setTotal(0);
  } finally {
    setLoading(false);
  }
};
```

## Common Debugging Steps

If you encounter `undefined` or unexpected response structure:

1. **Add console.log at each layer:**
   ```typescript
   // In service
   const response = await api.get('/admin/surveys', { params });
   console.log('API response:', response);
   console.log('Response data:', response.data);
   return response.data;
   ```

2. **Check Network tab in browser DevTools:**
   - Look at the actual response from backend
   - Verify it matches expected structure

3. **Verify api.ts hasn't been modified:**
   - Ensure `request()` method still returns `response.data`
   - Check error handling hasn't changed

4. **Check for try-catch issues:**
   - Ensure errors are properly caught and handled
   - Verify error messages are accessible

## Summary

**Golden Rule:** `api.get()` returns `response.data`, so service methods should return `response.data` (not `response.data.data`).

**Always:**
- Validate response structure with explicit type checks
- Handle errors at multiple message levels
- Provide safe fallback values
- Log errors for debugging

**Never:**
- Assume response structure without validation
- Access nested properties without checking existence
- Ignore error cases
- Leave state in undefined/null state

