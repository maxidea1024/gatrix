import { JobFactory } from './JobFactory';
import { MailSendJob } from './MailSendJob';
import { HttpRequestJob } from './HttpRequestJob';
import { SshCommandJob } from './SshCommandJob';
import { LogMessageJob } from './LogMessageJob';
import { createLogger } from '../../config/logger';

const logger = createLogger('index');

// Register job types with Factory
export function initializeJobTypes(): void {
  try {
    JobFactory.registerJobType('mailsend', MailSendJob);
    JobFactory.registerJobType('http_request', HttpRequestJob);
    JobFactory.registerJobType('ssh_command', SshCommandJob);
    JobFactory.registerJobType('log_message', LogMessageJob);

    logger.info('Job types initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize job types:', error);
    throw error;
  }
}

export * from './JobFactory';
export * from './MailSendJob';
export * from './HttpRequestJob';
export * from './SshCommandJob';
export * from './LogMessageJob';
