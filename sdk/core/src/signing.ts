export interface SignedUploadUrlParams {
  environmentId: string;
  fileKeyId: string;
  accessKey: string;
  fileName: string;
  size: number;
  hash?: string;
  mimeType?: string;
  expiresIn?: number;
  keyId: string;
  isPublic?: boolean;
  protocol?: "http" | "https";
}

export interface SignedDownloadUrlParams {
  fileKeyId: string;
  accessKey: string;
  fileName?: string;
  expiresIn?: number;
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

export async function deriveSigningSecret(
  apiKey: string,
  masterSigningSecret: string,
): Promise<string> {
  const keyHash = await hashString(apiKey);
  return deriveSigningSecretFromHash(keyHash, masterSigningSecret);
}

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

export async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function generateSignedUploadUrl(
  workerDomain: string,
  projectSlug: string,
  params: SignedUploadUrlParams,
  apiKey: string,
  masterSigningSecret: string,
): Promise<string> {
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
  const url = new URL(`${protocol}://${projectSlug}.${workerDomain}/ingest/tus`);
  Object.entries(payload).forEach(([key, value]) => {
    if (key !== "type") {
      url.searchParams.set(key, value);
    }
  });
  url.searchParams.set("sig", signature);

  return url.toString();
}

export async function generateSignedUploadUrlWithSecret(
  workerDomain: string,
  projectSlug: string,
  params: SignedUploadUrlParams,
  signingSecret: string,
): Promise<string> {
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
  const url = new URL(`${protocol}://${projectSlug}.${workerDomain}/ingest/tus`);
  Object.entries(payload).forEach(([key, value]) => {
    if (key !== "type") {
      url.searchParams.set(key, value);
    }
  });
  url.searchParams.set("sig", signature);

  return url.toString();
}

export async function generateSignedUploadUrlFromHash(
  workerDomain: string,
  projectSlug: string,
  params: SignedUploadUrlParams,
  keyHash: string,
  masterSigningSecret: string,
): Promise<string> {
  const signingSecret = await deriveSigningSecretFromHash(
    keyHash,
    masterSigningSecret,
  );

  return generateSignedUploadUrlWithSecret(
    workerDomain,
    projectSlug,
    params,
    signingSecret,
  );
}

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

  const url = new URL(`https://${projectSlug}.${workerDomain}/f/${params.accessKey}`);
  url.searchParams.set("expiresAt", expiresAt.toString());
  url.searchParams.set("sig", signature);

  if (params.fileName) {
    url.searchParams.set("fileName", params.fileName);
  }

  return url.toString();
}

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

export async function verifySignedUploadUrl(
  url: string,
  apiKeySecret: string,
): Promise<ParsedSignedUploadUrl> {
  const urlObj = new URL(url);
  const signature = urlObj.searchParams.get("sig");

  if (!signature) {
    throw new Error("Missing signature in URL");
  }

  const pathParts = urlObj.pathname.split("/").filter(Boolean);
  if (pathParts.length < 3 || pathParts[0] !== "upload") {
    throw new Error("Invalid upload URL path");
  }
  const environmentId = pathParts[1];
  const fileKeyId = pathParts[2];

  if (!environmentId || !fileKeyId) {
    throw new Error("Missing environmentId or fileKeyId in URL path");
  }

  const fileName = urlObj.searchParams.get("fileName");
  const sizeStr = urlObj.searchParams.get("size");
  const keyId = urlObj.searchParams.get("keyId");
  const accessKey = urlObj.searchParams.get("accessKey");
  const hash = urlObj.searchParams.get("hash");
  const mimeType = urlObj.searchParams.get("mimeType");
  const expiresAtStr = urlObj.searchParams.get("expiresAt");

  if (!fileName || !sizeStr || !keyId || !accessKey) {
    throw new Error(
      "Missing required parameters: fileName, size, keyId, or accessKey",
    );
  }

  const size = parseInt(sizeStr, 10);
  if (isNaN(size) || size <= 0) {
    throw new Error("Invalid size parameter");
  }

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

export async function verifySignedDownloadUrl(
  url: string,
  signingSecret: string,
): Promise<ParsedSignedDownloadUrl> {
  const urlObj = new URL(url);
  const signature = urlObj.searchParams.get("sig");

  if (!signature) {
    throw new Error("Missing signature in URL");
  }

  const pathParts = urlObj.pathname.split("/").filter(Boolean);
  if (pathParts.length < 2 || pathParts[0] !== "download") {
    throw new Error("Invalid download URL path");
  }
  const fileKeyId = pathParts[1];

  if (!fileKeyId) {
    throw new Error("Missing fileKeyId in URL path");
  }

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

  const now = Math.floor(Date.now() / 1000);
  if (now > expiresAt) {
    throw new Error("Signed URL has expired");
  }

  const payload: Record<string, string> = {
    type: "download",
    fileKeyId,
    accessKey,
    expiresAt: expiresAtStr,
  };
  if (fileName) payload.fileName = fileName;

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

async function createSignature(
  payload: Record<string, string>,
  secret: string,
): Promise<string> {
  const sortedKeys = Object.keys(payload).sort();
  const message = sortedKeys.map((key) => `${key}=${payload[key]}`).join("&");

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

  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  return signatureArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

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

export { createSignature };
