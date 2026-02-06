import type { Bindings } from "../../types/bindings";
import type { TusUploadMetadata } from "../../types/tus";

export async function storeUploadMetadata(
  metadata: TusUploadMetadata,
  env: Bindings,
): Promise<void> {
  const key = `upload:${metadata.uploadId}`;
  const ttl = parseInt(env.TUS_EXPIRATION_HOURS) * 3600;

  await env.TUS_METADATA.put(key, JSON.stringify(metadata), {
    expirationTtl: ttl,
  });

  const expirationKey = `expiration:${metadata.expiresAt}:${metadata.uploadId}`;
  await env.TUS_EXPIRATION.put(expirationKey, metadata.uploadId, {
    expirationTtl: ttl,
  });
}

export async function getUploadMetadata(
  uploadId: string,
  env: Bindings,
): Promise<TusUploadMetadata | null> {
  const key = `upload:${uploadId}`;
  const data = await env.TUS_METADATA.get(key, "json");
  return data as TusUploadMetadata | null;
}

export async function updateUploadOffset(
  uploadId: string,
  newOffset: number,
  env: Bindings,
): Promise<void> {
  const metadata = await getUploadMetadata(uploadId, env);
  if (!metadata) {
    throw new Error("Upload not found");
  }

  metadata.offset = newOffset;
  await storeUploadMetadata(metadata, env);
}

export async function updateUploadParts(
  uploadId: string,
  parts: { partNumber: number; etag: string }[],
  env: Bindings,
): Promise<void> {
  const metadata = await getUploadMetadata(uploadId, env);
  if (!metadata) {
    throw new Error("Upload not found");
  }

  metadata.parts = parts;
  await storeUploadMetadata(metadata, env);
}

export async function setUploadSize(
  uploadId: string,
  size: number,
  env: Bindings,
): Promise<void> {
  const metadata = await getUploadMetadata(uploadId, env);
  if (!metadata) {
    throw new Error("Upload not found");
  }

  metadata.size = size;
  await storeUploadMetadata(metadata, env);
}

export async function deleteUploadMetadata(
  uploadId: string,
  env: Bindings,
): Promise<void> {
  const metadata = await getUploadMetadata(uploadId, env);

  if (metadata) {
    const expirationKey = `expiration:${metadata.expiresAt}:${uploadId}`;
    await env.TUS_EXPIRATION.delete(expirationKey);
  }

  const key = `upload:${uploadId}`;
  await env.TUS_METADATA.delete(key);
}

export function isUploadExpired(metadata: TusUploadMetadata): boolean {
  const expiresAt = new Date(metadata.expiresAt);
  return expiresAt < new Date();
}

export function generateExpirationDate(env: Bindings): string {
  const hours = parseInt(env.TUS_EXPIRATION_HOURS);
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + hours);
  return expiresAt.toUTCString();
}
