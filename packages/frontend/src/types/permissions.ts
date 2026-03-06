/**
 * RBAC Permission Definitions for Frontend
 *
 * Single source of truth: @gatrix/shared/permissions
 * This file re-exports for convenience. Use P.XXX_READ / P.XXX_UPDATE etc.
 */

import { P } from '@gatrix/shared/permissions';

// Re-export P as the single permission constant
export { P };

// Re-export Permission type
export type Permission = string;
