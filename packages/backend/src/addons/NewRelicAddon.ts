/**
 * New Relic Addon
 *
 * Posts event updates to New Relic Event API
 */

import { Addon } from './Addon';
import { newRelicDefinition } from './definitions';
import type { IntegrationSystemEvent } from '../types/integrationEvents';
import { promisify } from 'util';
import { gzip } from 'zlib';

const asyncGzip = promisify(gzip);

export interface NewRelicParameters {
  url: string;
  licenseKey: string;
  customHeaders?: string;
  bodyTemplate?: string;
}

interface NewRelicRequestBody {
  eventType: string;
  gatrixEventType: string;
  featureName?: string;
  environment?: string;
  createdBy?: string;
  createdAt?: number;
  [key: string]: unknown;
}

export class NewRelicAddon extends Addon {
  constructor() {
    super(newRelicDefinition);
  }

  async handleEvent(
    event: IntegrationSystemEvent,
    parameters: Record<string, unknown>,
    integrationId: string
  ): Promise<void> {
    const { url, licenseKey, customHeaders, bodyTemplate } =
      parameters as unknown as NewRelicParameters;

    if (!url || !licenseKey) {
      this.logger.warn('New Relic integration missing required parameters');
      return;
    }

    try {
      // Build event body
      let body: NewRelicRequestBody;

      if (bodyTemplate && typeof bodyTemplate === 'string' && bodyTemplate.length > 1) {
        // Use custom body template with simple mustache-like replacements
        let renderedBody = bodyTemplate;
        renderedBody = renderedBody.replace(/\{\{event\.type\}\}/g, event.type);
        renderedBody = renderedBody.replace(
          /\{\{event\.data\.name\}\}/g,
          event.data?.name || event.data?.featureName || ''
        );
        renderedBody = renderedBody.replace(
          /\{\{event\.createdBy\}\}/g,
          event.createdBy || 'system'
        );
        renderedBody = renderedBody.replace(
          /\{\{event\.createdAt\}\}/g,
          event.createdAt?.toISOString() || new Date().toISOString()
        );
        try {
          body = JSON.parse(renderedBody);
        } catch {
          this.logger.warn('Failed to parse body template, using default format');
          body = this.buildDefaultBody(event);
        }
      } else {
        body = this.buildDefaultBody(event);
      }

      // Parse custom headers
      let extraHeaders: Record<string, string> = {};
      if (customHeaders && typeof customHeaders === 'string' && customHeaders.length > 1) {
        try {
          extraHeaders = JSON.parse(customHeaders);
        } catch {
          this.logger.warn('Could not parse customHeaders as JSON');
        }
      }

      // Compress body with gzip
      const compressedBody = await asyncGzip(JSON.stringify(body));

      // Send to New Relic
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Api-Key': licenseKey,
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
          ...extraHeaders,
        },
        body: compressedBody,
      });

      if (response.ok) {
        this.logger.info(
          `New Relic event sent successfully for event "${event.type}" (integration: ${integrationId})`
        );
      } else {
        this.logger.warn(
          `New Relic API request failed with status ${response.status} for integration ${integrationId}`
        );
      }
    } catch (error) {
      this.logger.error(`Failed to send event to New Relic: ${error}`);
    }
  }

  private buildDefaultBody(event: IntegrationSystemEvent): NewRelicRequestBody {
    return {
      eventType: 'GatrixServiceEvent',
      gatrixEventType: event.type,
      featureName: event.data?.name || event.data?.featureName,
      environment: event.environment,
      createdBy: event.createdBy || 'system',
      createdAt: event.createdAt ? event.createdAt.getTime() : Date.now(),
      ...event.data,
    };
  }
}
