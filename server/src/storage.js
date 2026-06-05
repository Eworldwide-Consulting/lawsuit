const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const logger = require('./logger');

const USE_S3 = !!(process.env.AWS_S3_BUCKET && process.env.AWS_ACCESS_KEY_ID);

const s3 = USE_S3
  ? new S3Client({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    })
  : null;

const BUCKET = process.env.AWS_S3_BUCKET;
const LOCAL_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');

function ensureLocalDir(subdir) {
  const dir = subdir ? path.join(LOCAL_DIR, subdir) : LOCAL_DIR;
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function upload({ buffer, originalName, mimeType, folder = 'documents' }) {
  const ext = path.extname(originalName);
  const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

  if (USE_S3) {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }));
    logger.debug({ key }, 'Uploaded to S3');
    return { key, url: null, backend: 's3' };
  }

  const dir = ensureLocalDir(folder);
  const filename = path.basename(key);
  fs.writeFileSync(path.join(dir, filename), buffer);
  logger.debug({ key }, 'Saved to local disk');
  return { key, url: null, backend: 'local' };
}

async function getDownloadUrl(key, expiresIn = 3600) {
  if (USE_S3) {
    const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
    return url;
  }
  return `/api/documents/file/${encodeURIComponent(path.basename(key))}`;
}

async function remove(key) {
  if (USE_S3) {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return;
  }
  const parts = key.split('/');
  const localPath = path.join(LOCAL_DIR, ...parts);
  if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
}

function getLocalFilePath(key) {
  const parts = key.split('/');
  return path.join(LOCAL_DIR, ...parts);
}

module.exports = { upload, getDownloadUrl, remove, getLocalFilePath, LOCAL_DIR, USE_S3 };
