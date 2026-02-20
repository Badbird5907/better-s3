/**
 * Signed URL generation and verification for Cloudflare Worker
 *
 * This module provides functionality to generate and verify signed URLs
 * for upload and download operations through the Cloudflare Worker.
 *
 * IMPORTANT: The customer's server SDK generates signed URLs locally using their API key.
 * The browser never has access to the API key - it only receives pre-signed URLs from
 * the customer's server.
 *
 * SIGNING APPROACH:
 * Since API keys are stored as hashes on the server, we use a derived signing secret:
 * 1. signingSecret = HMAC(MASTER_SIGNING_SECRET, SHA256(apiKey))
 * 2. The customer SDK knows the full API key, so it computes SHA256(apiKey) locally
 * 3. The server has the keyHash stored, so it can derive the same signingSecret
 */
 

export interface SignedUploadUrlParams {
  environmentId: string;
  fileKeyId: string; // client-generated, unique per environment
  accessKey: string; // caller-defined access key, unique per project
  fileName: string;
  size: number; // required for quota/validation
  hash?: string; // optional - if provided, worker validates against actual
  mimeType?: string; // optional - if provided, worker validates against actual
  expiresIn?: number; // seconds, optional - no expiry if omitted
  keyId: string; // API key prefix (sk-bs3-xxxx) to identify which key to look up
  isPublic?: boolean; // optional - whether file should be publicly accessible
  protocol?: "http" | "https"; // optional - defaults to https
}

export interface SignedDownloadUrlParams {
  fileKeyId: string;
  accessKey: string;
  fileName?: string; // optional filename for content-disposition header
  expiresIn?: number; // seconds, default 3600 (1 hour)
}

export interface ParsedSignedUploadUrl {
  type: "upload";
  environmentId: string;
  fileKeyId: string;
  accessKey: string;
  fileName: string;
  size: number;
  hash?: string;
  mimeType?: string;
  expiresAt?: number;
  keyId: string;
  signature: string;
}

export interface ParsedSignedDownloadUrl {
  type: "download";
  fileKeyId: string;
  accessKey: string;
  fileName?: string;
  expiresAt: number;
  signature: string;
}

export type ParsedSignedUrl = ParsedSignedUploadUrl | ParsedSignedDownloadUrl;

/**
 * Derive a signing secret from an API key and master signing secret.
 * This allows the server to verify signatures without storing the original API key.
 *
 * @param apiKey - The full API key (e.g., "sk-bs3-xxxxx...")
 * @param masterSigningSecret - The server's SIGNING_SECRET environment variable
 * @returns The derived signing secret to use for HMAC signatures
 */
export async function deriveSigningSecret(
  apiKey: string,
  masterSigningSecret: string,
): Promise<string> {
  // First, hash the API key (this is what's stored in the database)
  const keyHash = await hashString(apiKey);

  // Then derive the signing secret using HMAC
  return deriveSigningSecretFromHash(keyHash, masterSigningSecret);
}

/**
 * Derive a signing secret from an API key hash and master signing secret.
 * Used by the server when it only has access to the keyHash.
 */
