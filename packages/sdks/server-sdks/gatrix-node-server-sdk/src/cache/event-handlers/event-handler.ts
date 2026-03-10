/**
 * Event Handler Interface
 * Each domain handler implements this interface to handle specific event types.
 * environmentId validation is done by the caller (EventListener).
 */

import { StandardEvent } from '../../types/events';
import { UsesConfig } from '../../types/config';

export interface IEventHandler {
  /** Event types this handler can process */
  readonly eventTypes: string[];

  /** Check if this handler's feature is enabled */
  isEnabled(uses: UsesConfig): boolean;

  /**
   * Handle the event.
   * @param event The event to handle
   * @param environmentId Pre-validated environment identifier (may be empty for global events like segments)
   */
  handle(event: StandardEvent, environmentId: string): Promise<void>;
}
