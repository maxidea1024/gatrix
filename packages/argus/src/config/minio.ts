import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { config } from './index';
import { createLogger } from '../utils/logger';

const logger = createLogger('storage');

let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: config.storage.endpoint,
      region: config.storage.region,
      credentials: {
        accessKeyId: config.storage.accessKey,
        secretAccessKey: config.storage.secretKey,
      },
      forcePathStyle: config.storage.forcePathStyle,
    });
  }
  return s3Client;
}

export const s3 = getS3Client();

/**
 * Ensure the storage bucket exists, creating it if necessary.
 */
export async function ensureStorageBucket(): Promise<void> {
  const bucketName = config.storage.bucket;

  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    logger.info(`Storage bucket '${bucketName}' exists`);
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      logger.info(`Creating storage bucket '${bucketName}'...`);
      await s3.send(new CreateBucketCommand({ Bucket: bucketName }));
      logger.info(`Storage bucket '${bucketName}' created`);
    } else {
      logger.warn(
        `Could not verify storage bucket '${bucketName}', continuing...`,
        { error: error.message }
      );
    }
  }
}

export default s3;
