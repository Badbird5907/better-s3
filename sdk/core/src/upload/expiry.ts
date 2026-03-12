import { z } from "zod";

export type FileExpiryInput =
  | {
      ttlSeconds: number;
    }
  | {
      expiresAt: string | Date | null;
    };

export interface UpdateFileExpiryInput {
  projectId: string;
  fileKeyId: string;
  environmentId?: string;
  ttlSeconds?: number;
  expiresAt?: string | Date | null;
}

export interface UpdateFileExpiryResult {
  id: string;
  projectId: string;
  environmentId: string;
  accessKey: string;
  fileName: string;
  status: string;
  expiresAt: string | null;
  updatedAt: string;
}

export const updateFileExpiryResultSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  environmentId: z.string(),
  accessKey: z.string(),
  fileName: z.string(),
  status: z.string(),
  expiresAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
});

function normalizeExpiresAtInput(value: string | Date | null): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

export function applyFileExpiryToRegisterBody(
  registerBody: Record<string, unknown>,
  fileExpiry?: FileExpiryInput,
): void {
  if (!fileExpiry) {
    return;
  }

  registerBody.fileExpiry =
    "ttlSeconds" in fileExpiry
      ? { ttlSeconds: fileExpiry.ttlSeconds }
      : { expiresAt: normalizeExpiresAtInput(fileExpiry.expiresAt) };
}

export function createUpdateFileExpiryRequestBody(
  input: UpdateFileExpiryInput,
  defaultEnvironmentId: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    projectId: input.projectId,
    environmentId: input.environmentId ?? defaultEnvironmentId,
  };

  if (input.ttlSeconds !== undefined && input.expiresAt !== undefined) {
    throw new Error("Provide either ttlSeconds or expiresAt, not both.");
  }
  if (input.ttlSeconds === undefined && input.expiresAt === undefined) {
    throw new Error("Provide ttlSeconds or expiresAt.");
  }

  if (input.ttlSeconds !== undefined) {
    body.ttlSeconds = input.ttlSeconds;
  } else if (input.expiresAt !== undefined) {
    body.expiresAt = normalizeExpiresAtInput(input.expiresAt);
  }

  return body;
}
