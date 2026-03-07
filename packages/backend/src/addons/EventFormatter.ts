/**
 * Event Formatter
 *
 * Formats integration events into human-readable messages for various providers.
 */

import { IntegrationSystemEvent, IntegrationEventType } from '../types/integrationEvents';

/**
 * Format an event message for display
 */
export function formatEventMessage(event: IntegrationSystemEvent): string {
  const eventName = formatEventType(event.type);
  const actor = event.createdBy || 'System';
  const timestamp = formatTimestamp(event.createdAt);

  let message = `*${eventName}* by ${actor} at ${timestamp}`;

  if (event.environmentId) {
    message += ` (${event.environmentId})`;
  }

  return message;
}

/**
 * Format event type to human-readable text
 */
export function formatEventType(eventType: IntegrationEventType): string {
  return eventType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format timestamp to readable string
 */
export function formatTimestamp(date: Date): string {
  return new Date(date).toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * Get event color based on event type
 */
export function getEventColor(eventType: IntegrationEventType): string {
  if (eventType.includes('deleted') || eventType.includes('archived')) {
    return '#dc3545'; // Red
  }
  if (eventType.includes('created')) {
    return '#28a745'; // Green
  }
  if (eventType.includes('updated') || eventType.includes('enabled')) {
    return '#007bff'; // Blue
  }
  if (eventType.includes('disabled') || eventType.includes('suspended')) {
    return '#ffc107'; // Yellow
  }
  return '#6c757d'; // Gray
}

/**
 * Get event emoji based on event type
 */
export function getEventEmoji(eventType: IntegrationEventType): string {
  if (eventType.includes('feature_flag')) return '🏁';
  if (eventType.includes('segment')) return '📊';
  if (eventType.includes('game_world')) return '🌍';
  if (eventType.includes('maintenance')) return '🔧';
  if (eventType.includes('client_version')) return '📱';
  if (eventType.includes('service_notice')) return '📢';
  if (eventType.includes('coupon')) return '🎟️';
  if (eventType.includes('user')) return '👤';
  if (eventType.includes('whitelist')) return '✅';
  if (eventType.includes('tag')) return '🏷️';
  if (eventType.includes('environment')) return '🌐';
  if (eventType.includes('change_request')) return '📝';
  if (eventType.includes('message_template')) return '💬';
  if (eventType.includes('job')) return '⏰';
  if (eventType.includes('invitation')) return '📧';
  if (eventType.includes('api_token')) return '🔑';
  if (eventType.includes('integration')) return '🔗';
  return '📌';
}

/**
 * Build detail blocks for the event
 */
export function buildEventDetails(event: IntegrationSystemEvent): string[] {
  const details: string[] = [];

  if (event.data) {
    for (const [key, value] of Object.entries(event.data)) {
      if (value !== null && value !== undefined && key !== 'id') {
        const formattedKey = key
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, (str) => str.toUpperCase());

        let formattedValue = value;
        if (typeof value === 'boolean') {
          formattedValue = value ? 'Yes' : 'No';
        } else if (typeof value === 'object') {
          formattedValue = JSON.stringify(value);
        }

        details.push(`• *${formattedKey}*: ${formattedValue}`);
      }
    }
  }

  return details;
}

/**
 * Format Slack message payload
 */
export function formatSlackMessage(
  event: IntegrationSystemEvent,
  options: { username?: string; channel?: string; emojiIcon?: string } = {}
): Record<string, any> {
  const emoji = getEventEmoji(event.type);
  const message = formatEventMessage(event);
  const color = getEventColor(event.type);
  const details = buildEventDetails(event);

  const payload: Record<string, any> = {
    username: options.username || 'Gatrix',
    icon_emoji: options.emojiIcon || ':rocket:',
    attachments: [
      {
        color,
        fallback: message,
        pretext: `${emoji} ${message}`,
        fields: details.length > 0 ? [{ value: details.join('\n'), short: false }] : [],
        footer: 'Gatrix Integration',
        ts: Math.floor(new Date(event.createdAt).getTime() / 1000),
      },
    ],
  };

  if (options.channel) {
    payload.channel = options.channel;
  }

  return payload;
}

/**
 * Format Microsoft Teams message payload (Adaptive Card)
 */
export function formatTeamsMessage(event: IntegrationSystemEvent): Record<string, any> {
  const emoji = getEventEmoji(event.type);
  const eventName = formatEventType(event.type);
  const actor = event.createdBy || 'System';
  const color = getEventColor(event.type);
  const details = buildEventDetails(event);

  return {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    themeColor: color.replace('#', ''),
    summary: `${eventName} by ${actor}`,
    sections: [
      {
        activityTitle: `${emoji} ${eventName}`,
        activitySubtitle: `by ${actor}`,
        facts: [
          ...(event.environmentId ? [{ name: 'Environment', value: event.environmentId }] : []),
          { name: 'Time', value: formatTimestamp(event.createdAt) },
        ],
        text: details.length > 0 ? details.join('\n') : undefined,
        markdown: true,
      },
    ],
  };
}

/**
 * Format Lark message payload
 */
export function formatLarkMessage(event: IntegrationSystemEvent): Record<string, any> {
  const emoji = getEventEmoji(event.type);
  const eventName = formatEventType(event.type);
  const actor = event.createdBy || 'System';
  const details = buildEventDetails(event);

  const content = [
    `${emoji} **${eventName}**`,
    `By: ${actor}`,
    event.environmentId ? `Environment: ${event.environmentId}` : null,
    `Time: ${formatTimestamp(event.createdAt)}`,
    ...details,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    msg_type: 'text',
    content: {
      text: content,
    },
  };
}

/**
 * Format Discord message payload
 */
export function formatDiscordMessage(event: IntegrationSystemEvent): Record<string, any> {
  const emoji = getEventEmoji(event.type);
  const message = formatEventMessage(event);
  const color = parseInt(getEventColor(event.type).replace('#', ''), 16);
  const details = buildEventDetails(event);

  return {
    embeds: [
      {
        title: `${emoji} ${formatEventType(event.type)}`,
        description: message,
        color,
        fields: details.length > 0 ? [{ name: 'Details', value: details.join('\n') }] : [],
        footer: {
          text: 'Gatrix Integration',
        },
        timestamp: new Date(event.createdAt).toISOString(),
      },
    ],
  };
}

/**
 * Format PagerDuty message payload
 */
export function formatPagerDutyMessage(
  event: IntegrationSystemEvent,
  routingKey: string
): Record<string, any> {
  const eventName = formatEventType(event.type);
  const actor = event.createdBy || 'System';
  const details = buildEventDetails(event);

  return {
    routing_key: routingKey,
    event_action: 'trigger',
    payload: {
      summary: `${eventName} by ${actor}`,
      source: 'Gatrix',
      severity:
        event.type.includes('deleted') || event.type.includes('archived') ? 'warning' : 'info',
      timestamp: new Date(event.createdAt).toISOString(),
      custom_details: {
        eventType: event.type,
        actor,
        environmentId: event.environmentId,
        ...event.data,
      },
      text: details.join('\n'),
    },
  };
}

/**
 * Format Telegram message payload
 */
export function formatTelegramMessage(event: IntegrationSystemEvent): string {
  const emoji = getEventEmoji(event.type);
  const eventName = formatEventType(event.type);
  const actor = event.createdBy || 'System';
  const details = buildEventDetails(event);

  let content = `${emoji} *${eventName}*\n`;
  content += `By: ${actor}\n`;
  if (event.environmentId) content += `Env: ${event.environmentId}\n`;
  content += `Time: ${formatTimestamp(event.createdAt)}\n\n`;
  content += details.join('\n');

  return content;
}

/**
 * Format WhatsApp message payload (Meta API)
 */
export function formatWhatsAppMessage(
  event: IntegrationSystemEvent,
  to: string
): Record<string, any> {
  const emoji = getEventEmoji(event.type);
  const eventName = formatEventType(event.type);
  const actor = event.createdBy || 'System';
  const details = buildEventDetails(event);

  const content = [
    `${emoji} *${eventName}*`,
    `By: ${actor}`,
    event.environmentId ? `Env: ${event.environmentId}` : null,
    `Time: ${formatTimestamp(event.createdAt)}`,
    '',
    ...details,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: {
      body: content,
    },
  };
}

/**
 * Format Line message payload
 */
export function formatLineMessage(event: IntegrationSystemEvent, to: string): Record<string, any> {
  const emoji = getEventEmoji(event.type);
  const eventName = formatEventType(event.type);
  const actor = event.createdBy || 'System';
  const details = buildEventDetails(event);

  const content = [
    `${emoji} ${eventName}`,
    `By: ${actor}`,
    event.environmentId ? `Env: ${event.environmentId}` : null,
    `Time: ${formatTimestamp(event.createdAt)}`,
    '',
    ...details,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    to,
    messages: [
      {
        type: 'text',
        text: content,
      },
    ],
  };
}

/**
 * Format KakaoTalk message payload (Generic Agent format)
 */
export function formatKakaoMessage(event: IntegrationSystemEvent): Record<string, any> {
  const emoji = getEventEmoji(event.type);
  const eventName = formatEventType(event.type);
  const actor = event.createdBy || 'System';
  const details = buildEventDetails(event);

  const content = [
    `${emoji} [Gatrix Alert]`,
    `Event: ${eventName}`,
    `Actor: ${actor}`,
    event.environmentId ? `Environment: ${event.environmentId}` : null,
    `Time: ${formatTimestamp(event.createdAt)}`,
    '',
    ...details,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    msg: content,
  };
}

/**
 * Format Google Chat message payload
 */
export function formatGoogleChatMessage(event: IntegrationSystemEvent): Record<string, any> {
  const emoji = getEventEmoji(event.type);
  const eventName = formatEventType(event.type);
  const actor = event.createdBy || 'System';
  const color = getEventColor(event.type);
  const details = buildEventDetails(event);

  return {
    cardsV2: [
      {
        cardId: 'gatrixEvent',
        card: {
          header: {
            title: `${emoji} ${eventName}`,
            subtitle: `by ${actor}`,
          },
          sections: [
            {
              widgets: [
                {
                  textParagraph: {
                    text: [
                      event.environmentId ? `<b>Environment:</b> ${event.environmentId}` : null,
                      `<b>Time:</b> ${formatTimestamp(event.createdAt)}`,
                    ]
                      .filter(Boolean)
                      .join('<br>'),
                  },
                },
                {
                  textParagraph: {
                    text: details.join('<br>'),
                  },
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

/**
 * Format WeChat Work (WeCom) message payload
 */
export function formatWeComMessage(event: IntegrationSystemEvent): Record<string, any> {
  const emoji = getEventEmoji(event.type);
  const eventName = formatEventType(event.type);
  const actor = event.createdBy || 'System';
  const details = buildEventDetails(event);

  const content = [
    `# ${emoji} ${eventName}`,
    `**Actor**: ${actor}`,
    event.environmentId ? `**Environment**: ${event.environmentId}` : null,
    `**Time**: ${formatTimestamp(event.createdAt)}`,
    '',
    ...details.map((d) => `> ${d}`),
  ]
    .filter(Boolean)
    .join('\n');

  return {
    msgtype: 'markdown',
    markdown: {
      content,
    },
  };
}

/**
 * Format DingTalk message payload
 */
export function formatDingTalkMessage(event: IntegrationSystemEvent): Record<string, any> {
  const emoji = getEventEmoji(event.type);
  const eventName = formatEventType(event.type);
  const actor = event.createdBy || 'System';
  const details = buildEventDetails(event);

  const content = [
    `### ${emoji} ${eventName}`,
    `- **Actor**: ${actor}`,
    event.environmentId ? `- **Environment**: ${event.environmentId}` : null,
    `- **Time**: ${formatTimestamp(event.createdAt)}`,
    '',
    ...details,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    msgtype: 'markdown',
    markdown: {
      title: `${emoji} Gatrix Alert`,
      text: content,
    },
  };
}

/**
 * Format webhook JSON payload
 */
export function formatWebhookPayload(event: IntegrationSystemEvent): Record<string, any> {
  return {
    event: {
      type: event.type,
      createdBy: event.createdBy,
      createdByUserId: event.createdByUserId,
      environmentId: event.environmentId,
      createdAt: event.createdAt.toISOString(),
      data: event.data,
      preData: event.preData,
    },
    timestamp: Date.now(),
  };
}
