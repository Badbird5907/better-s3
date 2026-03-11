import type { Bindings } from "../../types/bindings";
import type { TusUploadMetadata } from "../../types/tus";

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
