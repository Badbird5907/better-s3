import {
  getNextAttemptNumber,
  getWebhookTargetForEvent,
  recordWebhookAttempt,
  shouldRetryAttempt,
  signWebhookPayload,
} from "@silo/api/services";
import { db } from "@silo/db/client";
import { handleCallback } from "@vercel/queue";
import { queuedWebhookMessageSchema } from "@silo/api/services";

import { env } from "@/env";

interface QueueMetadata {
  messageId?: string;
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
      return;
    }

    try {
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
        return;
      }

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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const retry = shouldRetryAttempt(attemptNumber, maxAttempts);
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
      if (retry) throw error;
    }
  },
);
