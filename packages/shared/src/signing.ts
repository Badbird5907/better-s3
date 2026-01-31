/**
 * Signed URL generation and verification for Cloudflare Worker
 * 
 * This module provides functionality to generate and verify signed URLs
 * for upload and download operations through the Cloudflare Worker.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

export interface SignedUploadUrlParams {
  projectId: string;
  environmentId: string;
  fileKeyId: string;
  uploadIntentId: string;
  hash: string;
  mimeType: string;
  size: number;
  expiresIn?: number; // seconds, default 3600 (1 hour)
}

export interface SignedDownloadUrlParams {
  fileKeyId: string;
  accessKey: string;
  fileName?: string; // optional filename for content-disposition header
  expiresIn?: number; // seconds, default 3600 (1 hour)
}

export interface ParsedSignedUrl {
  type: 'upload' | 'download';
  params: Record<string, string>;
  expiresAt: number;
  signature: string;
}

/**
 * Generate a signed upload URL
 */
export async function generateSignedUploadUrl(
  baseUrl: string,
  params: SignedUploadUrlParams,
  signingSecret: string,
): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + (params.expiresIn ?? 3600);
  
  const payload = {
    type: 'upload',
    projectId: params.projectId,
    environmentId: params.environmentId,
    fileKeyId: params.fileKeyId,
    uploadIntentId: params.uploadIntentId,
    hash: params.hash,
    mimeType: params.mimeType,
    size: params.size.toString(),
    expiresAt: expiresAt.toString(),
  };

  const signature = await createSignature(payload, signingSecret);
  
  const url = new URL(`${baseUrl}/upload/${params.fileKeyId}`);
  Object.entries(payload).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  url.searchParams.set('signature', signature);
  
  return url.toString();
}

/**
 * Generate a signed download URL
 */
export async function generateSignedDownloadUrl(
  baseUrl: string,
  params: SignedDownloadUrlParams,
  signingSecret: string,
): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + (params.expiresIn ?? 3600);
  
  const payload = {
    type: 'download',
    fileKeyId: params.fileKeyId,
    accessKey: params.accessKey,
    ...(params.fileName && { fileName: params.fileName }),
    expiresAt: expiresAt.toString(),
  };

  const signature = await createSignature(payload, signingSecret);
  
  const url = new URL(`${baseUrl}/download/${params.fileKeyId}`);
  Object.entries(payload).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  url.searchParams.set('signature', signature);
  
  return url.toString();
}

/**
 * Verify a signed URL and extract its parameters
 */
export async function verifySignedUrl(
  url: string,
  signingSecret: string,
): Promise<ParsedSignedUrl> {
  const urlObj = new URL(url);
  const signature = urlObj.searchParams.get('signature');
  
  if (!signature) {
    throw new Error('Missing signature in URL');
  }
  
  // Remove signature from params to reconstruct payload
  urlObj.searchParams.delete('signature');
  
  const params: Record<string, string> = {};
  urlObj.searchParams.forEach((value: string, key: string) => {
    params[key] = value;
  });
  
  const type = params.type;
  if (!type || (type !== 'upload' && type !== 'download')) {
    throw new Error('Invalid or missing type parameter');
  }
  
  const expiresAt = parseInt(params.expiresAt ?? '0', 10);
  if (!expiresAt || isNaN(expiresAt)) {
    throw new Error('Invalid or missing expiresAt parameter');
  }
  
  // Check expiration
  const now = Math.floor(Date.now() / 1000);
  if (now > expiresAt) {
    throw new Error('Signed URL has expired');
  }
  
  // Verify signature
  const expectedSignature = await createSignature(params, signingSecret);
  if (!timingSafeEqual(signature, expectedSignature)) {
    throw new Error('Invalid signature');
  }
  
  return {
    type,
    params,
    expiresAt,
    signature,
  };
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
  const message = sortedKeys.map(key => `${key}=${payload[key]}`).join('&');
  
  // Use Web Crypto API (works in Node.js 15+, browsers, and Cloudflare Workers)
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    messageData,
  );
  
  // Convert to hex string
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

/**
 * Extract parameters from a verified signed URL (convenience function)
 */
export function extractUploadParams(parsed: ParsedSignedUrl): Omit<SignedUploadUrlParams, 'expiresIn'> {
  if (parsed.type !== 'upload') {
    throw new Error('Not an upload URL');
  }
  
  const { projectId, environmentId, fileKeyId, uploadIntentId, hash, mimeType, size } = parsed.params;
  
  if (!projectId || !environmentId || !fileKeyId || !uploadIntentId || !hash || !mimeType || !size) {
    throw new Error('Missing required upload parameters');
  }
  
  return {
    projectId,
    environmentId,
    fileKeyId,
    uploadIntentId,
    hash,
    mimeType,
    size: parseInt(size, 10),
  };
}

/**
 * Extract parameters from a verified signed download URL (convenience function)
 */
export function extractDownloadParams(parsed: ParsedSignedUrl): Omit<SignedDownloadUrlParams, 'expiresIn'> {
  if (parsed.type !== 'download') {
    throw new Error('Not a download URL');
  }
  
  const { fileKeyId, accessKey, fileName } = parsed.params;
  
  if (!fileKeyId || !accessKey) {
    throw new Error('Missing required download parameters');
  }
  
  return {
    fileKeyId,
    accessKey,
    fileName,
  };
}
