import type { Context } from "hono";

import type { Bindings, Variables } from "../../types/bindings";
import type { DeletePrefixQueueMessage } from "../../services/r2/delete-prefix";
import { HTTP_STATUS } from "../../utils/constants";

interface DeletePrefixRequestBody {
  prefix?: string;
}

export async function handleInternalDeletePrefix(
  c: Context<{ Bindings: Bindings; Variables: Variables }>,
): Promise<Response> {
  const body = await c.req.json<DeletePrefixRequestBody>();
  const { prefix } = body;

  if (!prefix) {
    return c.json({ error: "prefix is required" }, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const deletePrefixQueue: {
      send(message: DeletePrefixQueueMessage): Promise<void>;
    } = c.env.DELETE_PREFIX_QUEUE;
    const message: DeletePrefixQueueMessage = {
      prefix,
      requestId: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
    };
    await deletePrefixQueue.send(message);

    return c.json(
      {
        success: true,
        accepted: true,
        requestId: message.requestId,
        prefix,
      },
      HTTP_STATUS.ACCEPTED,
    );
  } catch (error) {
    console.error("Delete prefix enqueue failed:", error);
    return c.json(
      { error: "Failed to delete files by prefix" },
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
    );
  }
}
