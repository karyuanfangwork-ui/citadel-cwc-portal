import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config';
import { logger } from '../utils/logger';

export class S3Service {
    private client: S3Client;

    constructor() {
        this.client = new S3Client({
            region: config.s3.region,
            endpoint: config.s3.endpoint,
            credentials: {
                accessKeyId: config.s3.accessKey,
                secretAccessKey: config.s3.secretKey,
            },
            forcePathStyle: config.s3.forcePathStyle,
            // DO Spaces rejects AWS SDK v3 checksum headers — disable them
            requestChecksumCalculation: 'WHEN_REQUIRED',
            responseChecksumValidation: 'WHEN_REQUIRED',
        });
    }

    /**
     * Generates a time-limited presigned URL for downloading a file
     * @param key The file key (UUID + extension)
     * @param expiresH Hours until the link expires (default 1 hour)
     * @param overrideParams Optional S3 GetObject overrides (e.g. ResponseContentDisposition, ResponseContentType)
     */
    async getPresignedUrl(key: string, expiresH: number = 1, overrideParams?: Record<string, string>): Promise<string> {
        try {
            const getObjectInput: any = {
                Bucket: config.s3.bucket,
                Key: key,
            };
            // Map common override keys to S3 SDK param names
            if (overrideParams) {
                if (overrideParams['response-content-disposition']) {
                    getObjectInput.ResponseContentDisposition = overrideParams['response-content-disposition'];
                }
                if (overrideParams['response-content-type']) {
                    getObjectInput.ResponseContentType = overrideParams['response-content-type'];
                }
            }
            const command = new GetObjectCommand(getObjectInput);
            
            const url = await getSignedUrl(this.client, command, { 
                expiresIn: expiresH * 3600 
            });
            
            return url;
        } catch (error) {
            logger.error(`Error generating presigned URL for ${key}: ${error}`);
            throw error;
        }
    }

    /**
     * Manually upload a buffer to S3 (not used by multer-s3, but useful for migrations)
     */
    async uploadBuffer(key: string, buffer: Buffer, contentType: string): Promise<void> {
        try {
            const command = new PutObjectCommand({
                Bucket: config.s3.bucket,
                Key: key,
                Body: buffer,
                ContentType: contentType,
            });
            await this.client.send(command);
        } catch (error) {
            logger.error(`Error uploading buffer to S3: ${error}`);
            throw error;
        }
    }
}

export const s3Service = new S3Service();
