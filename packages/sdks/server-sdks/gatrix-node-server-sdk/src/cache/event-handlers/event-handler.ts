/**
 * Event Handler Interface
 * Each domain handler implements this interface to handle specific event types.
 * Scope ID validation is done by the caller (EventListener) based on handler scope.
 */

import { StandardEvent } from '../../types/events';
import { UsesConfig } from '../../types/config';

/**
 * Scope type for event handlers.
 * Determines which ID is used for cache operations:
 * - 'environment': uses environmentId
 * - 'project': uses projectId
 * - 'org': uses orgId
 */
export type EventHandlerScope = 'environment' | 'project' | 'org';

export interface IEventHandler {
  /** Event types this handler can process */
  readonly eventTypes: string[];

  /**
   * Scope of this handler.
   * Determines which ID (environmentId / projectId / orgId) is extracted
   * from the event and passed to handle().
   */
  readonly scope: EventHandlerScope;

  /** Check if this handler's feature is enabled */
  isEnabled(uses: UsesConfig): boolean;

  /**
   * Handle the event.
   * @param event The event to handle
   * @param scopeId Pre-validated scope identifier (environmentId, projectId, or orgId depending on handler scope)
   */
  handle(event: StandardEvent, scopeId: string): Promise<void>;
}
