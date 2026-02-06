import type { MiddlewareHandler } from "hono";

import type { Bindings, Variables } from "../types/bindings";
import { Errors } from "../utils/errors";

export const requireCallbackSecret: MiddlewareHandler<{
  Bindings: Bindings;
  Variables: Variables;
}> = async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw Errors.unauthorized("Missing Authorization header");
  }

  const token = authHeader.slice(7);

  if (token !== c.env.CALLBACK_SECRET) {
    throw Errors.unauthorized("Invalid callback secret");
  }

  await next();
};

export async function verifyDownloadSignature(params: {
  accessKey: string;
  signature: string;
  expiresAt: string;
  signingSecret: string;
}): Promise<boolean> {
  try {
    const payload: Record<string, string> = {
      accessKey: params.accessKey,
      expiresAt: params.expiresAt,
    };

    const sortedKeys = Object.keys(payload).sort();
    const message = sortedKeys.map((key) => `${key}=${payload[key]}`).join("&");

    const encoder = new TextEncoder();
    const keyData = encoder.encode(params.signingSecret);
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
    const expectedSignature = signatureArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return timingSafeEqual(params.signature, expectedSignature);
  } catch (error) {
    console.error("Signature verification failed:", error);
    return false;
  }
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
