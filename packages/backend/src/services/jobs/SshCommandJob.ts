import { Client } from 'ssh2';
import { BaseJob, JobExecutionResult } from './JobFactory';
import logger from '../../config/logger';

export class SshCommandJob extends BaseJob {
  async execute(): Promise<JobExecutionResult> {
    return new Promise((resolve, reject) => {
      try {
        // 필수 필드 검증
        this.validateRequiredFields(['host', 'username', 'command']);

        const { 
          host, 
          port = 22, 
          username, 
          password, 
          privateKey, 
          command,
          timeout = 60000
        } = this.context.jobDataMap;

        const conn = new Client();
        let output = '';
        let errorOutput = '';
        let isResolved = false;

        // 연결 설정
        const connectConfig: any = {
          host,
          port,
          username,
          readyTimeout: timeout
        };

        // 인증 방법 설정
        if (privateKey) {
          connectConfig.privateKey = privateKey;
        } else if (password) {
          connectConfig.password = password;
        } else {
          throw new Error('Either password or privateKey must be provided');
        }

        // 타임아웃 설정
        const timeoutId = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            conn.end();
            reject(new Error(`SSH command timeout after ${timeout}ms`));
          }
        }, timeout);

        conn.on('ready', () => {
          logger.info(`SSH connection established`, {
            jobId: this.context.jobId,
            host,
            username
          });

          conn.exec(command, (err, stream) => {
            if (err) {
              clearTimeout(timeoutId);
              if (!isResolved) {
                isResolved = true;
                reject(err);
              }
              return;
            }

            stream.on('close', (code: number, signal: string) => {
              conn.end();
              clearTimeout(timeoutId);

              if (!isResolved) {
                isResolved = true;

                logger.info(`SSH command completed`, {
                  jobId: this.context.jobId,
                  exitCode: code,
                  signal
                });

                const success = code === 0;
                resolve({
                  success,
                  data: {
                    exitCode: code,
                    signal,
                    stdout: output,
                    stderr: errorOutput,
                    command,
                    host,
                    username
                  },
                  error: success ? undefined : `Command failed with exit code ${code}`,
                  executionTimeMs: 0 // Will be set by executeWithTimeout
                });
              }
            });

            stream.on('data', (data: Buffer) => {
              output += data.toString();
            });

            stream.stderr.on('data', (data: Buffer) => {
              errorOutput += data.toString();
            });
          });
        });

        conn.on('error', (err) => {
          clearTimeout(timeoutId);
          if (!isResolved) {
            isResolved = true;
            logger.error(`SSH connection failed`, {
              jobId: this.context.jobId,
              host,
              error: err.message
            });
            reject(err);
          }
        });

        // SSH 연결 시작
        conn.connect(connectConfig);

      } catch (error) {
        logger.error(`SSH command job failed`, {
          jobId: this.context.jobId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        reject(error);
      }
    });
  }
}
