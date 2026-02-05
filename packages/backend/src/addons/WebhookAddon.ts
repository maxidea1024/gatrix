/**
 * Webhook Addon
 *
 * Generic webhook integration that sends events to any HTTP endpoint.
 * Supports Mustache templates for custom payloads.
 */

import Addon, { HttpError } from './Addon';
import { webhookDefinition } from './definitions';
import { IntegrationSystemEvent } from '../types/integrationEvents';
import { formatWebhookPayload } from './EventFormatter';
import Mustache from 'mustache';

export class WebhookAddon extends Addon {
  constructor() {
    super(webhookDefinition);
  }

  async handleEvent(
    event: IntegrationSystemEvent,
    parameters: Record<string, any>,
    integrationId: string
  ): Promise<void> {
    const { url, contentType, authorization, customHeaders, bodyTemplate } = parameters;

    if (!url) {
      this.logger.warn(`Missing webhook URL for integration ${integrationId}`);
      await this.registerEvent(integrationId, event, 'failed', 'Missing webhook URL');
      return;
    }

    try {
      // Build request body
      let body: string;
      if (bodyTemplate) {
        // Use Mustache template
        const templateData = {
          event: {
            type: event.type,
            data: event.data,
            preData: event.preData,
          },
          environment: event.environment,
          createdBy: event.createdBy,
          createdByUserId: event.createdByUserId,
          createdAt: event.createdAt.toISOString(),
          timestamp: Date.now(),
        };
        body = Mustache.render(bodyTemplate, templateData);
      } else {
        // Use default payload
        body = JSON.stringify(formatWebhookPayload(event));
      }

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': contentType || 'application/json',
        ...this.parseCustomHeaders(customHeaders),
      };

      if (authorization) {
        headers['Authorization'] = authorization;
      }

      const response = await this.fetchRetry(url, {
        method: 'POST',
        headers,
        body,
      });

      this.logger.info(`Webhook sent for event ${event.type} (integration: ${integrationId})`);

      await this.registerEvent(integrationId, event, 'success', '', {
        url: this.maskUrl(url),
        statusCode: response.status,
        contentType: contentType || 'application/json',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send webhook for integration ${integrationId}:`, error);

      let statusCode: number | undefined;
      if (error instanceof HttpError) {
        statusCode = error.statusCode;
      }

      await this.registerEvent(integrationId, event, 'failed', errorMessage, {
        url: this.maskUrl(url),
        statusCode,
      });
    }
  }

  /**
   * Mask sensitive parts of URL for logging
   */
  private maskUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    } catch {
      return '***';
    }
  }
}

export default WebhookAddon;
