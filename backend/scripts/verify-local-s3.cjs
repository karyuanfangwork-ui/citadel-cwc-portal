// Local-only smoke check. Deletes only the unique object created by this run.
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), quiet: true });
const { S3Client, HeadBucketCommand, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { randomUUID } = require('crypto');

async function main() {
  const endpoint = new URL(process.env.S3_ENDPOINT);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname) || endpoint.port !== '8333') {
    throw new Error('Refusing to test non-local SeaweedFS storage');
  }
  const client = new S3Client({
    endpoint: endpoint.href, region: process.env.S3_REGION, forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
    requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED',
  });
  const Bucket = process.env.S3_BUCKET;
  const Key = `local-smoke/${randomUUID()}.pdf`;
  const bytes = Buffer.from('%PDF-1.4\n% local SeaweedFS storage smoke check\n%%EOF\n');
  try {
    await client.send(new HeadBucketCommand({ Bucket }));
    console.log('BUCKET_EXISTS=YES');
    await client.send(new PutObjectCommand({ Bucket, Key, Body: bytes, ContentType: 'application/pdf' }));
    const response = await client.send(new GetObjectCommand({ Bucket, Key }));
    const downloaded = Buffer.from(await response.Body.transformToByteArray());
    if (!bytes.equals(downloaded)) throw new Error('Object round-trip mismatch');
    console.log('OBJECT_ROUND_TRIP=MATCH');
  } finally {
    await client.send(new DeleteObjectCommand({ Bucket, Key }));
    client.destroy();
  }
  const verify = new S3Client({ endpoint: endpoint.href, region: process.env.S3_REGION, forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY } });
  try {
    await verify.send(new HeadObjectCommand({ Bucket, Key }));
    throw new Error('Test object still exists after deletion');
  } catch (error) {
    if (error.$metadata?.httpStatusCode !== 404) throw error;
    console.log('OBJECT_DELETED=YES');
  } finally { verify.destroy(); }
}
main().catch(error => { console.error('LOCAL_S3_CHECK_FAILED=' + error.message); process.exitCode = 1; });