export async function deriveSigningSecretFromHash(
  keyHash: string,
  masterSigningSecret: string,
): Promise<string> {
  const encoder = new TextEncoder();

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(masterSigningSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const derivedBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(keyHash),
  );

  return Array.from(new Uint8Array(derivedBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Hash a string using SHA-256 (used for API key hashing)
 */
export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Generate a signed upload URL
 *
 * This is called by the customer's server SDK to create a pre-signed URL
 * that the browser can use to upload directly to the Cloudflare Worker.
 *
 * @param workerDomain - The worker domain (e.g., "files.evanyu.dev")
 * @param projectSlug - The project slug (e.g., "myproject-k9x2m7")
 * @param params - Upload parameters
 * @param apiKey - The full API key (will be used to derive signing secret)
 * @param masterSigningSecret - The SIGNING_SECRET from environment
 *
 * URL format: POST https://{projectSlug}.{workerDomain}/ingest/tus?fileName=...&size=...&sig=...
 */
export async function generateSignedUploadUrl(
  workerDomain: string,
  projectSlug: string,
  params: SignedUploadUrlParams,
  apiKey: string,
  masterSigningSecret: string,
): Promise<string> {
  // Derive the signing secret from the API key
  const signingSecret = await deriveSigningSecret(apiKey, masterSigningSecret);

  const payload: Record<string, string> = {
    type: "upload",
    environmentId: params.environmentId,
    fileKeyId: params.fileKeyId,
    accessKey: params.accessKey,
    fileName: params.fileName,
    size: params.size.toString(),
    keyId: params.keyId,
  };

  // Add optional params if provided
  if (params.hash) {
    payload.hash = params.hash;
  }
  if (params.mimeType) {
    payload.mimeType = params.mimeType;
  }
  if (params.expiresIn !== undefined) {
    const expiresAt = Math.floor(Date.now() / 1000) + params.expiresIn;
    payload.expiresAt = expiresAt.toString();
  }
  if (params.isPublic !== undefined) {
    payload.isPublic = params.isPublic.toString();
  }

  const signature = await createSignature(payload, signingSecret);

  const protocol = params.protocol ?? "https";
  const url = new URL(
    `${protocol}://${projectSlug}.${workerDomain}/ingest/tus`,
  );
  Object.entries(payload).forEach(([key, value]) => {
    // Skip type as it's not needed in query params
    if (key !== "type") {
      url.searchParams.set(key, value);
    }
  });
  url.searchParams.set("sig", signature);

  return url.toString();
}

/**
 * Generate a signed upload URL using a stored key hash instead of the full API key.
 *
 * Used by server-side dashboard routes that authenticate via session and look up
 * an API key record from the database (where only the hash is stored).
 *
 * @param workerDomain - The worker domain (e.g., "files.evanyu.dev")
 * @param projectSlug - The project slug (e.g., "myproject-k9x2m7")
 * @param params - Upload parameters (keyId must be the keyPrefix from the DB record)
 * @param keyHash - The stored SHA-256 hash of the API key
 * @param masterSigningSecret - The SIGNING_SECRET from environment
 */
export async function generateSignedUploadUrlFromHash(
  workerDomain: string,
  projectSlug: string,
  params: SignedUploadUrlParams,
  keyHash: string,
  masterSigningSecret: string,
): Promise<string> {
  const signingSecret = await deriveSigningSecretFromHash(keyHash, masterSigningSecret);

  const payload: Record<string, string> = {
    type: "upload",
    environmentId: params.environmentId,
    fileKeyId: params.fileKeyId,
    accessKey: params.accessKey,
    fileName: params.fileName,
    size: params.size.toString(),
    keyId: params.keyId,
  };

  if (params.hash) {
    payload.hash = params.hash;
  }
  if (params.mimeType) {
    payload.mimeType = params.mimeType;
  }
  if (params.expiresIn !== undefined) {
    const expiresAt = Math.floor(Date.now() / 1000) + params.expiresIn;
    payload.expiresAt = expiresAt.toString();
  }
  if (params.isPublic !== undefined) {
    payload.isPublic = params.isPublic.toString();
  }

  const signature = await createSignature(payload, signingSecret);

  const protocol = params.protocol ?? "https";
  const url = new URL(
    `${protocol}://${projectSlug}.${workerDomain}/ingest/tus`,
  );
  Object.entries(payload).forEach(([key, value]) => {
    if (key !== "type") {
      url.searchParams.set(key, value);
    }
  });
  url.searchParams.set("sig", signature);

  return url.toString();
}

/**
 * Generate a signed download URL
 *
 * @param workerDomain - The worker domain (e.g., "files.evanyu.dev")
 * @param projectSlug - The project slug (e.g., "myproject-k9x2m7")
 * @param params - Download parameters
 * @param signingSecret - The signing secret
 *
 * URL format for private files: https://{projectSlug}.{workerDomain}/f/{accessKey}?sig=...&expiresAt=...
 * URL format for public files: https://{projectSlug}.{workerDomain}/f/{accessKey}
 */
export async function generateSignedDownloadUrl(
  workerDomain: string,
  projectSlug: string,
  params: SignedDownloadUrlParams,
  signingSecret: string,
): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + (params.expiresIn ?? 3600);

  const payload: Record<string, string> = {
    accessKey: params.accessKey,
    expiresAt: expiresAt.toString(),
  };

  const signature = await createSignature(payload, signingSecret);

  const url = new URL(
    `https://${projectSlug}.${workerDomain}/f/${params.accessKey}`,
  );
  url.searchParams.set("expiresAt", expiresAt.toString());
  url.searchParams.set("sig", signature);

  if (params.fileName) {
    url.searchParams.set("fileName", params.fileName);
  }

  return url.toString();
}

/**
 * Generate a public download URL (no signature required)
 *
 * @param workerDomain - The worker domain (e.g., "files.evanyu.dev")
 * @param projectSlug - The project slug (e.g., "myproject-k9x2m7")
 * @param accessKey - The file access key
 * @param fileName - Optional filename for content-disposition
 *
 * URL format: https://{projectSlug}.{workerDomain}/f/{accessKey}
 */
export function generatePublicDownloadUrl(
  workerDomain: string,
  projectSlug: string,
  accessKey: string,
  fileName?: string,
): string {
  const url = new URL(`https://${projectSlug}.${workerDomain}/f/${accessKey}`);

  if (fileName) {
    url.searchParams.set("fileName", fileName);
  }

  return url.toString();
}

/**
 * Verify a signed upload URL and extract its parameters
 *
 * This is called by the Cloudflare Worker to validate incoming upload requests.
 * The worker must fetch the API key secret from the server using the keyId.
 */
export async function verifySignedUploadUrl(
  url: string,
  apiKeySecret: string,
): Promise<ParsedSignedUploadUrl> {
  const urlObj = new URL(url);
  const signature = urlObj.searchParams.get("sig");

  if (!signature) {
    throw new Error("Missing signature in URL");
  }

  // Extract environmentId and fileKeyId from path: /upload/{environmentId}/{fileKeyId}
  const pathParts = urlObj.pathname.split("/").filter(Boolean);
  if (pathParts.length < 3 || pathParts[0] !== "upload") {
    throw new Error("Invalid upload URL path");
  }
  const environmentId = pathParts[1];
  const fileKeyId = pathParts[2];

  if (!environmentId || !fileKeyId) {
    throw new Error("Missing environmentId or fileKeyId in URL path");
  }

  // Extract query params
  const fileName = urlObj.searchParams.get("fileName");
  const sizeStr = urlObj.searchParams.get("size");
  const keyId = urlObj.searchParams.get("keyId");
  const accessKey = urlObj.searchParams.get("accessKey");
  const hash = urlObj.searchParams.get("hash");
  const mimeType = urlObj.searchParams.get("mimeType");
  const expiresAtStr = urlObj.searchParams.get("expiresAt");

  if (!fileName || !sizeStr || !keyId || !accessKey) {
    throw new Error("Missing required parameters: fileName, size, keyId, or accessKey");
  }

  const size = parseInt(sizeStr, 10);
  if (isNaN(size) || size <= 0) {
    throw new Error("Invalid size parameter");
  }

  // Check expiration if provided
  let expiresAt: number | undefined;
  if (expiresAtStr) {
    expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt)) {
      throw new Error("Invalid expiresAt parameter");
    }
    const now = Math.floor(Date.now() / 1000);
    if (now > expiresAt) {
      throw new Error("Signed URL has expired");
    }
  }

  // Rebuild payload for signature verification
  const payload: Record<string, string> = {
    type: "upload",
    environmentId,
    fileKeyId,
    accessKey,
    fileName,
    size: sizeStr,
    keyId,
  };
  if (hash) payload.hash = hash;
  if (mimeType) payload.mimeType = mimeType;
  if (expiresAtStr) payload.expiresAt = expiresAtStr;

  // Verify signature
  const expectedSignature = await createSignature(payload, apiKeySecret);
  if (!timingSafeEqual(signature, expectedSignature)) {
    throw new Error("Invalid signature");
  }

  return {
    type: "upload",
    environmentId,
    fileKeyId,
    accessKey,
    fileName,
    size,
    hash: hash ?? undefined,
    mimeType: mimeType ?? undefined,
    expiresAt,
    keyId,
    signature,
  };
}

