/**
 * Base Addon Class
 *
 * Abstract base class for all integration addon providers.
 * Each provider (Slack, Webhook, Teams, Lark) extends this class.
 */

import { createLogger } from '../config/logger';
import type { Logger as WinstonLogger } from 'winston';
import { IntegrationEventModel, IntegrationEventState } from '../models/IntegrationEvent';
import { IntegrationSystemEvent } from '../types/integrationEvents';
import type { AddonDefinition } from './definitions';

type Logger = WinstonLogger;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export abstract class Addon {
  protected logger: Logger;
  protected name: string;
  protected definition: AddonDefinition;

  constructor(definition: AddonDefinition) {
    this.logger = createLogger(`addon/${definition.name}`);
    this.name = definition.name;
    this.definition = definition;
  }

  /**
   * Handle an event and send it to the external service
   * @param event - The system event to handle
   * @param parameters - Provider-specific parameters (url, token, etc.)
   * @param integrationId - The integration configuration ID
   */
  abstract handleEvent(
    event: IntegrationSystemEvent,
    parameters: Record<string, any>,
    integrationId: string
  ): Promise<void>;

  /**
   * Get the addon definition
   */
  getDefinition(): AddonDefinition {
    return this.definition;
  }

  /**
   * Get the addon name
   */
  getName(): string {
    return this.name;
  }

  /**
   * HTTP fetch with retry logic
   */
  protected async fetchRetry(
    url: string,
    options: RequestInit,
    retries: number = MAX_RETRIES
  ): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        if (response.ok) {
          return response;
        }

        // Non-retryable status codes
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // Retryable error
        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
        this.logger.warn(`Attempt ${attempt + 1}/${retries + 1} failed: ${lastError.message}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.logger.warn(`Attempt ${attempt + 1}/${retries + 1} failed: ${lastError.message}`);
      }

      // Wait before retry (exponential backoff)
      if (attempt < retries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  /**
   * Register the result of an integration event
   */
  protected async registerEvent(
    integrationId: string,
    event: IntegrationSystemEvent,
    state: IntegrationEventState,
    stateDetails: string = '',
    details: Record<string, any> = {}
  ): Promise<void> {
    try {
      let eventData = event.data;

      // Ensure environment context is preserved in the saved data
      // This is critical for events where the payload is the full object (like FeatureFlag)
      // but doesn't explicitly have the environment that triggered the event at the top level
      if (
        event.environment &&
        eventData &&
        typeof eventData === 'object' &&
        !Array.isArray(eventData) &&
        !eventData.environment
      ) {
        eventData = { ...eventData, environment: event.environment };
      }

      await IntegrationEventModel.create({
        integrationId,
        eventType: event.type,
        state,
        stateDetails,
        eventData,
        details,
      });
    } catch (error) {
      this.logger.error('Failed to register integration event:', error);
    }
  }

  /**
   * Parse custom headers from string format
   */
  protected parseCustomHeaders(headersString: string | undefined): Record<string, string> {
    if (!headersString) {
      return {};
    }

    const headers: Record<string, string> = {};

    try {
      // Try JSON format first
      const parsed = JSON.parse(headersString);
      if (typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      // Fall back to key:value format
      const lines = headersString.split('\n');
      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          headers[key.trim()] = valueParts.join(':').trim();
        }
      }
    }

    return headers;
  }

  /**
   * Destroy/cleanup the addon (optional override)
   */
  destroy(): void {
    // Override in subclasses if cleanup is needed
  }
}

export default Addon;
