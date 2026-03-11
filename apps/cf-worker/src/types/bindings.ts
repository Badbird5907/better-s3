import type { DeletePrefixQueueMessage } from "../services/r2/delete-prefix";

export interface Bindings {
  R2_BUCKET: R2Bucket;
  PROJECT_CACHE: KVNamespace;
  TUS_STATE_DO: DurableObjectNamespace;
  DELETE_PREFIX_QUEUE: {
    send(message: DeletePrefixQueueMessage): Promise<void>;
  };

  WORKER_DOMAIN: string;
  NEXTJS_CALLBACK_URL: string;
  CALLBACK_SECRET: string;
  SIGNING_SECRET: string;
  TUS_MAX_SIZE: string;
  TUS_EXPIRATION_HOURS: string;
}

export interface Variables {
  projectSlug: string | null;
  projectId: string;
  defaultFileAccess: "public" | "private";
}