/**
 * Verify a signed download URL and extract its parameters
 */
export async function verifySignedDownloadUrl(
  url: string,
  signingSecret: string,
): Promise<ParsedSignedDownloadUrl> {
  const urlObj = new URL(url);
  const signature = urlObj.searchParams.get("sig");

  if (!signature) {
    throw new Error("Missing signature in URL");
  }

  // Extract fileKeyId from path: /download/{fileKeyId}
  const pathParts = urlObj.pathname.split("/").filter(Boolean);
  if (pathParts.length < 2 || pathParts[0] !== "download") {
    throw new Error("Invalid download URL path");
  }
  const fileKeyId = pathParts[1];

  if (!fileKeyId) {
    throw new Error("Missing fileKeyId in URL path");
  }

  // Extract query params
  const accessKey = urlObj.searchParams.get("accessKey");
  const expiresAtStr = urlObj.searchParams.get("expiresAt");
  const fileName = urlObj.searchParams.get("fileName");

  if (!accessKey || !expiresAtStr) {
    throw new Error("Missing required parameters: accessKey or expiresAt");
  }

  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt)) {
    throw new Error("Invalid expiresAt parameter");
  }

  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (now > expiresAt) {
    throw new Error("Signed URL has expired");
  }

  // Rebuild payload for signature verification
  const payload: Record<string, string> = {
    type: "download",
    fileKeyId,
    accessKey,
    expiresAt: expiresAtStr,
  };
  if (fileName) payload.fileName = fileName;

  // Verify signature
  const expectedSignature = await createSignature(payload, signingSecret);
  if (!timingSafeEqual(signature, expectedSignature)) {
    throw new Error("Invalid signature");
  }

  return {
    type: "download",
    fileKeyId,
    accessKey,
    fileName: fileName ?? undefined,
    expiresAt,
    signature,
  };
}

/**
 * Legacy verification function - use verifySignedUploadUrl or verifySignedDownloadUrl instead
 * @deprecated
 */
export async function verifySignedUrl(
  url: string,
  signingSecret: string,
): Promise<ParsedSignedUrl> {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split("/").filter(Boolean);

  if (pathParts[0] === "upload") {
    return verifySignedUploadUrl(url, signingSecret);
  } else if (pathParts[0] === "download") {
    return verifySignedDownloadUrl(url, signingSecret);
  }

  throw new Error("Unknown URL type");
}

/**
 * Create HMAC-SHA256 signature for the given payload
 */
async function createSignature(
  payload: Record<string, string>,
  secret: string,
): Promise<string> {
  // Sort keys for consistent signature
  const sortedKeys = Object.keys(payload).sort();
  const message = sortedKeys.map((key) => `${key}=${payload[key]}`).join("&");

  // Use Web Crypto API (works in Node.js 15+, browsers, and Cloudflare Workers)
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    messageData,
  );

  // Convert to hex string
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  return signatureArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

// Export createSignature for use in SDK
export { createSignature };
