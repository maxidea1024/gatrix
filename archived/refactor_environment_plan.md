# Environment Identifier Refactoring Plan

## Objective

- Remove `environmentId`, `envId`, `environmentIds` from the entire codebase.
- Rename `environmentName` to `environment`.
- Use `environment` (string) as the primary identifier for environments.
- **Remove the concept of "default environment".**
- **Remove `getCurrentEnvironment*` and `resolveEnvironment*` functions.**
- **Ensure `environment` is always explicitly specified in function calls and API requests.**
- Do NOT generate database migration files.

## Target Terms to Replace/Remove

- `environmentId` -> `environment`
- `envId` -> `environment`
- `environmentIds` -> `environments`
- `environmentName` -> `environment`
- `getCurrentEnvironmentId()`, `getCurrentEnvironment()` -> REMOVE (Pass `environment` explicitly)
- `setDefaultEnvironmentId()`, `setDefaultEnvironment()` -> REMOVE
- `getDefaultEnvironmentId()`, `getDefaultEnvironment()` -> REMOVE
- `getEnvironmentIdFromRequest()`, `getEnvironmentFromRequest()` -> `getEnvironmentFromRequest()` (Must return string or throw/error if missing)

## Phase 1: Backend Core Utilities

1.  **`packages/backend/src/utils/environmentContext.ts`**:
    - Remove all "default" related logic.
    - Remove `getCurrentEnvironment` and `environmentStorage` (AsyncLocalStorage) if possible, or keep it only if absolutely necessary for middleware-to-service propagation, but the user said it's "not needed".
    - Update `withEnvironmentFilter` to require `environment`.
2.  **`packages/backend/src/utils/systemKV.ts`**:
    - Update functions to use `environment`.

## Phase 2: Database Entities (Backend)

1.  Identify all entities in `packages/backend/src/entities/`.
2.  Change `environmentId` field to `environment`.
3.  Update `@Column` decorators.

## Phase 3: Services and Controllers (Backend)

1.  Update all services to accept `environment: string` as a parameter.
2.  Update all controllers to extract `environment` from request and pass it to services.
3.  Rename parameters in routes and DTOs.

## Phase 4: Frontend

1.  Search and replace in `packages/frontend/src/`.
2.  Update API service calls to always include `environment`.
3.  Update components and hooks.

## Phase 5: SDKs and Edge

1.  Update `packages/sdks/server-sdk`.
2.  Update `packages/edge`.

## Phase 6: Verification

1.  Run `npm run build` in all packages.
2.  Run lint checks.
