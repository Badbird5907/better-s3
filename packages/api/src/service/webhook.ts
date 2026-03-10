import { send } from "@vercel/queue";
import type { Db } from "@silo/db/client";
import { eq } from "@silo/db";
import { projectEnvironments, webhookAttempts } from "@silo/db/schema";
import type { UploadEventEnvelope } from "@silo/shared";
import { z } from "zod";

const WEBHOOK_TOPIC = "upload-webhooks";
const DEFAULT_MAX_ATTEMPTS = 8;

interface WebhookEnvironmentConfig {
  id: string;
  type: "development" | "staging" | "production";
  webhookEnabled: boolean;
  webhookUrl: string | null;
  webhookSecret: string | null;
  webhookEvents: string[];
}
export const queuedWebhookMessageSchema = z.object({
  idempotencyKey: z.string(),
  environmentId: z.string(),
  projectId: z.string(),
  maxAttempts: z.number().int().positive().optional(),
  event: z.object({
    id: z.string(),
    type: z.string(),
    version: z.literal(1),
    occurredAt: z.string(),
    data: z.unknown(),
  }),
});


function environmentAllowsEvent(
  environment: WebhookEnvironmentConfig,
  eventType: string,
) {
  if (environment.type !== "production") return false;
  if (!environment.webhookEnabled) return false;
  if (!environment.webhookUrl || !environment.webhookSecret) return false;
  if (environment.webhookEvents.length === 0) return true;
  return environment.webhookEvents.includes(eventType);
}


export async function enqueueUploadWebhookEvent(
  db: Db,
  input: {
    environmentId: string;
    projectId: string;
    event: UploadEventEnvelope;
    idempotencyKey?: string;
    maxAttempts?: number;
  },
) {
  const env = await db.query.projectEnvironments.findFirst({
    where: eq(projectEnvironments.id, input.environmentId),
    columns: {
      id: true,
      type: true,
      webhookEnabled: true,
      webhookUrl: true,
      webhookSecret: true,
      webhookEvents: true,
    },
  });

  if (!env) {
    return { enqueued: false as const, reason: "environment_not_found" as const };
  }

  const normalizedEnvironment: WebhookEnvironmentConfig = {
    ...env,
    webhookEvents: Array.isArray(env.webhookEvents)
      ? (env.webhookEvents as string[])
      : [],
  };

  if (!environmentAllowsEvent(normalizedEnvironment, input.event.type)) {
    return { enqueued: false as const, reason: "not_configured" as const };
  }

  // Preserve local dev flow (SSE/polling) without requiring queue infra.
  if (process.env.NODE_ENV !== "production") {
    return { enqueued: false as const, reason: "local_noop" as const };
  }

  if (process.env.WEBHOOK_DELIVERY_ENABLED === "false") {
    return { enqueued: false as const, reason: "delivery_disabled" as const };
  }

  await send(
    WEBHOOK_TOPIC,
    {
      idempotencyKey: input.idempotencyKey ?? input.event.id,
      environmentId: input.environmentId,
      projectId: input.projectId,
      maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      event: input.event,
    } satisfies z.infer<typeof queuedWebhookMessageSchema>,
  );

  return { enqueued: true as const };
}

export async function getWebhookTargetForEvent(
  db: Db,
  input: {
    environmentId: string;
    eventType: string;
  },
) {
  const environment = await db.query.projectEnvironments.findFirst({
    where: eq(projectEnvironments.id, input.environmentId),
    columns: {
      type: true,
      webhookEnabled: true,
      webhookUrl: true,
      webhookSecret: true,
      webhookEvents: true,
    },
  });

  if (!environment) return null;

  const normalizedEnvironment: WebhookEnvironmentConfig = {
    ...environment,
    id: input.environmentId,
    webhookEvents: Array.isArray(environment.webhookEvents)
      ? (environment.webhookEvents as string[])
      : [],
  };

  if (!environmentAllowsEvent(normalizedEnvironment, input.eventType)) {
    return null;
  }

  return {
    webhookUrl: normalizedEnvironment.webhookUrl,
    webhookSecret: normalizedEnvironment.webhookSecret,
  };
}

export async function recordWebhookAttempt(
  db: Db,
  input: typeof webhookAttempts.$inferInsert,
) {
  console.log("recording webhook attempt", input);
  await db.insert(webhookAttempts).values(input);
}

export async function getNextAttemptNumber(
  db: Db,
  eventId: string,
) {
  const [lastAttempt] = await db.query.webhookAttempts.findMany({
    where: eq(webhookAttempts.eventId, eventId),
    orderBy: (attempts, { desc: byDesc }) => [byDesc(attempts.attemptNumber)],
    limit: 1,
  });
  return (lastAttempt?.attemptNumber ?? 0) + 1;
}

export function isRetriableWebhookStatus(status: number) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

export function shouldRetryAttempt(
  attemptNumber: number,
  maxAttempts: number,
  status?: number,
): boolean {
  if (attemptNumber >= maxAttempts) return false;
  if (status === undefined) return true;
  return isRetriableWebhookStatus(status);
}

export async function signWebhookPayload(
  payload: string,
  secret: string,
  timestamp: number = Math.floor(Date.now() / 1000),
) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${payload}`),
  );
  const digest = Array.from(new Uint8Array(signed))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return {
    timestamp,
    signature: `t=${timestamp},v1=${digest}`,
  };
}
