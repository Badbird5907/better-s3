import { generateSignedUploadUrlWithSecret } from "./signing";
import { nanoid } from "nanoid";
import { z } from "zod";

export interface UploadCoreConfig {
  apiBaseUrl: string;
  apiKey: string;
  projectId: string;
  environmentId: string;
  projectSlug: string;
  ingestServer: string;
  keyId: string;
  signingSecret: string;
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
});

function parseRegisterResponseBody(value: unknown): {
  success: true;
  fileKeys: RegisteredUploadFile[];
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

    const preparedFiles: PreparedUploadFile[] = [];
    for (const file of input.files) {
      const fileKeyId = file.fileKeyId ?? nanoid(16);
      const accessKey = file.accessKey ?? createDefaultAccessKey();
      const uploadUrl = await generateSignedUploadUrlWithSecret(
        config.ingestServer,
        config.projectSlug,
        {
          environmentId: config.environmentId,
          fileKeyId,
          accessKey,
          fileName: file.fileName,
          size: file.size,
          hash: file.hash,
          mimeType: file.mimeType,
          isPublic: file.isPublic,
          keyId: config.keyId,
          expiresIn,
          protocol,
        },
        config.signingSecret,
      );

      preparedFiles.push({
        fileKeyId,
        accessKey,
        uploadUrl,
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
      projectId: config.projectId,
      environmentId: config.environmentId,
      fileKeys: preparedFiles.map((file) => ({
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
    if (contentType.includes("text/event-stream")) {
      if (!response.body) {
        throw new Error("Register returned an SSE response without a readable body");
      }
      return {
        mode: "development",
        files: preparedFiles,
        stream: response.body,
        response,
      };
    }

    const parsedJson = parseRegisterResponseBody(await response.json());
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
