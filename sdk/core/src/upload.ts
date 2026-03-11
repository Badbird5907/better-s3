import { generateSignedUploadUrlWithSecret } from "./signing";
import { nanoid } from "nanoid";
import { z } from "zod";

const siloTokenSchema = z
  .object({
    v: z.number().int().positive(),
    ak: z.string().min(1),
    eid: z.string().min(1),
    is: z.string().min(1),
    ss: z.string().min(1),
  })
  .strict();

export interface ParsedSiloToken {
  version: number;
  apiKey: string;
  environmentId: string;
  ingestServer: string;
  signingSecret: string;
}

export interface CreateSiloCoreFromTokenInput {
  url: string;
  token: string;
  callbackUrl?: string;
  fetch?: typeof fetch;
}

function decodeBase64UrlUtf8(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

  if (typeof atob === "function") {
    return atob(padded);
  }

  const globalBuffer = (globalThis as { Buffer?: { from: (value: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer;
  if (globalBuffer) {
    return globalBuffer.from(padded, "base64").toString("utf8");
  }

  throw new Error("Unable to decode SILO_TOKEN in this runtime.");
}

export function encodeSiloToken(payload: {
  v: number;
  ak: string;
  eid: string;
  is: string;
  ss: string;
}): string {
  const json = JSON.stringify(payload);
  if (typeof btoa === "function") {
    return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }
  const globalBuffer = (globalThis as { Buffer?: { from: (value: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer;
  if (globalBuffer) {
    return globalBuffer.from(json, "utf8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "");
  }
  throw new Error("Unable to encode SILO_TOKEN in this runtime.");
}

export function parseSiloToken(token: string): ParsedSiloToken {
  const decoded = decodeBase64UrlUtf8(token);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(decoded);
  } catch {
    throw new Error("Invalid SILO_TOKEN: expected base64url-encoded JSON.");
  }

  const parsed = siloTokenSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error(`Invalid SILO_TOKEN: ${parsed.error.message}`);
  }

  return {
    version: parsed.data.v,
    apiKey: parsed.data.ak,
    environmentId: parsed.data.eid,
    ingestServer: parsed.data.is,
    signingSecret: parsed.data.ss,
  };
}

export interface UploadCoreConfig {
  apiBaseUrl: string;
  apiKey: string;
  environmentId: string;
  ingestServer: string;
  signingSecret: string;
  keyId?: string;
  callbackUrl?: string;
  fetch?: typeof fetch;
}

export interface UploadFileInput {
  fileName: string;
  size: number;
  accessKey?: string;
  fileKeyId?: string;
  hash?: string;
  mimeType?: string;
  isPublic?: boolean;
  metadata?: Record<string, unknown>;
}

export interface RegisterUploadBatchInput {
  files: UploadFileInput[];
  requestMetadata?: Record<string, unknown>;
  callbackMetadata?: Record<string, unknown>;
  callbackUrl?: string;
  dev?: boolean;
  expiresIn?: number;
  protocol?: "http" | "https";
}

export interface PrepareUploadInput extends Omit<RegisterUploadBatchInput, "files"> {
  file: UploadFileInput;
}

export interface PreparedUploadFile {
  fileKeyId: string;
  accessKey: string;
  uploadUrl: string;
  fileName: string;
  size: number;
  hash?: string;
  mimeType?: string;
  isPublic?: boolean;
  metadata?: Record<string, unknown>;
  expiresAt: string;
}

export interface RegisteredUploadFile {
  fileKeyId: string;
  accessKey: string;
  status: string;
}

export interface ProductionUploadBatchResult {
  mode: "production";
  files: (PreparedUploadFile & { registration: RegisteredUploadFile | null })[];
  registerResponse: {
    success: true;
    fileKeys: RegisteredUploadFile[];
  };
}

export interface DevelopmentUploadBatchResult {
  mode: "development";
  files: PreparedUploadFile[];
  stream: ReadableStream<Uint8Array>;
  response: Response;
}

export type RegisterUploadBatchResult =
  | ProductionUploadBatchResult
  | DevelopmentUploadBatchResult;

function stripTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function isAbsoluteUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const registeredUploadFileSchema = z.object({
  fileKeyId: z.string(),
  accessKey: z.string(),
  status: z.string(),
});

const registerResponseBodySchema = z.object({
  success: z.literal(true),
  fileKeys: z.array(registeredUploadFileSchema),
  projectSlug: z.string().min(1),
});

function parseRegisterResponseBody(value: unknown): {
  success: true;
  fileKeys: RegisteredUploadFile[];
  projectSlug: string;
} {
  const parsed = registerResponseBodySchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Unexpected register response shape: ${parsed.error.message}`);
  }
  return parsed.data;
}

function createDefaultAccessKey(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

function resolveProtocol(apiBaseUrl: string, protocol?: "http" | "https"): "http" | "https" {
  if (protocol) return protocol;
  return apiBaseUrl.startsWith("http://") ? "http" : "https";
}

function requireAbsoluteCallbackUrl(value: string): string {
  if (!isAbsoluteUrl(value)) {
    throw new Error(
      "callbackUrl must be an absolute URL in sdk-core. Resolve origin/path in your framework adapter.",
    );
  }
  return value;
}

export function createSiloCore(config: UploadCoreConfig) {
  const baseUrl = stripTrailingSlash(config.apiBaseUrl);
  const fetchImpl = config.fetch ?? fetch;
  const resolvedKeyId = config.keyId ?? config.apiKey.slice(0, 11);

  async function registerUploadBatch(
    input: RegisterUploadBatchInput,
  ): Promise<RegisterUploadBatchResult> {
    if (input.files.length === 0) {
      throw new Error("registerUploadBatch requires at least one file");
    }
    if (input.dev === true && input.files.length > 1) {
      throw new Error(
        "Dev SSE registration currently supports a single file per request. Call registerUploadBatch once per file when dev=true.",
      );
    }

    const protocol = resolveProtocol(baseUrl, input.protocol);
    const expiresIn = input.expiresIn ?? 3600;

    const preparedFilesWithoutUrl: (
      Omit<PreparedUploadFile, "uploadUrl"> & {
        uploadUrl?: string;
      }
    )[] = [];
    for (const file of input.files) {
      const fileKeyId = file.fileKeyId ?? nanoid(16);
      const accessKey = file.accessKey ?? createDefaultAccessKey();
      preparedFilesWithoutUrl.push({
        fileKeyId,
        accessKey,
        fileName: file.fileName,
        size: file.size,
        hash: file.hash,
        mimeType: file.mimeType,
        isPublic: file.isPublic,
        metadata: file.metadata,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
      });
    }

    const registerBody: Record<string, unknown> = {
      environmentId: config.environmentId,
      fileKeys: preparedFilesWithoutUrl.map((file) => ({
        fileKeyId: file.fileKeyId,
        accessKey: file.accessKey,
        fileName: file.fileName,
        size: file.size,
        mimeType: file.mimeType,
        hash: file.hash,
        isPublic: file.isPublic,
        metadata: file.metadata,
      })),
      metadata: input.requestMetadata,
      dev: input.dev === true,
    };

    if (!input.dev) {
      const callbackUrlInput = input.callbackUrl ?? config.callbackUrl;
      if (!callbackUrlInput) {
        throw new Error(
          "Missing callbackUrl for production upload registration. Provide callbackUrl in createSiloCore config or per request.",
        );
      }
      const callbackUrl = requireAbsoluteCallbackUrl(callbackUrlInput);
      registerBody.callbackUrl = callbackUrl;
      registerBody.callbackMetadata = input.callbackMetadata ?? {};
    }

    const response = await fetchImpl(`${baseUrl}/api/v1/upload/register`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(registerBody),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Upload register request failed (${response.status}): ${text || response.statusText}`,
      );
    }

    const contentType = response.headers.get("content-type") ?? "";

    async function signPreparedFiles(projectSlug: string): Promise<PreparedUploadFile[]> {
      const preparedFiles: PreparedUploadFile[] = [];
      for (const file of preparedFilesWithoutUrl) {
        const uploadUrl = await generateSignedUploadUrlWithSecret(
          config.ingestServer,
          projectSlug,
          {
            environmentId: config.environmentId,
            fileKeyId: file.fileKeyId,
            accessKey: file.accessKey,
            fileName: file.fileName,
            size: file.size,
            hash: file.hash,
            mimeType: file.mimeType,
            isPublic: file.isPublic,
            keyId: resolvedKeyId,
            expiresIn,
            protocol,
          },
          config.signingSecret,
        );
        preparedFiles.push({
          ...file,
          uploadUrl,
        });
      }
      return preparedFiles;
    }

    if (contentType.includes("text/event-stream")) {
      if (!response.body) {
        throw new Error("Register returned an SSE response without a readable body");
      }
      const projectSlug = response.headers.get("x-silo-project-slug");
      if (!projectSlug) {
        throw new Error(
          "Register SSE response is missing x-silo-project-slug header.",
        );
      }
      const preparedFiles = await signPreparedFiles(projectSlug);
      return {
        mode: "development",
        files: preparedFiles,
        stream: response.body,
        response,
      };
    }

    const parsedJson = parseRegisterResponseBody(await response.json());
    const preparedFiles = await signPreparedFiles(parsedJson.projectSlug);
    const byFileKeyId = new Map(parsedJson.fileKeys.map((item) => [item.fileKeyId, item]));
    return {
      mode: "production",
      registerResponse: parsedJson,
      files: preparedFiles.map((file) => ({
        ...file,
        registration: byFileKeyId.get(file.fileKeyId) ?? null,
      })),
    };
  }

  async function prepareUpload(input: PrepareUploadInput) {
    const result = await registerUploadBatch({
      ...input,
      files: [input.file],
    });

    const firstFile = result.files[0];
    if (!firstFile) {
      throw new Error("prepareUpload failed to produce file metadata");
    }

    if (result.mode === "development") {
      return {
        mode: "development" as const,
        file: firstFile,
        stream: result.stream,
        response: result.response,
      };
    }

    return {
      mode: "production" as const,
      file: firstFile,
      registerResponse: result.registerResponse,
    };
  }

  return {
    registerUploadBatch,
    prepareUpload,
  };
}

export type UploadCore = ReturnType<typeof createSiloCore>;

export function createSiloCoreFromToken(
  input: CreateSiloCoreFromTokenInput,
): UploadCore {
  const parsed = parseSiloToken(input.token);

  return createSiloCore({
    apiBaseUrl: input.url,
    apiKey: parsed.apiKey,
    environmentId: parsed.environmentId,
    ingestServer: parsed.ingestServer,
    signingSecret: parsed.signingSecret,
    callbackUrl: input.callbackUrl,
    fetch: input.fetch,
  });
}
