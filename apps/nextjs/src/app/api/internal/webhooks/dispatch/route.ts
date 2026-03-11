import {
  getNextAttemptNumber,
  getWebhookTargetForEvent,
  recordWebhookAttempt,
  shouldRetryAttempt,
  signWebhookPayload,
} from "@silo-storage/api/services";
import { and, eq } from "@silo-storage/db";
import { db } from "@silo-storage/db/client";
import { fileKeys } from "@silo-storage/db/schema";
import { handleCallback } from "@vercel/queue";
import { queuedWebhookMessageSchema } from "@silo-storage/api/services";

import { env } from "@/env";

interface QueueMetadata {
  messageId?: string;
}

function getCallbackUrlFromUnknown(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  const callbackUrl = (value as Record<string, unknown>).callbackUrl;
  return typeof callbackUrl === "string" && callbackUrl.length > 0
    ? callbackUrl
    : null;
}

export const POST = handleCallback(async (rawQueueMessage, metadata) => {
    const parsed = queuedWebhookMessageSchema.safeParse(rawQueueMessage);
    if (!parsed.success) {
      throw new Error("Invalid webhook queue message payload");
    }
    const queueMessage = parsed.data;
    const queueMetadata = metadata as QueueMetadata | undefined;

    if (!env.WEBHOOK_DELIVERY_ENABLED) {
      return;
    }

    const startedAt = Date.now();
    const attemptNumber = await getNextAttemptNumber(db, queueMessage.event.id);
    const maxAttempts = queueMessage.maxAttempts ?? 8;
    const target = await getWebhookTargetForEvent(db, {
      environmentId: queueMessage.environmentId,
      eventType: queueMessage.event.type,
    });
    const fileKeyId =
      queueMessage.event.data &&
      typeof queueMessage.event.data === "object" &&
      !Array.isArray(queueMessage.event.data)
        ? (queueMessage.event.data as Record<string, unknown>).fileKeyId
        : undefined;
    const fileKey =
      typeof fileKeyId === "string"
        ? await db.query.fileKeys.findFirst({
            where: and(
              eq(fileKeys.id, fileKeyId),
              eq(fileKeys.projectId, queueMessage.projectId),
            ),
            columns: {
              callbackMetadata: true,
            },
          })
        : null;
    const callbackUrl = getCallbackUrlFromUnknown(fileKey?.callbackMetadata);
    const payload = JSON.stringify(queueMessage.event);

    const webhookUrl = target?.webhookUrl;
    const webhookSecret = target?.webhookSecret;
    if (!webhookUrl || !webhookSecret) {
      await recordWebhookAttempt(db, {
        eventId: queueMessage.event.id,
        idempotencyKey: queueMessage.idempotencyKey,
        queueMessageId: queueMetadata?.messageId,
        environmentId: queueMessage.environmentId,
        projectId: queueMessage.projectId,
        attemptNumber,
        status: "failed",
        requestUrl: webhookUrl ?? "missing",
        error: "Missing webhook URL or secret",
        latencyMs: Date.now() - startedAt,
      });
      if (!callbackUrl) {
        return;
      }
    }

    try {
      if (webhookUrl && webhookSecret) {
        const signed = await signWebhookPayload(payload, webhookSecret);
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "silo-webhooks/1.0",
            "X-Silo-Webhook-Id": queueMessage.idempotencyKey,
            "X-Silo-Event-Type": queueMessage.event.type,
            "X-Silo-Event-Version": String(queueMessage.event.version),
            "X-Silo-Signature": signed.signature,
            "X-Silo-Timestamp": String(signed.timestamp),
          },
          body: payload,
        });

        const responseBody = (await response.text().catch(() => "")).slice(0, 2000);
        const latencyMs = Date.now() - startedAt;
        if (response.ok) {
          await recordWebhookAttempt(db, {
            eventId: queueMessage.event.id,
            idempotencyKey: queueMessage.idempotencyKey,
            queueMessageId: queueMetadata?.messageId,
            environmentId: queueMessage.environmentId,
            projectId: queueMessage.projectId,
            attemptNumber,
            status: "success",
            requestUrl: webhookUrl,
            responseStatus: response.status,
            responseBody,
            latencyMs,
          });
        } else {
          const retry = shouldRetryAttempt(
            attemptNumber,
            maxAttempts,
            response.status,
          );
          await recordWebhookAttempt(db, {
            eventId: queueMessage.event.id,
            idempotencyKey: queueMessage.idempotencyKey,
            queueMessageId: queueMetadata?.messageId,
            environmentId: queueMessage.environmentId,
            projectId: queueMessage.projectId,
            attemptNumber,
            status: retry ? "retry" : "failed",
            requestUrl: webhookUrl,
            responseStatus: response.status,
            responseBody,
            error: `HTTP ${response.status}`,
            latencyMs,
          });
          if (retry) {
            throw new Error(`Retryable webhook response: ${response.status}`);
          }
        }
      }

      if (callbackUrl) {
        try {
          const callbackResponse = await fetch(callbackUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "silo-webhooks/1.0",
              "X-Silo-Webhook-Id": queueMessage.idempotencyKey,
              "X-Silo-Event-Type": queueMessage.event.type,
              "X-Silo-Event-Version": String(queueMessage.event.version),
            },
            body: payload,
          });

          if (!callbackResponse.ok) {
            const callbackBody = (
              await callbackResponse.text().catch(() => "")
            ).slice(0, 2000);
            console.error("Callback URL delivery failed", {
              eventId: queueMessage.event.id,
              callbackUrl,
              status: callbackResponse.status,
              body: callbackBody,
            });
          }
        } catch (callbackError) {
          console.error("Callback URL delivery errored", {
            eventId: queueMessage.event.id,
            callbackUrl,
            error:
              callbackError instanceof Error
                ? callbackError.message
                : String(callbackError),
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const retry = shouldRetryAttempt(attemptNumber, maxAttempts);
      if (webhookUrl && webhookSecret) {
        await recordWebhookAttempt(db, {
          eventId: queueMessage.event.id,
          idempotencyKey: queueMessage.idempotencyKey,
          queueMessageId: queueMetadata?.messageId,
          environmentId: queueMessage.environmentId,
          projectId: queueMessage.projectId,
          attemptNumber,
          status: retry ? "retry" : "failed",
          requestUrl: webhookUrl,
          error: errorMessage,
          latencyMs: Date.now() - startedAt,
        });
      }
      if (retry) throw error;
    }
  },
);
