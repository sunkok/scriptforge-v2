import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getClient() {
  return new S3Client({
    region: requireEnv("APP_AWS_REGION"),
    credentials: {
      accessKeyId: requireEnv("APP_AWS_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("APP_AWS_SECRET_ACCESS_KEY"),
    },
  });
}

function getBucket() {
  return requireEnv("APP_AWS_S3_BUCKET");
}

export async function putObject(
  key: string,
  body: string,
  contentType = "application/json",
  ifMatch?: string
) {
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: body,
      ContentType: contentType,
      ...(ifMatch !== undefined ? { IfMatch: ifMatch } : {}),
    })
  );
}

export async function getObject(key: string): Promise<string> {
  const client = getClient();
  const res = await client.send(
    new GetObjectCommand({ Bucket: getBucket(), Key: key })
  );
  return res.Body!.transformToString();
}

export async function getObjectWithEtag(
  key: string
): Promise<{ body: string; etag: string | undefined }> {
  const client = getClient();
  const res = await client.send(
    new GetObjectCommand({ Bucket: getBucket(), Key: key })
  );
  return { body: await res.Body!.transformToString(), etag: res.ETag };
}

export async function objectExists(key: string): Promise<boolean> {
  const client = getClient();
  try {
    await client.send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
    return true;
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.name === "NotFound" ||
        err.name === "NoSuchKey" ||
        (err as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode === 404)
    ) {
      return false;
    }
    throw err;
  }
}

export async function deleteObject(key: string) {
  const client = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
}

function isNotFound(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "NotFound" ||
      err.name === "NoSuchKey" ||
      (err as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode === 404)
  );
}

function isPreconditionFailed(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.name === "PreconditionFailed" ||
      (err as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode === 412)
  );
}

/**
 * Atomic read-mutate-write with ETag-based optimistic locking.
 * Retries up to maxRetries times on 412 PreconditionFailed (concurrent write).
 */
export async function updateIndexWithRetry<T>(
  key: string,
  empty: T,
  mutator: (current: T) => T,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    let current: T = empty;
    let etag: string | undefined;

    try {
      const result = await getObjectWithEtag(key);
      current = JSON.parse(result.body) as T;
      etag = result.etag;
    } catch (err) {
      if (!isNotFound(err)) throw err;
    }

    const updated = mutator(current);

    try {
      await putObject(key, JSON.stringify(updated), "application/json", etag);
      return updated;
    } catch (err) {
      if (isPreconditionFailed(err) && attempt < maxRetries - 1) {
        continue;
      }
      throw err;
    }
  }
  throw new Error(
    `Persistent write conflict on ${key} after ${maxRetries} retries`
  );
}
